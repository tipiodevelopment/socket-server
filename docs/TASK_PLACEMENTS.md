# Task — Product Placement System (backend + iOS SDK + dashboard)

> Tracking doc para la implementación del Product Placement System. Plan
> original en `~/.claude/plans/purrfect-exploring-iverson.md`.
>
> **Scope**: backend + **iOS SDK** (VioSwiftSDK) + dashboard. Apple TV SDK
> (`InteractiveAds-vio`) está fuera — no se re-abre aquí.

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

- [ ] **DB migration `0004_named_placements_consolidation.sql`**:
  - DROP TABLE `app_components`
  - ALTER `app_component_locations` ADD `deprecated_at TIMESTAMP NULL`
  - ALTER `app_placements` ADD `deprecated_at TIMESTAMP NULL`, `created_by INTEGER → users(id)`
  - ALTER `campaign_components` ADD `app_placement_id INTEGER → app_placements(id)`, `created_by INTEGER → users(id)`
  - Backfill `campaign_components.app_placement_id` from existing `(component_id, location_id, campaign→client_app_id)` lookup
  - DROP `campaign_components.component_id`, `location_id` (after backfill verified)
  - CREATE PARTIAL UNIQUE INDEX `idx_campaign_components_one_active` on `(campaign_id, app_placement_id) WHERE status = 'active'`
- [ ] **`shared/schema.ts`** — drop `appComponents`, update `appPlacements`, `appComponentLocations`, `campaignComponents` schemas + relations
- [ ] **`server/storage.ts`** — drop `getAppComponents` / `addComponentToApp` / `removeComponentFromApp`. Add `createAppPlacement`, `deprecateAppPlacement`, `getCanonicalLibraryTemplates`. Update `addComponentToCampaign` to take `appPlacementId`.
- [ ] **`server/routes.ts`**:
  - Manifest endpoint: accept only `locations[]`, reject `placements[]`/`components[]`. Sync-semantic deprecation.
  - DROP `/api/client-apps/:id/components` POST/DELETE (legacy).
  - NEW `POST /api/client-apps/:id/placements` (operator creates app_placement).
  - NEW `DELETE /api/client-apps/:id/placements/:id` (soft-delete).
  - UPDATE `POST /api/campaigns/:id/components` to take `appPlacementId` instead of `componentId+locationId`. Validate placement is from same clientApp as campaign + slot is not already active.
  - UPDATE `GET /v2/mobile/campaigns/:id/components` to JOIN through `app_placements`. Filter out rows where placement is deprecated (or include but flag).
  - WebSocket: emit `app_placement_deprecated` on soft-delete. Add `locationId` to `component_status_changed` payload.
- [ ] **iOS SDK**:
  - Remove `Vio.registerPlacement(name:type:locationId:)` (Phase C addition)
  - Restore `Vio.registerPlacementLocation(...)` as primary (un-deprecate)
  - Remove `VioPlacementComponent` protocol + `VioPlacementRegistration` struct
  - Manifest payload: only `locations[]` array
  - Update TV2 demo (`TV2PlacementRegistration.swift`) to register only locations
- [ ] **Dashboard**:
  - `/apps/:id` Placements section: "Add from library" button → dialog with template picker + name + locationId dropdown (declared locations)
  - `/apps/:id`: badge for `deprecated_at IS NOT NULL` rows
  - `/campaigns/:id` Components tab: simplified Add dialog (placement + sponsor + products)
  - Validation: cross-clientApp placement assignment rejected
- [ ] **Postman**: regenerate `vio-sdk.postman_collection.json` with new manifest body shape, new placement endpoints, removed legacy paths
- [ ] **Docs accumulate** (in-place, no new files):
  - `CURRENT_STATE.md §17` — diagram updated with the dashboard-driven flow
  - `DB_AND_ENDPOINTS.md` — schema for `app_placements` updated, new endpoints, dropped legacy paths
  - `ARCHITECTURE_OVERVIEW.md` — Hito 6 details consolidated

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
