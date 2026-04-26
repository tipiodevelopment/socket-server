# Vio — Architecture Overview (developer onboarding)

> **Read this first.** One doc that answers: what does Vio do, how are things
> organized, what's the API surface, and where is the project right now?
>
> For deeper detail follow the links at the end of each section. For the
> authoritative data-model spec see
> [`multi-sponsor-architecture.md`](./multi-sponsor-architecture.md).
>
> **Last updated**: 2026-04-24 — post API v2 direct cut merged to develop (backend + iOS) and main (Apple TV).

---

## 1. What Vio does

Vio is a real-time sports-engagement SaaS. Partner apps (TV2, Viaplay, …)
embed Vio SDKs to display:

- **Shoppable ads** — a sponsor's product pops up during a live broadcast; the
  viewer taps the remote on TV → mobile companion receives a cart-intent,
  opens the product, completes Apple Pay.
- **Engagement** — sponsor-branded polls and contests during broadcasts.
- **Placements** — always-on product carousels, banners, spotlights rendered
  by the SDK at locations the host app declares (hero, sidebar, …).

Everything orchestrated via:
- **Backend** (`socket-server`) — Express + Postgres (Neon) + WebSockets.
- **Dashboard** (same process) — operator UI to configure campaigns, sponsors, broadcasts, shoppable-ad slots, placements.
- **SDKs** — `VioSwiftSDK` (iOS mobile), `InteractiveAds-vio` (Apple TV tvOS), Kotlin SDKs (Android TV + Android mobile — not yet built).
- **Commerce** — external GraphQL service (`graph-ql-dev.vio.live`) per-sponsor. Each sponsor has its own `commerce_api_key` → catalogs + checkout flows are isolated per sponsor.

---

## 2. Hierarchy — how the domain is organized

```
Platform
└── User (operator — logs into dashboard, owns their Vio tenant)
    ├── ClientApp (host app instance — "TV2", "Viaplay", …)
    │   ├── apiKey                         ← SDK auth header X-API-Key
    │   ├── webhookUrl                     ← partner receives offline cart_intent
    │   ├── partnerDeviceRegisterUrl       ← partner receives APNs/FCM tokens
    │   ├── tvEnabled, tvPlatforms         ← TV SDK subscribe gate
    │   │
    │   └── Campaign (time-bounded marketing activation)
    │       ├── primarySponsor     (1, NOT NULL, immutable after children exist)
    │       │
    │       ├── secondarySponsors  (M:N via campaign_sponsors.role ∈ {full, shoppable, engagement})
    │       │
    │       ├── campaign_components (PLACEMENTS — not fully shipped yet, see §7)
    │       │     [component + sponsor + locationId + status + scheduling]
    │       │
    │       └── Broadcasts (live events under the campaign)
    │             ├── broadcast_sponsor_slots (shoppable ad authoring, per-broadcast)
    │             ├── polls / contests         (engagement, per-broadcast)
    │             ├── shoppable_ad_activations (dispatch log with activationId)
    │             └── (linked to) cart_intents
    │
    └── Sponsors (M:N with campaigns — an independent brand tenant)
          ├── commerce_api_key       ← Commerce GraphQL auth (per-sponsor!)
          ├── commerce_channel_id
          ├── paymentMethods         ← drives Apple Pay gate in iOS SDK
          └── avatarUrl / logoUrl / colors   (branding)
```

**Rule of thumb per entity**

| Entity | What it is |
|---|---|
| `users` | Dashboard operator account — one human. |
| `client_apps` | A host-app instance (TV2, Viaplay). Has its own `apiKey`. SDK consumers authenticate with this. |
| `sponsors` | A brand with its own Commerce catalog. Belongs to the user but is shared across campaigns. |
| `campaigns` | Time-bounded marketing activation under an app, with 1 primary + N secondary sponsors. |
| `campaign_sponsors` | M:N link. `role` = `full \| shoppable \| engagement` (dashboard UI taxonomy). |
| `broadcasts` | Single live event under a campaign (a match, a show). |
| `broadcast_sponsor_slots` | Scheduled or manually-fired shoppable ads attached to a broadcast. |
| `shoppable_ad_activations` | Dispatch log. Every shoppable_ad WS event creates one of these rows (with `activationId`). |
| `cart_intents` | User-initiated intent to purchase. Carries `source_activation_id` to close the attribution chain. |
| `campaign_components` | Product placements (carousels, banners, spotlights) — not in the smoke-test scope yet, see §7. |
| `end_users` | SDK viewer identity (opaque `externalUserId` per clientApp). |
| `tv_sessions` | Active TV SDK session row (heartbeat-kept). |

Deep ER + column detail in
[`DB_AND_ENDPOINTS.md`](./DB_AND_ENDPOINTS.md) (§1-2).

---

## 3. Multi-sponsor model

The hierarchy supports **multiple sponsors per campaign**, each with their
own Commerce credentials. Key properties:

- **Primary sponsor** (1, required). Immutable once children exist. Provides
  default branding; runs engagement.
- **Secondary sponsors** (0..N). Added via `campaign_sponsors`.
- **Commerce per sponsor**. Each sponsor has a unique `commerce_api_key` that
  the SDK uses to call Commerce GraphQL directly. When a `shoppable_ad`
  fires with `sponsorId=4`, the iOS SDK routes Commerce queries using
  sponsor 4's key — not a global fallback.
- **Payment methods per sponsor**. `sponsors.payment_methods` (JSON array)
  drives the Apple Pay gate. The iOS SDK only shows the Apple Pay button
  when `paymentMethods.contains("apple_pay")` for the active sponsor.
- **Avatar required** for shoppable dispatch. If `sponsor.avatar_url IS NULL`
  the backend rejects the dispatch with `422 SPONSOR_MISSING_AVATAR`.

**Example** (current state of campaign 36 "Tv2 Demo Campaign" in the active Neon branch):

| Sponsor | Role | Commerce key (first 8) | paymentMethods | Test product |
|---|---|---|---|---|
| Elkjøp (#3) | primary | `5HPHWJY-…` | klarna, stripe_link, vipps, apple_pay, google_pay | Samsung QLED TV |
| Torshov Sport (#4) | secondary / shoppable | `36EHG0M-…` | idem | Nike Fotballdrakt |
| XXL (#7) | secondary / full | `KCXF10Y-…` | idem | FC Barcelona Jersey |

---

## 4. API v2 surface (live as of 2026-04-24)

The API is organized by **audience**, not by version:

```
/v2/tv/*        — Apple TV + Android TV SDKs         (apiKey)
/v2/mobile/*    — iOS + Kotlin mobile SDKs           (apiKey)
/v2/commerce/*  — sponsor-scoped catalog proxy       (apiKey)
/v2/admin/*     — platform-admin programmatic        (Bearer JWT)
/api/*          — dashboard operator UI              (session cookie)
{partnerUrl}    — outbound calls Vio makes to partner (mocked today; HMAC signing deferred)
```

### /v2/tv/*

```
POST /v2/tv/broadcast/subscribe             combined bootstrap (validate + session + sponsors + wsUrl)
POST /v2/tv/session/start                   standalone session (rarely used)
POST /v2/tv/session/heartbeat               every 60s while connected
POST /v2/tv/session/end                     on VioTV.disconnect()
POST /v2/tv/cart-intent                     remote tap → mobile routing
POST /v2/tv/broadcasts/:broadcastId/shoppable-ad    SDK-originated + automation + smoke test dispatch
```

### /v2/mobile/*

```
GET  /v2/mobile/config                                bootstrap: campaign + primary + secondaries + commerce blocks
GET  /v2/mobile/broadcasts/:broadcastId/capabilities  per-broadcast feature flags
GET  /v2/mobile/broadcasts/:broadcastId/components    placements (campaign + broadcast-scoped merged)
POST /v2/mobile/campaigns/:campaignId/cart-intent     in-app "Add to cart"
POST /v2/mobile/campaigns/:campaignId/register-device APNs/FCM token
```

### /v2/commerce/*

```
GET /v2/commerce/products                            raw proxy (debug)
GET /v2/commerce/sponsors/:sponsorId/catalog         per-sponsor catalog — primary runtime call
```

### /v2/admin/*

```
POST /v2/admin/broadcasts/:broadcastId/shoppable-ad  Bearer JWT programmatic dispatch
```

### /api/* (dashboard, session cookie — NOT part of the SDK contract)

Campaign CRUD, sponsor CRUD, slot authoring, trigger endpoints, analytics, broadcast management. These live separately because they serve the operator UI, not SDK consumers.

### Partner outbound contract

When a `cart_intent` fires and the mobile user is offline on WS, Vio POSTs
to the clientApp's `webhookUrl`. Same when APNs token forwarding is set.
Today the partner mock at `viopartnermockv2.azurewebsites.net` implements
the receiver side. HMAC signing is documented in
[`API_V2_CONTRACT.md §8`](./API_V2_CONTRACT.md) but deferred until first
real partner onboards.

Full contract + expected responses + migration map from v1/mixed to v2:
[`API_V2_CONTRACT.md`](./API_V2_CONTRACT.md).

---

## 5. WebSocket channel

Every TV + iOS SDK connects to `wss://<host>/ws/:campaignId`. First frame
after handshake is `{"type":"identify","userId":"<externalUserId>"}`.

### Server → client events

| Event | Root payload | Consumed by |
|---|---|---|
| `campaign_started` / `campaign_ended` | `campaignId, startDate?, endDate?` | mobile + TV |
| `broadcast_status_changed` | `broadcastId, status` | mobile + TV |
| `component_status_changed` | `campaignId, componentId, sponsorId, status, component:{...}` | mobile |
| `poll_activated` / `poll_deactivated` | `pollId, broadcastId` | mobile |
| `contest_activated` / `contest_deactivated` | `contestId, broadcastId` | mobile |
| `lineup_show` | `broadcastId, videoTimestamp, …` | mobile |
| `shoppable_ad` | `broadcastId, campaignId, sponsorId, activationId, product, sponsor` | TV |
| `cart_intent` | canonical envelope with `activation_id, sponsor_id` | mobile |
| `ping` | — | both (reply `{type:"pong"}`) |

### Client → server

| Frame | When |
|---|---|
| `{"type":"identify","userId":"…"}` | first frame, required for user-scoped routing |
| `{"type":"pong"}` | reply to `ping` |

Dedup rule (iOS): `cart_intent` events are deduped by `activationId` in
`CampaignManager.publishCartIntentIfChanged`. TV-originated and
mobile-originated carry the same `activationId` → mobile SDK opens the
overlay once.

### Unified inbound dispatcher (post-2026-04-26 refactor)

The iOS SDK now routes both transports through a single dispatcher so
new TV→user event types (poll_result, score_update, …) plug in without
copy-paste:

```text
WebSocket  →  CampaignWebSocketManager.onCartIntent  ─┐
                                                      ▼
                          CampaignManager.dispatch(.cartIntent(event), source: .webSocket)
                                                      ▲
APNs (real)→  UNUserNotificationCenterDelegate ───────┘
              → handlePushNotificationUserInfo
              → applyCartIntentFromNotificationUserInfo
              → dispatch(.cartIntent(merged), source: .push)

dispatch(_:source:)
   └─► publishCartIntentIfChanged(event, channel: source.rawValue)
          └─► dedup → activeCartIntentEvent  → overlay reacts via @Published
```

`IncomingTVEvent` is a discriminated union (`Sources/VioCore/Models/IncomingTVEvent.swift`).
Today only `.cartIntent` exists; doc inside the file describes how to add
the next case (model + publisher + adapter wires). Per-event dedup +
publishing stays inside `publishXxxIfChanged`; `dispatch` only routes.

The SDK no longer self-schedules local `UNNotificationRequest`s — that
path was redundant with the overlay AND the source of duplicate
`cart_intents` rows for sponsors with role=shoppable. Anything reaching
`UNUserNotificationCenterDelegate` is now genuinely a remote APNs push.

Backend mirror: `server/routes.ts` exposes `buildCartIntentEnvelope` +
`notifyUserEventViaPartner` + `routeUserEvent` so any future
`/v2/tv/<event>` handler is ~30 lines. See `CURRENT_STATE.md §15` for
the architecture diagram.

---

## 6. End-to-end data flow — a shoppable_ad life cycle

```
1. Operator in dashboard fires a shoppable_ad OR a slot executes on schedule
   └── backend: persistAndBroadcastShoppableAd()
       ├── INSERT shoppable_ad_activations (id = activationId)
       ├── validate sponsor.avatar_url NOT NULL  (422 SPONSOR_MISSING_AVATAR otherwise)
       └── broadcastToCampaign(campaignId, { type:"shoppable_ad", activationId, sponsorId, product, sponsor })

2. Apple TV SDK (subscribed via /v2/tv/broadcast/subscribe, WS open on /ws/36)
   ├── receives shoppable_ad event
   ├── VioTVConfiguration.commerce(forSponsorId:) resolves the sponsor's key
   ├── VioTVCommerceService.fetchProduct(id:, commerceApiKey: key) enriches the product
   └── overlay renders with sponsor branding + product

3. User presses Select/Play on the remote
   └── VioTVManager.sendCartIntent(productId, campaignId, activationId, sponsorId)
       └── POST /v2/tv/cart-intent  { externalUserId, productId, campaignId, platform, activationId, sponsorId }

4. Backend receives cart-intent
   ├── resolve campaignId + sponsorId from shoppable_ad_activations[activationId]
   ├── ensureEndUser(clientAppId, externalUserId)
   ├── INSERT cart_intents { source_activation_id = activationId, sponsor_id, delivery_mode, envelope, ... }
   └── forward envelope:
       ├── WS direct (iOS connected as demo_user_001) → delivery_mode = websocket
       ├── partner webhook (clientApp.webhookUrl)     → delivery_mode = webhook
       └── APNs (device_tokens table)                 → delivery_mode = apns
       (when CART_INTENT_DUAL_DELIVERY=true, both WS + webhook fire → delivery_mode=dual, iOS dedups)

5. iOS SDK (WS open on /ws/36 as demo_user_001)
   ├── receives cart_intent event
   ├── CampaignManager.publishCartIntentIfChanged (dedup by activationId)
   ├── CommerceSdkClientProvider.client(forSponsorId: event.sponsorId) resolves per-sponsor client
   ├── ProductService.loadProduct(productId, sponsorId) — GraphQL with sponsor's key
   └── TV2ProductOverlay renders product + Apple Pay button (gated by sponsor.paymentMethods)

6. User taps Apple Pay
   └── CartManager → checkout using sponsor's CommerceSdkClient
```

---

## 7. Milestones — where we are

### ✅ Hito 1 — Multi-sponsor schema (Phase 1+2+3) on develop

5 sponsor FKs are NOT NULL (Phase 3 enforced on Neon develop). `campaigns.primary_sponsor_id`, `campaign_components.sponsor_id`, `scheduled_components.sponsor_id`, `polls.sponsor_id`, `contests.sponsor_id`.

### ✅ Hito 2 — TV SDK v2 integration on main (Apple TV)

`VioTVSDK` does the combined `POST /v2/tv/broadcast/subscribe` bootstrap, opens WS, identifies, heartbeat every 60s, cart-intent v2 minimal body with `activationId`. Per-sponsor commerce resolution via `VioTVConfiguration.commerce(forSponsorId:)`. No hardcoded fallback keys.

### ✅ Hito 3 — iOS SDK multi-sponsor consumption on develop

`VioSwiftSDK` consumes `/v2/mobile/config` with primary + secondaries + commerce blocks. `CommerceSdkClientProvider.client(forSponsorId:)` routes per-sponsor. `CartIntentEvent` decodes `activationId + sponsorId` and dedups. `TV2ProductOverlay` subscribes to `activeCartIntentEvent`.

### ✅ Hito 4 — API v2 direct cut (JUST MERGED, 2026-04-24)

13 backend routes renamed to `/v2/{mobile,tv,commerce,admin}/*`. iOS SDK URLs migrated (+ 4 legacy multi-sponsor-conflict calls killed). Apple TV SDK URLs migrated (+ hardcoded commerce fallback removed). Postman collection 100% v2 on SDK surfaces. No v1 fallbacks in SDK code.

Merged PRs:
- socket-server [#13](https://github.com/tipiodevelopment/socket-server/pull/13) → develop (commit `b92a92e`)
- VioSwiftSDK [#3](https://github.com/vio-live/VioSwiftSDK/pull/3) → **develop** (never main — locked rule) (commit `a8e5730`)
- InteractiveAds-vio [#3](https://github.com/angelosv/InteractiveAds-vio/pull/3) → main (commit `6a23bdf`)

### 🟡 Hito 5 — Multi-sponsor 3-ad smoke test (in progress)

3 shoppable_ads dispatched to campaign 36 with real per-sponsor commerce keys:
- Elkjøp / Samsung QLED (activationId 5, 6)
- Torshov Sport / Nike Fotballdrakt (activationId 7)
- XXL / FC Barcelona Jersey (activationId 8)

Pending user verification of Apple Pay checkout flow end-to-end (Apple TV tap → iOS overlay → per-sponsor Commerce → Apple Pay button → checkout completes).

### 🔄 Hito 6 — Product Placements (upcoming, paused at Step 4 of 12)

Placements = always-on product UI (carousels, banners, spotlights, stores, sliders) that render at host-app-declared `locationId`s. Three-layer model: `components` (catalog) → `app_components` (app scope, admin-only) → `campaign_components` (instances per campaign with sponsor + location + scheduling).

Status: backend WS event `component_status_changed` now emits `sponsorId` at root. Dashboard `ComponentsTab` has the sponsor picker. Remaining (Steps 5-12):
- Dashboard: catalog scope to `app_components`, product picker for `product_*` types, scheduling fields.
- iOS SDK: 5 views (`VProductCarousel`, `VProductSpotlight`, `VProductStore`, `VProductBanner`, `VProductSlider`) pass `component.sponsorId` to `ProductService.loadProduct(sponsorId:)`.
- `Product.sponsorId` stamped by `ProductService` at hydrate; `CartManager` reads it for per-sponsor checkout.
- E2E: reconstruct TV2 campaign with 2 placements (Elkjøp carousel + XXL spotlight), validate end-to-end with Apple Pay.

Tracked in [`TASK_PLACEMENTS.md`](./TASK_PLACEMENTS.md).

### ⏳ Hito 7 — Kotlin SDKs

Android TV + Android mobile, 1:1 port of the iOS/Apple TV v2 surface. Specs in [`KOTLIN_TV_SDK_SPEC.md`](./KOTLIN_TV_SDK_SPEC.md) and [`KOTLIN_MOBILE_SDK_SPEC.md`](./KOTLIN_MOBILE_SDK_SPEC.md). Kotlin dev arrives soon — they code against v2 from day 1.

### ⏳ Hito 8 — Legacy v1 retirement + partner HMAC + production cutover

See [`IOS_V2_MIGRATION_GAP.md`](./IOS_V2_MIGRATION_GAP.md) for the 9 legacy iOS calls still in code (not fallbacks, just unmigrated features) and [`ROLLOUT_ROADMAP.md`](./ROLLOUT_ROADMAP.md) Phase 4 for partner onboarding + observability plan.

---

## 8. Working on Vio — where to branch from, where PRs go

### Branching rules (locked 2026-04-24)

| Repo | Working branch | PR target | Notes |
|---|---|---|---|
| `socket-server` | `develop` | `develop` | Dashboard + backend + migrations here |
| `VioSwiftSDK` | `develop` | **`develop` — NEVER main** | main = v0.1.0-alpha release branch |
| `InteractiveAds-vio` | `main` | `main` | Apple TV repo has no develop |

### For a fix / feature

1. Pull the working branch: `git checkout develop && git pull` (or `main` for Apple TV).
2. Branch off: `git checkout -b feat/<short-desc>` or `fix/<short-desc>`.
3. Code, commit with conventional commits (`feat:`, `fix:`, `docs:`, `chore:`, `refactor:`).
4. **No hardcoded apiKeys**. No "try v2 → catch → v1" fallback logic. These rules are locked.
5. Push + open PR targeting the working branch.
6. Update [`CURRENT_STATE.md`](./CURRENT_STATE.md) if you change state worth tracking.

### Local dev environment

- Backend: `npm run dev` → port `:5001` with integrated Vite dashboard.
- Tunnel: `api-local-angelo.vio.live` → `localhost:5001` via Cloudflare. Apple TV + iOS demos hit the tunnel.
- Partner mock: `https://viopartnermockv2.azurewebsites.net` (stable, Azure-hosted).
- DB: Neon branch `local/angelo-20260423-1814` (`br-summer-morning-a8y0i36l`) — **do not re-fork**, stays active through v2 stabilization.
- See [`CURRENT_STATE.md`](./CURRENT_STATE.md) §3-§5 for live state.

---

## 9. Quick links

- [`CURRENT_STATE.md`](./CURRENT_STATE.md) — live truth (branches, DB, PRs, phase)
- [`API_V2_CONTRACT.md`](./API_V2_CONTRACT.md) — full API contract with per-endpoint shapes
- [`DB_AND_ENDPOINTS.md`](./DB_AND_ENDPOINTS.md) — schema + endpoints + recipes (deeper than §2 here)
- [`multi-sponsor-architecture.md`](./multi-sponsor-architecture.md) — authoritative data-model + flows spec
- [`TASK_PLACEMENTS.md`](./TASK_PLACEMENTS.md) — placements plan (Hito 6)
- [`IOS_V2_MIGRATION_GAP.md`](./IOS_V2_MIGRATION_GAP.md) — 9 legacy iOS calls still in code
- [`KOTLIN_TV_SDK_SPEC.md`](./KOTLIN_TV_SDK_SPEC.md) + [`KOTLIN_MOBILE_SDK_SPEC.md`](./KOTLIN_MOBILE_SDK_SPEC.md) — Kotlin SDK specs (Hito 7)
- [`ROLLOUT_ROADMAP.md`](./ROLLOUT_ROADMAP.md) — phased roadmap to production
- [`SHOPPABLE_AD_AUTHORING.md`](./SHOPPABLE_AD_AUTHORING.md) — dashboard authoring flow
- [`PHASE_3_ENFORCEMENT.md`](./PHASE_3_ENFORCEMENT.md) — NOT NULL migration playbook
