# Vio — Multi-Sponsor Architecture Redesign

**Status**: Design document, pre-implementation.
**Audience**: Backend team, iOS SDK team, Kotlin SDK team, Dashboard team.
**Last updated**: 2026-04-22.

This document defines the target architecture for Vio's multi-sponsor model. It consolidates the backend, dashboard, iOS SDK, Kotlin SDK (new), and TV SDK variants so everyone builds against one contract.

---

## 0. Resolved decisions (locked before Phase 1)

These are final as of 2026-04-22. Any change from here requires an explicit doc update.

| # | Decision | Choice |
|---|---|---|
| 1 | SDK config endpoint versioning | **Flip to `/v2/sdk/config`** with new shape; `/v1/sdk/config` is deprecated and retired in Phase 8. No parallel window. |
| 2 | Kotlin SDK repo | **Separate repo** (not monorepo with iOS). |
| 3 | Mixpanel project key | **Dual sourcing**: host app provides their own in local config. Vio has a default fallback project key for partners who don't. |
| 4 | Commerce → Vio sync of keys / payment methods | **Manual** initial entry by operator + **webhook** from Commerce for subsequent updates. |
| 5 | Reachu legacy | **100% out**. No backfill of `users.reachu_user_id` or `reachu_*` columns. Column and concept removed cleanly in Phase 4. End-users re-register via new `ensure_user` flow. |
| 6 | `broadcasts.engagement_enabled` default | **false**. Operator opts in explicitly per broadcast. |
| 7 | Apple TV SDK repo | **Separate repo `InteractiveAds-vio` (`VioTVSDK`)** — not part of `VioSwiftSDK`. tvOS-only, shoppable_ad-only. |
| 8 | TV SDK bootstrap | Single combined `POST /api/sdk/tv/broadcast/subscribe` (validate + session + sponsors in one call). Soft-miss when broadcast not registered for the client_app. |

**Implication of decision 5** (Reachu fully out): the old end-user identifier flow (`reachu_user_id` varchar) is abandoned. Historical `poll_votes`, `contest_participations`, `device_tokens` rows that reference old string IDs remain but are not bridged into the new user model. New flows use the `external_user_id` provided by partner at SDK init, resolved into an `end_users` row (see §2.3).

---

## 1. Context & Motivation

Vio today supports a single sponsor per campaign. Real use cases require:

- **Primary sponsor** — owns the campaign visually; drives engagement (polls, contests); has a Commerce catalog
- **Secondary sponsors** — multiple brands co-exist in the same campaign; appear in shoppable ads and component placements (carousels, banners) without owning engagement
- **TV SDKs** (Apple TV, Android TV) — same auth as mobile but distinct flows and triggers
- **Commerce integration per sponsor** — each sponsor is a distinct merchant in Commerce, with its own API key and product catalog
- **Attribution chain** — we need to correlate a shoppable_ad dispatch in TV → cart_intent on mobile → purchase

The current data model has the right bones (`campaign_sponsors` M:N exists, `sponsors` has `commerce_api_key`) but legacy columns (`campaigns.reachu_api_key`, `client_apps.reachu_api_key`, `reachu_user_id`), duplicated keys, and unused code paths make it inconsistent. This redesign consolidates.

---

## 2. Domain Model

### 2.1 Core entities

```
User
 └── ClientApp (host app — Viaplay, TV2, …)
      └── Campaign (time-bounded commercial unit)
           ├── primary_sponsor (FK NOT NULL, immutable after creation)
           ├── secondary_sponsors (M:N via campaign_sponsors)
           ├── Broadcasts (individual live events)
           │    └── Polls / Contests / Chat (engagement)
           └── Components / Placements (UI surfaces)
                ├── persistent (campaign_components)
                └── scheduled (scheduled_components)

Sponsor (independent entity, tenant of the User)
 ├── branding: name, logoUrl, primaryColor, secondaryColor
 └── commerce: commerce_api_key, commerce_channel_id, payment_methods

Cross-cutting
 ├── tv_sessions — live state of a TV app instance
 ├── shoppable_ad_activations — persisted dispatch log (already implemented)
 ├── cart_intents — user interaction log (new, replaces fire-and-forget)
 └── device_tokens — APNs/FCM, unchanged
```

### 2.2 Key concepts

**Primary sponsor** (1 per campaign, mandatory):
- Set at campaign creation, **cannot be changed** afterwards (enforced at endpoint level)
- Provides default branding for the campaign
- Runs engagement (polls, contests) — their logo shows by default on polls/contests unless overridden
- Has their own `commerce_api_key` in `sponsors` table if commerce features are enabled
- Can trigger shoppable ads

**Secondary sponsor** (0..N per campaign):
- Added/removed from the Sponsors tab of a campaign's dashboard
- Can trigger shoppable ads in TV
- Can be assigned as the sponsor of individual components (carousels, banners)
- Can co-sponsor individual polls/contests (overrides primary's branding on that item)
- Visual-only secondaries (no commerce key) also allowed

**Placement** (= an assignment of a component to a slot in a host app):
- Developer declares slots in the host app (e.g. "hero", "sidebar", "engagement-product-slot")
- Operator assigns a component to a slot for a specific campaign via `campaign_components`
- Each placement has ONE sponsor (primary or any secondary)
- Placements can optionally be scoped to a specific broadcast (`broadcast_id` nullable)

**Engagement**:
- A broadcast has engagement when `engagement_enabled=true` AND has polls/contests assigned
- Engagement is controlled at broadcast level (opt-in per broadcast)
- The primary sponsor brands engagement by default; individual polls/contests can override

**Flow A — Shoppable ad (TV)**:
Operator selects a product for a broadcast → backend fires WebSocket event → TV SDK shows popup → user clicks remote → TV SDK posts cart_intent → backend persists + routes to mobile app via WS or partner webhook/APNs → mobile SDK opens Commerce checkout.

**Flow B — Engagement product placement** (scheduled):
A commerce-coupled component (e.g. `product_carousel`) is scheduled to appear in the mobile app's engagement zone at minute X of a broadcast. Sponsor is selected when the component is configured. Requires the broadcast to have engagement enabled.

---

## 3. Data Model Changes

### 3.1 New tables

```sql
-- TV session tracking (per TV app instance per user)
CREATE TABLE tv_sessions (
  id              SERIAL PRIMARY KEY,
  client_app_id   INTEGER NOT NULL REFERENCES client_apps(id) ON DELETE CASCADE,
  user_id         INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  tv_device_id    VARCHAR(255),              -- optional, SDK-generated
  platform        VARCHAR(20) NOT NULL,      -- 'apple-tv' | 'android-tv'
  started_at      TIMESTAMP NOT NULL DEFAULT now(),
  last_seen_at    TIMESTAMP NOT NULL DEFAULT now(),
  ended_at        TIMESTAMP,
  UNIQUE (client_app_id, user_id, platform)  -- 1 active session per (app, user, platform)
);
CREATE INDEX idx_tv_sessions_user_seen ON tv_sessions (user_id, last_seen_at DESC);

-- Cart intent log (previously fire-and-forget, now persisted)
CREATE TABLE cart_intents (
  id                    SERIAL PRIMARY KEY,
  user_id               INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  campaign_id           INTEGER NOT NULL REFERENCES campaigns(id) ON DELETE CASCADE,
  client_app_id         INTEGER NOT NULL REFERENCES client_apps(id) ON DELETE CASCADE,
  tv_session_id         INTEGER REFERENCES tv_sessions(id) ON DELETE SET NULL,
  sponsor_id            INTEGER REFERENCES sponsors(id) ON DELETE SET NULL,
  product_id            VARCHAR(255) NOT NULL,              -- external Commerce id
  source_activation_id  INTEGER REFERENCES shoppable_ad_activations(id) ON DELETE SET NULL,
  source_component_id   INTEGER REFERENCES campaign_components(id) ON DELETE SET NULL,
  delivery_mode         VARCHAR(20) NOT NULL,               -- 'websocket' | 'dual' | 'webhook' | 'apns' | 'dropped'
  user_connected        BOOLEAN NOT NULL,
  envelope              JSONB NOT NULL,                     -- v1 notification envelope
  metadata              JSONB,
  triggered_at          TIMESTAMP NOT NULL DEFAULT now()
);
CREATE INDEX idx_cart_intents_campaign_time ON cart_intents (campaign_id, triggered_at DESC);
CREATE INDEX idx_cart_intents_user_time ON cart_intents (user_id, triggered_at DESC);
CREATE INDEX idx_cart_intents_source_activation ON cart_intents (source_activation_id);
CREATE INDEX idx_cart_intents_sponsor ON cart_intents (sponsor_id);
```

### 3.2 Modified tables

```sql
-- campaigns: rename and restructure
ALTER TABLE campaigns
  ADD COLUMN primary_sponsor_id INTEGER REFERENCES sponsors(id) ON DELETE RESTRICT,
  DROP COLUMN reachu_api_key,        -- legacy, was shadowing sponsors.commerce_api_key
  DROP COLUMN reachu_channel_id,     -- legacy, was unused at runtime
  DROP COLUMN payment_methods;       -- moves to sponsors (each merchant has its own)

-- After data migration (see §9), make primary_sponsor_id NOT NULL:
ALTER TABLE campaigns
  ALTER COLUMN primary_sponsor_id SET NOT NULL;

-- campaigns.sponsor_id (legacy) stays for migration window, then drops.
-- Existing unique on campaign_id not needed; RESTRICT prevents accidental deletion of primary.


-- client_apps: remove legacy + add TV support
ALTER TABLE client_apps
  DROP COLUMN reachu_api_key,              -- legacy, unused server-side
  ADD COLUMN tv_enabled BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN tv_platforms TEXT[] DEFAULT '{}';  -- ['apple-tv', 'android-tv']


-- CLARIFICATION: current `users` table = dashboard OPERATORS (they own campaigns,
-- client_apps, sponsors via user_id FKs). End-users (viewers of broadcasts) live
-- separately in new `end_users` table, identified by (client_app_id, external_user_id).
--
-- Reachu is fully retired (decision #5): users.reachu_user_id is dropped without
-- backfill. Operators remain identified by their own users.id + email/name.

CREATE TABLE end_users (
  id                SERIAL PRIMARY KEY,
  client_app_id     INTEGER NOT NULL REFERENCES client_apps(id) ON DELETE CASCADE,
  external_user_id  VARCHAR(255) NOT NULL,
  first_seen_at     TIMESTAMP NOT NULL DEFAULT now(),
  last_seen_at      TIMESTAMP NOT NULL DEFAULT now(),
  metadata          JSONB,
  UNIQUE (client_app_id, external_user_id)
);
CREATE INDEX idx_end_users_last_seen ON end_users (client_app_id, last_seen_at DESC);

-- Tables that previously stored user identity as varchar migrate to FK → end_users.id:
--   poll_votes.user_id              VARCHAR → end_user_id INTEGER FK
--   contest_participations.user_id  VARCHAR → end_user_id INTEGER FK
--   device_tokens.user_id           VARCHAR → end_user_id INTEGER FK
-- NO backfill of old varchar values — historical rows stay orphan or are deleted
-- with the feature branch cleanup (decision #5, reachu 100% out).

-- users table — operators only, legacy column removed:
ALTER TABLE users DROP COLUMN reachu_user_id;


-- sponsors: add payment_methods (moved from campaigns)
ALTER TABLE sponsors
  ADD COLUMN payment_methods JSONB NOT NULL DEFAULT '[]';
-- Values like ["card", "klarna", "vipps"]. Delivered in the /v1/sdk/config response.


-- campaign_sponsors: simplified (drop role column)
ALTER TABLE campaign_sponsors
  DROP COLUMN role;
-- Semantics: a row here means "sponsor X is a SECONDARY of campaign Y".
-- The primary is on campaigns.primary_sponsor_id (never appears here).


-- campaign_components: add sponsor + broadcast scope
ALTER TABLE campaign_components
  ADD COLUMN sponsor_id INTEGER REFERENCES sponsors(id) ON DELETE RESTRICT,
  ADD COLUMN broadcast_id VARCHAR(255) REFERENCES broadcasts(broadcast_id) ON DELETE CASCADE;
-- sponsor_id NOT NULL, default = campaign's primary at insert
-- broadcast_id NULL = placement active for the whole campaign
-- broadcast_id set = placement scoped to that broadcast only


-- scheduled_components: add sponsor
ALTER TABLE scheduled_components
  ADD COLUMN sponsor_id INTEGER REFERENCES sponsors(id) ON DELETE RESTRICT;


-- polls / contests: add sponsor
ALTER TABLE polls
  ADD COLUMN sponsor_id INTEGER REFERENCES sponsors(id) ON DELETE RESTRICT;
ALTER TABLE contests
  ADD COLUMN sponsor_id INTEGER REFERENCES sponsors(id) ON DELETE RESTRICT;


-- broadcasts: engagement opt-in
ALTER TABLE broadcasts
  ADD COLUMN engagement_enabled BOOLEAN NOT NULL DEFAULT false;


-- All new sponsor_id FK columns: default to campaign's primary_sponsor_id at insert.
-- Backend validates on insert/update that the chosen sponsor is either:
--   - the campaign's primary_sponsor_id, OR
--   - present in campaign_sponsors for that campaign.
-- 400 Bad Request if neither.
```

### 3.3 Legacy columns retired

| Table | Column | Replaced by |
|---|---|---|
| `campaigns` | `reachu_api_key` | `sponsors[primary].commerce_api_key` |
| `campaigns` | `reachu_channel_id` | `sponsors[primary].commerce_channel_id` |
| `campaigns` | `payment_methods` | `sponsors.payment_methods` (per sponsor) |
| `campaigns` | `sponsor_id` | `campaigns.primary_sponsor_id` |
| `client_apps` | `reachu_api_key` | Removed entirely (never referenced server-side) |
| `users` | `reachu_user_id` | **Dropped entirely** — operators identified by `users.id` + email; end-users live in new `end_users` table |
| `poll_votes`, `contest_participations`, `device_tokens` | `user_id VARCHAR` | `end_user_id INTEGER FK → end_users(id)` |
| `campaign_sponsors` | `role` | Removed (presence = secondary; role is implicit) |

### 3.4 Enums and conventions

- `tv_sessions.platform ∈ {'apple-tv', 'android-tv'}`
- `shoppable_ad_activations.source ∈ {'admin-api', 'dashboard', 'tv-sdk', 'slot-scheduler'}`
- `cart_intents.delivery_mode ∈ {'websocket', 'dual', 'webhook', 'apns', 'dropped'}`
- Sponsor validation rule: any sponsor FK must resolve to either `campaigns.primary_sponsor_id` OR be listed in `campaign_sponsors` for that campaign. Enforced at endpoint layer.

---

## 4. Endpoints

Organized by audience and auth.

### 4.1 Dashboard API (Session auth)

**Unchanged**: users/auth, client-apps, sponsors CRUD, broadcasts CRUD, polls/contests CRUD, events, objects, lineups, analytics.

**Changed / new for multi-sponsor**:

| Endpoint | Change |
|---|---|
| `POST /api/campaigns` | `sponsorId` field renamed to `primarySponsorId`, NOT NULL. Rejects request if missing. |
| `PATCH /api/campaigns/:id` | Rejects changes to `primarySponsorId` with 403 if any row already exists that references the campaign (broadcasts, polls, activations, cart_intents). |
| `GET /api/campaigns/:id/secondary-sponsors` | List secondary sponsors for a campaign. |
| `POST /api/campaigns/:id/secondary-sponsors` | Body: `{ sponsorId }`. Adds sponsor to `campaign_sponsors`. Validates not primary. |
| `DELETE /api/campaigns/:id/secondary-sponsors/:sponsorId` | Removes from campaign_sponsors. Fails (409) if active components reference it. |
| `POST /api/campaigns/:id/components` | New required field: `sponsorId`. Must match primary or an existing secondary. Accepts optional `broadcastId` for broadcast-scoped placements. |
| `PATCH /api/campaigns/:id/components/:id` | Can update `sponsorId`; same validation. |
| `POST /api/broadcasts/:id/polls` | New optional `sponsorId`; defaults to campaign primary if null at insert. |
| `POST /api/broadcasts/:id/contests` | Same as polls. |
| `PATCH /api/broadcasts/:id` | Adds `engagementEnabled` toggle. |
| `GET /api/broadcasts/:id/shoppable-ads` | Existing; shoppable_ad_activations list. |
| `GET /api/broadcasts/:id/cart-intents` | New; list cart_intents for a broadcast (attribution debug). |

### 4.2 Admin API (Bearer JWT, prefix `/v1/*`)

Broadcasts / Polls / Contests — unchanged.

`POST /api/broadcasts/:id/shoppable-ad` (admin-api source) — unchanged except sponsor validation.

### 4.3 SDK API (API Key auth)

**Mobile SDK (iOS/Android/Kotlin)**:

| Endpoint | Method | Purpose |
|---|---|---|
| `GET /v1/sdk/config` | GET | Bootstrap: active campaign, primary sponsor, secondary sponsors, each with commerce block |
| `GET /v1/sdk/broadcasts/:broadcastId/capabilities` | GET | Per-broadcast capabilities (`engagement`, `shoppable`, `lineup`) |
| `GET /v1/sdk/broadcasts/:broadcastId/components` | GET | Active component placements for this broadcast (campaign + broadcast-scoped merged). Each carries sponsor_id + config |
| `GET /v1/sdk/broadcasts/:broadcastId/polls` | GET | Polls for the broadcast, each with its sponsor |
| `GET /v1/sdk/broadcasts/:broadcastId/contests` | GET | Contests |
| `POST /v1/sdk/engagement/poll-vote` | POST | Vote on a poll |
| `POST /v1/sdk/engagement/contest-participate` | POST | Join a contest |
| `POST /api/campaigns/:campaignId/cart-intent` | POST | **Updated**: accepts optional `activationId` for attribution chain. Now persists a cart_intents row |
| `POST /api/campaigns/:campaignId/register-device` | POST | Register APNs/FCM token, unchanged |

**TV SDK** (separate path for TV-specific behaviour):

| Endpoint | Method | Purpose |
|---|---|---|
| **`POST /api/sdk/tv/broadcast/subscribe`** | POST | **Primary bootstrap — the TV SDK uses this.** One-shot that replaces config+capabilities+session/start. Body: `{ broadcastId, externalUserId, platform, tvDeviceId? }`. Validates the partner-provided `broadcastId` against Vio's DB for this client_app; ensures `end_users`; upserts `tv_sessions`; returns campaign + primary/secondary sponsors (with commerce blocks) + `wsUrl` + capabilities. Soft-miss returns 200 with `{ subscribed: false, reason }` (`broadcast_not_registered_for_client_app` / `campaign_has_no_primary_sponsor` / `tv_not_enabled_for_this_platform`) so the SDK can silently skip. |
| `POST /api/sdk/tv/session/start` | POST | Register a TV session without binding to a broadcast. Kept as a building block; most hosts use `/subscribe`. |
| `POST /api/sdk/tv/session/heartbeat` | POST | Updates `last_seen_at` on the session |
| `POST /api/sdk/tv/session/end` | POST | Marks session ended |
| `POST /api/sdk/tv/broadcasts/:broadcastId/shoppable-ad` | POST | Triggers a shoppable_ad dispatch (source=`tv-sdk`). Rare from a real Apple TV device; mostly for automation. |
| `POST /api/sdk/tv/cart-intent` | POST | TV-originated cart intent. **v2 minimal body**: `{ externalUserId, productId, activationId }` — the backend derives `campaignId` + `sponsorId` from `shoppable_ad_activations[activationId]`. Legacy body with explicit `{ campaignId, sponsorId, platform }` still accepted for ad-hoc callers (no upstream activation). Persists `cart_intents` with `source_activation_id = activationId` **and forwards the envelope to the user's mobile** via the same delivery tree as `/api/campaigns/:id/cart-intent` (local WS → Redis cluster → partner webhook → APNs). The persisted row records the actual `delivery_mode`. |
| `GET /api/sdk/tv/broadcasts/:broadcastId/capabilities` | GET | Same as mobile `capabilities` but filtered for TV (no engagement UI on TV; only shoppable) |

### 4.4 `/v1/sdk/config` response shape (final)

```jsonc
{
  "endpoints": {
    "webSocketBase": "wss://api-dev.vio.live",
    "commerceGraphQL": "https://graph-ql-dev.vio.live"
  },

  "campaign": {
    "id": 35,
    "name": "Mars 2026",
    "logo": "...",
    "isActive": true,
    "isPaused": false,
    "startDate": "2026-03-01T00:00:00Z",
    "endDate": "2026-04-13T00:00:00Z"
  },

  "primarySponsor": {
    "id": 3,
    "name": "Elkjøp",
    "avatarUrl": "...",   // square brand mark — used in the overlay / product card
    "logoUrl": "...",     // wide horizontal logo — used for sponsor intros / full-screen branding
    "primaryColor": "#…",
    "secondaryColor": "#…",
    "commerce": {
      "apiKey": "KCXF10Y-…",
      "channelId": null,
      "paymentMethods": ["card", "klarna", "vipps"]
    }
  },

  "secondarySponsors": [
    {
      "id": 4,
      "name": "Torshov Sport",
      "avatarUrl": "...",
      "logoUrl": "...",
      "primaryColor": "#…",
      "commerce": {
        "apiKey": "T0RSH0V-…",
        "channelId": null,
        "paymentMethods": ["card"]
      }
    },
    {
      "id": 99,
      "name": "Visual-Only Sponsor",
      "avatarUrl": "...",
      "logoUrl": "...",
      "commerce": null     // null = branding only, no purchase flow
    }
  ],

  "features": {
    "engagement": true,   // campaign-level flag (derived from active broadcasts)
    "shoppable": true,
    "lineup": true
  }
}
```

**Removed from current response**: `sdkVersion`, `clientApp.*` (already local), `endpoints.restBase`, `theme.*`, `markets`, `campaign.paymentMethods` (moved to sponsors), `commerce.*` at top-level (replaced by per-sponsor block).

### 4.5 `/v1/sdk/broadcasts/:broadcastId/capabilities` response

```jsonc
{
  "broadcastId": "paris-saint-germain-vs-chelsea-2026-03-11",
  "campaignId": 35,
  "engagement": {
    "enabled": true,
    "hasPolls": true,
    "hasContests": false
  },
  "shoppable": {
    "enabled": true
  },
  "lineup": {
    "available": true
  }
}
```

SDK uses this to decide whether to open the WebSocket and which subsystems to boot.

### 4.6 `/v1/sdk/broadcasts/:broadcastId/components` response

```jsonc
{
  "broadcastId": "…",
  "components": [
    {
      "id": 42,
      "campaignComponentId": 42,
      "type": "product_carousel",
      "locationId": "hero",
      "sponsor": {
        "id": 4,
        "name": "Torshov Sport",
        "logoUrl": "...",
        "primaryColor": "#…"
      },
      "commerce": {
        "apiKey": "T0RSH0V-…",     // copied from sponsor for convenience
        "channelId": null
      },
      "config": {
        "productIds": ["123", "456", "789"],
        "layout": "horizontal"
      }
    }
  ]
}
```

The SDK resolves products directly from Commerce GraphQL using `commerce.apiKey` from the component (model d3 as discussed).

---

## 5. WebSocket events

### 5.1 Existing events (with changes)

`shoppable_ad` — payload now carries `activationId` (attribution) + `sponsorId` top-level
(commerce-key routing for the SDK) + the full sponsor block including `avatarUrl`:

```jsonc
{
  "type": "shoppable_ad",
  "broadcastId": "...",
  "campaignId": 35,
  "sponsorId": 3,        // top-level — SDK resolves commerce key via sponsor(forSponsorId:)
  "product": { "id", "name", "price", "currency", "imageUrl" },
  "sponsor": {
    "id": 3,
    "name": "Elkjøp",
    "avatarUrl": "...", // square brand mark — what the overlay renders
    "logoUrl":   "...", // wide logo — sponsor intros / full-screen
    "primaryColor": "#f7b23b"
  },
  "activationId": 42,
  "slotId": 7,          // only if triggered by a pre-configured slot
  "timestamp": 1745123456789
}
```

**Avatar validation** — `persistAndBroadcastShoppableAd` rejects (HTTP 422,
`SPONSOR_MISSING_AVATAR`) any dispatch whose sponsor has `avatar_url IS NULL`. The SDK
can therefore treat `sponsor.avatarUrl` as effectively non-null on this event type.

`cart_intent` — unchanged envelope (v1), but now triggered by persistence-first endpoint.

### 5.2 New events

`engagement_component_schedule` (optional, for future):
```jsonc
{
  "type": "engagement_component_schedule",
  "broadcastId": "...",
  "campaignComponentId": 42,
  "sponsor": { ... },
  "action": "show" | "hide"
}
```

Low priority — can be replaced by SDK polling `/components` every X seconds. Document it so Kotlin dev knows the option.

### 5.3 Multi-node fan-out

Already implemented: `ws:events:forward` Redis channel distributes events between nodes. Each node reads and delivers to local clients. No changes needed.

---

## 6. Core flows

### 6.1 Campaign creation

```
Operator in Dashboard (new-campaign form)
  ├── Name, dates, description, logo
  ├── ClientApp (required)
  └── Primary Sponsor (required — select from sponsors this User owns)

Backend: POST /api/campaigns
  ├── Validate primary_sponsor_id belongs to the same User
  ├── INSERT campaign (primary_sponsor_id NOT NULL set)
  └── Return campaign with primary sponsor info embedded

Dashboard → redirects to Campaign Dashboard
  ├── Sponsors tab: operator can now add secondary sponsors
  └── Components tab: add placements with sponsor picker
```

### 6.2 Add secondary sponsor

```
Operator in Campaign Dashboard → Sponsors tab → "Add Secondary Sponsor"
  ├── Select sponsor from dropdown (all User's sponsors, excluding primary)

Backend: POST /api/campaigns/:id/secondary-sponsors
  ├── Validate sponsor ≠ primary_sponsor_id
  ├── Validate sponsor not already in campaign_sponsors
  ├── INSERT into campaign_sponsors (just campaign_id + sponsor_id)
  └── Return updated list
```

### 6.3 Add a placement with sponsor

```
Operator in Campaign Dashboard → Components tab → "Add Component"
  ├── Pick component type (banner, carousel, etc.)
  ├── Pick sponsor (primary or any secondary)
  ├── If commerce-coupled: pick products from sponsor's Commerce catalog
  ├── Pick slot (locationId)
  └── Optional: scope to specific broadcast

Backend: POST /api/campaigns/:id/components
  ├── Validate sponsor is primary or secondary of this campaign
  ├── INSERT campaign_components (with sponsor_id, optional broadcast_id)
  └── Return the placement

SDK at render time:
  ├── GET /v1/sdk/broadcasts/:broadcastId/components
  ├── For each component: use commerce.apiKey to fetch products from Commerce GraphQL
  └── Render with sponsor branding
```

### 6.4 Scheduled component (engagement-zone product placement)

Same as 6.3 but with a `scheduledTime` + `endTime`, and optionally a `broadcast_id` to scope to a specific broadcast. The scheduler (`server/scheduler.ts`) fires the component at the right moment.

```
Operator: Scheduled tab → "Schedule Component"
  ├── Pick component (pre-configured or inline)
  ├── Pick sponsor (primary or secondary)
  ├── Pick scheduledTime (video timestamp)
  ├── Optional: endTime
  └── Optional: locationId like "engagement-product-slot"

Backend persists row in campaign_components (with scheduled_time).
scheduler.ts fires at the right time → WS event to SDK → SDK renders.
```

### 6.5 TV SDK startup (single-round-trip via `/broadcast/subscribe`)

The Apple TV SDK consolidates config + capabilities + session into **one call**.
The host passes the partner-internal `broadcastId` it already knows; Vio
validates tenant + TV enablement and returns everything the SDK needs.

```
Host app (Viaplay Apple TV / TV2 Apple TV) launches Vio TV SDK
  ├── VioTV.configureFromBundle(userIdOverride: "tv2_demo_user")
  │       ↓ reads vio-config.json — only apiKey + userId (no commerceApiKey)
  └── VioTV.connect(broadcastId: "tv2-eliteserien-live-2026-03-08")
          ↓
SDK → POST /api/sdk/tv/broadcast/subscribe
  body: {
    broadcastId: "tv2-eliteserien-live-2026-03-08",
    externalUserId: "tv2_demo_user",
    platform: "apple-tv",
    tvDeviceId: "<real device id if available, else SDK-generated UUID>"
  }
  headers: X-Api-Key: <client_app.apiKey>

Backend — single block:
  ├── validateApiKey middleware                   → resolves client_app
  ├── storage.getBroadcast(broadcastId)           → does Vio have this broadcast?
  ├── broadcast.campaign.clientAppId = clientApp.id ?
  │     → no: 200 { subscribed: false, reason: 'broadcast_not_registered_for_client_app' }
  ├── campaign.primarySponsorId                   ? no: 200 { subscribed:false, reason:'campaign_has_no_primary_sponsor' }
  ├── clientApp.tvEnabled && platform in clientApp.tvPlatforms ?
  │     → no: 200 { subscribed:false, reason:'tv_not_enabled_for_this_platform' }
  ├── storage.ensureEndUser(clientApp.id, externalUserId) → end_users row
  ├── storage.upsertTvSession(…)                  → one row per (app,user,platform)
  ├── buildSponsorBlock(primarySponsorId) + listSecondarySponsors()
  └── Return 200 {
         subscribed: true,
         campaignId, broadcastId, sessionId, endUserId,
         wsUrl: "wss://api-local-angelo.vio.live/ws/<campaignId>",
         primarySponsor: { id, name, logoUrl, colors,
           commerce: { apiKey, channelId, paymentMethods } | null },
         secondarySponsors: [ { … }, … ],
         capabilities: { shoppable, engagement }
       }

SDK on success:
  ├── Cache sessionId + sponsor list for per-sponsor commerce client resolution
  ├── Open WebSocket at wsUrl; send { type: "identify", userId: externalUserId }
  ├── Start 60s heartbeat → POST /api/sdk/tv/session/heartbeat { sessionId }
  └── Listen for `shoppable_ad` WS events (see §5)

SDK on soft-miss (subscribed: false):
  └── Silent no-op. Host app sees no error.
      Optional `onSubscriptionFailed(reason)` callback available for hosts that
      want to surface it in their own logs / UI.
```

### 6.6 Shoppable ad dispatch (Flow A)

Already implemented, 4 entry points persisting to `shoppable_ad_activations`:

| Source | Entry point | Auth |
|---|---|---|
| `admin-api` | `POST /api/broadcasts/:id/shoppable-ad` | Bearer JWT |
| `dashboard` | `POST /api/broadcasts/:id/trigger-shoppable-ad` | Session (implicit) |
| `slot-scheduler` | `POST /api/broadcasts/:id/sponsor-slots/:slotId/execute` | Session |
| `tv-sdk` | `POST /api/sdk/tv/broadcasts/:id/shoppable-ad` | API Key |

All pass through `persistAndBroadcastShoppableAd()` helper → INSERT activation → broadcast WS → return `activationId`.

**Validation update**: reject if `sponsorId` not primary or secondary of campaign. Currently not validated.

### 6.7 Cart intent + attribution chain

```
Step 1: Backend dispatches shoppable_ad (operator / scheduler / TV / admin)
  → persistAndBroadcastShoppableAd() writes shoppable_ad_activations (activationId)
  → WS event on the campaign channel:
     { type: 'shoppable_ad', activationId: 42, product, sponsor, … }

Step 2: TV SDK receives WS event
  → VioTVWebSocketManager decodes ShoppableAdEvent (now with activationId + sponsorId)
  → SDK stores activationId + sponsorId in memory
  → VioTVShoppableOverlay renders the product + sponsor branding

Step 3: User presses OK on the remote
  SDK → POST /api/sdk/tv/cart-intent
  v2 minimal body (backend resolves campaignId + sponsorId from activationId):
  {
    externalUserId: "demo_user_001",
    productId: "408841",
    activationId: 42      ← attribution link AND context anchor
  }
  Legacy / ad-hoc callers may still pass campaignId + sponsorId explicitly.
  headers: X-Api-Key: <client_app.apiKey>

Step 4: Backend processes (persist AND forward)
  ├── When activationId present: getShoppableAdActivation(42)
  │     → derive campaignId + sponsorId (if not sent explicitly)
  │     → reject if activation.clientAppId doesn't match the API key
  ├── ensureEndUser(client_app, externalUserId) → end_users.id
  ├── getActiveTvSession(client_app, endUser, platform) → tv_session_id
  ├── Resolve product name via Commerce (best-effort, for push title)
  ├── Build envelope v1 (vio_payload carries activation_id, sponsor_id)
  ├── Decide delivery tree (same as /api/campaigns/:id/cart-intent):
  │   ├── mobile WS connected locally   → send WS         → 'websocket' (or 'dual')
  │   ├── mobile WS on another node     → Redis Pub/Sub   → 'websocket' (or 'dual')
  │   ├── client_app.webhookUrl set     → POST webhook    → 'webhook'
  │   ├── APNs device token registered  → direct APNs     → 'apns'
  │   └── else                          → drop            → 'dropped'
  ├── INSERT cart_intents:
  │     { endUserId, campaignId, clientAppId, tvSessionId, sponsorId,
  │       productId,
  │       source_activation_id = 42,   ← closes the TV→Mobile→Purchase chain
  │       delivery_mode, user_connected,
  │       envelope }
  └── Return 200 { success, cartIntentId, mode, userConnected, envelope }

Step 5: Mobile app receives the envelope (WS / webhook push / APNs)
  → VioSwiftSDK.CartIntentEvent.parse() decodes activation_id + sponsor_id
    from vio_payload (v2 — see VioSwiftSDK/Documentation/CART_INTENT_FLOW.md)
  → CampaignManager.publishCartIntentIfChanged() dedups by activationId so
    the dual-delivery (WS + webhook/APNs) doesn't open two overlays
  → CartIntentProductDetailHost renders, passing sponsorId to ProductService
  → ProductService.loadProduct uses CommerceSdkClientProvider.client(forSponsorId:)
    so a secondary sponsor's product hydrates from that sponsor's channel,
    not the primary's
  → VProductDetailOverlay sheet opens with Apple Pay
  → User completes purchase
  → (future) Commerce webhook → Vio closes the row → full attribution
```

### 6.8 Impression tracking (Mixpanel)

Not persisted in Vio DB. SDK batches directly to Mixpanel.

**Events**:

| Event | When | Properties |
|---|---|---|
| `placement_impression` | SDK renders a component | `campaign_id, broadcast_id, sponsor_id, component_type, product_ids` |
| `placement_click` | User taps/clicks a product in a component | same + `product_id, action` |
| `shoppable_ad_shown` | TV SDK shows the popup | `activation_id, campaign_id, broadcast_id, sponsor_id, product_id` |
| `shoppable_ad_dismissed` | User ignores the popup | `activation_id, duration_ms` |
| `cart_intent_sent` | SDK POSTs cart_intent | `cart_intent_id, activation_id` (when known) |
| `engagement_interaction` | User votes on a poll / joins contest | `poll_id / contest_id, sponsor_id` |

Mixpanel project key lives in the host app's local config (not delivered by our backend for now).

---

## 7. SDK design

### 7.1 iOS SDK (existing, needs changes)

Repo: `VioSwiftSDK` (branch `develop`). Swift Package, 8 targets.

**Required changes**:

1. **`SdkBootstrapResponse` model** (`Sources/VioCore/Models/CampaignModels.swift`): rewrite to match new `/v1/sdk/config` shape with `primarySponsor + secondarySponsors`.

2. **`CommerceSdkClientProvider`** (`Sources/VioCore/Sdk/Core/GraphQL/`): support multiple client instances (one per sponsor with commerce). Provide a method `clientForSponsor(id: Int) -> SdkClient?`.

3. **`VioConfiguration`**: store the full sponsor list and per-sponsor commerce clients. Expose helpers:
   - `primarySponsor() -> Sponsor`
   - `secondarySponsors() -> [Sponsor]`
   - `sponsor(id:) -> Sponsor?`
   - `commerceClient(forSponsor:) -> SdkClient?`

4. **Component rendering**: every rendering path (`VProductCarousel`, `VProductSpotlight`, `VProductBanner`, etc.) must use the commerce client of the component's sponsor, not a global one.

5. **`VioRuntime.setUserContext(userId:)`**: signature stays, but internally the user-id is the `externalUserId` passed to session endpoints.

6. **Cart intent call**: when TV SDK fires cart_intent, pass `activationId` (stored in memory since the WS event).

7. **TV session endpoints**: add client methods for `/api/sdk/tv/session/start`, `/heartbeat`, `/end`.

8. **Mixpanel events**: ensure `placement_impression`, `placement_click`, `shoppable_ad_shown`, `cart_intent_sent` are emitted from the right places.

### 7.2 Kotlin SDK (new, needs to be built)

Target: same public surface as iOS SDK. Modules mirror Swift:

| Swift target | Kotlin module |
|---|---|
| `VioNetwork` | `vio-network` (Apollo Kotlin or Ktor) |
| `VioCore` | `vio-core` |
| `VioDesignSystem` | `vio-design-system` |
| `VioUI` | `vio-ui` (Compose UI) |
| `VioEngagementSystem` | `vio-engagement-system` |
| `VioEngagementUI` | `vio-engagement-ui` |
| `VioCastingUI` | `vio-casting-ui` |
| `VioTesting` | `vio-testing` |

**Platform variants**: Android phone, Android tablet, Android TV. Use `@OptIn(PlatformSpecific::class)` or flavor-specific source sets for TV-only code.

**Public API** — mirror iOS exactly:
```kotlin
// Initialization
VioConfiguration.configure(apiKey = "...", environment = Development)

// Session
VioRuntime.setUserContext(userId = "externalUserId")
VioRuntime.startSession(broadcastId = "...")

// Rendering (via Compose)
@Composable
fun MyScreen() {
  VioEngagementSurface(broadcastId = "...")
  VioPlacementSlot(slotId = "hero")
}
```

**TV-specific on Android TV**:
- `VioTVRuntime.registerTVSession(externalUserId, tvDeviceId)` → calls `/api/sdk/tv/session/start`
- `VioTVRuntime.onRemotePress(product)` → calls `/api/sdk/tv/cart-intent` with `activationId` from memory

### 7.3 TV SDK contract (shared Apple TV + Android TV)

Both platforms expose same minimal API:

```
TV SDK
 ├── configure(apiKey, userId, environment)  or  configureFromBundle()
 ├── connect(broadcastId)   → POST /api/sdk/tv/broadcast/subscribe
 │    ├── { subscribed: true }  → cache sponsors, open WS, send identify, start heartbeat
 │    └── { subscribed: false } → silent no-op, optional onSubscriptionFailed(reason)
 ├── onShoppableAdReceived(payload):   // WS event
 │    ├── store activationId + sponsorId + product in memory
 │    └── render popup (product info + sponsor branding)
 ├── onUserConfirm():   // remote OK / tap
 │    └── POST /api/sdk/tv/cart-intent
 │         body: { externalUserId, productId, campaignId, activationId, sponsorId, platform }
 │         → backend persists cart_intents + forwards envelope to mobile
 ├── heartbeat() every 60s → POST /api/sdk/tv/session/heartbeat { sessionId }
 └── disconnect() → close WS, stop heartbeat, POST /api/sdk/tv/session/end
```

### 7.4 Apple TV SDK — `VioTVSDK` (separate repo `InteractiveAds-vio`)

Swift Package isolated from `VioSwiftSDK`. Platform gate: tvOS 17+ only (macOS 12+ just for tests). **Shoppable_ad only** — no polls/contests/lineup/chat.

| Module | Role |
|---|---|
| `VioTVCore` | `VioTVConfiguration`, `VioTVConfigurationLoader`, `VioTVWebSocketManager`, session lifecycle, `VioTVManager` (cart-intent sender + `activeAd` state), models (`ShoppableAdEvent`, `ShoppableProduct`, sponsor types) |
| `VioTVCommerce` | `VioTVCommerceService` — fetches products from Commerce GraphQL; accepts a per-sponsor `commerceApiKey` by call (no global singleton) |
| `VioTVUI` | `VioTVShoppableOverlay` + product card. Observes `VioTVManager.shared.activeAd`, triggers cart-intent through the manager |
| `VioTV` | Thin public facade: `configure`, `configureFromBundle`, `connect(broadcastId:)`, `disconnect`, `onCartIntent`, `onSubscriptionFailed(reason)` |

**`vio-config.json` (minimal)**:
```json
{
  "apiKey": "<client_app.apiKey>",
  "userId": "<optional default>",
  "broadcastId": "<optional — used by bare VioTV.connect()>",
  "environment": "development"
}
```
The JSON key `broadcastId` matches `broadcasts.broadcast_id` in this backend — it was
previously aliased as `contentId` in early SDK drafts and was renamed for consistency.
Notably **no `commerceApiKey`** — all commerce keys arrive from
`/api/sdk/tv/broadcast/subscribe` response (`primarySponsor.commerce.apiKey` +
`secondarySponsors[].commerce.apiKey`).

**Host integration (minimum viable)**:
```swift
import VioTV

@main struct TV2App: App {
    init() {
        try? VioTV.configureFromBundle(userIdOverride: "tv2_demo_user")
        VioTV.onCartIntent = { productId in analytics.track("cart_intent_sent", ["pid": productId]) }
        VioTV.onSubscriptionFailed = { reason in logger.debug("Vio skipped broadcast: \(reason)") }
    }
    var body: some Scene { WindowGroup { ContentView() } }
}

// When entering a broadcast:
VioTV.connect(broadcastId: "tv2-eliteserien-live-2026-03-08")

// When leaving:
VioTV.disconnect()
```

Everything else (subscribe, WS, identify, heartbeat, overlay, cart-intent, commerce hydration) is handled inside the SDK.

---

## 8. Dashboard changes

### 8.1 `new-campaign` form

- Add `primarySponsorId` as **required** field (dropdown of User's sponsors)
- Remove `paymentMethods` field (moved to sponsors)
- Validation: client-side (disable submit) + server-side (400)

### 8.2 `campaign-dashboard` — Sponsors tab

Currently placeholder. Build:
- Section 1: **Primary Sponsor** — read-only, shows name, logo, commerce badge. Note: "Cannot be changed after creation."
- Section 2: **Secondary Sponsors** — list with name, logo, "Has Commerce" indicator, action buttons (remove)
- "Add Secondary Sponsor" button → modal with dropdown of User's sponsors (excluding primary + already-added)
- Warning when trying to remove a secondary that has active components/slots (409 from backend)

### 8.3 `campaign-dashboard` — Components tab

Currently asks `{componentId, instanceName, locationId}`. Extend:
- **Sponsor dropdown** — primary + secondaries
- If commerce-coupled component type: **Products picker** filtered to sponsor's Commerce catalog (backend endpoint `/api/commerce/products?sponsorId=X`)
- **Broadcast scope** radio: "All broadcasts" (broadcast_id null) vs "Specific broadcast" (dropdown)
- **Preview** area showing sponsor's logo + colors

### 8.4 `campaign-dashboard` — Scheduled tab

Same component creation UX as 8.3, plus `scheduledTime` + `endTime` pickers and Timeline view.

### 8.5 `broadcast-detail` — Sponsor Moments panel

Already well-designed. Confirm sponsor dropdown shows primary + secondaries.

### 8.6 `campaign-dashboard` — Settings tab

- Remove `reachuApiKey` / `reachuChannelId` legacy inputs
- Remove `paymentMethods` input
- Keep engagement / shoppable feature flags (if any)

### 8.7 `campaign-dashboard` — Integrations tab

Currently shows legacy commerce fields. After cleanup: empty / unused. Move its content:
- `webhookUrl` / `partnerDeviceRegisterUrl` → up to **client-apps** page (they're app-level, not campaign-level, per user)
- **TV enabled flag** + platforms → up to client-apps page
- **Mixpanel project key** → lives in the host app's local config file (not in our backend)

After this migration, Integrations tab can be removed or repurposed.

### 8.8 `sponsors` page

- Add **payment_methods** multi-select input (`card`, `klarna`, `vipps`, etc.)
- Existing fields stay: name, logos, colors, commerce_api_key, commerce_channel_id

### 8.9 `client-apps` page

New sections:
- **TV Enabled**: toggle + multi-select platforms (apple-tv, android-tv)
- **Partner Integrations**: `webhookUrl`, `partnerDeviceRegisterUrl` (moved from campaign IntegrationsTab)

---

## 9. Migration plan

Ordered, non-destructive-first. Each phase is independently deployable.

### Phase 1 — Schema additions (non-breaking)

```
1. Add new tables: tv_sessions, cart_intents
2. Add nullable columns on existing tables:
     campaigns.primary_sponsor_id (nullable for now)
     client_apps.tv_enabled, tv_platforms
     users.external_user_id, users.client_app_id
     campaign_components.sponsor_id, broadcast_id
     scheduled_components.sponsor_id
     polls.sponsor_id, contests.sponsor_id
     broadcasts.engagement_enabled
     sponsors.payment_methods (default '[]')
3. Deploy: no runtime change yet.
```

### Phase 2 — Data migration

Run scripts (`scripts/migrate-phase2-*.ts`) in order:

```
1. Backfill users.external_user_id = reachu_user_id
   users.client_app_id = (lookup first campaign for this user's reachuUserId,
                          or the most common client_app_id from poll_votes rows)
   — caveat: some rows may be ambiguous; run a dry-run report first

2. Backfill campaigns.primary_sponsor_id = campaigns.sponsor_id
   For the 2 campaigns where sponsor_id is null (XXL-TV2), assign a placeholder
   sponsor or delete (already cleaned).

3. Backfill sponsors.payment_methods from campaigns.payment_methods
   (pick the primary sponsor; if same sponsor is primary of multiple
   campaigns with different payment_methods, log conflict and let operator resolve)

4. Backfill campaign_components.sponsor_id = campaigns.primary_sponsor_id
   (existing components have no sponsor concept; default to primary)

5. Backfill scheduled_components.sponsor_id = campaigns.primary_sponsor_id
6. Backfill polls.sponsor_id, contests.sponsor_id = broadcasts.campaign_id.primary_sponsor_id
7. Backfill broadcasts.engagement_enabled = (broadcast has ≥1 poll or contest)
8. Backfill client_apps.tv_enabled = false (default; operator enables per app)
```

Each script: dry-run mode default, `--yes` to execute, report of rows modified.

### Phase 3 — Enforce NOT NULL

```
1. ALTER TABLE campaigns ALTER COLUMN primary_sponsor_id SET NOT NULL
2. ALTER TABLE users ALTER COLUMN external_user_id SET NOT NULL
3. ALTER TABLE users ALTER COLUMN client_app_id SET NOT NULL
4. ALTER TABLE campaign_components ALTER COLUMN sponsor_id SET NOT NULL
5. ALTER TABLE scheduled_components ALTER COLUMN sponsor_id SET NOT NULL
6. ALTER TABLE polls ALTER COLUMN sponsor_id SET NOT NULL
7. ALTER TABLE contests ALTER COLUMN sponsor_id SET NOT NULL
8. ADD CONSTRAINT users_client_app_external UNIQUE (client_app_id, external_user_id)
```

### Phase 4 — Backend logic changes

In a deployable slice:
- Rename all references of `campaigns.sponsorId` → `campaigns.primarySponsorId` in storage, routes, DTOs
- Update `/v1/sdk/config` to new response shape (MINOR version bump for SDK contract)
- Implement `/v1/sdk/broadcasts/:id/capabilities`
- Implement `/v1/sdk/broadcasts/:id/components` with sponsor-per-component
- Implement `/api/sdk/tv/session/start`, `/heartbeat`, `/end`
- Implement `/api/sdk/tv/cart-intent`
- Update `/api/campaigns/:id/cart-intent` to persist `cart_intents` row and accept `activationId`
- Implement `/api/campaigns/:id/secondary-sponsors` CRUD
- Add sponsor validation to: polls, contests, components, shoppable_ad triggers
- Update `persistAndBroadcastShoppableAd` to reject unassociated sponsors
- Helper `ensureUser(clientAppId, externalUserId) → users.id`
- Block `PATCH /api/campaigns/:id` changes to `primarySponsorId` once any child row references the campaign

### Phase 5 — Dashboard changes

- `new-campaign`: make primary sponsor required
- `campaign-dashboard`: build Sponsors tab (primary read-only + secondaries CRUD)
- `ComponentsTab`: add sponsor dropdown + product picker
- `ScheduledTab`: idem
- `IntegrationsTab` → cleanup, move fields to client-apps page
- `sponsors` page: add `payment_methods`
- `client-apps` page: add TV section + partner integrations section

### Phase 6 — iOS SDK update (breaking, minor version)

- Rewrite `SdkBootstrapResponse` to new shape
- Multi-commerce-client support
- Propagate sponsor per component on render
- TV session endpoints
- Cart-intent carries `activationId`
- Release as minor version (0.3.0) with migration notes for Viaplay/TV2

### Phase 7 — Kotlin SDK implementation

- Mirror iOS API surface exactly
- Support Android phone + Android TV
- Publish to Maven / Artifactory

### Phase 8 — Legacy drops

Only once all clients (dashboard, iOS SDK, Kotlin SDK) no longer reference them:

```
DROP COLUMN campaigns.sponsor_id          (replaced by primary_sponsor_id)
DROP COLUMN campaigns.reachu_api_key
DROP COLUMN campaigns.reachu_channel_id
DROP COLUMN campaigns.payment_methods
DROP COLUMN client_apps.reachu_api_key
DROP COLUMN users.reachu_user_id
DROP COLUMN campaign_sponsors.role
```

### Phase 9 — Test data population

Populate feature DB branch with representative data so SDKs can integrate:

- 1 Viaplay campaign with Elkjøp primary + Torshov + 1 visual-only secondary
- 1 TV2 campaign with Elkjøp primary + 1 secondary
- Per campaign: 2 broadcasts, 1 with engagement enabled
- Per engagement-enabled broadcast: 2 polls (one branded by primary, one by secondary), 1 contest
- Per campaign: 3 components (1 product_carousel sponsored by primary, 1 by secondary, 1 banner visual-only)
- Per broadcast: 2 shoppable_ad pre-configured slots (one per sponsor)
- APNs test tokens + some cart_intents

Script: `scripts/seed-multi-sponsor-demo.ts`.

---

## 10. Testing strategy

### 10.1 Integration tests (Jest)

- Auth matrix per endpoint (session / Bearer / API key / missing / invalid)
- Multi-sponsor validation: reject sponsor outside campaign's primary + secondaries
- Primary sponsor immutability: reject PATCH after child rows exist
- Cart intent attribution: dispatch ad → post cart-intent with activationId → verify `source_activation_id` persisted
- TV session upsert: same (user, app, platform) creates 1 row + updates last_seen_at
- Ensure-user: new externalUserId creates users row; existing returns same id
- Tenant isolation: sponsors from User A cannot be used in campaign of User B

### 10.2 E2E flows

- Full "TV ad → mobile purchase" chain with real Neon DB branch
- Dashboard: create campaign → add secondaries → add components with per-sponsor products → verify `/v1/sdk/config` output

### 10.3 SDK contract tests

- JSON schema for `/v1/sdk/config` response — versioned, breaking changes gated
- Tests in iOS SDK that decode fixture responses
- Tests in Kotlin SDK that decode same fixtures

### 10.4 Load / scale

- Mixpanel handles impression volume; verify DB load on `cart_intents` is bounded (only writes on user click, <100 rps expected peak)

---

## 11. Open questions / future scope

**In-scope open questions** (flag these during implementation):

1. **Commerce webhook schema**: resolved that updates arrive via webhook (decision #4). Exact shape + auth of that webhook is out of this doc's scope — document in a Commerce integration doc.
2. **Kotlin SDK module split decision**: Compose-only vs fragment-compatible. Kotlin team to decide during Phase 7.
3. **TV session timeout**: cron every 5min marking sessions ended after 2h of no `last_seen_at` — nice-to-have, not blocking.

**Out of scope** (future features):

- **Chat**: not built yet, will need `chat_messages.sponsor_id` when it is
- **A/B testing placements**: currently (c1) one component per slot; if we add A/B, `campaign_components` gains a `variant` column
- **Poll/contest co-sponsorship**: today 1 sponsor per poll; if needed, a `poll_co_sponsors` join table
- **Component-level feature flags**: none today; add when a use case appears
- **Commerce webhook → Vio** for purchase attribution closure (after cart_intent)
- **Analytics dashboard views** for cart_intents + impressions join

---

## 12. Glossary

| Term | Definition |
|---|---|
| **Primary sponsor** | The single required sponsor of a campaign. Immutable after creation. Brands engagement by default. |
| **Secondary sponsor** | A sponsor added to a campaign via `campaign_sponsors`. Can be commerce-enabled or visual-only. |
| **Placement** | A row in `campaign_components` — a component assignment to a slot (optionally scoped to a broadcast) with a specific sponsor. |
| **Activation** | A row in `shoppable_ad_activations` — a single dispatch of a shoppable ad. Has an `activationId` used for attribution. |
| **Impression** | An event in Mixpanel — the SDK renders a component on screen. Not persisted in Vio DB. |
| **Cart intent** | A row in `cart_intents` — user indicated intent to purchase (click on TV, tap on mobile). Links to `source_activation_id`. |
| **External user id** | The opaque user identifier provided by the host partner (Viaplay, TV2). Unique per `client_app_id` but not globally. Replaces the retired `reachu_user_id`. |
| **Operator** | A dashboard user (row in `users` table). Distinct from end-user. Owns `campaigns`, `client_apps`, `sponsors`. |
| **End-user** | A viewer of a broadcast (row in `end_users` table). Identified by `(client_app_id, external_user_id)`. |
| **TV session** | An active instance of the TV SDK for a given (client_app, user, platform). UPSERTed at SDK start, closed by inactivity. |
| **Ensure-user** | Backend operation: given `(client_app_id, external_user_id)`, return existing `users.id` or create new row. |
| **Envelope v1** | Canonical notification payload (`vio_notification_version: 1`) shipped to partner webhook / APNs. Shape in §5 of this doc. |
| **Delivery mode** | How a cart_intent was delivered: `websocket`, `dual`, `webhook`, `apns`, or `dropped`. |

---

## 13. Contacts & versioning

- Backend: coordinated in `vio-backend/socket-server` on branch `feature/multi-sponsor-redesign` (to be created)
- iOS SDK: `VioSwiftSDK` — version bump to `0.3.0`
- Kotlin SDK: new repo TBD
- Dashboard: same repo as backend (client/ folder)
- API contract: `openapi.yaml` in backend repo is the source of truth

**Versioning rules**:
- `/v1/sdk/config` and `/v1/sdk/*` are versioned by URL prefix. Any breaking change → `/v2/sdk/...`
- SDK minor version (0.2.x → 0.3.0) indicates new contract. Patch versions stay backwards-compatible.
- Host apps on old SDK versions still work until we deprecate `/v1/sdk/config`.
