# Vio - Real-Time Event Broadcasting Platform

## Overview

Vio is a real-time event broadcasting platform for multi-campaign management, enabling administrators to create campaigns with custom sponsor branding and manage real-time broadcasts. It supports interactive elements like polls, contests, ads, and shoppable products. The platform aims to provide a scalable solution for interactive audience engagement, supporting multi-tenant SaaS for agencies and brands to manage client applications, channels, and campaigns with data isolation.

## User Preferences

Preferred communication style: Simple, everyday language (Spanish).
Publishing rule: Every time the app is published, update the `.cursorrules` file with the latest project details, architecture changes, new endpoints, and any relevant implementation notes.

## System Architecture

### Design System

Vio uses a monochromatic dark theme with `#0a0e1a` as the primary background and `#141824` for cards. Text is white, with `text-gray-400` for secondary and `text-gray-500` for muted text. Accent colors use white backgrounds with dark text, avoiding blue/purple gradients. Icons are from Lucide React, and the font is Inter. Status badges are styled for "Live," "Upcoming," and "Ended" states, and broadcast elements (Polls, Contests, Ads) are color-coded in blue, purple, and green, respectively.

### Technical Implementation

The platform is built with a full-stack TypeScript environment.

**Frontend:**
- **Framework:** React 18 with Vite
- **Styling:** Tailwind CSS, Radix UI, and shadcn/ui
- **State Management:** TanStack Query v5
- **Routing:** Wouter
- **Real-time:** Custom `useWebSocket` hook
- **Forms:** React Hook Form with Zod validation
- **Icons:** Lucide React
- **File Upload:** Uppy with AWS S3 multipart support

**Backend:**
- **Runtime:** Node.js + Express.js
- **Database:** PostgreSQL (Neon Serverless) with Drizzle ORM
- **WebSockets:** `ws` library, providing isolated channels per campaign.
- **Authentication:** JWT Bearer tokens for admin APIs and API key validation for SDK endpoints.
- **Object Storage:** Replit Object Storage for file uploads.
- **Scheduler:** In-memory interval-based service for component activation/deactivation.

### Feature Specifications

- **Dashboard (`/`):** "New Campaign" button navigates to /campaigns/new. App cards without logo show deterministic initials placeholder (color based on app name hash). Stats deltas (↑/↓ %) calculados via `GET /api/analytics/deltas` comparando últimos 7 días vs los 7 anteriores. Sección "Upcoming Campaigns" filtra por `startDate` dentro de los próximos 7 días con empty state si no hay ninguna.

- **Apps List (`/apps`):** Viewer count real sumado de `viewerCount` de todos los broadcasts de campañas de esa app. Un solo botón "Manage" por app (sin duplicados Edit/Settings).

- **App Detail (`/apps/:id`):** Viewer count total real desde broadcasts. Broadcast count por campaña real. "Live Broadcasts" cuenta solo `status='live'`. Icono `Calendar` junto a fechas (no `Users`). Status badges: Active=teal, Paused=amber, Archived/Ended=gray. Stat cards con `border border-gray-200 dark:border-white/10 rounded-lg`.

- **Campaigns List (`/campaigns`):** Nombres de país completos via `Intl.DisplayNames` (ej: "NO" → "Norway"). Nombre + avatar del sponsor visible en tarjetas. Columna "Engagement" muestra suma de votos de polls + participaciones en contests. Badge colors: Active=teal, Paused=amber, Upcoming=gray, Ended=dark gray.

- **Campaign Dashboard:** Tabs: Overview, Broadcasts, Components, Sponsors, Live, Analytics, Settings. Analytics tab se pre-fetcha al cargar la página (`enabled: true`, no lazy). "Save API Key" de Commerce funciona igual que otros campos del formulario. Poll results muestran porcentaje + votos absolutos: "45% (234 votos)". Sponsors tab: `SponsorsTabContent` muestra sponsors vinculados con role badges, botón Add/Remove sponsor via `GET/POST/DELETE /api/campaigns/:id/sponsors`.

- **Broadcasts List (`/broadcasts`):** Viewer count desde `broadcast.viewerCount` directamente. Upcoming broadcasts muestran "Starts Mar 10 · 19:00". Icono `Users` para viewers, `BarChart3` para polls. Una sola barra de búsqueda contextual (header search oculto via `hideSearch` prop en AppLayout). Sin botón "Filter" dummy. Create Broadcast modal completamente en inglés (traducido de español en Mar-09-2026).

- **Broadcast Detail (`/broadcasts/:id`):** Poll options muestran "45% (234 votes)". Header stats: Viewers, Total Votes, **Engagement Rate** (`totalVotes/viewers*100`%), Status. Botón "Load Demo" eliminado. Shoppable Ads section redesigned with 3 panels: Pre-programmed Slots (Add Slot dialog: sponsor/products/trigger type/auto-execute; Fire/Delete per slot via `GET/POST/DELETE /api/broadcasts/:id/sponsor-slots`, execute via `POST /api/broadcasts/:id/sponsor-slots/:slotId/execute`), Quick Fire ad-hoc (sponsor + product from campaign Commerce), Session Log. **EventTimeline** es horizontal scrubber 0'–90' con dot markers coloreados: blue=poll, purple=contest, green=shoppable_ad, yellow=goal, grey=kickoff/fulltime. Minute labels (0',15',30',45',60',75',90'), hover tooltips con label+votes. **Fusiona eventos reales de Sportmonks** (goles, tarjetas, kickoff, FT via `GET /api/sportmonks/fixture/:id/result`) con eventos de engagement de `broadcast.metadata.matchEvents` — Sportmonks es autoritativo para eventos de partido; metadata es autoritativo para poll/contest/shoppable_ad. **MatchDataCard** (`client/src/components/match-data-card.tsx`) aparece después del EventTimeline: muestra marcador (logos + score), fecha, liga y timeline de eventos clave. Se oculta si no hay `sportmonksFixtureId`. Live chat deshabilitado (read-only) cuando `status='ended'` con banner informativo. Sin array `topValues` hardcodeado.

- **Sponsors (`/sponsors`):** Default colors al crear: `primaryColor: '#3d8b7a'`, `secondaryColor: '#141824'`. Labels "Primary" / "Secondary" visibles junto a los color pickers. SDK badge preview en tarjeta del sponsor (rect redondeado con primaryColor, logo/iniciales y nombre). `GET /sponsors/:id` muestra perfil completo, stats y campañas vinculadas.

- **Components (`/components`):** Config preview por tipo: banner→thumbnail de imagen, countdown→fecha target, carousel→cantidad de productos. Badge "Test" si el nombre contiene "test". Altura dinámica con `min-h` (no `h-48` fijo). isTemplate almacenado y comparado como boolean (no string). Filtros incluyen: `offer_banner`, `product_store`, `product_banner`. Botón "New Component" usa `<Button>` de shadcn/ui.

- **Analytics (`/analytics`):** `useChartTheme()` usa `useState` + `useEffect` con `MutationObserver` para detectar cambios de tema sin recargar. Empty state cuando no hay datos en el período: "No hay actividad de broadcasts en los últimos X días". Barras del chart con mayor contraste en dark mode (`#3d8b7a`). KPI cards con subtexto explicativo (ej: "X templates", "X activos"). Back button en drill-down muestra nombre del destino (ej: "← TV2 Demo App"). Selector de período: Today / 7d / 30d.

- **AppLayout:** Acepta prop `hideSearch` para ocultar el search bar global del header en páginas con su propio search contextual (ej: /broadcasts).

- **Commerce Integration:** Módulo de ecommerce llamado "Commerce" en todas las interfaces públicas. API key de Commerce almacenada a nivel de **Sponsor** (`sponsors.commerceApiKey` + `sponsors.commerceChannelId`), entregada via `integrations.commerce.apiKey` en la respuesta de config. Soporta componentes `product_carousel` y `product_banner`.

- **API Key Architecture:** SDK usa una sola Vio App API Key (`client_apps.api_key`). Commerce key es por Sponsor (no por campaña).

- **Location Slot System:** `locationId` en `campaign_components` (ej: `sport-detail-banner`). SDK consulta `GET /v1/sdk/components?locationId=` para resolver el componente activo por slot.

- **Create Broadcast (global):** Dialog en `/broadcasts` incluye sección "Link to a Match" con selector de liga + fixture de Sportmonks. Popula `sportmonksFixtureId`, nombres/logos de equipos y `matchStartingAt`. **Fixture y externalId son campos requeridos** — botón submit deshabilitado hasta que ambos estén completados.

- **Broadcast Edit Dialog:** Edita nombre, externalId, status, startTime, endTime. Cambios de status disparan eventos WebSocket.

- **Admin Panel:** Forms de polls, productos y contests arrancan vacíos y cargan datos de DB.

- **Geographic Targeting & User Segmentation:** Segmentación server-side por ubicación con hashing determinístico.

### Demo Data (NO MODIFICAR)

- **TV2 app** (campaign 36): 3 broadcasts, ~34K viewers peak. Live: `tv2-eliteserien-live-2026-03-08` (Brann vs Molde, ~18.7K viewers).
  - `barcelona-psg-2026-03-03` (ended, 34200 viewers, peak 41K): 3 polls (36.3K total votes), 1 contest. 11 matchEvents in metadata.
- **Viaplay app** (campaigns 35/33/31): 6+ broadcasts, ~72K viewers peak.
  - `viaplay-atletico-psg-2026-03-08` (live, 19.6K viewers, peak 24K): 3 polls (47.6K total votes), 1 contest. 9 matchEvents.
  - `real-madrid-vs-barcelona-2026-02-25` (ended, 29K viewers, peak 35K): 6 polls (68.1K total votes), 2 contests. 11 matchEvents.
- Viaplay apiKey: `viaplay_api_key_0c611e983b314ff8` → campaign 35. Commerce key: `KCXF10Y-W5T4PCR-GG5119A-Z64SQ9S`.
- `matchEvents` in broadcast.metadata JSONB: array of `{minute, type, label, team?}`. Types: kickoff, goal, poll, contest, shoppable_ad, fulltime.
- Broadcasts con `created_at` distribuidos en los últimos 30 días para chart de analytics.

### Database Tables

Key tables and their extensions:
- `broadcast_ads`: Ads linked to broadcasts (name, description, imageUrl, ctaUrl, adType, duration, isActive, displayOrder).
- `broadcast_products`: Shoppable products per broadcast (name, subtitle, price/originalPrice as varchar, buyUrl, status, displayOrder).
- `chat_messages`: Live chat messages per broadcast (username, message, createdAt, type, metadata).
- `broadcasts`: Extended with `viewerCount`, `peakViewers`, `externalId` (indexed on `(externalId, campaignId)`), `metadata` (JSONB — stores `matchEvents` array), and Sportmonks match fields: `sportmonksFixtureId`, `homeTeamName`, `homeTeamLogo`, `awayTeamName`, `awayTeamLogo`, `matchStartingAt`, `leagueName`.
- `sponsors`: Extended with `commerceApiKey` (varchar, nullable) and `commerceChannelId` (varchar, nullable) — Commerce module credentials per sponsor.
- `campaign_components`: Extended with `locationId` for SDK slot identification.
- `sportmonks_cache`: Caches Sportmonks API responses (leagues + fixtures) for 2 days. Fields: `cacheType`, `leagueId`, `dateFrom`, `dateTo`, `data` (JSONB), `updatedAt`.
- `polls` / `poll_options` / `poll_votes`: Poll data with `vote_count` per option and `total_votes` on polls.
- `contests` / `contest_participations`: Contest engagement data.

### API Architecture

- **Dashboard APIs (`/api/*`):** Session-based for internal operations (CRUD, configuration, uploads).
  - `GET /api/analytics/deltas` — Calcula % de cambio de viewers y engagement en últimos 7 días vs anteriores 7.
  - `POST /api/broadcasts/:broadcastId/trigger-shoppable-ad` — Dispara un shoppable ad (sin Bearer auth).
- **Admin APIs (`/v1/*`):** JWT Bearer token secured for full CRUD of broadcasts, polls, and contests.
- **SDK APIs (`/v1/sdk/*` and `/v1/engagement/*`):** API key authenticated for campaign discovery, configuration, engagement actions, offers, and localization.
- **Analytics routes:** Definidas en `server/analytics.ts` (no en `routes.ts`).

### SDK Engagement Flow

Two-step SDK initialization:
1. `GET /v1/sdk/campaigns`: Returns all active campaigns and campaign-level components.
2. `GET /v1/sdk/broadcast?contentId=xxx&country=NO`: Resolves `contentId` to `externalId` and returns `hasEngagement` status. If true, includes `broadcastId`, `broadcastName`, `status`, `campaignId`, `websocketChannel`, `campaignComponents`, `broadcastComponents.polls`, `broadcastComponents.contests`, and `broadcastComponents.chat.enabled`.

WebSocket events include `campaign_ended`, `campaign_started`, `broadcast_started`, `broadcast_ended`, `chat_message`, `tweet`, and `score_update`.

New SDK endpoints include chat history, tweeting, live score updates, match stats, live scores, and filtered campaign components.

### Deployment

The platform runs on **`autoscale`** deployment (changed from `vm` in Feb 2026 after `vm` health checks failed persistently despite the server starting correctly). Build: `npm run build`. Run: `node dist/index.js`. At current traffic levels, autoscale runs as a single instance, so WebSockets and the in-memory scheduler work correctly. Scaling to multiple instances requires Redis Pub/Sub for WebSocket broadcasting and BullMQ for the scheduler (code foundation already present in `server/queue/`).

## External Dependencies

- **UI & Styling:** Radix UI, Tailwind CSS, class-variance-authority, clsx, Lucide React.
- **Data & State Management:** TanStack Query v5, React Hook Form, Zod, Drizzle ORM, Drizzle Zod.
- **Real-time Communication:** `ws` (WebSocket library).
- **File Upload & Object Storage:** Uppy (with `uppy/react`, `uppy/aws-s3`), Replit Object Storage.
- **Development Tools:** Vite, esbuild, tsx.
- **Database:** Neon Serverless PostgreSQL (via `@neondatabase/serverless`), Drizzle Kit.
- **Sports Data:** Sportmonks API v3 (`SPORTMONKS_API_TOKEN`). Auth header: `Authorization: <token>` (sin "Bearer"). Cache en tabla `sportmonks_cache` por 2 días.
