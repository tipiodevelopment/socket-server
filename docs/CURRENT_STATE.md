# Vio — Current State (live truth)

> **Purpose**: one file to regain context after a compaction, a break, or a
> new session. If you read only one doc, read this.
>
> **Last updated**: 2026-04-28 — Placement model **pivoted to dashboard-driven** (sprint 2026-04-27 PM + 2026-04-28 morning). The morning's "self-service named placements via SDK manifest" was retired; SDK now declares only slot **locations**, operator creates **named placements** in the dashboard against those slots, campaigns bind to placements. Migration `0004_named_placements_consolidation.sql` applied to `local/angelo-…` Neon branch. iOS carousel renders operator-controlled header (title + sponsor logo) with SVG-capable image renderer. Two open feature branches awaiting review.

This doc is the single source of truth for:
- Which branch + commit of each repo is the working tip
- Which Neon DB branch the backend is hitting
- Which services are up (backend, tunnel, partner mock)
- What demo data exists to test with
- What PRs are open, what's waiting, what's next
- Current phase of work + operational rules locked

---

## 1. Repositories (3)

| Repo | Local path | Active branch | HEAD | Purpose |
|---|---|---|---|---|
| socket-server (backend + dashboard) | `/Users/angelo/vio-backend/socket-server` | `feature/placements-app-placements-table` | `74b39c7` | named-placements consolidation (migration 0004 + dashboard-driven placement creation + carousel header config form). Awaiting review/merge to develop. |
| VioSwiftSDK (iOS SDK) | `/Users/angelo/VioSwiftSDK` | `feature/placements-named-instances` | `95eafdb` | iOS SDK paired with the backend pivot — manifest declares only locations[], carousel renders operator-controlled header with SVG-capable image renderer. Awaiting merge to develop. |
| InteractiveAds-vio (Apple TV SDK) | `/Users/angelo/Documents/GitHub/InteractiveAds-vio` | `main` | merged to main via PR #3 (6a23bdf) | unchanged. New backend ships `avatarUrl` alongside `logoUrl` (additive — Apple TV SDK reads same fields it did before, plus optionally avatarUrl in places that already supported it). |

**Develop tips before the in-flight feature work** (cuando el feature work merge, develop avanza desde aquí):
- socket-server `develop` @ `ac8256a` — placement self-service runtime morning state (pre-pivot)
- VioSwiftSDK `develop` @ `0d3383d` — Phase C named-placement SDK API (will be replaced by feature/placements-named-instances)

**Branches already merged (don't reuse)**:
- socket-server `feature/api-v2-cut` → develop (PR #13)
- socket-server `docs/architecture-overview` → develop (PR #14)
- socket-server `fix/dashboard-sponsors-show-primary` → develop (PR #15)
- socket-server `fix/dashboard-app-tv-settings` → develop (PR #16)
- socket-server `docs/session-state-post-dashboard-sprint` → develop (PR #20)
- socket-server `fix/campaign-sponsors-primary-v2` → develop (PR #21)
- socket-server `fix/shoppable-moments-unified-v2` → develop (PR #22)
- socket-server `fix/broadcast-detail-tv-gate-v2` → develop (PR #23, rebased onto #22 before merge — stripped obsolete rename hunks)
- socket-server `docs/state-after-pr-rebranch` → develop (PR #24)
- socket-server `refactor/route-user-event` → develop (PR #26)
- socket-server `docs/post-unification-state` → develop (PR #27)
- socket-server `feature/placements-manifest-registry` → develop (PR #29 — backend foundation: `/v2/mobile/components/manifest`, `app_component_locations` table, `getCanonicalComponentByType`, 17 jest tests)
- socket-server `feature/placements-dashboard-pickers-on-29` → develop (PR #32 — dashboard location/sponsor/product pickers + `GET /v2/mobile/campaigns/:id/components` with template+overlay merge. Replaced PR #30 after rebase, since #30 auto-closed when its base #29 branch was deleted on merge)
- VioSwiftSDK `feature/api-v2-urls` → develop (PR #3)
- VioSwiftSDK `refactor/unify-cart-intent-paths` → develop (PR #4)
- VioSwiftSDK `fix/confirmation-sheet-active-sponsor-logo` → develop (PR #7)
- VioSwiftSDK `fix/cart-intent-loader-feedback` → develop (PR #5)
- VioSwiftSDK `feature/placements-registry` → develop (PR #8 — `VioPlacementRegistry` + manifest upload + cold-start fetch + `(id, locationId)` dedupe + per-sponsor `ProductService.loadProducts(sponsorId:)` plumbing)
- InteractiveAds-vio `feature/api-v2-urls` → main (PR #3)

**Closed without merge (do not reopen)**:
- socket-server #28 (`docs/state-runtime-snapshot-2026-04-26`) — outdated by the time it landed
- socket-server #30 (`feature/placements-dashboard-pickers`) — auto-closed by GitHub when base branch #29 was deleted on merge; replaced by #32 (rebased onto develop)
- socket-server #31 (`docs/post-pr32-merge-state`) — premature snapshot, superseded by this update
- VioSwiftSDK #6 (`fix/confirmation-sheet-active-sponsor-logo`) — superseded by #7 (better fix anchored on `CommerceSdkClientProvider.activeSponsorId`)

## 2. Rules locked (2026-04-24, last extended 2026-04-27)

1. **VioSwiftSDK NEVER merges to `main`**. main is the v0.1.0-alpha release branch. All work lives on `develop` + feature branches off develop. PRs target develop.
2. **InteractiveAds-vio works on `main`**. Apple TV repo has no develop. Feature branches off main, PRs target main.
3. **No force-push** on shared branches. Incident precedent: `docs/multi-sponsor-architecture` got force-pushed by another session earlier — response was to create a fresh branch off develop, not to fight back. Same playbook if it happens again.
4. **No v1 fallbacks in SDK code**. No "try v2 → catch → call v1" logic. Remaining v1 calls are direct calls for unmigrated features, not fallbacks.
5. **No hardcoded apiKeys in SDK code**. Commerce keys come only from per-sponsor blocks in `/v2/mobile/config` (iOS) and `/v2/tv/broadcast/subscribe` (Apple TV).
6. **No auto-merge of PRs** by the assistant. Open the PR, push the branch, tell the user the URL and what to test. User triggers merge with explicit "merge #NN". Applies to code AND docs (consistency > special cases).
7. **No new doc files** (added 2026-04-27). When state changes, update existing docs in place: `CURRENT_STATE.md`, `DB_AND_ENDPOINTS.md`, `ARCHITECTURE_OVERVIEW.md`, `TASK_PLACEMENTS.md`, `multi-sponsor-architecture.md`, `API_V2_CONTRACT.md`, `IOS_V2_MIGRATION_GAP.md`, `ROLLOUT_ROADMAP.md`, KOTLIN specs. Don't create one-off snapshot/state docs (`docs/state-runtime-snapshot-...`, `docs/post-...-state.md`, etc.) — they go stale within hours and pollute the doc tree. If a new concept legitimately needs its own file, ask first.
8. **No AI attribution in commit messages** (already in user memory). Skip the `Co-Authored-By: Claude…` trailer.

## 3. Open PRs awaiting user review

**None.** All PRs from the placements sprint landed 2026-04-27. Develop tips for both repos are listed in §1.

**Historical closed / superseded** (do not reopen):
- #10 superseded by #11 (was a force-push casualty)
- #11 superseded by #13 (docs folded into the v2 cut)
- #12 superseded by #13 (idem)
- #17 superseded by #23 (rebranched off fresh develop 2026-04-24)
- #18 superseded by #21 (idem)
- #19 superseded by #22 (idem)
- #28, #30, #31 — see §1 "Closed without merge" for the placements-cycle casualties

## 4. Runtime state (local dev)

| Service | Status | Address |
|---|---|---|
| Backend (socket-server) | 🟢 up | `node` PID rotates each restart — latest on `:5001` |
| Cloudflare tunnel | 🟢 up | `https://api-local-angelo.vio.live` → `localhost:5001` |
| Partner mock (Azure) | 🟢 up | `https://viopartnermockv2.azurewebsites.net` (~3s cold start) |
| Vite frontend | 🟢 up | dashboard at `localhost:5001` (same process) |

Backend is launched via `npm run dev` which runs `tsx server/index.ts` **without `--watch`**. After editing `server/*.ts` you must `kill <pid> && npm run dev` for changes to load. The frontend (`client/src/*`) reloads via Vite HMR automatically.

## 5. Database state (Neon)

**⚠️ Seguimos usando `local/angelo-…` localmente — develop refrescado 2026-04-27 para que otros devs puedan trabajar.**

| Branch | ID | Endpoint host | Role |
|---|---|---|---|
| `local/angelo-20260423-1814` | `br-summer-morning-a8y0i36l` | `ep-odd-tree-a8c6hlj0` | **🟢 active** — `DATABASE_URL` + `PGHOST` apuntan aquí. Forkeada de develop 2026-04-23 18:14. Phase 3 NOT NULL aplicada. Campaign 36 sponsors alineados con keys reales. Broadcast `barcelona-psg-2026-03-03` con `endTime` pushed + `status=live` para smoke. |
| `develop` | `br-royal-mode-a8e8mdq1` | `ep-summer-star-a89av46e` | 🟢 **refrescado 2026-04-27 12:34 UTC desde local** vía Neon's `restore` (preserve_under_name). Mismo schema + datos del sprint. Nadie tiene que re-forkear para trabajar. |
| `backup/develop-pre-promote-20260427-1435` | `br-still-rice-a8ms51nu` | (suspended) | snapshot atómico del develop pre-promote, by-product del restore. **No tocar** — safety net. |
| `feature/placements-v2-20260423-1250` | `br-damp-snow-a8rv0cnc` | (suspended) | idle safety net del fork inicial del sprint |
| `dev/jhondev`, `dev/alan` | — | — | idle, may want to re-fork from develop now if they need fresh data |
| others | (production, staging, test/*, backup/*) | — | idle / historical |

**`.env` backups**:
- `/tmp/vio-env-develop-before-placements.bak` (12:50)
- `/tmp/vio-env-placements-v2-before-local-fork.bak` (18:14)

**Scheduler gotcha**: `server/scheduler.ts:264` auto-flips broadcasts to `status='ended'` when `endTime < now`. To keep `barcelona-psg-2026-03-03` live, endTime was pushed to ~2026-05-24 via direct SQL. If the user reports the broadcast going inactive again, re-push endTime.

## 6. Demo data (active DB — campaign 36 "Tv2 Demo Campaign")

### Client app

`#18 TV2` — apiKey `tv2_api_key_91b4fbf634af4bc5`, `tvEnabled=true`, `tvPlatforms=['apple-tv']`, webhook + deviceRegister → partner mock.

### Campaign 36 sponsors (aligned 2026-04-24)

| Sponsor | Role | Commerce apiKey (first 8) | paymentMethods | Test product |
|---|---|---|---|---|
| **#3 Elkjøp** | primary | `5HPHWJY-…` | klarna, stripe_link, vipps, **apple_pay**, google_pay | `408895` Samsung 75" QN85F Neo QLED TV (17990 NOK) |
| **#4 Torshov Sport** | secondary / shoppable | `36EHG0M-…` | full set incl apple_pay | `408898` Nike Norge Fotballdrakt 2026 (999 NOK) |
| **#7 XXL** | secondary / full | `KCXF10Y-…` | full set incl apple_pay | `408841` FC Barcelona Dri-Fit Jersey (759 NOK) |

### Broadcasts on campaign 36

- `barcelona-psg-2026-03-03` — **status=live** (endTime pushed), engagement enabled. Main test broadcast.
- `tv2-eliteserien-live-2026-03-08` — status=live (original), engagement enabled.
- `tv2-viking-haugesund-2026-03-09` — status=ended.

### Apple TV demo config (`InteractiveAds-vio/Demo/tv2demo-appletv/Configuration/vio-config.json`)

```json
{
  "apiKey": "tv2_api_key_91b4fbf634af4bc5",
  "environment": "development",
  "backendUrl": "https://api-local-angelo.vio.live",
  "webSocketUrl": "wss://api-local-angelo.vio.live/ws",
  "commerceUrl": "https://graph-ql-dev.vio.live/graphql",
  "country": "NO"
}
```

No `commerceApiKey` hardcoded. Commerce keys arrive per-sponsor via `/v2/tv/broadcast/subscribe` response.

## 7. API v2 surface (live on develop)

13 SDK-facing routes renamed in the direct cut (PR #13). Full contract in `API_V2_CONTRACT.md`. Summary:

```
/v2/tv/broadcast/subscribe          POST  apiKey    Apple TV bootstrap
/v2/tv/session/{start,heartbeat,end} POST apiKey    TV session lifecycle
/v2/tv/cart-intent                  POST  apiKey    TV tap → cart_intent
/v2/tv/broadcasts/:id/shoppable-ad  POST  apiKey    TV + test dispatch

/v2/mobile/config                            GET  apiKey  iOS bootstrap
/v2/mobile/broadcasts/:id/capabilities       GET  apiKey
/v2/mobile/broadcasts/:id/components         GET  apiKey
/v2/mobile/campaigns/:id/cart-intent         POST apiKey  in-app tap
/v2/mobile/campaigns/:id/register-device     POST apiKey  APNs/FCM token

/v2/commerce/products                        GET  apiKey
/v2/commerce/sponsors/:id/catalog            GET  apiKey  ← PR #22 also fixes dashboard hook pointing at this path

/v2/admin/broadcasts/:id/shoppable-ad        POST Bearer  platform admin
```

Dashboard operator routes stay at `/api/*` (session auth, different audience). Legacy v1 paths still live on backend for the 9 iOS calls tracked in `IOS_V2_MIGRATION_GAP.md`.

## 8. Dashboard sprint completed today (2026-04-24)

Two iteration batches on top of the v2 cut, driven by the user reviewing the campaign 36 broadcast detail page.

### Batch 1 — already merged to develop

| PR | Change |
|---|---|
| #13 | Backend v2 direct cut — 13 routes renamed, postman regenerated |
| #14 | `ARCHITECTURE_OVERVIEW.md` onboarding doc + `multi-sponsor-architecture.md` update + consolidated docs |
| #15 | Campaign dashboard Sponsors tab shows primary sponsor in an amber card (was only showing secondaries) |
| #16 | New **Platforms** tab in app settings — toggle `tvEnabled` + pick `tvPlatforms` without SQL |

### Batch 2 — all merged to develop

Rebranched 2026-04-24: the original #17/#18/#19 were closed and recreated off fresh develop (post #20 merge) to eliminate stale-branch risk. Then merged in sequence #21 → #22 → #23. #23 was rebased before merge to strip the rename hunks that #22 had already subsumed.

| PR | Change |
|---|---|
| #21 | `/api/campaigns/:id/sponsors` now returns primary + secondaries as a single array (before: only secondaries). Fixes "data inconsistent across dashboard" — all callers see 3 sponsors now. (ex-#18) |
| #22 | Unified `Add Shoppable Moment` dialog replaces the 3 redundant surfaces (Sponsor Catalog grid + Pre-programmed Slots + Quick Fire). One form with `Fire now` / `Schedule for later` radio. Also fixes `useSponsorCatalog` hook hitting dead `/api/commerce/*` path. (ex-#19) |
| #23 | Broadcast detail: TV SDK gate banner (if `clientApp.tvEnabled=false`, hides TV-dependent sections and shows a link to Platforms tab). (ex-#17 — rename hunks dropped during rebase, only the gate banner landed) |

### Patches not in any PR (direct data fixes)

- **Broadcast `barcelona-psg-2026-03-03`**: `status='live'`, `endTime` pushed to 2026-05-24 so the scheduler doesn't auto-end it during testing.
- **`campaign_sponsors` on campaign 36**: deduped row where Elkjøp was simultaneously primary AND secondary (pre-existing data bug).
- **Sponsor commerce keys aligned**: Elkjøp → `5HPHWJY-…`, Torshov → `36EHG0M-…`, XXL → `KCXF10Y-…`. Before: all 3 shared the `KCXF10Y` key; aligned to what the user confirmed as the real keys.

## 9. Smoke test status (Phase 5) — ✅ CLOSED 2026-04-26

Apple Pay end-to-end completed for all 3 sponsors. Validation rows in `cart_intents`:

| ID | Sponsor | Product | Activation | Mode | Connected |
|---|---|---|---|---|---|
| 8  | Elkjøp (3) | 408895 Samsung QLED | 13 | websocket | true |
| 9+10 | Torshov Sport (4) | 408898 Nike drakt | 14 | websocket | true (duplicate — see §15) |
| 11 | XXL (7) | 408874 PSG drakt | 15 | websocket | true |
| 12 | XXL (7) | 408874 (refactor smoke) | 15 | webhook | false (curl test post-refactor) |

All 4 paths validated end-to-end:
- Apple TV WS connect via `/v2/tv/broadcast/subscribe` → 3 sponsor blocks with correct commerce keys
- TV remote tap → `/v2/tv/cart-intent` → backend WS fan-out → iOS receives
- iOS overlay loads product via per-sponsor commerce key
- Apple Pay sheet → completion → Commerce backend received the order
- DB attribution chain (`source_activation_id`) intact

**Bug found during smoke**: Torshov consistently produced 2 `cart_intents` per fire (intents 9 + 10 ~1.2s apart, both same activation 14). Root cause: SDK-scheduled local `UNNotificationRequest` re-entering the pipeline via `UNUserNotificationCenterDelegate`. Fixed in SDK PR #4 (drops the local notification path entirely). Backend PR #26 generalizes the delivery layer so future TV→user events don't repeat the same mistake.

## 10. iOS SDK — 9 legacy v1 calls still in code (deferred)

Tracked in `IOS_V2_MIGRATION_GAP.md`. NOT fallbacks — direct calls for features we haven't migrated yet. Each migrates when we advance to its feature domain:

- `/v1/campaigns/:id/config` (brand/theme)
- `/v1/engagement/config`, `/v1/engagement/polls|contests/*` (5 routes, engagement)
- `/v1/localization/:lang`
- `/v1/sdk/broadcasts/:id/lineup`
- `/v1/sdk/broadcast?contentId=` (Viaplay)

5 follow-up PRs (A-E) planned. Backend legacy handlers retire after each migration ships.

## 11. Placements plan (Hito 6) — ✅ runtime landed 2026-04-27

`TASK_PLACEMENTS.md` on socket-server. The original 12-step plan was reshaped during execution: instead of a rigid catalog/picker-based flow, the system pivoted to a **self-service registry** (dev declares components + locations once at app boot → manifest upload → operator picks from registered set). See §17 for the full architecture.

**Done end-to-end**:
- Steps 1-4 — backend WS event `sponsorId`, openapi schema, dashboard sponsor picker (tracked from earlier)
- **Self-service registry foundation** (PR #29) — `app_component_locations` table, `POST /v2/mobile/components/manifest`, `getCanonicalComponentByType`, 17 jest tests
- **Dashboard pickers + campaign-components endpoint** (PR #32) — operator picks location/sponsor/products from manifest data; `GET /v2/mobile/campaigns/:id/components` merges template + customConfig overlay
- **iOS runtime** (VioSwiftSDK PR #8) — `VioPlacementRegistry` + manifest upload at boot + cold-start fetch for `activeComponents` + `(id, locationId)` dedupe + per-sponsor `ProductService.loadProducts(sponsorId:)`
- **TV2 demo wired** — `TV2PlacementRegistration.registerAll()` registers 3 components + 5 locations; `HomeView` and `MatchDetailView` use `VProductCarousel(locationId:)`. Smoke test verde con Elkjøp en `home_top` y XXL en `match_pre_kickoff`.

**Deferred (out of original scope, not blocking)**:
- Steps 9-11 partial — `VProductSpotlight`, `VProductStore`, `VProductBanner`, `VProductSlider` still need the `sponsorId` plumbing (only `VProductCarousel` was migrated for the TV2 smoke). Migration follows the exact same pattern as `VProductCarousel.swift`.
- Scheduling fields (`scheduledTime` + `endTime`) — not needed for the smoke; deferred until first operator request.
- `Product.sponsorId` stamping at hydration — not needed today since `CartManager` already routes via `CommerceSdkClientProvider.activeSponsorId` (set by `ProductService.loadProducts(sponsorId:)`).

## 12. Kotlin SDKs (Hito 7, not started)

Task card written for Kotlin dev (see `TV+BACKEND+TELEFONO` Trello). Specs:
- `KOTLIN_TV_SDK_SPEC.md` — Android TV mirror of `InteractiveAds-vio`
- `KOTLIN_MOBILE_SDK_SPEC.md` — Android mobile mirror of `VioSwiftSDK`

Kotlin dev codes against v2 surface from day 1, tests with campaign 36 (TV2) AND a second campaign to catch TV2-specific assumptions.

## 13. How to resume in a fresh session

1. Read this doc top-to-bottom (especially §1 develop tips, §11 placements summary, §17 placement architecture).
2. `cd /Users/angelo/vio-backend/socket-server`.
3. Check backend: `lsof -nP -iTCP:5001 -sTCP:LISTEN` — if not running, `npm run dev &`.
4. Check PR state: `gh pr list --state open` — should be empty for both repos. If not, see if it's a leftover that needs closing.
5. Check local branches: `git branch` — `develop` is the latest working tip on socket-server (`f97bebd`) and VioSwiftSDK (`0d3383d`). Next work lives on fresh feature branches off develop.
6. See `ARCHITECTURE_OVERVIEW.md` for the big picture, `API_V2_CONTRACT.md` for endpoint shapes, `TASK_PLACEMENTS.md` for the placement plan history (now landed).
7. Quick smoke for placements: cold-start TV2 demo (`Demo/tv2demo/`), open dashboard ComponentsTab on campaign 36, verify location/sponsor pickers populate from registry. See §17 for full trace.

## 14. How to update this doc

State change worth persisting → new commit `docs(state): …`. Examples:
- PR merged → move row from §3 to §1 "merged branches".
- Smoke test completed → update §9.
- New PR opened → add to §3.
- Neon branch rolled → update §5 + §6 if data affected.
- Regla nueva → add to §2.

Keep terse. If a section grows past ~30 lines, extract + link.

## 15. Cart-intent unified architecture (post-refactor 2026-04-26)

Both backend (PR #26) and iOS SDK (PR #4) refactored on 2026-04-26 so the cart-intent path is **two transports → one dispatcher → one publisher**, with extension hooks for the next TV→user event type (poll_result, score_update, etc.) without copy-paste.

### iOS SDK — VioSwiftSDK

```text
   ┌──── WebSocket ──── CampaignWebSocketManager.onCartIntent ─────┐
   │                                                                │
   │                                                                ▼
   │                                          CampaignManager.dispatch(.cartIntent(event), source: .webSocket)
   │                                                                ▲
   │                                                                │
   └──── Real APNs ──── UNUserNotificationCenterDelegate ───────────┘
                                              handlePushNotificationUserInfo
                                              → applyCartIntentFromNotificationUserInfo
                                              → dispatch(.cartIntent(merged), source: .push)

   dispatch(.cartIntent(...), source: ...)
       └─► publishCartIntentIfChanged(event, channel: source.rawValue)
              └─► dedup by activationId / (productId, campaignId)
                  └─► activeCartIntentEvent = event  → overlay reacts via @Published
```

**Files**:
- `Sources/VioCore/Models/IncomingTVEvent.swift` — discriminated union (only `.cartIntent` case today; extension docs in the file itself)
- `Sources/VioCore/Managers/CampaignManager.swift` — `dispatch(_:source:)` is the single public entry point. Per-event publishers (`publishCartIntentIfChanged`) stay private, own their dedup
- `Sources/VioCore/Managers/CampaignWebSocketManager.swift` — WS adapter, no longer self-schedules local notifications

**Removed (legacy, post-PR #4)**: `scheduleCartIntentNotification`, `shouldSkipCartIntentLocalNotificationForForeground`, init-time `UNUserNotificationCenter.requestAuthorization`, hardcoded Spanish defaults, `import UserNotifications`, `import UIKit`, `CampaignManager.showsCartIntentLocalNotificationWhenAppIsActive` flag, `VioCampaignPartnerAPI.sendCartIntent` (was unused dead code).

### Backend — socket-server

```text
   /v2/mobile/campaigns/:id/cart-intent ──┐
                                          ├─► buildCartIntentEnvelope(...)
   /v2/tv/cart-intent ────────────────────┘     │
                                                ▼
                                          routeUserEvent({envelope, wsEvent, ...})
                                                │
                              ┌─────────────────┼─────────────────┐
                              ▼                 ▼                 ▼
                         (local WS)         (Redis cluster)    (offline → notifyUserEventViaPartner)
                                                                       │
                                                                  ┌────┴────┐
                                                                  ▼         ▼
                                                              webhook    APNs
```

**Helpers** (`server/routes.ts` top of file):
- `buildCartIntentEnvelope(args)` — single source of truth for v1 envelope shape. `activation_id + sponsor_id` optional (TV path includes; mobile path omits, matching pre-refactor behavior).
- `notifyUserEventViaPartner({envelope, ...})` — delivery only. Webhook if `clientApp.webhookUrl` set, else APNs (cart_intent-shaped today; guarded by `vio_event_type` for future expansion).
- `routeUserEvent({envelope, wsEvent, ...})` — canonical 3-branch dispatcher (local WS / Redis cluster / offline). Returns `{deliveryMode, userConnected}` for the caller to persist.

`wsUserMap` promoted to module-level so helpers can route without parameter plumbing.

### To add the next TV→user event type (e.g. `poll_result`)

1. Backend: write a `buildPollResultEnvelope(args)` (analogous to cart_intent), add a handler `/v2/tv/poll-result` that calls `routeUserEvent({envelope, wsEvent})`. ~30 lines.
2. iOS SDK: add `case pollResult(PollResultEvent)` to `IncomingTVEvent`, add `@Published var activePollResult` + `publishPollResultIfChanged` to `CampaignManager`, extend the `dispatch` switch. Wire WS adapter (in `bindWebSocketCallbacks`) and APNs adapter (extend the `switch resolved` in `handlePushNotificationUserInfo`). ~40 lines.
3. APNs builder in `server/services/ios-flow.ts` — generalize `sendAPNs(envelope)` if the new event needs notification-center surface (today it's cart_intent-shaped).

Total: ~70 lines vs the ~250 it would have taken before this refactor.

## 16. Known issues / tracked deferred (2026-04-26)

Issues observed during today's smoke + refactor that are **not blocking** Phase 7 (placements) but worth tracking:

| Severity | Issue | Where | Plan |
|---|---|---|---|
| Med | Apple Pay order arrived with `quantity=2` when expected 1 (only 1 of 3 sponsors). Likely `CartModule.addProduct` stacks (`existing.quantity + quantity`) instead of replacing when product is already in cart from a prior incomplete attempt. User says non-critical, will report if recurs. | `VioSwiftSDK/Sources/VioUI/Managers/CartModule.swift:551-572` | Confirm in next test whether cart was empty pre-fire. If recurring → either clear cart on `activeCartIntentEvent` set, or change semantics to `replace` when adding from shoppable_ad context. |
| Med | TV-side `setupCommerceEnrichment()` called twice during boot (once from `configure(...)`, once from `configureFromBundle(...)`) — possible race that re-emits `activeAd` and could re-render overlay with stale state. | `InteractiveAds-vio/Sources/VioTV/VioTV.swift:38, 48` | Idempotency guard or single entry point. Out of scope of iOS PR #4 (different repo, different surface). |
| Med | TV WS handler accepts both `type:'product'` (legacy) and `type:'shoppable_ad'` — backend only emits the latter today, so the legacy branch is dead but still parses if someone resurrects it. | `InteractiveAds-vio/Sources/VioTVCore/Managers/VioTVWebSocketManager.swift:104` | Remove legacy branch when we ship the next TV SDK release. |
| Low | `sendAPNs` in backend (`server/services/ios-flow.ts`) is still cart_intent-shaped — hardcoded Norwegian title `"Produkt lagt til"` + body template + legacy `vio_cartIntent_*` keys. | `server/services/ios-flow.ts:57-68` | Generalize `sendAPNs(envelope)` when next user-event type ships. Backend PR #26 already guards with `if eventType !== 'cart_intent' → skip APNs + log warning` so non-cart_intent envelopes don't accidentally send wrong-shaped pushes. |
| Low | Spanish hardcoded strings in `VioCastingUI` and `Demo/{Vg,tv2demo,Viaplay}/` (e.g., `"Producto agregado al carrito"`, `"Producto recibido"` in print statements). Outside cart-intent unification scope but real tech debt. | grep `Sources/VioCastingUI Demo/` for `Producto\|Carrito\|Comprar` | Move to `Localizable.strings` per market when Casting feature is touched again. |
| Low | iOS SDK has 9 legacy `/v1/*` calls still in flight (engagement, lineup, localization, brand config). Tracked separately. | `IOS_V2_MIGRATION_GAP.md` | 5 follow-up PRs (A-E) planned. Each migrates when its feature domain advances. |

## 17. Placement model — dashboard-driven (post-pivot 2026-04-28)

> **Pivot history**: 2026-04-27 morning shipped a "self-service named
> placements via SDK manifest" model where the SDK declared full placements.
> Same-day PM smoke test surfaced UX problems (developer has too much
> control, operator has too little, integrity rule "registry == render"
> forced ad-hoc on every code change). 2026-04-28 morning we pivoted to
> the dashboard-driven model below. Migration `0004_named_placements_consolidation.sql`
> drops the `app_components` table, adds `app_placements` as the source
> of truth, soft-delete columns, audit columns, and partial UNIQUE for
> "one active per (campaign, placement)" multi-sponsor rotation.

The SDK declares only the **slot locations** its layout exposes. The
**operator** creates named placements in the dashboard binding library
templates to those slots. Campaigns then bind to placements with sponsor
+ products. Three layers, each with one source of truth.

### Three-layer model

```
┌────────────────────────────────────────────────────────────────────┐
│ 1. LIBRARY  (components, is_template=true) — read-only catalog     │
│    Six canonical templates: countdown, offer_banner, product_banner,│
│    product_carousel, product_spotlight, product_store.              │
│    Vio admin edits via SQL only. Dashboard never creates new ones.  │
└────────────────────────────────────────────────────────────────────┘
                              ↓
                              ↓ (declared by SDK manifest)
                              ↓
   ┌─ Partner App (boot) ────────────────────────────────────────────┐
   │ TV2PlacementRegistration.registerAll()                           │
   │   └─ Vio.registerPlacementLocation(VioPlacementLocation(         │
   │        id: "home_top", displayName: "Home — Top"))               │
   │                                                                  │
   │ POST /v2/mobile/components/manifest                              │
   │   X-API-Key: tv2_…                                               │
   │   { locations: [{id, displayName}] }                             │
   │ Sync semantics: locations not in payload get deprecated_at=now() │
   │ Rejects body with `placements[]` or `components[]` (HTTP 400)    │
   └──────────────────────────────────────────────────────────────────┘
                              ↓
┌────────────────────────────────────────────────────────────────────┐
│ 2. APP_COMPONENT_LOCATIONS (per clientApp, manifest-populated)     │
│    Each row = a slot the dev's UI exposes.                         │
│    UNIQUE (client_app_id, location_id).                            │
│    deprecated_at NULL = active, set = soft-deleted via manifest.   │
└────────────────────────────────────────────────────────────────────┘
                              ↓
                              ↓ (operator picks template + location + name)
                              ↓
   ┌─ Dashboard /apps/:id "Add from library" ────────────────────────┐
   │  Form fields:                                                    │
   │    - template (from library, is_template=true)                   │
   │    - locationId (from declared locations, !deprecated)           │
   │    - name (e.g. "Carrusel home")                                 │
   │  POST /api/client-apps/:id/placements                            │
   │  Validates: template canonical + location declared + name unique │
   │  + slot unique (4 distinct error codes for the dashboard).       │
   └──────────────────────────────────────────────────────────────────┘
                              ↓
┌────────────────────────────────────────────────────────────────────┐
│ 3. APP_PLACEMENTS (named instances per app)                        │
│    (client_app_id, component_id, location_id, name, custom_config) │
│    UNIQUE (client_app_id, name)                                    │
│    UNIQUE (client_app_id, component_id, location_id)               │
│    deprecated_at — soft-delete; existing campaign uses keep        │
│    rendering with a dashboard warning until operator unbinds.      │
└────────────────────────────────────────────────────────────────────┘
                              ↓
                              ↓ (operator picks placement + sponsor + products)
                              ↓
   ┌─ Dashboard /campaigns/:id "Add placement" ──────────────────────┐
   │  Form fields:                                                    │
   │    - placement (from app_placements, !deprecated)                │
   │    - sponsor (campaign's primary or one of the secondaries)      │
   │    - products (only if placement.template.type starts product_*) │
   │    - title (optional, sets customConfig.title — header label)    │
   │    - showSponsorLogo (optional, sets customConfig.showSponsorLogo)│
   │    - autoPlay / interval (optional, carousel-specific)           │
   │  POST /api/campaigns/:id/components                              │
   │  Validates: placement matches campaign's clientApp + sponsor     │
   │  in campaign_sponsors + DB partial-UNIQUE "one active per        │
   │  (campaign, app_placement)" surfaced as PLACEMENT_ACTIVE_CONFLICT.│
   └──────────────────────────────────────────────────────────────────┘
                              ↓
┌────────────────────────────────────────────────────────────────────┐
│ 4. CAMPAIGN_COMPONENTS (campaign-bound instances)                  │
│    FK app_placement_id → app_placements (RESTRICT on delete)       │
│    FK sponsor_id → sponsors                                        │
│    customConfig {productIds, title?, showSponsorLogo?, autoPlay?…} │
│    PARTIAL UNIQUE (campaign_id, app_placement_id) WHERE            │
│      status='active' — multi-sponsor rotation: only ONE active     │
│      at a time, others are inactive/scheduled.                     │
└────────────────────────────────────────────────────────────────────┘
                              ↓
                              ↓ (SDK fetches via apiKey)
                              ↓
   ┌─ iOS SDK (cold-start + WS) ─────────────────────────────────────┐
   │ CampaignManager.fetchAndApplyCampaignComponentsIfPossible()      │
   │   ← GET /v2/mobile/campaigns/:id/components                       │
   │   Backend JOIN through app_placements; filters out where         │
   │   placement.deprecated_at NOT NULL.                              │
   │   Server merges template.config + cc.customConfig overlay.       │
   │                                                                  │
   │ Render path (no change from previous architecture):              │
   │   VProductCarousel(locationId: "home_top")                       │
   │     └─ getActiveComponent(type:locationId:)                      │
   │     └─ placementHeader (NEW): renders title + sponsor logo if    │
   │         customConfig.title or .showSponsorLogo set.              │
   │           ← VRemoteImage routes SVG → WKWebView, raster → AsyncImage│
   │           ← sponsor logoUrl fetched via VioConfiguration.shared  │
   │              .sponsor(withId: comp.sponsorId).logoUrl            │
   │     └─ ProductService.loadProducts(sponsorId: comp.sponsorId)    │
   │           ← per-sponsor commerce key                             │
   └──────────────────────────────────────────────────────────────────┘
```

### Smoke E2E (live-tested 2026-04-28)

1. Cold-start TV2 demo → `🧩 [VioPlacementManifest] uploaded → locations=2 deprecated=0` (home_top + match_pre_kickoff). DB has 2 rows in `app_component_locations`.
2. Dashboard `/apps/18` → Placements section is empty + "Add from library" button enabled. Click → dialog with 3 fields. Pick Product Carousel + home_top + name "tes1" → 201, app_placement id=19 created.
3. Dashboard `/campaigns/36` → Components tab → Add Component. Pick "tes1" + sponsor=XXL + 2 products → 201, campaign_components id=113 created with status=inactive.
4. Click toggle in campaign card → PATCH 200 → status=active. WS `component_status_changed` event fired with `appPlacementId` + `locationId`.
5. iOS demo (already running) re-fetches → carousel appears in HomeView with XXL sponsor + 2 products.
6. Operator opens placement card → pencil icon → Customize dialog. Sets title="Ukens tilbud" + "Show sponsor logo"=true → save. WS `component_config_updated` fires.
7. iOS re-renders: header now shows "Ukens tilbud" (left) + XXL SVG logo (right, decoded via WKWebView). Carousel below unchanged.
8. Operator deprecates placement "tes1" via dashboard → DELETE 200, deprecated_at set, WS `app_placement_deprecated` per affected campaign.
9. iOS cold-fetch returns 0 components. Render empty.

### Files touched (sprint 2026-04-27 PM + 2026-04-28 morning)

**Backend** (branch `feature/placements-app-placements-table`):
- `migrations/0003_add_app_placements.sql` — initial app_placements table (Phase B from morning)
- `migrations/0004_named_placements_consolidation.sql` — drops app_components; adds deprecated_at + audit + app_placement_id FK + partial UNIQUE
- `shared/schema.ts` — drop appComponents, update appComponentLocations (deprecatedAt), update appPlacements (deprecatedAt + createdBy), update campaignComponents (appPlacementId FK + drop componentId/locationId + createdBy), update relations
- `server/storage.ts` — drop legacy app_components helpers; add `createAppPlacement` (validates location + template + uniqueness, with PLACEMENT_* error codes), `deprecateAppPlacement` (soft delete), `getCanonicalLibraryTemplates`, `deprecateAppComponentLocationsNotIn` (manifest sync); refactor `getCampaignComponents` to JOIN through app_placements with synthesized legacy fields; refactor PATCH helpers to use row PK after the columnId column drop
- `server/routes.ts`:
  - `POST /v2/mobile/components/manifest` — accepts only `locations[]`, rejects legacy arrays, sync-semantic deprecation
  - `POST /api/client-apps/:id/placements` — operator-driven create
  - `DELETE /api/client-apps/:id/placements/:placementId` — soft-delete + WS broadcast
  - `POST /api/campaigns/:id/components` — takes `appPlacementId`, multi-sponsor active-conflict pre-check
  - `PATCH /api/campaigns/:id/components/:componentId` — refactored to look up by row PK + ws payload includes appPlacementId+locationId
  - GET `/v2/mobile/campaigns/:id/components` + broadcasts/:id/components — JOIN through app_placements, filter deprecated, sponsor block ships avatarUrl + logoUrl
  - GET/POST/DELETE `/api/client-apps/:id/components` — return HTTP 410 Gone (legacy retired)
- `client/src/components/dashboard/ComponentsTab.tsx` — placement picker simplified to 1 dropdown; product_carousel config form gains `title` + `showSponsorLogo`
- `client/src/pages/app-detail.tsx` — Placements section reads /api/client-apps/:id/placements; "Add from library" dialog with 3 fields (template + locationId + name)
- `client/src/pages/advanced-campaign.tsx` + `OverviewTab.tsx` + `ScheduledTab.tsx` — mutation calls pass `String(cc.id)` (row PK) instead of legacy `cc.componentId`

**iOS SDK** (branch `feature/placements-named-instances`):
- `Sources/VioCore/Placements/VioPlacementRegistry.swift` — drop named-placements indexes, `register<T:Component>`, `registerPlacement(name:type:locationId:)`. Keep only `registerLocation(_:)` and the locations index.
- `Sources/VioCore/Placements/VioPlacementManifestUploader.swift` — Response model trimmed to locations + deprecatedCount
- `Sources/VioCore/VioCore.swift` — VioRuntime.registerPlacementLocation as primary API; deprecate / drop registerPlacement and registerPlacementComponent
- `Sources/VioCore/Models/VioSponsor.swift` — add avatarUrl + renderableLogoUrl helper + doc clarifying naming
- `Sources/VioCore/Models/CampaignModels.swift` — SponsorBlock decodes avatarUrl
- `Sources/VioCore/Models/OfferBannerModels.swift` — ProductCarouselConfig adds `title?` + `showSponsorLogo`
- `Sources/VioUI/Components/VProductCarousel.swift` — placementHeader renders title + sponsor logo via VRemoteImage (inline component); WKWebView SVG fallback
- `Tests/VioCoreTests/VioPlacementRegistryTests.swift` — replaced 9 named-placement tests with location-only tests + manifest payload guard against re-introducing legacy arrays
- `Demo/tv2demo/tv2demo/Helpers/TV2PlacementRegistration.swift` — registry trimmed to 2 real slots (declaration ≡ render)
- `Demo/tv2demo/tv2demo/Views/HomeView.swift` — drop hardcoded "Ukens tilbud" Text + Image("logo") wrapper


### How to add a new placement (post-pivot dev workflow)

**Dev side** (one-time per slot):
1. In the partner app, decide a stable `locationId` for the new slot (e.g. `match_lineup_below`).
2. Add `Vio.registerPlacementLocation(VioPlacementLocation(id:, displayName:))` to your boot helper.
3. Render the placement view at that slot in your SwiftUI layout: `VProductCarousel(locationId: "match_lineup_below")` (or similar for other types).
4. Cold-start the app — manifest uploads. Done from dev side.

**Operator side** (per app, one-time per placement):
1. Dashboard `/apps/:id` → Placements section → "Add from library".
2. Pick template (Product Carousel / Banner / etc) + locationId (from declared slots) + name (e.g. "Carrusel home").
3. Saved → row in `app_placements`.

**Operator side** (per campaign, per binding):
1. Dashboard `/campaigns/:id` → Components tab → Add Component.
2. Pick the named placement + sponsor + (for product placements) products + (optional) title + show sponsor logo.
3. Toggle status → carousel renders in the SDK live via WS.

**Multi-sponsor rotation**:
- Operator can create multiple campaign_components rows for the same (campaign, placement) with different sponsors.
- Only one can be `status='active'` at a time (DB partial UNIQUE enforces).
- Use `scheduledTime` + `endTime` to rotate sponsors over time.

### Resume in a fresh session — the 5-line cheat sheet

1. Read this doc (especially §17). Then read `docs/TASK_PLACEMENTS.md` "Sprint 2026-04-27 (PM)" section for the locked decisions.
2. Two feature branches in flight: `feature/placements-app-placements-table` (socket-server, tip updated daily — check with `git log -1`) and `feature/placements-named-instances` (VioSwiftSDK, tip `95eafdb`). Both work end-to-end on local Neon `local/angelo-…`. Awaiting review/merge to develop.
3. Migration `0004_named_placements_consolidation.sql` applied to local Neon **only**. develop Neon still has pre-pivot schema. When merging, re-promote local → develop OR run migration on develop.
4. Open features pending tomorrow: dashboard "edit existing campaign_components" UX polish, scheduling fields exposure (scheduled_time + end_time on the campaign placement form), maybe banner/countdown locationId support in their SDK views (today only carousel takes locationId).
5. Commands to verify state:
   ```bash
   # Backend up?
   lsof -nP -iTCP:5001 -sTCP:LISTEN
   # Active Neon branch
   grep PGHOST /Users/angelo/vio-backend/socket-server/.env
   # DB sanity for TV2
   curl -s https://api-local-angelo.vio.live/api/client-apps/18/component-locations | jq length
   curl -s https://api-local-angelo.vio.live/api/client-apps/18/placements         | jq length
   curl -s https://api-local-angelo.vio.live/v2/mobile/campaigns/36/components -H "X-API-Key: tv2_api_key_91b4fbf634af4bc5" | jq '.components | length'
   ```
