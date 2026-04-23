# Task — Product Placement System (backend + SDK + dashboard)

> Tracking doc para la implementación del Product Placement System. Plan
> aprobado en `~/.claude/plans/purrfect-exploring-iverson.md`. Paso por paso,
> commit + smoke test por cada paso. No avanzar al siguiente hasta verde.

## Status

- [x] **Step 1 — Preparación** — this doc + wipe TV2 existing components
- [x] **Step 2 — A.1/A.2** backend WS event `sponsorId` at root — commit `b5d74df`. Smoke test pass (WS payload carries `sponsorId: 3`)
- [x] **Step 3 — A.4** openapi + Postman — new `ComponentStatusChangedEvent` schema documenting the WS event shape; Postman reorganised by audience (6 folders: Setup, Mobile SDK, TV SDK, Commerce, Dashboard, Admin) + legacy v1 dropped. Commits `1d0ae3c` + `4663e56`
- [x] **Step 4 — C.1** dashboard sponsor picker obligatorio — Add dialog exige sponsor (Select constrained to `GET /api/campaigns/:id/sponsors`), submit disabled without it, `sponsorId` travels in POST body. Backend auto-fallback to primary sponsor (routes.ts:2895) remains as defensive default. Commit to come
- [ ] **Step 5 — C.2** dashboard component catalog scope a `app_components`
- [ ] **Step 6 — C.3** dashboard product picker para types `product_*`
- [ ] **Step 7 — C.4** dashboard scheduling fields
- [ ] **Step 8 — B.1** iOS `Component` + `ComponentStatusChangedEvent` + `sponsorId`
- [ ] **Step 9 — B.2** las 5 views pasan `component.sponsorId` a `ProductService`
- [ ] **Step 10 — B.3/B.4** `Product.sponsorId` optional + estampado por `ProductService` al hidratar
- [ ] **Step 11 — B.5** `CartManager` lee `product.sponsorId` → checkout con la key del sponsor correcto
- [ ] **Step 12 — E2E** reconstruir TV2 con 2 placements (Elkjøp + XXL), validar logs + render + checkout

## Branches de trabajo (safety net)

| Repo / env | Branch | Base |
|---|---|---|
| `socket-server` | `feature/placements-v2` | `develop` @ `be8df59` |
| `VioSwiftSDK` | `feature/placements-v2` | `develop` @ `080a287` |
| **Neon** | `feature/placements-v2-20260423-1250` (`br-damp-snow-a8rv0cnc`) | `develop` (`br-royal-mode-a8e8mdq1`) |

Backend local apunta a la Neon branch (archivo `.env` → `DATABASE_URL`). El
archivo `.env` anterior está respaldado en `/tmp/vio-env-develop-before-placements.bak`.

Criterio de merge a develop: pasos 1-12 verdes + E2E demo TV2 funcional.

## Decisiones locked (desde el plan)

- Commerce NO viaja en payload — SDK resuelve con `sponsorId` vía `VioConfiguration.commerce(forSponsorId:)`
- `broadcast_id` en `campaign_components` solo para override — null en caso base
- Component catalog picker en dashboard limitado a **app_components** del app de la campaña (strict)
- Registro de `app_components` es **admin-only** por ahora (no inline desde operador)
- Smoke test con campaña TV2 (id 36) — se wipea y se reconstruye para validar end-to-end

## Issues / decisiones encontradas por paso

_(se rellena a medida que avanza)_

### Step 1 — Preparación

- TV2 campaign 36 tenía N placements registrados previamente. Se eliminan vía SQL directo (cascade en `campaign_components`) antes de reconstruir por el nuevo flow.

## Archivos de referencia

- Plan completo: `~/.claude/plans/purrfect-exploring-iverson.md`
- Roadmap general: `docs/ROLLOUT_ROADMAP.md` (esta task completa Phase 2.1)
- Arquitectura: `docs/multi-sponsor-architecture.md` §4.6 + §6.3
