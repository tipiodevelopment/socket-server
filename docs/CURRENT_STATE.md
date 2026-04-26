# Vio — Current State (live truth)

> **Purpose**: one file to regain context after a compaction, a break, or a
> new session. If you read only one doc, read this.
>
> **Last updated**: 2026-04-27 — Hito 6 placements re-engaged with manifest registry: backend PR #29 + iOS SDK PR #8 + dashboard PR #30 open. Self-service flow locked (dev registers component+location once at boot, operator picks from dashboard, never touches code again).

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
| socket-server (backend + dashboard) | `/Users/angelo/vio-backend/socket-server` | `develop` | `61e43c1` | tip of develop with the full dashboard UX sprint merged |
| VioSwiftSDK (iOS SDK) | `/Users/angelo/VioSwiftSDK` | `develop` | merged to develop via PR #3 (a8e5730) | |
| InteractiveAds-vio (Apple TV SDK) | `/Users/angelo/Documents/GitHub/InteractiveAds-vio` | `main` | merged to main via PR #3 (6a23bdf) | |

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
- VioSwiftSDK `feature/api-v2-urls` → develop (PR #3)
- InteractiveAds-vio `feature/api-v2-urls` → main (PR #3)

## 2. Rules locked (2026-04-24)

1. **VioSwiftSDK NEVER merges to `main`**. main is the v0.1.0-alpha release branch. All work lives on `develop` + feature branches off develop. PRs target develop.
2. **InteractiveAds-vio works on `main`**. Apple TV repo has no develop. Feature branches off main, PRs target main.
3. **No force-push** on shared branches. Incident precedent: `docs/multi-sponsor-architecture` got force-pushed by another session earlier — response was to create a fresh branch off develop, not to fight back. Same playbook if it happens again.
4. **No v1 fallbacks in SDK code**. No "try v2 → catch → call v1" logic. Remaining v1 calls are direct calls for unmigrated features, not fallbacks.
5. **No hardcoded apiKeys in SDK code**. Commerce keys come only from per-sponsor blocks in `/v2/mobile/config` (iOS) and `/v2/tv/broadcast/subscribe` (Apple TV).
6. **No auto-merge of PRs** by the assistant. Open the PR, push the branch, tell the user the URL and what to test. User triggers merge with explicit "merge #NN". Applies to code AND docs (consistency > special cases).

## 3. Open PRs awaiting user review

| Repo | PR | Branch | What | Target |
|---|---|---|---|---|
| socket-server | [#29](https://github.com/tipiodevelopment/socket-server/pull/29) | `feature/placements-manifest-registry` | Backend foundation for placement self-service: new table `app_component_locations`, endpoint `POST /v2/mobile/components/manifest` (idempotent upsert, multi-tenant via apiKey), dashboard read endpoints `GET /api/client-apps/:id/component-locations` + `?withLocations=true` extension. 17 jest tests. | develop |
| VioSwiftSDK | [#8](https://github.com/vio-live/VioSwiftSDK/pull/8) | `feature/placements-registry` | iOS half: `VioPlacementComponent` protocol + `VioPlacementRegistry` + `VioRuntime.registerPlacementComponent(_:)` + `registerPlacementLocation(_:)`. Manifest auto-upload from `VioSession.start()` after bootstrap. 16 XCTest cases. | develop |
| socket-server | [#30](https://github.com/tipiodevelopment/socket-server/pull/30) | `feature/placements-dashboard-pickers-on-29` | Dashboard ComponentsTab Add dialog: location picker fed by SDK manifest (replaces hardcoded `sport-*` dropdown), component picker scoped to app. Based on top of PR #29. | feature/placements-manifest-registry → develop after #29 |

**Merge order**: PR #29 first → develop. PR #8 in parallel (independent, just needs the endpoint live for end-to-end). PR #30 auto-rebases to develop after #29 lands.

**Dependencies**:
- PR #29 ← prerequisite for the manifest endpoint to exist
- PR #8 (iOS) and PR #30 (dashboard) both consume #29's endpoint but each can merge independently of the other

**Closed / superseded** (do not reopen):
- #10 superseded by #11 (was a force-push casualty)
- #11 superseded by #13 (docs folded into the v2 cut)
- #12 superseded by #13 (idem)
- #17 superseded by #23 (rebranched off fresh develop 2026-04-24)
- #18 superseded by #21 (idem)
- #19 superseded by #22 (idem)

## 4. Runtime state (local dev)

| Service | Status | Address |
|---|---|---|
| Backend (socket-server) | 🟢 up | `node` PID rotates each restart — latest on `:5001` |
| Cloudflare tunnel | 🟢 up | `https://api-local-angelo.vio.live` → `localhost:5001` |
| Partner mock (Azure) | 🟢 up | `https://viopartnermockv2.azurewebsites.net` (~3s cold start) |
| Vite frontend | 🟢 up | dashboard at `localhost:5001` (same process) |

Backend is launched via `npm run dev` which runs `tsx server/index.ts` **without `--watch`**. After editing `server/*.ts` you must `kill <pid> && npm run dev` for changes to load. The frontend (`client/src/*`) reloads via Vite HMR automatically.

## 5. Database state (Neon)

**⚠️ Seguimos usando esta branch** — locked decision, no re-forkear.

| Branch | ID | Role |
|---|---|---|
| `local/angelo-20260423-1814` | `br-summer-morning-a8y0i36l` | **🟢 active** — `DATABASE_URL` + `PGHOST` apuntan aquí. Forkeada de develop 2026-04-23 18:14. Phase 3 NOT NULL aplicada. Campaign 36 sponsors alineados con keys reales. Broadcast `barcelona-psg-2026-03-03` tiene `endTime` pushed al futuro + `status=live` para smoke tests. |
| `feature/placements-v2-20260423-1250` | `br-damp-snow-a8rv0cnc` | idle safety net |
| `develop` | `br-royal-mode-a8e8mdq1` | shared dev, intact |
| others | (production, staging, dev/*, test/*, backup/*) | idle / historical |

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

## 11. Placements plan (Hito 6, paused)

`TASK_PLACEMENTS.md` on socket-server. 12 steps total, 1-4 done, 5-12 pending:

- Steps 5-7 — dashboard Components tab (catalog scope to `app_components`, product picker for `product_*` types, scheduling fields)
- Steps 8-11 — iOS SDK Component.sponsorId propagation through 5 product views + CartManager per-sponsor checkout
- Step 12 — E2E with TV2 campaign + 2 placements

Paused at Step 4. Dashboard UX sprint (#21/#22/#23) is now merged — next blocker is the Apple Pay smoke test (Phase 5) closing. Once that's green, Phase 7 resumes from Step 5.

## 12. Kotlin SDKs (Hito 7, not started)

Task card written for Kotlin dev (see `TV+BACKEND+TELEFONO` Trello). Specs:
- `KOTLIN_TV_SDK_SPEC.md` — Android TV mirror of `InteractiveAds-vio`
- `KOTLIN_MOBILE_SDK_SPEC.md` — Android mobile mirror of `VioSwiftSDK`

Kotlin dev codes against v2 surface from day 1, tests with campaign 36 (TV2) AND a second campaign to catch TV2-specific assumptions.

## 13. How to resume in a fresh session

1. Read this doc top-to-bottom.
2. `cd /Users/angelo/vio-backend/socket-server`.
3. Check backend: `lsof -nP -iTCP:5001 -sTCP:LISTEN` — if not running, `npm run dev &`.
4. Check PR state: `gh pr list --state open` — should be empty.
5. Check local branches: `git branch` — develop is the latest working tip; next work lives on fresh feature branches off develop.
6. See `ARCHITECTURE_OVERVIEW.md` for the big picture, `API_V2_CONTRACT.md` for endpoint shapes.

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
