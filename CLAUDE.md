# Vio — Real-time Sports Engagement Platform

## Comunicación
- Responder en español
- No incluir atribución de Claude/AI en commits, PRs, ni código
- Branches descriptivos (no usar "claude/" como prefijo)

## Stack
- **Backend**: Express.js + TypeScript + PostgreSQL (Neon Serverless) + Drizzle ORM + WebSockets (ws)
- **Frontend**: React 18 + Vite + Tailwind CSS + shadcn/ui + TanStack Query v5 + Wouter
- **Schema compartido**: `shared/schema.ts` (Drizzle ORM)
- **Dev server**: `npm run dev` → Express en puerto 5001 + Vite frontend integrado

## Nomenclatura (CRÍTICO)
- **Vio**: Plataforma de engagement (producto principal)
- **Commerce**: Módulo e-commerce (antes "Reachu") — opcional por campaign
- **Tipio**: Livestream service (producto separado, NO relevante para trabajo actual)
- En DB: `reachuApiKey` / `reachuChannelId` son campos internos → se exponen como `integrations.commerce`

## Arquitectura
```
Users → Client Apps (api_key) → Campaigns → Broadcasts → Polls/Contests/Products
                                    ↓
                              Components (Location Slots)
                              Sponsors (branding source)
```

## Autenticación
- Dashboard `/api/*`: Session-based (cookies)
- Admin `/v1/*`: JWT Bearer token (`requireBearerAuth`)
- SDK `/v1/sdk/*` y `/v1/engagement/*`: API Key (`validateApiKey`)

## Reglas de desarrollo

### Backend
- Endpoints SDK deben tener `validateApiKey`
- Body de POST/PUT validado con Zod
- WebSocket events: `{ type: "event_name", data: {...}, broadcastId }` (underscore, no colon)
- Operaciones multi-tabla: usar `db.transaction()` de Drizzle
- Rate limiting activo: 30/min votes, 10/min contests — no desactivar
- `broadcastToCampaign()` para emitir eventos WS

### Frontend
- TanStack Query para data fetching (no fetch directo)
- Mutations invalidan queries relacionadas con `invalidateQueries()`
- Componentes de shadcn/ui + Radix UI
- No hardcodear keys, URLs ni colores — usar config/variables

### General
- `main` branch siempre deployable
- No romper legacy (campaigns existentes deben seguir funcionando)
- No hardcodear API keys, tokens o secrets
- Commits: `feat:`, `fix:`, `docs:`, `chore:`, `refactor:`

## Documentación vigente
- `VIO_TRUTH.md` — Fuente de verdad (endpoints, WS events, auth, demo data)
- `VIO_BEST_PRACTICES.md` — Reglas de desarrollo backend + SDK
- `VIO_ESTADO_ACTUAL.md` — Estado actual del sistema
- `CAMPAIGN_LIFECYCLE.md` — Estados de campaigns y WS events
- `DASHBOARD_FLOWS.md` — Navegación y flujos del dashboard
- `DEPLOYMENT.md` — Opciones de deploy (actualmente autoscale)
- `design_guidelines.md` — Sistema de diseño visual
- `replit.md` — Overview de la plataforma

## Demo data
- Campaign 35 (Viaplay): `viaplay_api_key_0c611e983b314ff8`
- Campaign 28 (XXL): `xxl_api_key_507d4014243d8360`
- contentId: `real-madrid-barcelona-2025-01-24`
