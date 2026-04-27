# Task — Product Placement System (backend + iOS SDK + dashboard)

> Tracking doc para la implementación del Product Placement System. Plan
> original en `~/.claude/plans/purrfect-exploring-iverson.md`.
>
> **Scope**: backend + **iOS SDK** (VioSwiftSDK) + dashboard. Apple TV SDK
> (`InteractiveAds-vio`) está fuera — no se re-abre aquí.

## Pending for 2026-04-29 morning (resume here)

End-of-day 2026-04-28: full E2E smoke working. Two feature branches in
flight, awaiting review/merge:

- socket-server `feature/placements-app-placements-table` @ `74b39c7` (3 commits: schema, dashboard, today's polish)
- VioSwiftSDK `feature/placements-named-instances` @ `95eafdb` (3 commits)

Outstanding work:

1. **Postman regen** — see checklist below for folder-specific changes needed.
2. **Edit existing campaign_components in dashboard** — Customize / pencil dialog already works for the new fields (title + showSponsorLogo) but lightly tested. Walk through and polish if anything looks off.
3. **Banner / Spotlight `locationId:` plumbing** — only `VProductCarousel` accepts `locationId:` today. Spotlight/Banner/Store views need the same `getActiveComponent(type:locationId:)` lookup so the new model covers all template types. **Follow the carousel as the reference pattern.**
4. **Scheduling fields** — `scheduled_time` + `end_time` exist in DB but the dashboard placement form doesn't expose them. Add 2 datetime inputs in the campaign placement form for time-based rotations.
5. **Multi-sponsor rotation UX** — the dashboard should make "create another row with a different sponsor" obvious (today operator has to figure out the +Add flow). Maybe a "Rotate sponsor" button on existing placement cards.
6. **Schema consistency vs Apple TV SDK** — sponsor block on backend now ships both `logoUrl` + `avatarUrl` (additive — Apple TV unaffected). Verify Apple TV SDK still builds + flows still work. No code changes expected on that side.

Open question for tomorrow:
- The Apple TV SDK lives in `InteractiveAds-vio` and calls the same backend. Did any of today's backend changes break its consumption path? Smoke test it before merging the backend feature branch.

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
