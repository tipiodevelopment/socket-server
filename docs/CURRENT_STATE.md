# Vio — Current State (live truth)

> **Purpose**: one file to regain context after a compaction, a break, or a
> new session. If you read only one doc, read this. Updated continuously.
>
> **Last updated**: 2026-04-24 by Angelo (post API v2 contract draft).

This doc is the single source of truth for:
- Which branch + commit of each repo is the working tip
- Which Neon DB branch the backend is hitting
- Which services are up (backend, tunnel, partner mock)
- What demo data exists to test with
- What PRs are open, what's waiting, what's next
- The current smoke-test plan for the live Apple TV → iOS flow

Other docs (`API_V2_CONTRACT.md`, `DB_AND_ENDPOINTS.md`,
`multi-sponsor-architecture.md`, `ROLLOUT_ROADMAP.md`, `TASK_PLACEMENTS.md`)
are referenced from here — they hold the detail. This doc holds the state.

---

## 1. Repositories (3)

| Repo | Local path | Active branch | HEAD | Dirty |
|---|---|---|---|---|
| socket-server (backend + dashboard) | `/Users/angelo/vio-backend/socket-server` | `feature/placements-v2` | `c63f681` | clean |
| VioSwiftSDK (iOS SDK) | `/Users/angelo/VioSwiftSDK` | `feature/tv-cart-intent-attribution` | `8c993c4` | clean |
| InteractiveAds-vio (Apple TV SDK) | `/Users/angelo/Documents/GitHub/InteractiveAds-vio` | `feat/sdk-consolidation` (⚠ stale) | `48e0635` | 2 files (demo video recovered + staged) |

All 3 are pushed up to origin on their respective branches.

**Apple TV truth lives on `main`**, not on the locally checked-out
`feat/sdk-consolidation`. `main` is 4 commits ahead and contains the v2
TV integration (subscribe, broadcastId alignment, ws keep-alive, demo
picker). Before running the TV demo for any smoke test, switch to
`main`: `cd ~/Documents/GitHub/InteractiveAds-vio && git checkout main`
(the 2 local changes — demo video + pbxproj — cherry-pick cleanly onto
main or stash first).

## 2. Open PRs (socket-server)

| PR | Branch | Title | Depends on |
|---|---|---|---|
| [#11](https://github.com/tipiodevelopment/socket-server/pull/11) | `docs/placements-v2-refresh` | DB & endpoints reference + placements v2 refresh | — |
| [#12](https://github.com/tipiodevelopment/socket-server/pull/12) | `docs/api-v2-contract` | API v2 contract — surface-based namespaces + migration map | — |

Both docs-only, mergeable in any order, no conflicts.

**Closed**: #10 (was superseded by #11 after a cross-session force-push on
the original docs branch; no content lost — #10 is closed with a comment
pointing at #11).

## 3. Runtime state (local dev)

| Service | Status | Address |
|---|---|---|
| Backend (socket-server) | 🟢 up | `node` PID 7792 on `:5001` |
| Cloudflare tunnel | 🟢 up | `https://api-local-angelo.vio.live` → `localhost:5001` |
| Partner mock (Azure) | 🟢 up | `https://viopartnermockv2.azurewebsites.net` (~3s cold start) |
| Vite frontend | 🟢 up | `node` PID 30014 on `:8081` (dashboard dev server) |

**Not mock, just local**: the backend is running locally and exposed via
Cloudflare tunnel. The Apple TV demo hits the tunnel, which forwards to
the local backend.

**Mock is only the partner surface**: `viopartnermockv2.azurewebsites.net`
stands in for what a real partner (TV2, Viaplay) would host to receive our
outbound `cart_intent` webhook and APNs device registration forwards. This
is formalised as `/v2/partner/*` in the v2 contract (PR #12 §8).

## 4. Database state (Neon)

| Branch | ID | Role |
|---|---|---|
| `local/angelo-20260423-1814` | `br-summer-morning-a8y0i36l` | **🟢 active** (`DATABASE_URL` + `PGHOST` point here) — forked from develop 2026-04-23 18:14 |
| `feature/placements-v2-20260423-1250` | `br-damp-snow-a8rv0cnc` | idle safety net (TV2 wiped in this one) |
| `develop` | `br-royal-mode-a8e8mdq1` | the shared dev branch, intact |
| `production` | `br-rough-cake-a8frru0c` | primary, unused today (no prod env) |
| `staging` | `br-falling-sunset-a82ym3kq` | idle |
| `dev/jhondev`, `dev/alan`, `test/tv-subscribe-validation`, `backup/develop-pre-phase1-20260423-0131` | (various) | idle, historical |

Phase 3 NOT NULL is applied on all 5 sponsor FKs in the active branch.

**`.env` backups**:
- `/tmp/vio-env-develop-before-placements.bak` (before first fork, 12:50)
- `/tmp/vio-env-placements-v2-before-local-fork.bak` (before current fork, 18:14)

## 5. Demo data (active DB)

### Client apps

| id | name | apiKey (first 20) | tvEnabled |
|---:|---|---|---|
| 17 | Viaplay | `viaplay_api_key_0c61…` | false |
| 18 | TV2 | `tv2_api_key_91b4fbf6…` | **true** (apple-tv) |

Both have `webhookUrl` + `partnerDeviceRegisterUrl` pointing to the partner
mock.

### Sponsors

| id | name | has_avatar | has_commerce |
|---:|---|---|---|
| 2 | SkiStar | ✔ | — |
| 3 | Elkjøp | ✔ | ✔ |
| 4 | Torshov Sport | ✔ | ✔ |
| 5 | test name | ✔ | — |
| 6 | Elkjøp (duplicate) | ✔ | — |
| 7 | XXL | ✔ | — |

Data quirk: Elkjøp appears twice (ids 3 and 6). Id 3 is the canonical one
with commerce; id 6 shows up in `secondarySponsors` as a stale duplicate.
Not blocking, flagged for cleanup.

### TV2 campaign (id 36)

- `name`: Tv2 Demo Campaign
- `primary_sponsor_id`: 3 (Elkjøp)
- `client_app_id`: 18 (TV2)
- `is_paused`: false
- Broadcasts:
  - `tv2-eliteserien-live-2026-03-08` — **status=live, engagement enabled** — ✅ the one to use for smoke tests
  - `barcelona-psg-2026-03-03` — status=ended, has 1 slot
  - `tv2-viking-haugesund-2026-03-09` — status=ended
- 1 historical `shoppable_ad_activation` on `barcelona-psg-…` (sponsor 3, product 408895, source=dashboard, 2026-04-23)
- 0 `cart_intents` yet

### Apple TV demo (on `main`)

Config file: `InteractiveAds-vio/Demo/tv2demo-appletv/Configuration/vio-config.json`

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

No `campaignId`, no `contentId` — both were removed. The SDK resolves
campaign + sponsors from the subscribe response.

### Apple TV runtime flow (verified in `origin/main` 2026-04-24)

```
BroadcastPickerView (landing screen)
 ├─ "Broadcast registrado":   barcelona-psg-2026-03-03  (hardcoded in picker)
 └─ "Broadcast desconocido":  broadcast-no-existe-demo   (hardcoded, tests soft-miss)

User tap → TVPlayerView(broadcastId:) → VioTV.connect(broadcastId:)

VioTVManager.connect:
  1. POST /api/sdk/tv/broadcast/subscribe
     body: { broadcastId, externalUserId: config.userId, platform: "apple-tv", tvDeviceId? }
  2. subscribed=true:
     • applySubscribeResponse(...)       → sponsors + commerce keys cached
     • ws.connect(wsUrl, identifyUserId) → identify frame sent
     • session.start(sessionId)          → heartbeat loop
  3. subscribed=false: idle + onSubscriptionFailed callback

Remote Select/Play → VioTVManager.sendCartIntent(productId, campaignId, activationId, sponsorId)
 → POST /api/sdk/tv/cart-intent
    body: { externalUserId, productId, campaignId, platform, activationId, sponsorId }
    (activationId + sponsorId come from the active shoppable_ad event)
```

Backend subscribe (routes.ts:6876) **does NOT check `broadcast.status`** —
so the picker's hardcoded `barcelona-psg-2026-03-03` (currently ended in
the DB) still subscribes successfully. No config changes needed for the
smoke test.

## 6. Work in flight

### 6.1 Product placement v2 (paused at Step 4)

Full tracking: [`TASK_PLACEMENTS.md`](./TASK_PLACEMENTS.md) on `feature/placements-v2`.

Status: Steps 1–4 done (backend WS `sponsorId`, openapi, Postman, dashboard sponsor picker). Steps 5–12 pending. Will resume after (a) PRs #11 + #12 merge, (b) the v2 alias routes ship (see §6.2).

### 6.2 API v2 consolidation (new)

Contract drafted in [`API_V2_CONTRACT.md`](./API_V2_CONTRACT.md) — PR #12. Proposes 5 surface-prefixed namespaces under `/v2/*` to replace the current 5-prefix mess. Zero downtime via additive alias routes + `410 Gone` on cutover.

**Rollout** (7 steps, ~5 backend-days):
1. Contract merge (PR #12) → unblocks everything else
2. Backend alias routes (new work, PR TBD)
3. openapi + Postman regen
4. iOS SDK URL rename (1 patch release)
5. VioTVSDK URL rename
6. Kotlin SDKs code against v2 from day 1
7. v1 retirement (410 Gone + `Link` header, 4 weeks after #2)

### 6.3 Next working session (after smoke test passes)

Two independent tracks can progress in parallel:

- **Backend alias routes** (§6.2 step 2) — new PR off develop. Zero iOS/TV impact.
- **Placements Step 5** (dashboard catalog scope to `app_components`) — continues on `feature/placements-v2`.

## 7. Smoke test plan — live Apple TV → iOS cart-intent round-trip

**Why**: verify the current stack still works before adding any new layer.

**Pre-flight** (all ✅ before starting):

| # | Check | Current |
|---|---|---|
| 1 | Backend `:5001` listening | ✅ |
| 2 | Tunnel `api-local-angelo.vio.live/health` 200 | ✅ |
| 3 | Partner mock 200 | ✅ |
| 4 | DB campaign 36 has `barcelona-psg-2026-03-03` broadcast | ✅ (ended status; subscribe works anyway) |
| 5 | Sponsor 3 Elkjøp with commerce key | ✅ |
| 6 | Apple TV repo on `main` (not `feat/sdk-consolidation`) | **verify before starting** |
| 7 | `vio-config.json` has `"userId": "demo_user_001"` (or is set via env/ProcessInfo before `VioTV.configure(fromConfigFile:)`) | **verify before starting** |
| 8 | iOS demo configured with same backend URL + `externalUserId = "demo_user_001"` | **verify before starting** |

**Steps**:

1. **Apple TV repo → `main`**. `cd ~/Documents/GitHub/InteractiveAds-vio &&
   git stash && git checkout main`. Open the workspace, build the
   `tv2demo-appletv` target against the tvOS simulator.
2. **Launch the Apple TV demo**. It lands on `BroadcastPickerView`. Tap
   **"Broadcast registrado"** (`barcelona-psg-2026-03-03`). Expected logs:
   ```
   [VioTV] POST subscribe → subscribed=true, wsUrl=wss://…/ws/36
   [VioTV] WebSocket connected to wss://api-local-angelo.vio.live/ws/36
   [VioTV] identify sent userId=demo_user_001
   [VioTV] session started id=<N>
   ```
3. **Launch iOS demo** (VioSwiftSDK TV2 demo). Expected:
   `[CampaignWS] connected /ws/36, identified userId=demo_user_001`.
4. **Fire a shoppable ad** from a terminal. The path that exercises the
   full multi-sponsor pipeline is the TV SDK shoppable endpoint (apiKey
   auth, so no cookie needed):
   ```bash
   curl -X POST "https://api-local-angelo.vio.live/api/sdk/tv/broadcasts/barcelona-psg-2026-03-03/shoppable-ad" \
     -H "Content-Type: application/json" \
     -H "X-API-Key: tv2_api_key_91b4fbf634af4bc5" \
     -d '{"productId":"408895","sponsorId":3}'
   ```
   Response carries the new `activationId`. Capture it.
5. **Expect on Apple TV**: overlay shows with Elkjøp branding + product
   card. Log: `[VioTV] shoppable_ad received: <title> (activationId=<N>)`.
6. **Press Select/Play on the tvOS simulator remote**. The SDK posts
   `/api/sdk/tv/cart-intent` with body
   `{externalUserId, productId, campaignId, platform, activationId, sponsorId}`.
7. **Expect on iOS demo**: `cart_intent` WS event received, product
   detail screen opens with Elkjøp-branded UI, product loaded through
   Elkjøp's commerce client.
8. **Verify in DB**:
   ```sql
   SELECT id, sponsor_id, product_id, source_activation_id, delivery_mode, triggered_at
   FROM cart_intents WHERE campaign_id=36 ORDER BY id DESC LIMIT 1;
   ```
   Expect `sponsor_id=3, source_activation_id=<activationId from step 4>,
   delivery_mode='websocket'`.

**Failure-mode decoder**:

| Symptom | Likely cause |
|---|---|
| Subscribe 401 | `apiKey` in `vio-config.json` ≠ `client_apps.api_key` for TV2 (id 18) |
| Subscribe returns `{subscribed:false, reason:"broadcast_not_registered_for_client_app"}` | broadcastId doesn't belong to a campaign of clientApp 18 — not our case for `barcelona-psg-2026-03-03` |
| Subscribe returns `{subscribed:false, reason:"tv_not_enabled_for_this_platform"}` | `client_apps.tv_enabled=false` or `tv_platforms` missing `apple-tv` — verify with `SELECT tv_enabled, tv_platforms FROM client_apps WHERE id=18` |
| Subscribe OK but no `shoppable_ad` on the TV after the curl | Check backend logs — `wsUserMap` / `campaignSubscribers` dispatch. WS may have dropped and not reconnected |
| iOS demo doesn't receive `cart_intent` | `externalUserId` mismatch between TV config and iOS config (must both be `demo_user_001`), or iOS WS not actually open (dual delivery falls back to webhook) |
| iOS receives but product loads 401 | per-sponsor commerce routing broken — check `CommerceSdkClientProvider.client(forSponsorId:)` returns Elkjøp's key |
| `cart_intents.delivery_mode='webhook'` or `'apns'` | iOS was offline at dispatch — relaunch and retry, fallback is working as designed |
| `cart_intents.source_activation_id IS NULL` | TV SDK didn't include `activationId` in the body — check the TV SDK log for `activationId=<N>` on dispatch |

## 8. How to update this doc

Any state change worth persisting goes here in a new commit with a short
imperative subject (`docs(state): …`). Examples:

- Step of placements plan lands → update §6.1 status table.
- Neon branch rolled → update §4 table + §5 demo data if affected.
- New PR opened → add to §2 table.
- Smoke test run → note date + result in §7.

Keep sections terse. If something grows past 20 lines, extract to its own
doc and link from here.
