# Task — Product Placement System (backend + iOS SDK + dashboard)

> Tracking doc para la implementación del Product Placement System. Plan
> original en `~/.claude/plans/purrfect-exploring-iverson.md`.
>
> **Scope**: backend + **iOS SDK** (VioSwiftSDK) + dashboard. Apple TV SDK
> (`InteractiveAds-vio`) está fuera — no se re-abre aquí.

## Pending for next session (resume here)

End-of-session 2026-04-28: planning complete for the **Live updates via
WebSocket** sub-sprint. Implementation about to start. State on disk:

- socket-server `feature/placements-app-placements-table` @ `2a83a15` (3 commits + 2 docs commits) — clean
- VioSwiftSDK `feature/placements-named-instances` @ `95eafdb` (5 commits) — clean
- DB: `local/angelo-20260423-1814` (Neon, unchanged from yesterday)

The current sprint is **§ Sprint 2026-04-28 PM — Live updates via
WebSocket** (full plan below). All 6 phases land on the existing branches
above; one commit per phase; same DB. Once landed, the carry-over items
below resume.

### Carried over (after live-updates sprint)

1. **Postman regen** — see checklist below for folder-specific changes needed.
2. **Edit existing campaign_components in dashboard** — Customize/pencil dialog walk-through & polish.
3. **Banner / Spotlight `locationId:` plumbing** — extend the `VProductCarousel(locationId:)` pattern to `VProductBanner`, `VProductSpotlight`, `VProductStore`, `VProductSlider`.
4. **Scheduling fields** — `scheduled_time` + `end_time` already exist in DB; expose 2 datetime inputs in the campaign placement form for time-based rotations.
5. **Schema consistency vs Apple TV SDK** — verify `sponsor.avatarUrl` additive change doesn't break the Apple TV consumption path in `InteractiveAds-vio`.

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
- ❌ Banner / Spotlight / Store / Slider `locationId:` plumbing — carry-over item, separate sprint.

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
