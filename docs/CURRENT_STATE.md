# Vio — Current State (live truth)

> **Purpose**: one file to regain context after a compaction, a break, or a
> new session. If you read only one doc, read this.
>
> **Last updated**: 2026-04-24 — post v2 direct cut on 3 repos + campaign 36
> sponsor alignment + 3-ad smoke test dispatched.

This doc is the single source of truth for:
- Which branch + commit of each repo is the working tip
- Which Neon DB branch the backend is hitting
- Which services are up (backend, tunnel, partner mock)
- What demo data exists to test with
- What PRs are open, what's waiting, what's next
- Current phase of work

Other docs (`API_V2_CONTRACT.md`, `DB_AND_ENDPOINTS.md`,
`multi-sponsor-architecture.md`, `ROLLOUT_ROADMAP.md`, `TASK_PLACEMENTS.md`,
`IOS_V2_MIGRATION_GAP.md`) are referenced from here — they hold detail, this holds state.

---

## 1. Repositories (3)

| Repo | Local path | Active branch | HEAD | Remote synced |
|---|---|---|---|---|
| socket-server (backend + dashboard) | `/Users/angelo/vio-backend/socket-server` | `feature/api-v2-cut` | `c858056` | ✅ pushed |
| **VioSwiftSDK** (iOS SDK) | `/Users/angelo/VioSwiftSDK` | `feature/api-v2-urls` | `17d9336` | ✅ pushed |
| InteractiveAds-vio (Apple TV SDK) | `/Users/angelo/Documents/GitHub/InteractiveAds-vio` | `feature/api-v2-urls` | `3be56b7` | ✅ pushed |

### Branching rules (locked 2026-04-24)

1. **VioSwiftSDK NEVER merges to `main`** — main is the v0.1.0-alpha release branch. Work lives on `develop` + feature branches off develop. PRs target develop.
2. **InteractiveAds-vio works on `main`** — Apple TV repo has no develop. Feature branches off main, PRs target main.
3. **No force-push** in shared branches. If a cross-session force-push happens, create a new branch off the latest state instead of overwriting.
4. **No v1 fallbacks in SDK code**. Remaining v1 calls are direct calls for unmigrated features; no "try v2 → catch → call v1" logic allowed.
5. **No hardcoded apiKeys** in SDK code. Commerce keys come exclusively from per-sponsor blocks in `/v2/mobile/config` (iOS) and `/v2/tv/broadcast/subscribe` (Apple TV).

## 2. Open PRs (socket-server)

| PR | Branch | Title | Status |
|---|---|---|---|
| [#11](https://github.com/tipiodevelopment/socket-server/pull/11) | `docs/placements-v2-refresh` | DB & endpoints reference + placements refresh | docs only — can merge anytime |
| [#12](https://github.com/tipiodevelopment/socket-server/pull/12) | `docs/api-v2-contract` | API v2 contract — surface-based namespaces | docs only — can merge anytime |
| pending | socket-server `feature/api-v2-cut` | v2 direct cut (code + postman + ios-gap doc + consolidated state docs) | open after smoke test green → develop |
| pending | VioSwiftSDK `feature/api-v2-urls` | iOS v2 URL migration + legacy multi-sponsor-conflict cleanup | open after smoke test green → **develop** |
| pending | InteractiveAds-vio `feature/api-v2-urls` | Apple TV v2 URLs + remove hardcoded commerce apiKey fallbacks | open after smoke test green → main |

**Closed**: #10 (superseded by #11 after a cross-session force-push).

## 3. Runtime state (local dev)

| Service | Status | Address |
|---|---|---|
| Backend (socket-server) | 🟢 up | `node` PID 77038 on `:5001` |
| Cloudflare tunnel | 🟢 up | `https://api-local-angelo.vio.live` → `localhost:5001` |
| Partner mock (Azure) | 🟢 up | `https://viopartnermockv2.azurewebsites.net` (~3s cold start) |
| Vite frontend | 🟢 up | dashboard at `localhost:5001` (same process) |

## 4. Database state (Neon)

**⚠️ Seguimos usando esta branch** (user decision 2026-04-24) — no re-forkear.

| Branch | ID | Role |
|---|---|---|
| `local/angelo-20260423-1814` | `br-summer-morning-a8y0i36l` | **🟢 active** — `DATABASE_URL` + `PGHOST` apuntan aquí. Forkeada de develop 2026-04-23 18:14. Phase 3 NOT NULL aplicada. Campaign 36 sponsors alineados con keys reales (§5). |
| `feature/placements-v2-20260423-1250` | `br-damp-snow-a8rv0cnc` | idle safety net |
| `develop` | `br-royal-mode-a8e8mdq1` | shared dev, intact |
| `production`, `staging`, `dev/*`, `test/*`, `backup/*` | (various) | idle / historical |

**`.env` backups**:
- `/tmp/vio-env-develop-before-placements.bak` (first fork, 12:50)
- `/tmp/vio-env-placements-v2-before-local-fork.bak` (second fork, 18:14)

## 5. Demo data (active DB — campaign 36)

### Client app

`#18 TV2` — apiKey `tv2_api_key_91b4fbf634af4bc5`, tvEnabled=true, tvPlatforms=['apple-tv'], webhook + deviceRegister → partner mock.

### Campaign 36 "Tv2 Demo Campaign" sponsors (aligned 2026-04-24)

| Sponsor | Role | Commerce apiKey (first 8) | paymentMethods | Test product |
|---|---|---|---|---|
| **#3 Elkjøp** | primary | `5HPHWJY-…` | klarna, stripe_link, vipps, **apple_pay**, google_pay | `408895` Samsung 75" QN85F Neo QLED TV (17990 NOK) |
| **#4 Torshov Sport** | secondary / shoppable | `36EHG0M-…` | full set incl apple_pay | `408898` Nike Norge Fotballdrakt 2026 (999 NOK) |
| **#7 XXL** | secondary / full | `KCXF10Y-…` | full set incl apple_pay | `408841` FC Barcelona Dri-Fit Jersey (759 NOK) |

Other sponsors in DB but NOT part of campaign 36: `#2 SkiStar`, `#5 test name`, `#6 Elkjøp (duplicate)` — none have commerce keys.

Duplicate row `(campaign_id=36, sponsor_id=3)` removed from `campaign_sponsors` on 2026-04-24 — Elkjøp was erroneously both primary AND secondary.

### Broadcasts on campaign 36

- `tv2-eliteserien-live-2026-03-08` — status=live, engagement enabled
- `barcelona-psg-2026-03-03` — status=ended, has 1 scheduled slot (Torshov, product 408898). **Used as test broadcast** — subscribe endpoint accepts ended broadcasts.
- `tv2-viking-haugesund-2026-03-09` — status=ended

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

**No `commerceApiKey` hardcoded** (regla: no fallbacks). Commerce keys arrive per-sponsor desde `/v2/tv/broadcast/subscribe`.

## 6. API v2 surface (live on backend)

13 SDK-facing routes renamed. Full contract in `API_V2_CONTRACT.md` (PR #12). Summary live:

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
/v2/commerce/sponsors/:id/catalog            GET  apiKey

/v2/admin/broadcasts/:id/shoppable-ad        POST Bearer  platform admin
```

Old paths caen al Vite SPA fallback (html response). No alias retained.

### What's NOT in v2 yet

Listed en `IOS_V2_MIGRATION_GAP.md`. Los 9 calls legacy que el iOS SDK aún hace (brand/theme, engagement, localization, lineup, Viaplay contentId) — son directos, NO fallbacks. Migran cuando avancemos a esas features.

## 7. Smoke test — where we are

Phase 5 (v2 E2E): 3 shoppable ads dispatched.

| # | activationId | Sponsor | Commerce key used | Product |
|---|---:|---|---|---|
| 1 | 5, 6 (re-fired) | Elkjøp (#3) | `5HPHWJY-…` | Samsung QLED TV |
| 2 | 7 | Torshov Sport (#4) | `36EHG0M-…` | Nike Fotballdrakt |
| 3 | 8 | XXL (#7) | `KCXF10Y-…` | FC Barcelona Jersey |

Cada dispatch devolvió `200 {success:true, activationId, product, sponsor}`. WS fanout a `/ws/36`.

**Pending verification** (user running demos):
- Apple TV overlay con branding correcto per-sponsor en cada dispatch
- Remote Select/Play → iOS recibe WS `cart_intent` + abre product overlay
- Apple Pay button visible (paymentMethods del sponsor correspondiente)
- Apple Pay checkout completa via Commerce client **del sponsor correcto** (3 keys distintas)
- `cart_intents` DB rows con `sponsor_id + source_activation_id + delivery_mode='websocket'`

## 8. Work completed per repo

### socket-server `feature/api-v2-cut`

```
c858056  docs(ios-gap): mark 4 legacy calls killed on VioSwiftSDK
80b4bd0  chore(postman+docs): SDK folders 100% v2 — track legacy debt separately
0ffa5e0  chore(postman): complete SDK inventory
bed5dfb  chore(postman): rebuild collection for v2 direct cut
6eabf40  feat(api-v2): direct cut — rename 13 SDK routes to /v2/{mobile,tv,commerce,admin}/*
```

+ this doc consolidation commit.

### VioSwiftSDK `feature/api-v2-urls`

```
17d9336  chore(ios-v2): confirm no v1 fallback code paths + clean stale doc refs
748aeac  feat(ios-v2): drop 4 legacy multi-sponsor-conflicting endpoints
88320c5  feat(api-v2): migrate SDK runtime URLs to /v2/mobile/* surface
```

Net: 520 LoC deleted from CampaignManager.swift + OfferBannerModels.swift.

### InteractiveAds-vio `feature/api-v2-urls`

```
3be56b7  feat(tv-v2): remove hardcoded commerce apiKey fallbacks
5a7f3a4  feat(api-v2): migrate TV SDK URLs to /v2/tv/* surface
```

## 9. Next steps (after smoke test feedback)

1. User reports outcomes of the 3 Apple Pay checkouts.
2. If green → open 3 PRs:
   - socket-server: `feature/api-v2-cut` → develop
   - VioSwiftSDK: `feature/api-v2-urls` → develop (**never main**)
   - InteractiveAds-vio: `feature/api-v2-urls` → main
3. Merge PRs #11 + #12 (docs) into develop — content already replicated on feature/api-v2-cut so no conflict.
4. Phase 6: branch/Neon cleanup (see `ROLLOUT_ROADMAP.md`).
5. Phase 7: resume product placements per `TASK_PLACEMENTS.md` steps 5-12.

## 10. How to update this doc

State change worth persisting → new commit `docs(state): …`. Examples:
- Smoke test completed → update §7 with outcomes.
- A repo merges its PR → update §1 HEAD + §2 PR table.
- Neon branch rolls → update §4 + §5 if data affected.
- New v2 route added → update §6.

Keep terse. If a section grows past ~30 lines, extract + link.
