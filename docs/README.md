# Vio docs — entry point

All living docs for the multi-sponsor + TV+mobile cart-intent work.
Cross-repo references are plain relative paths so the file opens on any
developer's machine that has all three repos cloned alongside this one.

## Start here

- **New developer landing on the project?** → [`ARCHITECTURE_OVERVIEW.md`](./ARCHITECTURE_OVERVIEW.md).
  Explains the hierarchy (App → Campaign → multi-sponsor → broadcasts/placements), the v2 API surface, the data flow, and milestones (done vs coming). This is the onboarding doc.
- **Lost context? Resuming a session?** → [`CURRENT_STATE.md`](./CURRENT_STATE.md)
  is the live truth: branches, DB, runtime, demo data, PRs, current phase.
- **Building or consuming the API?** → [`API_V2_CONTRACT.md`](./API_V2_CONTRACT.md)
  is the SDK contract (5 surfaces under `/v2/*`).
- **Operator login, roles & permissions?** → [`AUTH_AND_PERMISSIONS.md`](./AUTH_AND_PERMISSIONS.md)
  — Firebase IdP, the capability matrix, tenant scoping, the `/api` gate, and the decision log (ADR-0007).
- **Need the map** (schema + endpoints + WS events + recipes) → [`DB_AND_ENDPOINTS.md`](./DB_AND_ENDPOINTS.md).
- **Authoritative data-model spec** → [`multi-sponsor-architecture.md`](./multi-sponsor-architecture.md) (deeper than ARCHITECTURE_OVERVIEW; the design → implementation spec).
- **Planning next steps?** → [`ROLLOUT_ROADMAP.md`](./ROLLOUT_ROADMAP.md).
- **Placement system tracker** → [`TASK_PLACEMENTS.md`](./TASK_PLACEMENTS.md). Original 12-step plan landed; current sprint = "Phase 2 polish per component" + doc consolidation. Latest sprint section at the top.
- **Latest landed sprint** → `CURRENT_STATE.md` §20 (Phase 2 polish — OfferBanner + ProductBanner + ProductStore + hide-on-failure + Neon guard, 2026-04-28 PM evening).
- **iOS legacy calls still in code** → [`IOS_V2_MIGRATION_GAP.md`](./IOS_V2_MIGRATION_GAP.md). 9 remaining (post 2026-04-29 cleanup that retired 24 dead v1 routes).
- **Onboarding the Kotlin dev?** → [`KOTLIN_TV_SDK_SPEC.md`](./KOTLIN_TV_SDK_SPEC.md)
  and [`KOTLIN_MOBILE_SDK_SPEC.md`](./KOTLIN_MOBILE_SDK_SPEC.md).
- **About to push a PR to `develop`?** → [`CURRENT_STATE.md` §22](./CURRENT_STATE.md). Mandatory checklist (contract + openapi + Postman + CURRENT_STATE refresh) and the `npm run check:docs-drift` gate.

## By role

### Backend / dashboard developer

1. [`multi-sponsor-architecture.md`](./multi-sponsor-architecture.md) — schema + endpoints + WS events.
1. [`AUTH_AND_PERMISSIONS.md`](./AUTH_AND_PERMISSIONS.md) — operator auth, roles/capabilities, tenant scoping, the `/api` gate. **Read before touching auth or adding endpoints** (so you know if your route needs a capability or a public exemption).
2. [`SHOPPABLE_AD_AUTHORING.md`](./SHOPPABLE_AD_AUTHORING.md) — dashboard flow (slot authoring, sponsor scoping, trigger types, validation gates).
3. [`openapi.yaml`](../openapi.yaml) — authoritative endpoint schemas.
4. [`postman/vio-sdk.postman_collection.json`](../postman/vio-sdk.postman_collection.json) — drop in, set `apiKey`, run the flows.
5. Archived references in [`docs/archive/`](./archive/) — original multi-sponsor implementation plan + Phase 3 NOT NULL enforcement playbook (kept for historical context; both phases landed on develop).

### Apple TV SDK developer

Repo: `InteractiveAds-vio` (`feature/tv-v2-subscribe` → merged to `main`).

- `docs/SDK_ARCHITECTURE.md` — runtime sequence, module layout, endpoint list, demo app notes.
- Backend reference when in doubt: [`multi-sponsor-architecture.md §7.4`](./multi-sponsor-architecture.md) and [`§6.7`](./multi-sponsor-architecture.md) (attribution chain).

### iOS SDK / mobile developer

Repo: `VioSwiftSDK` (`feature/tv-cart-intent-attribution` → merged to `develop`).

- `Documentation/CART_INTENT_FLOW.md` — end-to-end sequence of the TV → mobile flow, including dedup rules and per-sponsor Commerce routing.
- `Documentation/CODEBASE_INDEX.md` — topic-indexed file map.
- `Documentation/RUNTIME_FLOW_MAP.md` — campaign + commerce lifecycle.

### Kotlin (Android TV + Mobile) developer

- [`KOTLIN_TV_SDK_SPEC.md`](./KOTLIN_TV_SDK_SPEC.md) — Android TV SDK (mirror of Apple TV).
- [`KOTLIN_MOBILE_SDK_SPEC.md`](./KOTLIN_MOBILE_SDK_SPEC.md) — Android mobile SDK (mirror of iOS cart-intent receive path).
- Swift source of truth:
  - Apple TV: `InteractiveAds-vio/Sources/VioTVCore/VioTVManager.swift`, `.../VioTVWebSocketManager.swift`, `.../VioTVConfiguration.swift`, `InteractiveAds-vio/Sources/VioTVUI/VioTVShoppableOverlay.swift`.
  - iOS companion: `VioSwiftSDK/Sources/VioCore/Models/CampaignModels.swift` (CartIntentEvent), `.../Managers/CampaignManager.swift` (publishCartIntentIfChanged), `.../Sdk/Core/GraphQL/CommerceSdkClientProvider.swift`, `VioSwiftSDK/Sources/VioUI/Services/ProductService.swift`.

### QA / Operator

- [`SHOPPABLE_AD_AUTHORING.md`](./SHOPPABLE_AD_AUTHORING.md) — how to configure a slot and fire it.
- [`ROLLOUT_ROADMAP.md`](./ROLLOUT_ROADMAP.md) §4.2 — partner onboarding sequence.

## By topic

| Topic | Where |
|---|---|
| TV session lifecycle (subscribe, heartbeat, end) | `multi-sponsor-architecture.md` §4.3, `SDK_ARCHITECTURE.md` §Runtime sequence |
| Cart-intent envelope + attribution | `multi-sponsor-architecture.md` §6.7, `VioSwiftSDK/Documentation/CART_INTENT_FLOW.md` |
| Per-sponsor Commerce routing | `CART_INTENT_FLOW.md` §Per-sponsor Commerce routing, Kotlin spec §7-8 |
| Sponsor avatar requirement | `multi-sponsor-architecture.md` §4 sponsor shape, `SHOPPABLE_AD_AUTHORING.md` §Validation gates |
| Dashboard slot authoring | `SHOPPABLE_AD_AUTHORING.md`, frontend in `client/src/pages/broadcast-detail.tsx` |
| Commerce catalog picker (sponsor-scoped) | `SHOPPABLE_AD_AUTHORING.md`, endpoint `GET /api/commerce/sponsors/:id/catalog` |
| Phase 1 SQL (additive schema) | `scripts/phase1-sql.sql` |
| Phase 2 backfill | `scripts/backfill-multi-sponsor-phase2.ts` |
| Phase 3 NOT NULL enforcement | `scripts/phase3-enforce-sponsor-fks.sql` + [`docs/archive/PHASE_3_ENFORCEMENT.md`](./archive/PHASE_3_ENFORCEMENT.md) |

## Conventions

- `contentId` is **not** used anywhere. The partner-internal identifier is
  always `broadcastId` (matches `broadcasts.broadcast_id`).
- `userId` on the SDK side is the opaque `externalUserId` that keys the
  backend's `wsUserMap`. Apple TV demo + iOS TV2 demo are both aligned to
  `demo_user_001` so backend delivery routes WS-direct, not webhook.
- `sponsorId` top-level on a `shoppable_ad` WS event drives per-sponsor
  Commerce routing. Downstream `cart_intent` envelope carries the same value
  in `vio_payload.sponsor_id`.
- `activationId` = `shoppable_ad_activations.id`. It's the attribution anchor
  that closes the TV-dispatch → mobile-cart loop.
