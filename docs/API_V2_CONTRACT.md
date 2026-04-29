# Vio API v2 — Contract

> Source of truth for the shape of the public API consumed by SDKs and by
> partner integrations. Supersedes any v1 document. Full request/response
> schemas live in `openapi.yaml`; this doc defines **namespaces, audiences,
> auth, and the versioning + deprecation policy**.
>
> **Status**: Adopted 2026-04-24, refreshed 2026-04-29 with placement system surface (manifest + campaigns/components) and accurate v1 retirement state. Target audience: Kotlin SDK author, iOS SDK maintainers, partner integrations.

## 1. Why v2

The current surface has 24 SDK-facing routes spread across 5 prefixes
(`/v1/sdk/*`, `/v2/sdk/*`, `/api/sdk/tv/*`, `/api/campaigns/*`,
`/api/commerce/*`) with no consistent rule. That made sense as features grew
organically. It does not make sense now that:

- A Kotlin SDK is about to be written and needs a single, stable contract.
- The iOS SDK + VioTVSDK are about to add new placement + per-sponsor checkout
  behaviour.
- Partner onboarding needs a clear "what we send you, what we expect from you"
  document to sign off.

v2 consolidates every SDK-facing route under `/v2/<surface>/*`, where `<surface>`
declares the audience. No logic changes — routes are renamed and a clean
contract is published.

## 2. Design principles

1. **Surface-prefixed, not version-suffixed.** The URL declares who the
   caller is: `/v2/mobile/*`, `/v2/tv/*`, `/v2/commerce/*`, `/v2/admin/*`,
   `/v2/partner/*`.
2. **One surface, one auth mode.** A caller should never need to remember
   that "this apiKey route actually takes a Bearer too".
3. **Dashboard UI is not an SDK.** Operator endpoints stay at `/api/*` with
   session cookies — different audience, different namespace.
4. **No parallel windows.** v1 responds `410 Gone` with a `Link` header to
   the v2 equivalent on a published cutover date. Decision 1 of the
   multi-sponsor architecture doc already locked this.
5. **Additive backward compatibility inside v2.** Adding fields is fine;
   renaming or removing requires a v3 bump.
6. **Contract-first.** This doc + `openapi.yaml` are merged before any SDK
   or backend code claims "v2 support".

## 3. Surfaces at a glance

| Surface | Prefix | Auth | Audience | Outbound? |
|---|---|---|---|---|
| Mobile SDK runtime | `/v2/mobile/*` | `X-API-Key` | iOS SDK, Kotlin mobile SDK | — |
| TV SDK runtime | `/v2/tv/*` | `X-API-Key` | VioTVSDK (Apple TV), Kotlin Android TV SDK | — |
| Commerce proxy | `/v2/commerce/*` | `X-API-Key` | both SDKs, dashboard | — |
| Platform admin | `/v2/admin/*` | `Authorization: Bearer <JWT>` | internal ops, platform integrations | — |
| Partner outbound (contract) | `/v2/partner/*` | HMAC-signed | **Vio → partner** (defined here, hosted by partner) | ✔ |
| Dashboard UI | `/api/*` | session cookie | operator UI only | — |

**Base URLs** (unchanged):
- REST: `https://api-dev.vio.live` (dev) · `https://api-local-angelo.vio.live` (tunnel)
- WebSocket: `wss://api-dev.vio.live/ws/:campaignId`

**Auth headers**:
- `X-API-Key: <client_app.api_key>` — always preferred. Legacy `apiKey` query param kept as fallback for 1 release cycle.
- `Authorization: Bearer <JWT>` — admin only.

## 4. `/v2/mobile/*` — mobile SDK runtime

Consumed by iOS (`VioSwiftSDK`) and Kotlin mobile SDK.

### 4.1 Shipped (live on develop)

| Method | Path | Purpose |
|---|---|---|
| GET | `/v2/mobile/config` | Bootstrap — campaign + primary + secondaries + endpoints + commerce blocks. **Replaces `/v2/sdk/config` + `/v1/sdk/config`.** |
| POST | `/v2/mobile/components/manifest` | **Cold-start manifest upload.** Body `{ locations: [{id, displayName?}, …] }` — sync semantics: locations not in payload get `deprecated_at = now()` (soft). Rejects body with `placements[]` or `components[]` (HTTP 400 — those legacy arrays were retired post-migration `0004`). |
| GET | `/v2/mobile/broadcasts/:broadcastId/capabilities` | Feature flags per broadcast. **Replaces `/v2/sdk/broadcasts/:id/capabilities`.** |
| GET | `/v2/mobile/broadcasts/:broadcastId/components` | Active placement list **scoped to a broadcast** (campaign + broadcast-scoped merged). Used for broadcast-bound carousels. **Replaces `/v2/sdk/broadcasts/:id/components`.** |
| GET | `/v2/mobile/campaigns/:campaignId/components` | **Primary placement fetch** — campaign-scoped placement instances JOINed through `app_placements`. Backend filters out where `app_placements.deprecated_at IS NOT NULL`. Each row carries `appPlacementId + appPlacementName + locationId` + sponsor block (`logoUrl + avatarUrl + primaryColor`) + template config merged with customConfig. Used by every always-on placement (carousel/banner/spotlight/store/offer_banner). |
| POST | `/v2/mobile/campaigns/:campaignId/cart-intent` | Mobile-originated cart intent. Accepts optional `activationId` for attribution. Persists `cart_intents` and fans out WS / webhook. Response `mode` ∈ `'websocket' \| 'dual' \| 'webhook' \| 'apns' \| 'dropped'`. **Replaces `/api/campaigns/:id/cart-intent`.** |
| POST | `/v2/mobile/campaigns/:campaignId/register-device` | APNs/FCM token registration. **Replaces `/api/campaigns/:id/register-device`.** |

Full shapes → `openapi.yaml` tagged `mobile-sdk`.

### 4.2 Planned (iOS still uses `/v1/*` — pending v1→v2 migration per `IOS_V2_MIGRATION_GAP.md`)

| Method | Path | Replaces v1 | Tracker |
|---|---|---|---|
| GET | `/v2/mobile/broadcasts/:broadcastId/lineup` | `/v1/sdk/broadcasts/:id/lineup` | PR D |
| GET | `/v2/mobile/broadcasts/resolve?contentId=` | `/v1/sdk/broadcast?contentId=` | PR D |
| GET | `/v2/mobile/campaigns/:campaignId/config` | `/v1/campaigns/:id/config` | PR A (or fold into `/v2/mobile/config`) |
| GET | `/v2/mobile/broadcasts/:broadcastId/engagement/config` | `/v1/engagement/config` | PR B (or fold into `/v2/mobile/broadcasts/:id/capabilities`) |
| GET | `/v2/mobile/localization/:lang` | `/v1/localization/:lang` | PR E (or bundle locally in SDK) |

### 4.3 Engagement under mobile (planned — PR C)

Polls + contests stay semantically as-is but move under `/v2/mobile/engagement/*`:

| Method | Path | Replaces v1 |
|---|---|---|
| GET | `/v2/mobile/engagement/broadcasts/:broadcastId/polls` | `/v1/engagement/polls` |
| POST | `/v2/mobile/engagement/polls/:pollId/vote` | `/v1/engagement/polls/:id/vote` |
| GET | `/v2/mobile/engagement/broadcasts/:broadcastId/contests` | `/v1/engagement/contests` |
| POST | `/v2/mobile/engagement/contests/:contestId/participate` | `/v1/engagement/contests/:id/participate` |

The 9 v1 routes referenced in 4.2 + 4.3 remain live until the matching `/v2/mobile/*` lands. **`IOS_V2_MIGRATION_GAP.md` is the live migration tracker.**

### 4.4 Retired entirely (handlers deleted 2026-04-29 — no v2 successor)

These v1 routes had **zero callers** across the 3 SDKs (iOS, Apple TV, dashboard) and any backend script. Handlers removed in commit `374a3ae` (`refactor(routes): retire 24 dead v1 endpoints`):

- **SDK legacy (8)**: `/v1/sdk/campaigns`, `/v1/sdk/config`, `/v1/offers`, `/v1/sdk/livescores`, `/v1/sdk/components`, `/v1/sdk/broadcasts/:id/{chat,score,stats}` — replaced by `/v2/mobile/config` + WS events, or had no consumer.
- **Bearer admin CRUD (16)**: `/v1/broadcasts` (5 verbs), `/v1/campaigns/:id/broadcasts`, `/v1/broadcasts/:id/{polls,contests}` (4), `/v1/{polls,contests}/:id` (CRUD x2), `/v1/polls/:id/results`, `/v1/contests/:id/participations` — predate the dashboard; never connected to any frontend or external admin tool.

## 5. `/v2/tv/*` — TV SDK runtime

Consumed by `VioTVSDK` (Apple TV) and Kotlin Android TV SDK.

| Method | Path | Purpose |
|---|---|---|
| POST | `/v2/tv/broadcast/subscribe` | Combined bootstrap (validate broadcast + ensure end_user + upsert tv_session + return campaign + sponsors + wsUrl + capabilities). **Replaces `/api/sdk/tv/broadcast/subscribe`.** |
| POST | `/v2/tv/session/start` | Register a TV session without binding to a broadcast. Kept as building block. **Replaces `/api/sdk/tv/session/start`.** |
| POST | `/v2/tv/session/heartbeat` | Update `last_seen_at` on the session. **Replaces `/api/sdk/tv/session/heartbeat`.** |
| POST | `/v2/tv/session/end` | Mark session ended. **Replaces `/api/sdk/tv/session/end`.** |
| POST | `/v2/tv/cart-intent` | TV-originated cart intent. v2 minimal body `{ externalUserId, productId, activationId }`. Response `mode` ∈ `'websocket' \| 'dual' \| 'webhook' \| 'apns' \| 'dropped'`. **Replaces `/api/sdk/tv/cart-intent`.** |
| POST | `/v2/tv/broadcasts/:broadcastId/shoppable-ad` | TV SDK-driven ad dispatch (rare from a real device, used by automation). **Replaces `/api/sdk/tv/broadcasts/:id/shoppable-ad`.** |

## 6. `/v2/commerce/*` — Commerce proxy

Consumed by both mobile and TV SDKs.

| Method | Path | Purpose |
|---|---|---|
| GET | `/v2/commerce/products` | Raw Commerce GraphQL proxy (debug, power users). **Replaces `/api/commerce/products`.** |
| GET | `/v2/commerce/sponsors/:sponsorId/catalog` | Sponsor-scoped product catalog — the primary runtime call. **Replaces `/api/commerce/sponsors/:id/catalog`.** |

## 7. `/v2/admin/*` — Platform admin

Bearer JWT. Reserved for internal ops and platform-level integrations.

| Method | Path | Purpose |
|---|---|---|
| POST | `/v2/admin/broadcasts/:broadcastId/shoppable-ad` | Programmatic ad dispatch. **Replaces `POST /api/broadcasts/:id/shoppable-ad` (Bearer variant).** |

### 7.1 Control plane — operator-facing `/api/*` (session cookie)

Dashboard-only surface, **not part of the SDK contract**. Listed here because it's the contract the dashboard frontend consumes against the same backend, and external tooling occasionally needs to reach it (Postman folder "5b. Placement control plane"). Auth: session cookie set after `POST /api/auth/login`.

**Placement system (operator):**

| Method | Path | Purpose |
|---|---|---|
| POST | `/api/client-apps/:clientAppId/placements` | **Add placement from library** — operator picks a canonical template + locationId from the dev-declared manifest + assigns a name. Creates an `app_placements` row. |
| DELETE | `/api/client-apps/:clientAppId/placements/:appPlacementId` | Soft-deletes the placement (`deprecated_at = now()`). Existing campaign_components keep rendering with a dashboard warning. |
| POST | `/api/campaigns/:campaignId/components` | **Bind a campaign to a placement** — operator picks placement + sponsor + products + customConfig. Creates a `campaign_components` row (`status='inactive'` by default). |
| PATCH | `/api/campaigns/:campaignId/components/:componentId` | Edit `sponsorId` and/or `customConfig`. Backend computes the diff, updates the row, and emits `placement_config_updated` (sponsor swap = `sponsorChanged: true` flag). |
| POST | `/api/campaigns/:campaignId/components/:componentId/pause` | Sets `status='inactive'`. Emits `placement_status_changed`. |
| POST | `/api/campaigns/:campaignId/components/:componentId/activate` | Sets `status='active'`. Emits `placement_status_changed`. Also handles the multi-sponsor swap: if another component currently holds the slot, it is atomically deactivated + the new one activated, with a single `placement_activation_swapped` event covering both. |
| POST | `/api/campaigns/:campaignId/placements/:appPlacementId/activate` | Activate a specific campaign_component for an app_placement (alternate verb when the operator picks the placement first instead of the component). Same swap semantics. |

**Other dashboard endpoints** (campaign CRUD, sponsor CRUD, broadcast CRUD, analytics, uploads, form-state) follow the conventional `/api/<resource>` pattern. They are not contract-frozen — they evolve with the dashboard UI.

## 8. `/v2/partner/*` — Partner outbound contract (new)

The partner hosts these endpoints; Vio is the caller. The partner mock
(`https://viopartnermockv2.azurewebsites.net`) implements this contract. This
section turns the ad-hoc `PARTNER_MOCK_SERVER_CARD.md` into a versioned
contract.

| Method | Path (partner-hosted) | Vio calls it when |
|---|---|---|
| POST | `{partnerDeviceRegisterUrl}` | SDK called `/v2/mobile/campaigns/:id/register-device` and `partnerDeviceRegisterUrl` is set on the client_app. |
| POST | `{webhookUrl}` | A `cart_intent` (mobile or TV) fires and the target user is **not** connected on WebSocket. Also fires on fallback delivery paths (`delivery_mode = 'webhook'` or `'dual'`). |

**Headers Vio sends (v2)**:
- `Content-Type: application/json`
- `X-Vio-Event: cart_intent` (or `device_register`)
- `X-Vio-Version: 1` (envelope version, not API version)
- `X-Vio-Signature: sha256=<hmac>` (HMAC-SHA256 of body using the shared secret stored on `client_apps.partner_webhook_secret`; new column to add — **TBD before we cut over**)
- `X-Vio-Delivery: <uuid>` (retry-safe idempotency key)

**Retry policy**:
- Exponential backoff: 0s, 30s, 2m, 10m, 1h. After 5 failures Vio logs
  `partner_webhook_dropped` and gives up.
- `2xx` → success. `4xx` → no retry (partner rejected), logged. `5xx` →
  retry. `timeout > 10s` → retry.

**cart_intent body** — canonical v1 envelope (unchanged shape):

```jsonc
{
  "vio_notification_version": 1,
  "vio_event_type": "cart_intent",
  "vio_payload": {
    "product_id": "...",
    "sponsor_id": 3,
    "activation_id": 42,
    "campaign_id": 36,
    "user_id": "demo_user_001",
    "client_app_id": 18,
    "triggered_at": "2026-04-24T12:34:56Z"
  },
  "metadata": { "source": "tv-sdk" | "mobile-sdk" }
}
```

**device_register body** — unchanged from legacy:

```jsonc
{ "userId": "<string>", "deviceToken": "<string>", "platform": "ios" | "android" }
```

### `delivery_mode` semantics (cart-intent response + cart_intents row)

Both cart-intent endpoints (`/v2/mobile/...` and `/v2/tv/...`) resolve the
delivery outcome and report it as `mode` in the response + persist it to
`cart_intents.delivery_mode`. Possible values:

| `mode` | Meaning |
|---|---|
| `websocket` | User WS-connected (this node or via Redis cluster forward), envelope delivered over WS only. `dual` flag was off. |
| `dual` | User WS-connected AND `CART_INTENT_DUAL_DELIVERY=true` → envelope sent over WS AND also POSTed to partner webhook (or APNs fallback) for safety. |
| `webhook` | User offline; envelope POSTed to `clientApp.webhookUrl`. |
| `apns` | User offline AND no `webhookUrl` configured; envelope sent as APNs push to all registered iOS device tokens. |
| `dropped` | User offline AND no `webhookUrl` AND no iOS device tokens registered. The envelope was built and persisted but no delivery happened. |

Pre-2026-04-26 the mobile path collapsed everything offline-ish to
`'webhook'`. Post-refactor (PR #26 — `routeUserEvent`), both endpoints
report the precise outcome. Consumers that switched on the previous
narrower set will still see `'websocket' | 'dual' | 'webhook'` in the
common path; the new values appear only when the partner webhook is
unset (rare in production but useful for telemetry).

### Internal helpers (server-side, for adding new TV→user events)

The user-event delivery layer is centralized in `server/routes.ts`:

| Helper | What |
|---|---|
| `buildCartIntentEnvelope(args)` | Builds the v1 envelope (`vio_event_type='cart_intent'`). Single source of truth. To add a new event type, write a sibling `buildXxxEnvelope` with `vio_event_type='xxx'`. |
| `routeUserEvent({envelope, wsEvent, ...})` | Canonical 3-branch dispatcher (local WS / Redis cluster / offline → partner). Returns `{deliveryMode, userConnected}`. Generic — accepts any envelope. |
| `notifyUserEventViaPartner({envelope, ...})` | Delivery only. POSTs envelope as-is to webhook OR (if no webhook) sends APNs (cart_intent-shaped today; guarded by `vio_event_type` for future event types). |

A new `/v2/tv/<event>` handler is ~30 lines: build the envelope, build the
`wsEvent` wrapper, call `routeUserEvent`, persist whatever per-event row
the new event needs with the returned `deliveryMode + userConnected`.

## 9. WebSocket events

WS is a separate contract channel. No URL reshuffle — only the event payloads
matter. Connection point stays `wss://api-dev.vio.live/ws/:campaignId`.

Sprint 2026-04-28 PM split outbound events into **module buckets** so
SDKs can subscribe selectively. Events flagged with a module are
emitted via the **outbox pattern** (atomic with the data UPDATE that
triggered them — see `ARCHITECTURE_OVERVIEW.md §5` for the diagram).

### Outbound (server → client)

| Event | Module | Consumed by | Payload root |
|---|---|---|---|
| `campaign_started` | (firehose) | mobile + TV | `campaignId, startDate, endDate, matchId?` |
| `campaign_ended` | (firehose) | mobile + TV | `campaignId, endDate` |
| `broadcast_status_changed` | (firehose) | mobile + TV | `broadcastId, status` |
| `placement_status_changed` | `placements` | mobile | `campaignId, appPlacementId, campaignComponentId, status: 'active'\|'inactive', module, serverTimestamp` |
| `placement_config_updated` | `placements` | mobile | `…, customConfig, productIdsChanged: bool, sponsorId: int?, sponsorChanged: bool, module, serverTimestamp` |
| `placement_activation_swapped` | `placements` | mobile | `…, fromCampaignComponentId, toCampaignComponentId, fromSponsorId, toSponsorId, newComponent:{id, componentTypeId?, sponsorId?, customConfig, status}, module, serverTimestamp` |
| `poll_activated` / `poll_deactivated` | (firehose, future `engagement`) | mobile | `pollId, broadcastId` |
| `contest_activated` / `contest_deactivated` | (firehose, future `engagement`) | mobile | `contestId, broadcastId` |
| `lineup_show` | (firehose, future `broadcast`) | mobile | `broadcastId, videoTimestamp, ...` |
| `shoppable_ad` | (firehose, future `broadcast`) | TV | `broadcastId, campaignId, sponsorId, activationId, product, sponsor` |
| `cart_intent` | direct unicast (future `cart_intent`) | mobile | canonical envelope (see §8) |
| `ping` | — | both | app-level keepalive |

> The legacy `component_status_changed` / `component_config_updated` wire types pre-Sprint-2026-04-28 are no longer emitted. Their decoders remain on the SDK as inert source-compat shims.

### Inbound (client → server)

| Event | Sent by | Payload | When |
|---|---|---|---|
| `identify` | both | `userId` | first frame after handshake |
| `subscribe` | both (v2026-04-28+ SDKs) | `modules: string[]` (subset of `["placements","engagement","broadcast","cart_intent"]`) | second frame; tells the server to filter every emit by this socket's module set. Sockets that skip this stay on the firehose for backward compat. |
| `pong` | both | — | reply to `ping` |

### Module subscribe semantics

- Server-side state: `clientSubscriptions: WeakMap<WebSocket, Set<string>>`. GC'd automatically when the socket is collected.
- `broadcastToCampaign(campaignId, message, module?)` filters per-socket: when `module` is provided, sockets whose subscription set lacks that module skip the send. When `module` is undefined (legacy emit sites), all local sockets receive the message (firehose).
- Cross-node delivery: the Redis pub/sub envelope carries `module` so a different node's filter applies correctly. Legacy events from older nodes (no `module` field) are treated as firehose.
- Whitelist enforced server-side against the canonical set (`'placements' | 'engagement' | 'broadcast' | 'cart_intent'`) — garbage names are dropped silently.

### Sequencing

Events with a module also carry `serverTimestamp` (the outbox row's
INSERT time as ISO-8601 UTC). The SDK keeps a per-`campaignComponentId`
high-water mark and discards events whose timestamp is older than the
last applied — protects against out-of-order retries from the worker.

### Future WS surface split

If a future need arises (e.g., mobile and TV need different ping cadence or
envelope), the split will be at the connection URL (`/ws/mobile/:campaignId`
vs `/ws/tv/:campaignId`). Not needed for v2.

## 10. Error model

Every v2 response that fails must return:

```jsonc
{
  "error": {
    "code": "SPONSOR_MISSING_AVATAR",      // stable machine code
    "message": "Sponsor 3 has no avatar_url set.",   // human
    "details": { "sponsorId": 3 }          // optional structured data
  }
}
```

Status codes:
- `400` — malformed request body.
- `401` — auth missing/invalid.
- `403` — auth valid but not allowed for this resource.
- `404` — resource not found.
- `409` — conflict (e.g., secondary sponsor removal with active placements).
- `410` — **Gone**. Reserved for future v1 retirement. Today (2026-04-29) v1 routes that have an iOS consumer still return 200 OK; routes with zero callers have been **deleted entirely** from the codebase (commit `374a3ae`) — they hit Vite's SPA fallback instead. Once iOS migrates the remaining 9 v1 calls, those handlers will be deleted too rather than returning 410, since "no consumers" is verified empirically before each cut.
- `422` — semantic validation (avatar missing, invalid sponsor for campaign).
- `429` — rate limited.
- `5xx` — Vio-side failure.

## 11. Versioning + deprecation policy

- **Breaking change inside v2** (field removed, body reshaped, auth changed)
  → bump to v3. No silent renames.
- **Additive changes** (new optional field, new endpoint) → land in v2.
- **v1 retirement** → empirical, route-by-route. For each v1 path: (1) grep the 3 SDK repos + dashboard + scripts for any caller, (2) if zero, delete the handler in a single commit, (3) verify by content-type probe that requests now hit Vite's SPA fallback. No parallel window. The `410 Gone` flow stays reserved for the (unlikely) case a partner integration depends on a path we want to retire — would announce a cutover date in release notes first.
- **Partner outbound envelope** version lives in `X-Vio-Version` header and
  inside payload's `vio_notification_version`. Independent of the inbound API
  version number — can evolve on its own cycle.

## 12. Migration map (v1/mixed → v2)

### 12.1 Done — handlers shipped, SDKs migrated (live on develop)

| Old path | New path | Migrated by |
|---|---|---|
| `GET /v1/sdk/config` + `GET /v2/sdk/config` | `GET /v2/mobile/config` | iOS commit `748aeac` (2026-04-24) |
| `GET /v2/sdk/broadcasts/:id/capabilities` | `GET /v2/mobile/broadcasts/:id/capabilities` | iOS |
| `GET /v2/sdk/broadcasts/:id/components` | `GET /v2/mobile/broadcasts/:id/components` | iOS |
| `POST /api/campaigns/:id/cart-intent` | `POST /v2/mobile/campaigns/:id/cart-intent` | iOS |
| `POST /api/campaigns/:id/register-device` | `POST /v2/mobile/campaigns/:id/register-device` | iOS |
| `POST /api/sdk/tv/broadcast/subscribe` | `POST /v2/tv/broadcast/subscribe` | VioTVSDK |
| `POST /api/sdk/tv/session/*` | `POST /v2/tv/session/*` | VioTVSDK |
| `POST /api/sdk/tv/cart-intent` | `POST /v2/tv/cart-intent` | VioTVSDK |
| `POST /api/sdk/tv/broadcasts/:id/shoppable-ad` | `POST /v2/tv/broadcasts/:id/shoppable-ad` | VioTVSDK |
| `GET /api/commerce/products` | `GET /v2/commerce/products` | both SDKs |
| `GET /api/commerce/sponsors/:id/catalog` | `GET /v2/commerce/sponsors/:id/catalog` | both SDKs |
| `POST /api/broadcasts/:id/shoppable-ad` (Bearer) | `POST /v2/admin/broadcasts/:id/shoppable-ad` | platform ops |

### 12.2 Pending — v1 still live until iOS migrates (9 routes)

iOS SDK still calls these. Backend handlers stay 200 until the matching `/v2/mobile/*` ships. Tracked in `IOS_V2_MIGRATION_GAP.md`.

| Old path (still 200 OK) | New path (planned) | PR tracker |
|---|---|---|
| `GET /v1/sdk/broadcasts/:id/lineup` | `GET /v2/mobile/broadcasts/:id/lineup` | PR D |
| `GET /v1/sdk/broadcast?contentId=` | `GET /v2/mobile/broadcasts/resolve?contentId=` | PR D |
| `GET /v1/campaigns/:id/config` | `GET /v2/mobile/campaigns/:id/config` (or fold into `/v2/mobile/config`) | PR A |
| `GET /v1/engagement/config` | `GET /v2/mobile/broadcasts/:id/engagement/config` (or fold into capabilities) | PR B |
| `GET /v1/localization/:lang` | `GET /v2/mobile/localization/:lang` (or bundle locally) | PR E |
| `GET /v1/engagement/polls` | `GET /v2/mobile/engagement/broadcasts/:id/polls` | PR C |
| `POST /v1/engagement/polls/:id/vote` | `POST /v2/mobile/engagement/polls/:id/vote` | PR C |
| `GET /v1/engagement/contests` | `GET /v2/mobile/engagement/broadcasts/:id/contests` | PR C |
| `POST /v1/engagement/contests/:id/participate` | `POST /v2/mobile/engagement/contests/:id/participate` | PR C |

### 12.3 Retired — handlers deleted, no successor (commit `374a3ae`, 2026-04-29)

These v1 routes had **zero callers** across the 3 SDKs, the dashboard, and any backend script. Removed entirely from `server/routes.ts` (894 lines deleted, drift verified by content-type probe — paths return Vite SPA fallback, not handler JSON):

- **SDK legacy (8)** — replaced by `/v2/mobile/config` + WS or had no consumer:
  `/v1/sdk/campaigns`, `/v1/sdk/config`, `/v1/offers`, `/v1/sdk/livescores`, `/v1/sdk/components`, `/v1/sdk/broadcasts/:id/{chat,score,stats}`.
- **Bearer admin CRUD (16)** — predates the dashboard; never connected to any frontend or external admin tool:
  `/v1/broadcasts` (5 verbs), `/v1/campaigns/:id/broadcasts`, `/v1/broadcasts/:id/{polls,contests}` (4), `/v1/{polls,contests}/:id` (CRUD), `/v1/polls/:id/results`, `/v1/contests/:id/participations`.

### 12.4 Unchanged (`/api/*` dashboard surface)

Everything under `/api/*` that is session-cookie auth (dashboard CRUD for campaigns, sponsors, slots, broadcasts, analytics, uploads, form-state, **placement control plane**, etc.) stays. Those are not SDK-facing — they live in §7 "Control plane" of this doc.

## 13. Rollout

1. **Contract freeze** — this doc + updated `openapi.yaml` merged to
   `develop`. Kotlin spec docs updated to reference v2 paths only.
2. **Backend alias routes** — add `/v2/mobile/*`, `/v2/tv/*`, `/v2/commerce/*`,
   `/v2/admin/*` as thin forwards to the existing handlers. Zero logic change.
   Every old path keeps working (so no big-bang break).
3. **openapi + Postman** — tag every endpoint by surface, publish v2
   collection.
4. **iOS SDK migration** — rename URLs in one patch release. Ship.
5. **VioTVSDK migration** — rename URLs, demo config updated.
6. **Kotlin SDKs** — code against v2 from day 1 (never touch v1).
7. **Partner contract formalisation** — add `partner_webhook_secret` column,
   implement HMAC signing, update partner mock to verify signature, publish a
   signed-integration card.
8. **v1 retirement** — cutover date (announced in release notes). Old paths
   respond `410` with `Link` to successor. Sentry alert on any 410 hit to
   catch SDK versions still in the wild.

Estimated total ~5 working days across backend. SDK migrations are 0.5 day
each. Zero downtime — alias + 410 means there is never a moment when a live
SDK has no server to talk to.

## 14. Out of scope for v2

- WebSocket connection URL restructure — deferred, not needed now.
- GraphQL federation — no plan.
- gRPC — no plan.
- A second Commerce vendor — the proxy abstracts per-sponsor, which is
  enough.

## 15. Open decisions (blocks merge of this doc)

| # | Decision | Default if not decided |
|---|---|---|
| D1 | `partner_webhook_secret` column name + migration timing | Add in Phase 3 before Kotlin's FCM receiver lands. |
| D2 | v1 retirement cutover date | 4 weeks after v2 alias routes ship. |
| D3 | Keep `apiKey` query-param fallback, or require `X-API-Key` header only | Keep fallback for 1 release, drop at v1 retirement. |
| D4 | WS `ping` cadence — currently 30s server-driven; Kotlin spec wants 45s | Confirm with the Kotlin dev before they implement. |

These blocks are trivial to resolve — tagged here so they are not forgotten.
