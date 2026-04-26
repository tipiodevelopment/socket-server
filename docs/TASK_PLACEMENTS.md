# Task — Product Placement System (backend + iOS SDK + dashboard)

> Tracking doc para la implementación del Product Placement System. Plan
> aprobado en `~/.claude/plans/purrfect-exploring-iverson.md`. Paso por paso,
> commit + smoke test por cada paso. No avanzar al siguiente hasta verde.
>
> **Scope**: backend + **iOS SDK** (VioSwiftSDK) + dashboard. Apple TV SDK
> (`InteractiveAds-vio`) está fuera — no se re-abre aquí.

## Pausado — prioridad cambió a API v2 consolidation (2026-04-24)

El trabajo de placements quedó pausado en Step 4 para ejecutar primero el
**direct cut de API v2** (3 repos). El v2 ya está dispachado y probado con
3 shoppable ads multi-sponsor. Cuando cierre el smoke test y mergeen los
3 PRs v2, retomamos este plan desde Step 5 (dashboard). Ver `CURRENT_STATE.md`.

**Lo que quedó landeado del plan de placements** (Steps 1-4) se mantiene en
`feature/placements-v2` del socket-server. Cuando avancemos a Step 5 se
rebasa sobre develop (ya con v2 + PRs docs merged).

## Status (snapshot 2026-04-23 18:30)

- [x] **Step 1 — Preparación** — this doc + wipe TV2 existing components (on the previous Neon feature branch). Commit `3f41583`.
- [x] **Step 2 — A.1/A.2** backend WS event `sponsorId` at root (scheduler + manual toggle). Commit `b5d74df`. Smoke test: WS payload carries `sponsorId: 3`.
- [x] **Step 3 — A.4** openapi `ComponentStatusChangedEvent` schema + Postman reorganised into 6 folders by audience + legacy v1 dropped. Commits `1d0ae3c` + `4663e56`.
- [x] **Step 4 — C.1** dashboard sponsor picker obligatorio in `ComponentsTab` Add dialog. `Select` constrained to `GET /api/campaigns/:id/sponsors`, submit disabled without it, `sponsorId` viaja en POST body. Backend auto-fallback a primary (routes.ts:2895) se mantiene como defensa. Commit `ca7ae21`.
- [x] **Docs refresh** — DB_AND_ENDPOINTS.md (developer reference para onboarding) + multi-sponsor-architecture.md (v1→v2 + `component_status_changed` con sponsorId) + ROLLOUT_ROADMAP §2.6 (este sub-track) + README topic index. Commits `4987b06` + `648ca4a` en branch `docs/placements-v2-refresh` → **PR #11** (https://github.com/tipiodevelopment/socket-server/pull/11). PR #10 cerrada (apuntaba a commits ajenos tras force-push cross-session en `docs/multi-sponsor-architecture`).
- [x] **Step 5' — Backend manifest endpoint** — *2026-04-27, branch `feature/placements-manifest-registry`*. New table `app_component_locations`, endpoint `POST /v2/mobile/components/manifest` (validateApiKey, idempotent upsert by `(clientAppId, type)` and `(clientAppId, locationId)`, unknown types → warning + skip), dashboard read endpoints `GET /api/client-apps/:id/component-locations` + `GET /api/client-apps/:id/components?withLocations=true`. 17 jest integration tests passing. PR [#29](https://github.com/tipiodevelopment/socket-server/pull/29).
- [x] **Step 5b — iOS SDK registry** — *2026-04-27, branch `feature/placements-registry` on VioSwiftSDK*. `VioPlacementComponent` protocol, `VioPlacementRegistry`, `VioPlacementLocation`, `VioProductBindingMode` enum. Convenience entries on `VioRuntime`: `registerPlacementComponent(_:)` + `registerPlacementLocation(_:)`. Manifest auto-upload from `VioSession.start()` after `discoverCampaigns()` via `VioPlacementManifestUploader` (best-effort, errors logged + swallowed). 16 XCTest cases. PR [vio-live/VioSwiftSDK#8](https://github.com/vio-live/VioSwiftSDK/pull/8).
- [x] **Step 5 — C.2 dashboard scope** — *2026-04-27, branch `feature/placements-dashboard-pickers-on-29`*. Location picker fed by `/api/client-apps/:id/component-locations` (replaces hardcoded sport-* dropdown). Component picker scoped to `/api/client-apps/:id/components`. Empty state when SDK hasn't uploaded yet. PR [#30](https://github.com/tipiodevelopment/socket-server/pull/30) — based on top of PR #29.
- [ ] **Step 6 — C.3** dashboard product picker para types `product_*` (embed `SponsorCatalogPicker` cuando el component seleccionado es `product_*`; escribe `customConfig.productIds`).
- [ ] **Step 7 — C.4** dashboard scheduling fields — `scheduledTime` + `endTime` en el Add dialog.
- [ ] **Step 8 — B.1** iOS `Component` + `ComponentStatusChangedEvent` decode `sponsorId` (`Sources/VioCore/Models/OfferBannerModels.swift`).
- [ ] **Step 9 — B.2** las 5 views pasan `component.sponsorId` a `ProductService`:
  - `VProductCarousel.swift:1303`
  - `VProductSpotlight.swift:659`
  - `VProductStore.swift:450`
  - `VProductBanner.swift:722`
  - `VProductSlider/VProductSliderViewModel.swift:68,75`
- [ ] **Step 10 — B.3/B.4** `Product.sponsorId` optional + estampado por `ProductService.loadProduct(sponsorId:)` al hidratar.
- [ ] **Step 11 — B.5** `CartManager.addProduct` lee `product.sponsorId` → checkout con la key del sponsor correcto (Apple Pay gate + per-sponsor commerce client).
- [ ] **Step 12 — E2E** reconstruir TV2 con 2 placements (Elkjøp + XXL), validar logs + render + checkout dual.

## Branches de trabajo (safety net)

| Repo / env | Branch | Base / estado |
|---|---|---|
| `socket-server` | `feature/placements-v2` | `develop` @ `be8df59`. Steps 1-4 committed + pushed (tip `268a446`). |
| `socket-server` | `docs/placements-v2-refresh` | `develop` @ `be8df59`. Tip `648ca4a`. PR #11 open. Separate from feature branch — docs only. |
| `VioSwiftSDK` | `feature/placements-v2` | safety branch creada. Steps 8-11 aún sin tocar. Working branch activa: `feature/tv-cart-intent-attribution`. |
| **Neon (activa)** | `local/angelo-20260423-1814` (`br-summer-morning-a8y0i36l`) | forkeada de `develop` (`br-royal-mode-a8e8mdq1`) el 2026-04-23 18:14. Phase 3 aplicada. TV2 campaign 36 tiene 6 `campaign_components` y 1 `app_component` (no wipeada todavía en esta branch). |
| **Neon (idle, safety)** | `feature/placements-v2-20260423-1250` (`br-damp-snow-a8rv0cnc`) | forkeada de develop el 2026-04-23 12:50. TV2 wipeada (0 placements). Se mantiene por si se necesita rollback del estado con scheduling de pruebas. |
| **Neon (idle, test)** | `test/tv-subscribe-validation` (`br-patient-meadow-a8dat89p`) | histórica. No tocar. |

### `.env` backups

- `/tmp/vio-env-develop-before-placements.bak` — antes del primer fork (Step 1, 12:50).
- `/tmp/vio-env-placements-v2-before-local-fork.bak` — antes del fork actual a `local/angelo-*` (18:14).

### git state (2026-04-23 18:30)

- `socket-server` HEAD = `feature/placements-v2` @ `268a446` (sincronizado con origin). Working tree clean.
- `VioSwiftSDK` HEAD = `feature/tv-cart-intent-attribution`. Working tree clean — no placement changes locally.
- `InteractiveAds-vio` (out of scope) HEAD = `feat/sdk-consolidation`. Demo video `Demo/tv2demo-appletv/demo-video.f137.mp4` **recuperado y staged** post-merge loss.

Criterio de merge a develop: pasos 1-12 verdes + E2E demo TV2 funcional.

## Decisiones locked (desde el plan)

- Commerce NO viaja en payload — SDK resuelve con `sponsorId` vía `VioConfiguration.commerce(forSponsorId:)`.
- `broadcast_id` en `campaign_components` solo para override — null en caso base.
- Component catalog picker en dashboard limitado a **app_components** del app de la campaña (strict).
- Registro de `app_components` es **admin-only** por ahora (no inline desde operador).
- Smoke test con campaña TV2 (id 36) — cuando empiece el E2E (Step 12), wipear placements actuales en la Neon branch local y reconstruir con el nuevo flow.
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

- Plan completo: `~/.claude/plans/purrfect-exploring-iverson.md`
- Roadmap general: `docs/ROLLOUT_ROADMAP.md` §2.6 (ficha pública de este sub-track, en `docs/placements-v2-refresh`)
- Arquitectura: `docs/multi-sponsor-architecture.md` §4.6 + §6.3 (tip actual en `docs/placements-v2-refresh`)
- Developer reference: `docs/DB_AND_ENDPOINTS.md` (disponible vía `docs/placements-v2-refresh` PR #11)

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
