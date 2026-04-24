# Vio — Current State (live truth)

> **Purpose**: one file to regain context after a compaction, a break, or a
> new session. If you read only one doc, read this.
>
> **Last updated**: 2026-04-24 — post PR rebranch (closed #17/#18/#19 stale branches, reopened as #21/#22/#23 off fresh develop).

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
| socket-server (backend + dashboard) | `/Users/angelo/vio-backend/socket-server` | `develop` | `f4f28d7` | tip of develop after #20 merge; 3 open feature PRs off it |
| VioSwiftSDK (iOS SDK) | `/Users/angelo/VioSwiftSDK` | `develop` | merged to develop via PR #3 (a8e5730) | |
| InteractiveAds-vio (Apple TV SDK) | `/Users/angelo/Documents/GitHub/InteractiveAds-vio` | `main` | merged to main via PR #3 (6a23bdf) | |

**Branches already merged (don't reuse)**:
- socket-server `feature/api-v2-cut` → develop (PR #13)
- socket-server `docs/architecture-overview` → develop (PR #14)
- socket-server `fix/dashboard-sponsors-show-primary` → develop (PR #15)
- socket-server `fix/dashboard-app-tv-settings` → develop (PR #16)
- socket-server `docs/session-state-post-dashboard-sprint` → develop (PR #20)
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

All on `tipiodevelopment/socket-server`. None merged yet.

| PR | Branch | What | Target |
|---|---|---|---|
| [#21](https://github.com/tipiodevelopment/socket-server/pull/21) | `fix/campaign-sponsors-primary-v2` | `/api/campaigns/:id/sponsors` now returns primary + secondaries in one array with `role:'primary'` | develop |
| [#22](https://github.com/tipiodevelopment/socket-server/pull/22) | `fix/shoppable-moments-unified-v2` | single `Add Shoppable Moment` dialog with `Fire now` / `Schedule for later` radio; drops broken `ShoppableProductsSection` and `Quick Fire` subsection. Also fixes `useSponsorCatalog` hook hitting dead `/api/commerce/*` path | develop |
| [#23](https://github.com/tipiodevelopment/socket-server/pull/23) | `fix/broadcast-detail-tv-gate-v2` | TV SDK gate banner on broadcast detail + renames (partial — superseded in part by #22 for the renames) | develop |

### PR interaction notes

- #22 supersedes #23's header renames (both rename "Sponsor Moments" → something distinct, but #22 goes further and removes the duplicate entirely). If #22 merges first, #23 needs rebase to keep only the TV gate banner (not the renames).
- #21 is independent. Can merge anytime.
- The 3 can merge in any order but #21 → #22 → #23 keeps conflicts minimal.

**Closed** (superseded, do not reopen):
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

### Batch 2 — open PRs (awaiting user test)

Rebranched 2026-04-24: the original #17/#18/#19 were closed and recreated off fresh develop (post #20 merge) to eliminate stale-branch risk. Same content, new numbers.

| PR | Change |
|---|---|
| #21 | `/api/campaigns/:id/sponsors` now returns primary + secondaries as a single array (before: only secondaries). Fixes "data inconsistent across dashboard" — all callers see 3 sponsors now. (ex-#18) |
| #22 | Unified `Add Shoppable Moment` dialog replaces the 3 redundant surfaces (Sponsor Catalog grid + Pre-programmed Slots + Quick Fire). One form with `Fire now` / `Schedule for later` radio. Also fixes `useSponsorCatalog` hook hitting dead `/api/commerce/*` path. (ex-#19) |
| #23 | Broadcast detail: TV SDK gate banner (if `clientApp.tvEnabled=false`, hides the 3 TV-dependent sections and shows a link to Platforms tab). Also renamed duplicate "Sponsor Moments" headers. (ex-#17) |

### Patches not in any PR (direct data fixes)

- **Broadcast `barcelona-psg-2026-03-03`**: `status='live'`, `endTime` pushed to 2026-05-24 so the scheduler doesn't auto-end it during testing.
- **`campaign_sponsors` on campaign 36**: deduped row where Elkjøp was simultaneously primary AND secondary (pre-existing data bug).
- **Sponsor commerce keys aligned**: Elkjøp → `5HPHWJY-…`, Torshov → `36EHG0M-…`, XXL → `KCXF10Y-…`. Before: all 3 shared the `KCXF10Y` key; aligned to what the user confirmed as the real keys.

## 9. Smoke test status (Phase 5)

3 shoppable ads dispatched against campaign 36 earlier today. activationIds:

- **5 and 6** Elkjøp / Samsung QLED
- **7** Torshov Sport / Nike Fotballdrakt
- **8** XXL / FC Barcelona Jersey

Backend responses 200 JSON with correct sponsor blocks. Apple TV overlay should have rendered with per-sponsor branding. Apple Pay checkout verification is **pending user confirmation** — user has been iterating on dashboard UX instead of completing the Apple Pay round-trip.

Completion requires:
1. Apple TV demo (InteractiveAds-vio on `main`) connected to `/v2/tv/broadcast/subscribe`
2. iOS demo (VioSwiftSDK on `develop` via `feature/api-v2-urls`) connected as `demo_user_001`
3. Fire the 3 ads (via PR #22 new dialog once merged, or curl to `/api/broadcasts/:id/trigger-shoppable-ad`)
4. User taps Select/Play on tvOS sim → iOS receives `cart_intent` → overlay opens with Commerce product loaded via the correct sponsor's key → Apple Pay button visible + functional
5. Verify `cart_intents` DB row has `sponsor_id + source_activation_id + delivery_mode='websocket'`

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

Paused at Step 4. Resumes once the 3 open PRs (#21/#22/#23) merge + Apple Pay smoke test closes.

## 12. Kotlin SDKs (Hito 7, not started)

Task card written for Kotlin dev (see `TV+BACKEND+TELEFONO` Trello). Specs:
- `KOTLIN_TV_SDK_SPEC.md` — Android TV mirror of `InteractiveAds-vio`
- `KOTLIN_MOBILE_SDK_SPEC.md` — Android mobile mirror of `VioSwiftSDK`

Kotlin dev codes against v2 surface from day 1, tests with campaign 36 (TV2) AND a second campaign to catch TV2-specific assumptions.

## 13. How to resume in a fresh session

1. Read this doc top-to-bottom.
2. `cd /Users/angelo/vio-backend/socket-server`.
3. Check backend: `lsof -nP -iTCP:5001 -sTCP:LISTEN` — if not running, `npm run dev &`.
4. Check PR state: `gh pr list --state open` — there should be 3 (#21, #22, #23) unless merged.
5. Check local branches: `git branch` — latest work landed on `develop`; open feature branches are `fix/campaign-sponsors-primary-v2`, `fix/shoppable-moments-unified-v2`, `fix/broadcast-detail-tv-gate-v2`.
6. See `ARCHITECTURE_OVERVIEW.md` for the big picture, `API_V2_CONTRACT.md` for endpoint shapes.

## 14. How to update this doc

State change worth persisting → new commit `docs(state): …`. Examples:
- PR merged → move row from §3 to §1 "merged branches".
- Smoke test completed → update §9.
- New PR opened → add to §3.
- Neon branch rolled → update §5 + §6 if data affected.
- Regla nueva → add to §2.

Keep terse. If a section grows past ~30 lines, extract + link.
