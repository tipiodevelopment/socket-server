# Multi-Sponsor + Cart-Intent Attribution — Rollout Roadmap

Tracks everything from **today (2026-04-23, develop post Phase 3)** to
**production-ready across all platforms + partners**.

This is a living doc. Tick items as they land. Status legend:
✅ done · 🟡 in progress · ⏳ queued · 🔴 blocked

## Where we are today

### ✅ Landed on `develop`

| Area | Highlights |
|---|---|
| **Backend** | Multi-sponsor schema (Phase 1+2+3 applied on Neon `develop`), `/api/sdk/tv/broadcast/subscribe`, `/api/sdk/tv/cart-intent` v2 minimal body, `/api/sdk/tv/session/*`, `/api/commerce/sponsors/:id/catalog`, `persistAndBroadcastShoppableAd` unified helper with avatar validation (422 `SPONSOR_MISSING_AVATAR`), shoppable_ad WS event with `sponsorId` + `activationId` + full sponsor block with `avatarUrl`, Commerce `images` 500 fallback. |
| **Apple TV SDK** | `VioTV.connect(broadcastId:)` subscribe flow, WS ping/pong, avatar overlay, demo picker (registered vs soft-miss), back button, `broadcastId` rename. |
| **iOS SDK** | v2 SDK config consumer (primary + secondaries + commerce keys), `CartIntentEvent.activationId + sponsorId` decode, `publishCartIntentIfChanged` dedup, `CommerceSdkClientProvider.client(forSponsorId:)` per-sponsor routing, `ProductService.loadProduct(sponsorId:)`. |
| **Dashboard** | `SponsorCatalogPicker` (sponsor-scoped Commerce browse), edit slot UI, inline "link sponsor to campaign", userId-aware sponsor listing. |
| **Docs** | `multi-sponsor-architecture.md` (§7.4 TV + §6.7 cart-intent), `SHOPPABLE_AD_AUTHORING.md`, `PHASE_3_ENFORCEMENT.md`, `VioSwiftSDK/CART_INTENT_FLOW.md`, `InteractiveAds-vio/SDK_ARCHITECTURE.md`, openapi.yaml + Postman. |

### 🟡 In transit (verified on test but not proven with real partner traffic)

- TV → Mobile end-to-end was validated with two simulators on the same Mac,
  both identified as `demo_user_001`. **Needs real-device confirmation**
  (Apple TV hardware + iPhone) on the dev Cloudflare tunnel.
- Phase 3 enforcement applied to Neon `develop` branch. **Production DB
  unchanged** — migration + orphan cleanup still to do.

## Phase 0 — Finalize today's work (this week)

| # | Task | Owner | Status |
|---|---|---|---|
| 0.1 | Real-device TV2 E2E dry-run (physical Apple TV + physical iPhone, dev tunnel) | QA + Angelo | ⏳ |
| 0.2 | Bug-bash round on the dashboard slot authoring (create, edit, delete, fire, search, inline add sponsor) | Angelo | ⏳ |
| 0.3 | ~~Backend dedup cart_intents~~ — **decision 2026-04-23**: dedup stays SDK-side. Backend keeps every tap as an analytics signal. iOS already dedups in `publishCartIntentIfChanged`; Kotlin spec requires the same. | — | ✅ resolved |
| 0.4 | Commerce team ticket: `Product.images` non-nullable while data returns null. Opened by Angelo. Mitigation already in backend (fallback to `{ id title }` query). | Angelo → Commerce | 🟡 ticket filed |
| 0.5 | Drop legacy `campaigns.sponsor_id` column (develop applied 2026-04-23). Production not applicable — no production env yet. | Angelo | ✅ done |

## Phase 1 — Kotlin SDKs (next 2-3 weeks)

### 1.1 — Android TV SDK (`vio-tv-sdk`)

Spec: [`KOTLIN_TV_SDK_SPEC.md`](./KOTLIN_TV_SDK_SPEC.md) — 1:1 port of
`InteractiveAds-vio`.

| # | Task | Dependency | Status |
|---|---|---|---|
| 1.1.1 | Gradle module scaffold + CI publish workflow | — | ⏳ |
| 1.1.2 | Core models (`ShoppableAdEvent`, `VioTVSponsor`, `VioTVSubscribeResponse`) + `kotlinx.serialization` | 1.1.1 | ⏳ |
| 1.1.3 | `VioTVConfiguration` + loader for `vio-config.json` from assets | 1.1.2 | ⏳ |
| 1.1.4 | `VioTVManager.connect(broadcastId:)` — subscribe + WS open + identify + heartbeat | 1.1.3 | ⏳ |
| 1.1.5 | WS app-level ping/pong responder | 1.1.4 | ⏳ |
| 1.1.6 | `sendCartIntent` with v2 minimal body | 1.1.4 | ⏳ |
| 1.1.7 | `VioTVShoppableOverlay` Compose for TV (avatar + product card + CTA) | 1.1.2 | ⏳ |
| 1.1.8 | `VioTVCommerceService` per-sponsor GraphQL enrichment | 1.1.4 | ⏳ |
| 1.1.9 | Demo app `demo/tv2demo-androidtv` (broadcast picker + player + back button) | 1.1.1-8 | ⏳ |
| 1.1.10 | Unit tests for JSON decode + subscribe response + commerce(forSponsorId:) | 1.1.2-3 | ⏳ |
| 1.1.11 | Emulator E2E test: subscribe → WS → shoppable_ad → cart-intent round-trip | 1.1.9 | ⏳ |

### 1.2 — Android Mobile SDK (`vio-mobile-sdk`)

Spec: [`KOTLIN_MOBILE_SDK_SPEC.md`](./KOTLIN_MOBILE_SDK_SPEC.md) — mirror of
`VioSwiftSDK` cart-intent receive path.

| # | Task | Dependency | Status |
|---|---|---|---|
| 1.2.1 | Gradle module scaffold | — | ⏳ |
| 1.2.2 | `VioConfiguration` + `VioSponsor` + v2 bootstrap consumer | 1.2.1 | ⏳ |
| 1.2.3 | `CartIntentEvent` parser — canonical + legacy + FCM userInfo | 1.2.1 | ⏳ |
| 1.2.4 | `CampaignWebSocketManager` with identify + cart_intent dispatch | 1.2.2-3 | ⏳ |
| 1.2.5 | `CampaignManager.publishCartIntentIfChanged` dedup | 1.2.3 | ⏳ |
| 1.2.6 | `CommerceSdkClientProvider.client(forSponsorId:)` | 1.2.2 | ⏳ |
| 1.2.7 | `ProductService.loadProduct(sponsorId:)` | 1.2.6 | ⏳ |
| 1.2.8 | FCM receiver helper (`handlePushNotification(userInfo)`) | 1.2.3 | ⏳ |
| 1.2.9 | Demo TV2 Android — opens product detail via sponsor-scoped commerce | 1.2.1-8 | ⏳ |
| 1.2.10 | Unit tests — parser, dedup, per-sponsor routing | 1.2.3, 1.2.5-6 | ⏳ |
| 1.2.11 | Instrumented test — FCM + WS send same event, overlay opens once | 1.2.9 | ⏳ |

### 1.3 — Kotlin cross-cutting

| # | Task | Status |
|---|---|---|
| 1.3.1 | Decide Maven Central org + group id; register | ⏳ |
| 1.3.2 | Snapshot vs release versioning scheme (SemVer; 0.x during beta) | ⏳ |
| 1.3.3 | Release `vio-tv-sdk 0.1.0-SNAPSHOT` after 1.1.11 passes | ⏳ |
| 1.3.4 | Release `vio-mobile-sdk 0.1.0-SNAPSHOT` after 1.2.11 passes | ⏳ |

## Phase 2 — Dashboard polish (parallel with Kotlin)

| # | Task | Nice-to-have / must-have | Status |
|---|---|---|---|
| 2.1 | Edit scheduled components (not slots) — `scheduled_components` has the same lifecycle gap as `broadcast_sponsor_slots` did | must-have if scheduler is used | ⏳ |
| 2.2 | "Clone slot" button — duplicate an existing slot into a new row (faster authoring for demos with multiple products) | nice-to-have | ⏳ |
| 2.3 | Analytics mini-panel on broadcast detail — show last 10 `shoppable_ad_activations` + `cart_intents` with source attribution | nice-to-have | ⏳ |
| 2.4 | Campaign settings — expose `tv_enabled` + `tv_platforms` toggle on client_apps | must-have before onboarding a new partner | ⏳ |
| 2.5 | Sponsor editor — make `avatar_url` a required field with upload widget (currently operator can leave it null and the backend will 422 later) | must-have | ⏳ |

## Phase 3 — Backend follow-ups

| # | Task | Trigger | Status |
|---|---|---|---|
| 3.1 | Legacy column drop — `campaigns.sponsor_id`, `campaigns.reachu_*`, `campaigns.payment_methods`, `client_apps.reachu_api_key`, `users.reachu_user_id` | After 2 SDK release cycles consume v2 everywhere | ⏳ |
| 3.2 | Commerce webhook receiver — when a cart_intent results in a purchase, close the attribution row (`cart_intents.fulfilled_at`, new column) | Commerce team delivers webhook shape | 🔴 blocked on Commerce spec |
| 3.3 | Admin dashboard for cart_intents + activations — list, filter, export CSV (currently only via API) | Product/Ops request | ⏳ |
| 3.4 | Rate-limit the TV cart-intent endpoint (currently unbounded — same tap × 10 creates 10 rows) | before partner onboarding | ⏳ |
| 3.5 | Multi-node WS + Redis cluster — verified locally single-node; production needs the Redis-enabled path re-tested after Phase 3 | production deploy | ⏳ |

## Phase 4 — Production cutover

> **Context 2026-04-23**: we don't have a production environment today. `develop`
> (Neon `br-royal-mode-a8e8mdq1`) is the only live environment. This phase
> activates the day the operator decides to spin up `production`.

### 4.1 — Pre-flight (when production is created)

| # | Task | Status |
|---|---|---|
| 4.1.1 | Create production Neon branch (likely fork from develop after a stable milestone) | ⏳ |
| 4.1.2 | Apply Phase 1+2+3 SQL to production branch (follow `PHASE_3_ENFORCEMENT.md` — orphan review + drop legacy column) | ⏳ |
| 4.1.3 | Create Neon backup branch from production before any schema change | ⏳ |
| 4.1.4 | Verify every production sponsor has `avatar_url` set (blocker — backend now 422s on dispatch when missing) | ⏳ |
| 4.1.5 | Redis cluster wiring check — dual-delivery path falls back to webhook if Redis is down, verify the failover works on production infra | ⏳ |
| 4.1.6 | Decide Cloudflare tunnel vs direct DNS for production SDK endpoints | ⏳ |

### 4.2 — Partner onboarding sequence

Process per partner (TV2 is first):

1. Operator sets `client_apps.tv_enabled = true` + populates `tv_platforms` array.
2. Operator provides `webhook_url` + `partner_device_register_url` for push.
3. Operator creates campaign → assigns primary sponsor (required) + secondaries.
4. Operator uploads sponsor avatars (blocking).
5. SDK teams deliver AAR / XCFramework builds targeting dev env first.
6. Dry-run on Cloudflare tunnel: Apple TV demo + iOS demo + Dashboard.
7. QA sign-off on Apple TV → iPhone E2E.
8. Point both SDKs at `testing` env (api-dev).
9. QA sign-off on testing env.
10. Flip env to `production`. Keep a feature flag on the partner app for 24h
    so rollback is one config push.

### 4.3 — Observability

**Stack decision (2026-04-23)**: no observability tooling today. Using Azure
credits + free tiers to start:

- **Backend (socket-server)** → **Azure Application Insights**. Node.js
  auto-instrumentation via `applicationinsights` npm package. Log custom events:
  - `CartIntentDispatched` — props: `deliveryMode`, `sponsorId`, `activationId`,
    `userConnected`, `cartIntentId`.
  - `ShoppableAdDispatched` — props: `source` (admin-api/dashboard/tv-sdk/
    slot-scheduler), `sponsorId`, `campaignId`, `activationId`.
  - `SubscribeOutcome` — props: `clientAppId`, `subscribed`, `reason` (nullable).
  - `CommerceGraphQLFallback` — when the rich query 500s and we fall back to
    minimal, count the occurrences per sponsor.
  - Integrates with Azure alerts natively; credits cover ingestion.
- **SDKs (iOS + Apple TV + Kotlin x2)** → **Sentry free tier** (5k errors/month,
  unlimited users, 1-project retention). Best-in-class crash reporting for
  Swift/Kotlin/Android TV. Mobile SDK adds ~100 KB per platform.
- **Visual dashboards later** → once App Insights queries get cumbersome, wire
  **Grafana Cloud free** (10k metrics, 50 GB logs, 50 GB traces) as a secondary
  — App Insights ships a connector.

Initial alerts (Azure Monitor):

| # | Alert | Threshold | Status |
|---|---|---|---|
| 4.3.1 | `cart_intents.delivery_mode = 'dropped'` rolling 15m count | >1% of total dispatches | ⏳ |
| 4.3.2 | `/api/sdk/tv/broadcast/subscribe` soft-miss rate per client_app | >20% over 1h | ⏳ |
| 4.3.3 | `SPONSOR_MISSING_AVATAR` 422 count | >0 (should stay 0 post-onboarding) | ⏳ |
| 4.3.4 | Backend p95 latency on `/api/sdk/tv/cart-intent` | >2s over 5m | ⏳ |
| 4.3.5 | Sentry: new crash in any SDK | immediate (pager) | ⏳ |

Visual dashboards (App Insights Workbooks or Grafana later):

| # | Panel | Status |
|---|---|---|
| 4.3.6 | Shoppable_ad dispatches / hour per sponsor | ⏳ |
| 4.3.7 | cart_intents by delivery_mode (ws / dual / webhook / apns / dropped) | ⏳ |
| 4.3.8 | Active tv_sessions / concurrent connections | ⏳ |
| 4.3.9 | Upstream Commerce GraphQL error rate (isolates "is it them or us?") | ⏳ |

## Phase 5 — Post-launch hardening

| # | Task | Status |
|---|---|---|
| 5.1 | `cart_intents.fulfilled_at` — close the loop with Commerce webhook (see 3.2) | ⏳ |
| 5.2 | `impressions` — Mixpanel-based today, consider local persistence if Product wants campaign-level impression audits | ⏳ |
| 5.3 | Engagement sponsor_id routing — polls/contests currently ignore sponsorId on the SDK side; sponsor-branded polls need the same treatment as cart-intent overlays | ⏳ |
| 5.4 | Retire legacy mobile cart-intent endpoint (`/api/campaigns/:id/cart-intent`) — v2 replacement is `/api/sdk/tv/cart-intent`, but the mobile path is still used by the iOS SDK for in-app cart intents. Decide unification path. | ⏳ |
| 5.5 | Engagement Kotlin SDK — if partners want polls/contests on Android, a separate spec + port is needed | ⏳ |

## Ownership map (tentative, to confirm tomorrow)

| Area | Primary | Backup |
|---|---|---|
| Backend + dashboard | Angelo | Alan |
| Apple TV SDK + iOS SDK | Angelo | — |
| Android TV SDK + Mobile SDK | Kotlin dev (TBD name) | Angelo (review only) |
| QA + real-device testing | QA team | — |
| Commerce integration (webhook, images fix) | Commerce team | Angelo (liaison) |

## Decision log (as of today)

- **reachu is 100% out** — no data migration from reachu users; end-users
  register fresh via `ensure_user` / `/v2/sdk/config` bootstrap.
- **v2 only, no parallel v1 window** — `/v2/sdk/config` is the single bootstrap.
- **Per-sponsor commerce keys mandatory** — no global fallback in prod. Dev-only
  fallback via `vio-config.json` `commerceApiKey` still accepted.
- **`broadcastId` over `contentId`** — config JSON key standardised across all
  SDKs.
- **Avatar required for shoppable dispatch** — 422 `SPONSOR_MISSING_AVATAR`.
  Visual-only sponsors can live in the campaign but cannot back a `product` slot.
- **Dual delivery default on** — `CART_INTENT_DUAL_DELIVERY=true`. The iOS and
  (future) Android SDKs must dedup by `activationId` to avoid duplicate overlays.
- **Backend does not dedup cart_intents** — each tap writes a row. Open for
  revision (see 0.3).

## Risk register

| Risk | Mitigation |
|---|---|
| Commerce upstream `images` null brings down shoppable_ad dispatch | Already mitigated: backend falls back to `{ id title }` query |
| Partner doesn't implement WS dedup → overlay opens 2× | Enforced on iOS, will be enforced on Android via spec §6 |
| Sponsor commerceApiKey rotated without updating Vio → 401 on GraphQL | Already handled: `runWithCommerceAuthRetry` refreshes bootstrap on 401 |
| Operator deletes a campaign with active cart_intents | Currently cascade-deletes cart_intents rows. Consider soft-delete post-launch |
| Production orphan campaigns — partners have real data in fields we assumed dead | `PHASE_3_ENFORCEMENT.md` playbook forces a per-row review before NOT NULL flip |
| Backend Redis down → multi-node cart-intent broadcast misses | Single-node fallback already works; if Redis hosts both nodes, dropout is minutes-long and self-heals |
