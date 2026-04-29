# Task — Product Placement System (backend + iOS SDK + dashboard)

> Tracking doc para la implementación del Product Placement System. Plan
> original en `~/.claude/plans/purrfect-exploring-iverson.md`.
>
> **Scope**: backend + **iOS SDK** (VioSwiftSDK) + dashboard. Apple TV SDK
> (`InteractiveAds-vio`) está fuera — no se re-abre aquí.

## Pending for next session (resume here)

End-of-session 2026-04-28: **Live updates sprint + Spotlight polish +
Banner/Store/Slider first-phase polish all landed**. State on disk:

- socket-server `feature/placements-app-placements-table` @ `361ff94` — clean, pushed
- VioSwiftSDK `feature/placements-named-instances` @ `61253c9` — clean, pushed
- DB: `local/angelo-20260423-1814` (Neon, schema 0005 events_outbox applied + cc=114 spotlight binding for smoke testing)

Smoke E2E **passed** end-of-day: pause/resume/activate from dashboard
reach the iOS SDK in <1s, sponsor swap in place updates the rendered
component without recreating rows, in-place customConfig edits flow
through `placement_config_updated`. See §17 + new §18 in
`CURRENT_STATE.md` for the architecture summary.

### Carried over (Phase 2 customization per component)

The first-phase polish on Banner / Store / Slider (locationId +
sponsorId + opt-in header / sponsor logo overlay) shipped together;
their **per-component customization layer** is the next sprint and
runs one component at a time:

1. **VProductBanner — Phase 2**: variant selector (compact / standard /
   large layouts), CTA button styling per variant, deeplink behavior
   when sponsor changes. Today only `showSponsorLogo` overlay is
   exposed; full visual variants + dashboard form work pending.
2. **VProductStore — Phase 2**: tab/category support so the store can
   group products by sponsor or category, infinite-scroll polish, list
   variant typography. Today only mode/displayType/columns/title/
   showSponsorLogo are exposed.
3. **VProductSlider — Phase 2**: convert to campaign-driven mode (add
   `ProductSliderConfig` + `case productSlider` to ComponentConfig +
   `getActiveComponent` lookup) so it joins the placement system.
   Today Slider stays manual (host passes products + sponsorLogoUrl
   directly).

### Other carry-over items (lower priority)

4. **Postman regen** — collection still on the pre-Sprint-2026-04-28
   route surface. Owners: same SDK developer who runs the next
   smoke + integration round.
5. **Scheduling fields** — `scheduled_time` + `end_time` columns exist
   on `campaign_components`; dashboard form doesn't expose them yet.
6. **Schema consistency vs Apple TV SDK** — verify `sponsor.avatarUrl`
   additive change doesn't break the Apple TV consumption path in
   `InteractiveAds-vio`.
7. **Banner inline picker** — added in customize dialog today but the
   "Add component" form for `product_banner` still uses the same
   multi-select picker that single-product templates need. Audit
   addComponentMutation single vs multi serialization on Add side.

---

## Sprint 2026-04-28 PM — Live updates via WebSocket (outbox + module subs)

> **Goal**: when an operator pauses, edits, or rotates a placement in the
> dashboard, the iOS SDK reflects the change in <1s without polling and
> without an app restart. Built on the existing `/ws/:campaignId`
> connection, structured to scale to engagement + broadcast events later.
>
> **Repos & branches**: `feature/placements-app-placements-table`
> (socket-server) + `feature/placements-named-instances` (VioSwiftSDK).
> One commit per phase. DB stays on `local/angelo-20260423-1814`.

### Design decisions (locked 2026-04-28)

| # | Decision |
|---|---|
| 1 | **3 placement events** — `placement_status_changed` (paused↔active), `placement_config_updated` (customConfig diff), `placement_activation_swapped` (sponsor rotation A→B atomic) |
| 2 | **Outbox pattern from day 1** — new `events_outbox` table; HTTP handler INSERTs event row in the **same tx** as the data UPDATE; in-process worker polls + emits via `broadcastToCampaign`; multi-node safe via `FOR UPDATE SKIP LOCKED` |
| 3 | **Scope = `campaign:{id}`** — placements live above broadcasts; reuse the existing `/ws/:campaignId` rooms (no new room model) |
| 4 | **Module-aware subscribe protocol** — client sends `{type:"subscribe", modules:[…]}` after connect; server tracks `clientSubscriptions: WeakMap<WS, Set<module>>`; emit filters by `event.module ∈ client.modules` (default `'*'` for backward-compat) |
| 5 | **Reconnect = silent re-fetch** — on reconnect the SDK calls existing `GET /v2/mobile/campaigns/:id/components` and reconciles; user sees no flicker; "GET es la verdad" rule respected |
| 6 | **UI semantics**: paused → hard cut; `config_updated` with `productIds` change → brief skeleton; `config_updated` (title/showSponsorLogo only) → in-place; `activation_swapped` → hard cut + reload (new sponsor's catalog) |
| 7 | **Sequencing via `serverTimestamp`** — every event payload carries `serverTimestamp`; SDK ignores events older than the last applied for that target (out-of-order resilience) |
| 8 | **No `placement_deprecated` event** — soft-delete (`deprecated_at`) is a code-level concern (operator must remove from code path); runtime control = pause/resume only |
| 9 | **Naming `placement_*`** — rename SDK callbacks `onComponentStatusChanged` → `onPlacementStatusChanged`, `onComponentConfigUpdated` → `onPlacementConfigUpdated`; new `onPlacementActivationSwapped` |
| 10 | **Multi-sponsor at campaign scope** — only one `campaign_components` row per `(campaignId, appPlacementId)` is `status='active'` (partial UNIQUE in DB already); rotation = atomic swap inside a single tx, single emit |

### Scalability — table of supported modules

The outbox + subscribe protocol is **module-agnostic**. Today only
`placements` emits. Adding the others later is purely additive:

| module | scope_type | status | wiring required when added |
|---|---|---|---|
| `placements` | `campaign` | **🚧 building this sprint** | full E2E |
| `engagement` | `broadcast` | future | 1 INSERT in outbox per handler + 1 case in SDK switch |
| `broadcast` | `broadcast` | future | idem |
| `cart_intent` | `user` | migrate later | currently uses direct user routing; outbox migration is a separate follow-up |

### Phase 1 — Outbox foundation (backend)

**Branch**: `feature/placements-app-placements-table`. **One commit.**

Files:

- NEW `migrations/0005_events_outbox.sql`:
  ```sql
  CREATE TABLE events_outbox (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    topic       TEXT NOT NULL,         -- 'placement_status_changed' | …
    module      TEXT NOT NULL,         -- 'placements' | 'engagement' | …
    scope_type  TEXT NOT NULL,         -- 'campaign' | 'broadcast' | 'user'
    scope_id    BIGINT NOT NULL,
    payload     JSONB NOT NULL,
    server_timestamp TIMESTAMPTZ NOT NULL DEFAULT now(),
    status      TEXT NOT NULL DEFAULT 'pending',  -- 'pending' | 'sent' | 'failed' | 'dead'
    attempts    INT NOT NULL DEFAULT 0,
    last_error  TEXT,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
    processed_at TIMESTAMPTZ
  );
  CREATE INDEX events_outbox_pending_idx ON events_outbox (created_at) WHERE status='pending';
  CREATE INDEX events_outbox_scope_idx ON events_outbox (scope_type, scope_id, server_timestamp DESC);
  ```
- MOD `shared/schema.ts` — Drizzle table definition for `eventsOutbox`.
- NEW `server/events/types.ts` — TS interfaces for the 3 placement events + the generic outbox row.
- NEW `server/events/outbox.ts` — `enqueueEvent(tx, args)` helper that takes the existing transaction handle.
- NEW `server/events/worker.ts` — `processOutbox()` loop running every 500ms; uses `FOR UPDATE SKIP LOCKED LIMIT 50`; max 5 attempts then marks `dead`.
- MOD `server/index.ts` — start the worker on app boot; clean shutdown on SIGTERM.
- Apply migration to local Neon (`local/angelo-20260423-1814`).

### Phase 2 — Module subscribe protocol (backend WS)

**Branch**: same. **One commit.**

Files:

- MOD `server/routes.ts` (WS section ~line 485):
  - `clientSubscriptions: WeakMap<WebSocket, Set<string>>` — module-level state.
  - On message `{type:"subscribe", modules:[…]}`: store in WeakMap.
  - Default if no subscribe arrives: treat as `'*'` (firehose, backward-compat for current cart-intent / poll / contest emit paths).
- `broadcastToCampaign(campaignId, message)` — accept structured event `{module, type, payload, serverTimestamp}` and filter per-client by `clientSubscriptions`. Stays backward-compat for raw-string callers (legacy emit sites).
- Multi-node Redis path: filter still happens at each node before sending to local clients (Redis Pub/Sub fanout unchanged).

### Phase 3 — Emit the 3 placement events (backend handlers)

**Branch**: same. **One commit.**

Files:

- MOD `server/routes.ts` — refactor existing handlers to use `enqueueEvent` inside the same tx as the data UPDATE:
  - `PATCH /api/campaigns/:id/components/:rowId` → if `status` field changed → `placement_status_changed`; if `customConfig` changed → `placement_config_updated`.
  - NEW `POST /api/campaigns/:id/components/:rowId/pause` and `…/resume` — explicit verbs that emit only `placement_status_changed`.
  - NEW `POST /api/campaigns/:id/placements/:appPlacementId/activate` body `{campaignComponentId}` — atomic swap: sets old to inactive + new to active + enqueues `placement_activation_swapped` (single event).
- MOD `server/storage.ts` — helpers accept tx handle so `enqueueEvent` shares it.
- Payload shapes added to `API_V2_CONTRACT.md §WS` (also in Phase 6).

### Phase 4 — iOS SDK: subscribe + handlers

**Branch**: `feature/placements-named-instances`. **One commit.**

Files:

- NEW `Sources/VioCore/Models/VioModule.swift` — `enum VioModule: String { case placements, engagement, cartIntent, broadcast }`.
- MOD `Sources/VioCore/VioConfiguration.swift` — `enabledModules: Set<VioModule>` (default lazy: `.cartIntent` for backward compat; populated by `VioPlacementRegistry` on first placement view mount).
- MOD `Sources/VioCore/Managers/CampaignWebSocketManager.swift`:
  - After `identify`, send `{type:"subscribe", modules:[…]}` based on `VioConfiguration.shared.enabledModules`.
  - Rename `onComponentStatusChanged` → `onPlacementStatusChanged`, `onComponentConfigUpdated` → `onPlacementConfigUpdated`.
  - Add `onPlacementActivationSwapped`.
  - Update `handleMessage` switch for new wire names.
- MOD `Sources/VioCore/Managers/CampaignManager.swift`:
  - Rename binding methods accordingly.
  - Implement `handlePlacementActivationSwapped(event)` — replace component for `appPlacementId`; SwiftUI auto-renders; ProductService reloads with new `sponsorId`.
  - Add `lastEventTimestamp` per Component for sequencing — events with older timestamps ignored.
  - On WS reconnect (`didOpenWithProtocol` after non-zero `reconnectAttempts`): call `fetchAndApplyCampaignComponentsIfPossible()` silently and reset `lastEventTimestamp` to `now`.
- MOD `Sources/VioCore/Models/CampaignModels.swift` — add `PlacementActivationSwappedEvent` struct + rename existing `ComponentStatusChangedEvent` → `PlacementStatusChangedEvent` etc.

### Phase 5 — Dashboard: pause + activate UI

**Branch**: `feature/placements-app-placements-table`. **One commit.**

Files:

- MOD `client/src/components/dashboard/ComponentsTab.tsx`:
  - Per-placement card: "Pausar" / "Reanudar" button → POST `…/pause` or `…/resume`.
  - When `(campaignId, appPlacementId)` has >1 row, show "Sponsor activo" dropdown listing the candidate rows; selecting one calls POST `…/activate`.
  - All mutations show toast on success ("Aplicado en vivo").

### Phase 6 — Smoke test E2E + docs accumulation

**Branches**: both. **One commit per repo.**

Smoke scenarios (must all pass):

1. iOS demo cold-start: carousel renders sponsor A.
2. Dashboard: pause → carousel disappears in <1s.
3. Dashboard: resume → carousel re-appears.
4. Dashboard: change `title` → header updates, no skeleton.
5. Dashboard: change `productIds` → brief skeleton + new products.
6. Dashboard: add second binding (sponsor B), then "activate B" → hard cut to sponsor B with logo + title + new products.
7. iOS: airplane mode 30s, dashboard pauses meanwhile, iOS reconnects → silent fetch → carousel disappears (eventual consistency, no flicker).

Docs to update (rule #7 — accumulate, no new files):

- `CURRENT_STATE.md §17` — add "Live updates" subsection with sequence diagram.
- `ARCHITECTURE_OVERVIEW.md` — add `events_outbox` table + WS subscribe protocol section.
- `DB_AND_ENDPOINTS.md` — `events_outbox` schema + new placement endpoints (`/pause`, `/resume`, `/activate`) + WS message types.
- `API_V2_CONTRACT.md §WS` — full payload reference for the 3 placement events + subscribe message.
- This file — append final outcomes + roll-forward "Pending" section.

### Anti-goals (explicitly out of scope this sprint)

- ❌ Engagement events (polls, contests, chat) — structure supports them; wiring later.
- ❌ Broadcast events (lineup, score, stats) — same.
- ❌ Cart-intent migration to outbox — separate follow-up sprint.
- ❌ Postgres `LISTEN/NOTIFY` for sub-100ms latency — premature optimization; revisit if 500ms feels slow in production.
- ❌ Outbox cleanup cron — add when DB row count crosses ~100k; trivial to add later.
- ❌ Banner / Spotlight / Store / Slider `locationId:` plumbing — landed afterward in the closure round below.

### Sprint closure (landed 2026-04-28 PM)

All 6 phases shipped + the carry-over pieces folded in same day. Final
commit map:

**socket-server `feature/placements-app-placements-table`**:

| Commit | Phase | Summary |
|---|---|---|
| `4b99778` | plan | full sprint plan committed to TASK_PLACEMENTS |
| `e2df66c` | 1 | outbox foundation (table + worker + helpers) |
| `89f530a` | 2 | module subscribe protocol on WS handler |
| `1bfb71d` | 3 | emit 3 placement events + pause/resume/activate endpoints |
| `753abe0` | 5a | dashboard Pausar / Hacer activo verbs |
| `b70fcf3` | follow-up | productConfig shape per template (single vs multi) |
| `29de760` | follow-up | zod title + showSponsorLogo on carousel + spotlight |
| `b26881b` | follow-up | spotlight layout enum on zod |
| `6b0cfda` | 5b | dashboard spotlight form (title + showSponsorLogo + layout) |
| `3022f75` | 5c | PATCH /config accepts sponsorId + customize sponsor swap UI |
| `cac72cf` | 5d | shared SponsorProductPicker (reused in both Add + Customize) |
| `aeafe3d` | infra | Neon pool error handler (anti-crash) |
| `361ff94` | bonus | Banner + Store first-phase polish (zod + customize form) |

**VioSwiftSDK `feature/placements-named-instances`**:

| Commit | Summary |
|---|---|
| `f89eaa3` | subscribe protocol + 3 placement event handlers |
| `07e5669` | match events by campaignComponentId, not template id |
| `02be9d2` | spotlight polish (locationId + header + sponsorId + picker) |
| `c14bea3` | wire home_spotlight slot for smoke |
| `3f1ebf5` | move home_spotlight slot below Direkte rail |
| `e2f3429` | spotlight layout config + sponsorId fix |
| `f8c4954` | productCard list-layout Spacer fix (no vertical bleed) |
| `e8a24ff` | in-place sponsor swap on placement_config_updated |
| `4fa2391` | spotlight skeleton variant-aware |
| `61253c9` | Banner / Store / Slider first-phase polish |

**Smoke E2E final state** (manually verified):

1. iOS demo cold-start → carousel + spotlight (cc=114) render in their
   slots with correct sponsor logos + per-sponsor product catalogs.
2. Pause cc=113 from dashboard → carousel disappears in <1s. Resume →
   reappears.
3. Pause cc=114 from dashboard → spotlight disappears. Activate →
   re-renders with operator-set title + sponsor logo + chosen product.
4. Customize sponsor swap (cc=114) — sponsor select changes from XXL
   to Elkjøp → SDK updates header logo + reloads product from new
   commerce key. Single `placement_config_updated` event carries both
   the sponsorId change + customConfig diff.
5. Customize layout swap (hero → list) → SDK re-renders compact card
   without skeleton flash; carouselContent in `home_spotlight` slot
   collapses to ~120pt height (was ~600pt before the variant-aware
   skeleton fix).

Pending for fresh tests after Banner/Store/Slider polish lands: bind
Banner + Store placements via dashboard with operator-set
showSponsorLogo + title and confirm SDK render. Slider stays manual,
exercised by host code as before.

---

## Sprint 2026-04-29 — Doc consolidation + Q2 canonicalize component IDs

Audit identified drift between docs / openapi / Postman / code, plus a schema
inconsistency: 3 of 6 `components.id` values were random UUIDs, the other 3
were slug-style — a mixed PK convention that propagated to every
`/v2/mobile/campaigns/:id/components` SDK response (some rows shipped with
`id: "product-store-template"`, others with `id: "5355258c-fad2-…"`).

### What landed

- [x] **Phase 1 — code cleanup**: 24 dead v1 routes deleted from `server/routes.ts`
  (894 lines). Verified zero callers across iOS / Apple TV / dashboard /
  scripts. Commit `374a3ae`.
- [x] **Phase 2 — docs refresh**: `API_V2_CONTRACT` (sections 4 / 7 / 11 / 12),
  `ARCHITECTURE_OVERVIEW` (section 4 + Hito 6 + new Hitos 6.5/6.6/6.7),
  `docs/README`, `IOS_V2_MIGRATION_GAP`, `ROLLOUT_ROADMAP` — all rewritten
  to match code state. Commit `4bdbc9d`.
- [x] **Phase 3 — archive**: `multi-sponsor-implementation-plan.md` and
  `PHASE_3_ENFORCEMENT.md` moved to `docs/archive/` (both phases landed,
  kept for historical context).
- [x] **Phase 4 — openapi.yaml**: 21 stale entries removed (3 `/v2/sdk/*`
  renamed, 6 `/api/sdk/tv/*` renamed, 12 dead v1 routes); 13 missing v2
  paths added. 101 → 97 paths total; v2 count 3 → 16; ghost paths 0.
- [x] **Phase 5 — Postman**: new folder "5b. Placement control plane" (7
  management routes), 2 missing v2 paths added to folder 2, folder 7
  WebSocket events filled with reference items. Reordered iOS Mobile SDK
  folder so requests follow cold-start sequence (commit `9b4e46e`). 31 →
  45 requests across 9 → 10 folders.
- [x] **Phase 6 — drift script**: `scripts/check-docs-drift.ts` runs 5
  comparisons (routes ↔ openapi, ↔ contract, ↔ Postman, SDK ↔ DB
  manifest, DB invariants). Reports drift as exit code 1.
  Now extended with invariant 7 (components.id must be slug format).
- [x] **Q2 — canonicalize component IDs**: migration
  `0006_canonicalize_component_ids.sql`. ALTERs the FK
  `app_placements.component_id` → `components.id` from `NO ACTION` to
  `ON UPDATE CASCADE` (so future renames are a single UPDATE), then
  renames the 3 UUID PKs:
    - `1346badf-…` → `countdown-template`
    - `5355258c-…` → `offer-banner-template`
    - `321ce3d4-…` → `product-spotlight-template`
  Cascade auto-updates the matching `app_placements` rows (TV2 ap=20
  spotlight, ap=21 offer_banner). All 6 templates now use a uniform
  `<type>-template` slug pattern. SDK response confirmed via probe:
  `id` field now ships slugs across all 4 active placements.

### Verification

`npm run check:docs-drift` (5 of 5 checks passing):

```
[1/5] routes.ts ↔ openapi.yaml             ✅ aligned 25 contract routes
[2/5] /v2/* in code ↔ API_V2_CONTRACT      ✅ aligned 16 routes
[3/5] /v2/* in code ↔ Postman              ✅ aligned 16 routes
[4/5] SDK slot manifest ↔ DB locations     ✅ aligned 6 slots
[5/5] DB invariants                         ✅ 7 of 7 (1 known warning: 4
                                              campaigns with primary_sponsor_id
                                              missing from campaign_sponsors —
                                              tracked as Q1 follow-up)
```

### Open follow-ups (decisions still pending)

- **Q1 — primary↔junction sync** (4 campaigns: 31 SkiStar, 33 Elkjøp,
  36 TV2/Elkjøp, 37 test). Path A = backfill INSERT + DB trigger,
  Path B = deprecate `campaigns.primary_sponsor_id` column. Drift
  script reports as ⚠️ until resolved.
- **Q4 — `Product.sponsorId`** for per-product cart routing in
  multi-sponsor stores. Today the detail-overlay routes via
  `CommerceSdkClientProvider.activeSponsorId` (global), not the
  tapped product's actual sponsor. Tracked in
  `CURRENT_STATE.md §20` known limitations.

---

## Sprint 2026-04-28 (PM evening) — Phase 2 polish per component

Continuation of the Banner/Store/Slider first-phase sprint. Goal of
Phase 2 is to take each campaign-driven component **end-to-end** so
the operator can do create + customize + live edit from the dashboard
without ever editing `customConfig` JSON by hand. Three components
shipped in one evening + one cross-cutting fix + one infra fix.

### Components polished

- [x] **VOfferBanner** — campaign-driven mode (`VOfferBanner(locationId:)`)
  with full content fields (title/subtitle/bg/countdown/badge/CTA/
  deeplink) inline in the Add dialog + Customize. Brand-aware color
  pickers for buttonColor + backgroundColor. Logo auto-resolves from
  `sponsor.logoUrl` when override is empty. Live preview at create-time.
  Wired in TV2 demo at `home_offer` slot below the legacy hardcoded
  banner during the migration window.
- [x] **VProductBanner** — layout preset enum (`compact` / `standard` /
  `large`) drives height + font sizing; granular fields still override.
  Brand color pickers replace hex Inputs in Customize. Inline content
  fields in Add (title / subtitle / bg / CTA / deeplink + 2 brand
  colors). Live preview component. Demo slot `home_product_banner`
  registered + mounted in HomeView wrapped in NavigationLink.
- [x] **VProductStore** — Phase 2 simplified per user direction
  ("multi-sponsor, sin categoria, un modal a la vez"). Products array
  changed from `[productId]` (single sponsor) to
  `[{productId, sponsorId}, ...]` so each product routes through its
  OWN sponsor's commerce key. Tap → `VProductDetailOverlay`, one at a
  time via `@State`. New shared `MultiSponsorProductPicker` rendered
  in **both** Add and Customize dialogs (creation parity with edit
  parity). Demo slot `home_store` registered + mounted at the bottom
  of HomeView.

### Cross-cutting

- [x] **Hide-on-failure** on Carousel + Spotlight + Store. `loadFailed:
  Bool` flag on each viewModel; `shouldShow` returns false when failed
  && empty. Single-shot — fail → hide. Next config / WS event triggers
  fresh attempt. Telemetry-to-backend variant deferred (open design
  Q1-Q4).

### Infra

- [x] **Process-level Neon guard** in `server/db.ts`. Pool error
  listener wasn't enough; neon-serverless drops the WS transport
  inside Client / WebSocket and the unhandled exception crashes the
  process after the pool already reacted. Added `process.on(
  'uncaughtException')` + `process.on('unhandledRejection')` that
  swallow exactly "Connection terminated" / "Unhandled error" and
  re-throw everything else. Symptom that triggered the fix: backend
  died → /v2/mobile/config 502 → iOS fell back to stale Reachu
  creds → GraphQL 401 cascade.

### Files of record (sprint commits)

socket-server `feature/placements-app-placements-table`:

| Commit | Component | Summary |
|---|---|---|
| `998625e` | offerBanner | full offer_banner customize form (deeplink + buttonColor) |
| `40139f9` | offerBanner | logoUrl optional in zod + dashboard hint |
| `dd2cbbd` | offerBanner | inline offer_banner content + live preview at create-time |
| `0266554` | offerBanner | brand-aware color picker for offer_banner |
| `936365e` | productBanner | layout enum on zod + dashboard select |
| `5a6f03a` | productBanner | brand color pickers replace hex Inputs in customize form |
| `b06c78f` | productBanner | inline content fields in Add dialog |
| `812f64b` | productBanner | live preview component + wire into Add + Customize |
| `824cf69` | infra | process-level guard for neon-serverless connection drops |
| `fe5487d` | productStore | MultiSponsorProductPicker + zod for Phase 2 |
| `2328c5a` | productStore | MultiSponsorProductPicker in Add dialog |

VioSwiftSDK `feature/placements-named-instances`:

| Commit | Component | Summary |
|---|---|---|
| `00cdd08` | offerBanner | campaign-driven mode + home_offer slot wired in demo |
| `007975d` | offerBanner | logoUrl optional → falls back to sponsor.logoUrl |
| `a06668f` | offerBanner | button color falls back to sponsor.primaryColor |
| `37ee62c` | offerBanner | white-on-dark text + dark badge to match hardcoded render |
| `bccdc37` | offerBanner | black overlay + leading-aligned logo + DB countdown |
| `7353401` | productBanner | layout preset (compact/standard/large) |
| `5dd29af` | productBanner | register home_product_banner slot + mount in HomeView |
| `194cc7c` | cross | hide-on-failure — no perpetual skeleton when load fails |
| `5730975` | productStore | multi-sponsor products array (one detail modal at a time) |
| `2855f58` | productStore | register home_store slot + mount VProductStore |

### Pending E2E smoke (next session)

1. Cold-restart TV2 demo → manifest uploads, dashboard `/apps/18` sees
   `home_offer`, `home_product_banner`, `home_store` listed.
2. Bind `home_offer` from Add with title/countdown/badge/CTA + buttonColor
   → SDK render matches preview.
3. Bind `home_product_banner` with `layout=compact` → swap to `large`
   from Customize → SDK reflows live via `placement_config_updated`.
4. Bind `home_store` from Add with 2-3 products from Elkjøp + 2-3 from
   XXL → grid renders multi-sponsor; each tap opens detail overlay one
   at a time. Reopen same row in Customize → entries round-trip exactly.
5. Force a commerce 401 on one sponsor (toggle env or break the API
   key) → Carousel/Spotlight/Store hide instead of showing skeleton.

### Open follow-ups

- **Cart routing per-product in multi-sponsor stores** — `Product` struct
  has no `sponsorId` field; detail-overlay's "Add to cart" routes via
  `CommerceSdkClientProvider.activeSponsorId` (not the tapped product's
  sponsor). Add `Product.sponsorId` (or wrapper struct) so the overlay
  knows which sponsor's key to use for checkout.
- **Telemetry to backend on hide-on-failure** — sdk_events table + POST
  endpoint + batching. 4 design questions open: Q1 schema columns
  (event_type, error_code, sdk_version, broadcastId?, locationId?),
  Q2 batching cadence (60s? on backgrounding?), Q3 PII in error message
  (raw error string vs categorized code), Q4 retention (90d? 30d?).
- **VProductSlider Phase 2** — campaign-driven mode (currently
  manual-only host-app view). Promotion to placement template would
  add `case .productSlider` in `ComponentConfig` + canonical row +
  `getActiveComponent` lookup.
- **Cleanup** — remove the legacy hardcoded `OfferBannerView()` from
  TV2 demo HomeView once the dynamic version is signed off.

---

## Sprint 2026-04-27 (PM) — Architecture pivot to dashboard-driven placements

The morning's "self-service named placements" design (Phases A→C) had the
SDK declare `placements[]` directly. After hands-on testing we pivoted:
**operator/admin creates app_placements via dashboard**, the SDK declares
**only the slot locations** it implements. This gives operator full control
while keeping a thin self-service contract for slot discovery.

### Decisions locked (afternoon)

1. **Library is read-only** — 6 canonical templates only (countdown, offer_banner,
   product_banner, product_carousel, product_spotlight, product_store).
   No "New Component" button. Vio admin edits via SQL when needed.
2. **Locations declared by SDK** (`POST /v2/mobile/components/manifest` with
   `locations[]` only). Manifest is sync-semantic: locations not present in
   the new payload are **soft-deprecated**, not deleted.
3. **App_placements created by dashboard** — `/apps/:id` "Add from library"
   form: pick template + name + locationId (dropdown of dev's declared
   locations). NOT created by SDK.
4. **Campaign_components picker** — `/campaigns/:id/components`: simplified
   to `placement (from app_placements) + sponsor + products`. The
   component+location pair lives implicitly inside the placement.
5. **Multi-sponsor rotation** — only ONE active campaign_component per
   `(campaign, app_placement)` at a time. Enforced by partial UNIQUE in DB
   AND by dashboard validation (defense in depth).
6. **Soft-delete everywhere**: `deprecated_at` columns on
   `app_component_locations` and `app_placements`. Existing campaign_components
   pointing at deprecated rows keep rendering with dashboard warning.
7. **Drop `app_components` table** — fully redundant with `app_placements`.
8. **No legacy support** — manifest endpoint rejects `placements[]` and
   `components[]` arrays. Phase C iOS API `Vio.registerPlacement(...)` is
   removed (was added this morning, superseded).
9. **Audit columns** — `created_by` on `app_placements` and
   `campaign_components` for operator accountability.
10. **WebSocket events** — new `app_placement_deprecated` and
    `app_placement_status_changed` so SDK can react in real-time.

### Sub-sprint checklist

- [x] **DB migration `0004_named_placements_consolidation.sql`** — applied to local Neon `local/angelo-…` only; develop pending re-promote.
- [x] **`shared/schema.ts`** — appComponents dropped; appPlacements + appComponentLocations + campaignComponents updated.
- [x] **`server/storage.ts`** — legacy helpers gone; createAppPlacement + deprecateAppPlacement + getCanonicalLibraryTemplates + deprecateAppComponentLocationsNotIn added.
- [x] **`server/routes.ts`** — manifest accepts only `locations[]`; legacy app_components endpoints return 410 Gone; new POST/DELETE app_placements endpoints; campaign placement endpoints take `appPlacementId`; PATCH refactored to row PK; SDK fetch endpoints JOIN through app_placements + filter deprecated; WS payloads include appPlacementId + locationId.
- [x] **iOS SDK** — Vio.registerPlacement and registerPlacementComponent dropped; registerPlacementLocation un-deprecated as primary; manifest payload only `locations[]`; VioSponsor adds avatarUrl + renderableLogoUrl; ProductCarouselConfig adds title + showSponsorLogo; VProductCarousel renders placementHeader; VRemoteImage handles SVG via WKWebView; TV2 demo cleaned to declaration ≡ render.
- [x] **Dashboard** — `/apps/:id` Placements section + "Add from library" form (template + locationId + name); deprecated badge; `/campaigns/:id` Add Component simplified to placement + sponsor + products + (optional) title + showSponsorLogo + autoPlay/interval; ID semantics fixed (mutations pass `String(cc.id)` row PK).
- [x] **Docs accumulated in-place**: `CURRENT_STATE.md §17` rewritten with the post-pivot diagram + smoke test results + new-session cheat sheet; `DB_AND_ENDPOINTS.md` schema/endpoints updated; this checklist.
- [ ] **Postman** — `vio-sdk.postman_collection.json` regen pending. Folders affected:
  - `2. iOS Mobile SDK` — manifest body shape changed to `{locations: [{id, displayName?}]}`; legacy 410-Gone paths.
  - `5. Dashboard operator` — new POST/DELETE `/api/client-apps/:id/placements`; updated POST `/api/campaigns/:id/components` body (`appPlacementId` not `componentId+locationId`); new error codes documented.
  - **Tomorrow**: regen the collection from openapi or hand-edit; smoke each request.

### Smoke E2E

1. Wipe TV2 (clientApp 18) state.
2. Run iOS demo → manifest uploads `locations[]` only → DB has `app_component_locations` rows but `app_placements` empty.
3. Dashboard `/apps/18` Placements section: empty + locations list shows from manifest.
4. Click "Add from library" → pick "Product Carousel" + name "Carrusel home" + location "home_top" → save → `app_placements` row created.
5. Repeat for "Carrusel pre-kickoff" @ match_pre_kickoff.
6. Dashboard `/campaigns/36` Components tab → Add → pick placement "Carrusel home" + sponsor XXL + products → save → `campaign_components` row.
7. iOS demo cold-restart → carousel renders.
8. Operator deprecates "Carrusel home" → existing campaign_components shows warning + WS event fires + iOS dev log.

---

## Status — runtime PRE-pivot (2026-04-27 morning, superseded)

El plan original (12 steps) se ejecutó hasta Step 4, después se **reshapeó a self-service registry** durante la sesión del 2026-04-27 cuando el usuario reframeó el goal: _"dev nunca toca código, operador drives todo desde el dashboard"_. La nueva arquitectura está documentada en `CURRENT_STATE.md §17` (single source of truth para resumen + diagrama de flujo).

### Phases consolidadas

| Phase | What | Repos | Status | Merge commits |
|---|---|---|---|---|
| **A — Backend WS + openapi** | Steps 1-4 (sponsorId at root, openapi schema, dashboard sponsor picker) | socket-server | ✅ done (2026-04-23) | tracked in `feature/placements-v2` (folded into PR #29 base) |
| **B — Self-service backend** | `app_component_locations` table + `POST /v2/mobile/components/manifest` + `getCanonicalComponentByType` + 17 jest tests | socket-server | ✅ done (2026-04-27) | **PR #29 → `688b9d4`** |
| **C — Dashboard pickers** | Location/sponsor/product pickers in `ComponentsTab` + `GET /v2/mobile/campaigns/:id/components` con merge `templateConfig + customConfig` | socket-server | ✅ done (2026-04-27) | **PR #32 → `f97bebd`** (replaced PR #30, rebased onto develop after #29 merge auto-closed it) |
| **D — iOS runtime** | `VioPlacementRegistry` + manifest upload at boot + cold-start fetch + `(id, locationId)` dedupe + per-sponsor `ProductService.loadProducts(sponsorId:)` | VioSwiftSDK | ✅ done (2026-04-27) | **PR #8 → `0d3383d`** |
| **E — TV2 demo wired** | `TV2PlacementRegistration.registerAll()` + `HomeView` + `MatchDetailView` use `VProductCarousel(locationId:)` | VioSwiftSDK demo | ✅ done (2026-04-27) | folded into PR #8 |
| **F — Smoke test** | Elkjøp en `home_top` + XXL en `match_pre_kickoff`, products cargan via per-sponsor key, dashboard pickers populate from registry | all 3 | ✅ verde (2026-04-27) | — |

### Mapping del plan original (12 steps)

| Step original | Estado actual | Nota |
|---|---|---|
| 1. Preparación | ✅ done (Phase A) | TV2 wipe + tracking doc |
| 2. Backend WS sponsorId | ✅ done (Phase A) | scheduler + toggle |
| 3. openapi + Postman | ✅ done (Phase A) | 6 folders |
| 4. Dashboard sponsor picker | ✅ done (Phase A) | PR #29 también lo refuerza |
| 5. Component catalog scope `app_components` | ✅ done (Phase C, PR #32) | reshaped: location-first picker + manifest source |
| 6. Product picker para `product_*` | ✅ done (Phase C, PR #32) | `useSponsorCatalog` reused |
| 7. Scheduling fields | ⏸ deferred | no blocker para smoke; first operator request lo activa |
| 8. iOS `Component.sponsorId` decode | ✅ done (Phase D, PR #8) | `CartIntentEvent.dispatchedAt` también |
| 9. 5 views pasan `sponsorId` a `ProductService` | ✅ partial (Phase D, PR #8) | Solo `VProductCarousel` migrado para el smoke. Spotlight/Store/Banner/Slider siguen el mismo patrón cuando los toque la siguiente campaña |
| 10. `Product.sponsorId` optional + stamping | ⏸ deferred | no necesario hoy: `CartManager` rutea via `CommerceSdkClientProvider.activeSponsorId` que `ProductService.loadProducts(sponsorId:)` ya setea |
| 11. `CartManager.addProduct` per-sponsor | ✅ done (precedió placements en PR #7 de VioSwiftSDK) | `activeSponsorId` is owned exclusively by `client(forSponsorId:)` |
| 12. E2E TV2 con 2 placements | ✅ done (Phase F) | Elkjøp + XXL verde |

## Branches de trabajo (post-landing)

Todas las branches del placement sprint están merged + safe to delete localmente. El siguiente trabajo arranca de `develop` fresh en cada repo.

| Repo / env | Branch | Estado |
|---|---|---|
| `socket-server` | `feature/placements-manifest-registry` | ✅ merged via PR #29 (`688b9d4`). Safe to delete. |
| `socket-server` | `feature/placements-dashboard-pickers-on-29` | ✅ merged via PR #32 (`f97bebd`). Safe to delete. |
| `socket-server` | `feature/placements-dashboard-pickers` | ⚠️ stale — auto-closed when PR #30 base #29 was deleted on merge. Reemplazada por la `-on-29` rebased. Safe to delete. |
| `socket-server` | `feature/placements-v2` (legacy) | ⚠️ pre-reshape carrier de Steps 1-4. Folded into PR #29. Safe to delete. |
| `VioSwiftSDK` | `feature/placements-registry` | ✅ merged via PR #8 (`0d3383d`). Safe to delete. |
| `VioSwiftSDK` | `feature/placements-v2` | ⚠️ legacy safety branch nunca usada. Safe to delete. |
| **Neon (activa)** | `local/angelo-20260423-1814` (`br-summer-morning-a8y0i36l`) | 🟢 active — `DATABASE_URL` + `PGHOST` apuntan aquí. Tiene los 2 placements del smoke test (TV2 campaign 36 ids 108 + 109). |

### `.env` backups

- `/tmp/vio-env-develop-before-placements.bak` — antes del primer fork (Step 1, 12:50).
- `/tmp/vio-env-placements-v2-before-local-fork.bak` — antes del fork actual a `local/angelo-*` (18:14).

### git state (2026-04-27 final)

- `socket-server` HEAD = `develop` @ `f97bebd`. Working tree clean.
- `VioSwiftSDK` HEAD = `develop` @ `0d3383d`. Working tree clean.
- `InteractiveAds-vio` HEAD = `main`. Sin cambios este ciclo (placements no requirió tocar Apple TV SDK).

## Decisiones locked

- **Self-service over admin-only**. Dev declara components + locations una vez al boot vía manifest upload; operador drive el resto desde el dashboard. (Reframed during sesión 2026-04-27.)
- **Manifest-declared locations** (no fixed list en backend). Dashboard's location picker reads from `app_component_locations` que el SDK populated. Operator nunca puede bind a slot que el dev no expone.
- **Dedupe key `(id, locationId)`** en cliente. Supports multiple instances del mismo template en diferentes slots de la misma campaña. La vieja key `id` colapsaba 2 instances con mismo template.
- **Server-side merge `templateConfig + customConfig`**. Backend devuelve config completa; SDK decoder no necesita defaults. Operator solo escribe el overlay (productIds, etc.).
- **Adapt existing SDK components, don't recreate**. `VProductCarousel(locationId:)` + `getActiveComponent(locationId:)` — no nuevo `VioPlacementSlot` view abstraction.
- **`activeSponsorId` exclusively owned by `client(forSponsorId:)`**. `client(configuration:)` never overwrites. Apple Pay confirmation logo deriva de aquí.
- Commerce NO viaja en payload — SDK resuelve con `sponsorId` vía `VioConfiguration.commerce(forSponsorId:)`.
- `broadcast_id` en `campaign_components` solo para override — null en caso base.
- No force-push (regla operativa post-incidente docs branch).

## Issues / decisiones encontradas por paso

### Step 1 — Preparación

- TV2 campaign 36 tenía placements registrados previamente. Se eliminan vía SQL directo (cascade en `campaign_components`) antes de reconstruir por el nuevo flow. Esto se hizo en la Neon branch `feature/placements-v2-20260423-1250`.

### Step 4 — Dashboard sponsor picker

- Smoke observado: POST sin `sponsorId` retorna 201 (no 400) porque `routes.ts:2895` tiene fallback defensivo al primary sponsor. El dashboard form sí fuerza el picker — el backend queda como safety net. No es un bug.

### Docs / PR incident (post-Step 4)

- Al abrir PR #10 sobre `docs/multi-sponsor-architecture`, esa branch fue force-pushed por otra sesión (commits ajenos `96715af` + `8f2bde4` del 2026-04-05). Decision: no force-push encima. Se cerró PR #10, se abrió PR #11 sobre branch nueva `docs/placements-v2-refresh` off develop con los 2 commits del refresh. Ver commentario de cierre en PR #10.

### Neon branch refresh (pre-Step 5)

- Se forkeó `local/angelo-20260423-1814` desde develop (18:14) para tener DB local limpia con data real de develop. `DATABASE_URL` + `PGHOST` alineados al nuevo endpoint. La branch previa (`feature/placements-v2-20260423-1250`) se mantiene idle como safety net.

## Archivos de referencia

- **`CURRENT_STATE.md §17`** — single source of truth para la arquitectura del placement runtime (post-landing). Diagrama completo + lista de archivos tocados + design decisions.
- `docs/multi-sponsor-architecture.md` §4.6 + §6.3 — multi-sponsor commerce key resolution.
- `docs/DB_AND_ENDPOINTS.md` — developer reference para tablas + endpoints involucrados.
- Plan original: `~/.claude/plans/purrfect-exploring-iverson.md` (kept for historical reference).

## Comandos frecuentes

```bash
# Activar la DB local actual
grep -E "^(DATABASE_URL|PGHOST)=" .env

# Ver estado de placements de TV2
node -e 'const { Client } = require("pg"); const url = require("fs").readFileSync(".env","utf8").split("\n").find(l=>l.startsWith("DATABASE_URL=")).slice(13); (async()=>{const c=new Client({connectionString:url});await c.connect();console.log((await c.query("SELECT id,component_id,sponsor_id,location_id,status FROM campaign_components WHERE campaign_id=36")).rows);await c.end();})()'

# Cambiar entre Neon branches (si hace falta)
# - Backup primero: cp .env /tmp/env-before-<motivo>.bak
# - Editar DATABASE_URL + PGHOST con el host nuevo

# Branch endpoints Neon (reference)
# develop:            ep-summer-star-a89av46e-pooler...
# placements-v2-1250: ep-rapid-hat-a8eylw84-pooler...
# local-1814 (now):   ep-odd-tree-a8c6hlj0-pooler...
```
