# Vio - Real-Time Event Broadcasting Platform

## Overview

Vio is a multi-tenant SaaS platform for managing real-time event broadcasts with interactive audience engagement (polls, contests, ads, shoppable products). It enables administrators to create and manage broadcasts with custom sponsor branding and interactive elements. The platform supports multi-tenant use cases for agencies and brands managing client applications, channels, and campaigns with data isolation.

## User Preferences

- Preferred communication style: Simple, everyday language (Spanish).
- Publishing rule: Every time the app is published, update the `.cursorrules` file with the latest project details, architecture changes, new endpoints, and any relevant implementation notes.

## System Architecture

### Design System

Monochromatic dark theme throughout:
- **Background:** `#0a0e1a` (no gradients)
- **Cards/surfaces:** `#141824` with `border-white/10`
- **Text:** White primary, `text-gray-400` secondary, `text-gray-500` muted
- **Accent:** White background + black text for active elements
- **Status badges:** Live = teal bg + pulse dot, Upcoming = bordered, Ended = low opacity
- **Broadcast element colors:** Blue = polls, Purple = contests, Green = ads
- **Icons:** Lucide React only
- **Font:** Inter

### Technical Stack

**Frontend:**
- React 18 + Vite + TypeScript
- Tailwind CSS, Radix UI, shadcn/ui
- TanStack Query v5 (object form only)
- Wouter routing
- React Hook Form + Zod validation
- Lucide React icons
- Recharts (analytics charts)
- Uppy (file uploads with AWS S3 multipart)

**Backend:**
- Node.js + Express.js + TypeScript
- PostgreSQL (Neon Serverless) via Drizzle ORM
- `ws` WebSockets — isolated channels per campaign (`/ws/:campaignId`)
- In-memory scheduler for component activation/deactivation
- Replit Object Storage for file uploads

**Auth:**
- Dashboard: session-based (`/api/*`)
- Admin APIs: JWT Bearer tokens (`/v1/*`)
- SDK APIs: API key via `X-Api-Key` header or `?apiKey=` param (`/v1/sdk/*`, `/v1/engagement/*`)

### Project Structure

```
shared/schema.ts              — Single source of truth: Drizzle tables, Zod schemas, TypeScript types
server/routes.ts              — All API routes (~4000 lines)
server/storage.ts             — IStorage interface + DatabaseStorage implementation
server/analytics.ts           — Analytics endpoints (SQL-based)
server/db.ts                  — Drizzle database connection
server/scheduler.ts           — In-memory component scheduler
server/services/              — Vote processor, contest processor
client/src/App.tsx            — Wouter router with all page routes
client/src/components/AppLayout.tsx  — Main shell (sidebar + header + content)
client/src/components/ui/     — shadcn/ui component library
client/src/components/dashboard/    — Campaign dashboard tab components
client/src/pages/             — All page components
client/src/contexts/          — ThemeContext, UserContext
client/src/lib/queryClient.ts — TanStack Query config + apiRequest helper
openapi.yaml                  — OpenAPI 3.0 spec (~80 endpoints, 17 tag groups)
```

### Data Model Hierarchy

```
Users → Client Apps → Campaigns → Broadcasts → Polls / Contests / Ads / Products
                               → Campaign Components (banners, carousels, slots)
Sponsors → linked to Campaigns (many-to-many via campaign_sponsors)
```

Key tables: `users`, `sponsors`, `client_apps`, `channels`, `campaigns`, `components`, `campaign_components`, `broadcasts`, `polls`, `poll_options`, `poll_votes`, `contests`, `contest_participations`, `broadcast_ads`, `broadcast_products`, `chat_messages`, `events`, `scheduled_components`, `sportmonks_cache`

Config tables: `campaign_translations`, `campaign_engagement_config`, `campaign_ui_config`, `campaign_feature_flags`, `sdk_translations`

### API Architecture

- **Dashboard APIs (`/api/*`):** Session-based. Internal CRUD for all entities.
- **Admin APIs (`/v1/*`):** JWT Bearer tokens. Full control over broadcasts, polls, contests.
- **SDK APIs (`/v1/sdk/*`, `/v1/engagement/*`):** API key auth. Campaign discovery, configuration, engagement actions.
- **Analytics APIs (`/api/analytics/*`):** Session-based. SQL-based drill-down from global → app → campaign → broadcast.

### Feature Specifications

- **Campaign Management:** Multi-tenant campaigns with sponsor branding, interactive components, and audience targeting.
- **Broadcast Management:** Real-time scheduling, activation, and monitoring with Sportmonks fixture linking.
- **Interactive Components:** Polls, contests, shoppable ads, and banners with real-time WebSocket delivery to SDK clients.
- **Event Timeline:** Horizontal 0'–90' scrubber showing merged Sportmonks + engagement events. Colored dots: blue=poll, purple=contest, green=shoppable_ad, yellow=goal, grey=kickoff/FT.
- **Commerce Integration:** Per-sponsor Commerce API key (`sponsors.commerceApiKey`) delivered to SDK via config endpoint. Powers shoppable ads with external Commerce catalog.
- **Sportmonks Integration:** League + fixture picker in Create Broadcast modal. Server-side proxy with 2-day DB cache. Match score/events shown in broadcast detail via `MatchDataCard`.
- **Location Slot System:** `campaign_components.locationId` for dynamic SDK slot placement.
- **User Segmentation:** Server-side geographic targeting (`campaign.targetCountries`).
- **Analytics:** Global → App → Campaign → Broadcast drill-down with KPI cards, charts, and engagement timelines.
- **SDK:** Two-step init (campaigns on launch → broadcast on content open). `externalId` resolves Viaplay/partner content IDs to Vio broadcasts.

### Key Pages

| Route | Purpose |
|-------|---------|
| `/` | Dashboard — KPI cards, broadcast activity chart, upcoming campaigns |
| `/apps` | Client apps list with viewer totals |
| `/apps/:id` | App detail with campaign breakdown |
| `/campaigns` | Campaign list with sponsor, engagement, status |
| `/campaigns/:id` | Campaign dashboard — **tabs: Overview · Broadcasts · Components · Sponsors · Analytics · Settings** |
| `/broadcasts` | All broadcasts list with search |
| `/broadcasts/:broadcastId` | Broadcast detail — timeline, polls, contests, shoppable ads, live chat |
| `/sponsors` | Sponsor CRUD with logo/color upload |
| `/components` | Component library |
| `/analytics` | Full analytics drill-down |
| `/docs` | Interactive OpenAPI documentation |

### Campaign Dashboard Tabs (current — Mar 2026)

`Overview · Broadcasts · Components · Sponsors · Analytics · Settings`

The **Live** tab was removed (Mar-09-2026). `EventsTab` and `ScheduledTab` no longer exist in the campaign dashboard. The Overview tab now renders team logos (home/away) in each broadcast card via the `TeamLogo` component defined in `OverviewTab.tsx`.

### Broadcast Detail Header Stats (Mar 2026)

`Viewers · Total Votes · Engagement Rate · Status`

Engagement Rate = `Math.round(totalVotes / viewers * 100) + '%'`. Shows `'--'` if either value is 0. The "Load Demo" button has been removed from the header.

### Sponsors DB (Critical — do not break)

| ID | Name | Notes |
|----|------|-------|
| 2 | SkiStar | — |
| 3 | Elkjøp | commerceApiKey seeded |
| 4 | Torshov Sport | commerceApiKey seeded |

**Sponsor ID 1 does not exist.** Always use sponsorId=3 or 4 for sponsor-related operations.

### Demo Data (Do Not Modify)

- **Viaplay app** (client_app id=17, campaign 35): broadcast `viaplay-atletico-psg-2026-03-08` — live, 19.6K viewers, 3 polls, 3 sponsor slots (id=21 min35 [product 19], id=11 min45 [products 17,18], id=22 min70 [product 20]).
- **TV2 app** (client_app id=18, campaign 36): broadcast `tv2-eliteserien-live-2026-03-08` — Brann vs Molde, ~18.7K viewers.
- Viaplay apiKey: `viaplay_api_key_0c611e983b314ff8`. Commerce key: `KCXF10Y-W5T4PCR-GG5119A-Z64SQ9S`.
- Quick Access login: `vio-admin` (DB user ID 2).

### Deployment

`autoscale`. Build: `npm run build`. Run: `node dist/index.js`. Single instance — in-memory WebSockets and scheduler work as-is. Future multi-instance scaling will require Redis Pub/Sub + BullMQ.

## External Dependencies

- **UI:** Radix UI, Tailwind CSS, shadcn/ui, Lucide React, Recharts
- **Data:** TanStack Query v5, React Hook Form, Zod, Drizzle ORM, Drizzle Zod, Drizzle Kit
- **Real-time:** `ws` WebSocket library
- **File upload:** Uppy (`uppy/react`, `uppy/aws-s3`), Replit Object Storage
- **Database:** Neon Serverless PostgreSQL (`@neondatabase/serverless`)
- **Sports data:** Sportmonks API v3 (`SPORTMONKS_API_TOKEN`)
- **Commerce:** External GraphQL API at `graph-ql-dev.vio.live/graphql` (not managed in this repo)

## Session Change Log

### Mar-10-2026 (Session 6 — TASK-BACKEND-REVIEW: 4 fixes)
- **Bug 1 FIXED:** `fetchLineup` refactored into `fetchLineupData` (pure data, uses `sportmonksFetch`) + thin `fetchLineup` wrapper. Eliminates silent auth failure on cold start.
- **Bug 2 FIXED:** Cache stampede on lineup — `lineupInFlight = new Map<string, Promise<any>>()` in-flight dedup. N concurrent cache-miss requests = 1 Sportmonks call.
- **Bug 3 FIXED:** `fixtureResultCache` LRU eviction at 200 entries (3 lines, FIFO on Map insertion order).
- **Scheduler N+1 FIXED:** `processScheduledPolls` and `processScheduledContests` now use 1 JOIN query each instead of 1 + N per broadcast. New storage methods: `getScheduledPollsForLiveBroadcasts()` and `getScheduledContestsForLiveBroadcasts()` — JOIN polls/contests × broadcasts WHERE status='live' AND scheduledStartTime IS NOT NULL.

### Mar-10-2026 (Session 5 — Lineup Feature UI-07 + UI-08)
- **UI-07 COMPLETED:** Lineup endpoints added — `GET /api/broadcasts/:id/lineup` (dashboard) and `GET /v1/sdk/broadcasts/:id/lineup` (SDK). `homeTeamId`/`awayTeamId` stored in `broadcasts.metadata` JSONB (sport-agnostic). 30-min lineup cache (`cacheType='lineup_{fixtureId}'`). Position mapping: G=goalkeeper, D=defender, M=midfielder, F=attacker. `LineupSection` component added to broadcast detail (after MatchDataCard).
- **UI-08 COMPLETED:** `showLineup: boolean` and `startedAt: timestamp` columns added to `broadcasts` table. `PUT /api/broadcasts/:id` now accepts `showLineup` and auto-sets `startedAt` when status→live. `POST /api/broadcasts/:id/send-lineup` sends `lineup_show` WS event with computed `videoTimestamp` (10 min before kickoff). `LineupSection` upgraded: toggle "Show lineup to viewers" (disabled = Send button grayed out), "Send lineup now" manual trigger, "Sent at HH:MM" status indicator.

### Mar-09-2026 (Session 4 — Sportmonks Definitive Fix)
- **Sportmonks fixtures cache:** TTL split — fixtures 6h, leagues 2d. Removed `?leagues=${leagueId}` from Sportmonks URL (doesn't filter reliably). Server-side `f.league_id === leagueId` filter applied BEFORE caching. Stale fixtures cache cleared (11 rows). `leagueId` field added to cached fixture objects.
- **League dropdown:** Kept restricted to 4 leagues: CL (2), Europa League (5), Premier League (8), La Liga (564).
- **Verified:** CL Mar-10 → 4 correct fixtures. Championship Mar-10 → 6 fixtures, zero cross-contamination. Cache hit confirmed (38ms vs 584ms).

### Mar-09-2026 (Session 3 — UI Polish)
- **Create Broadcast modal fully translated to English** (was mixed Spanish/English)
- **Poll vote label:** "votos" → "votes" in broadcast detail
- **"Load Demo" button removed** from broadcast detail header
- **Engagement Rate** added to broadcast detail header stats
- **"VIaplay" → "Viaplay"** fixed in DB (client app name)
- **Sponsor slot 500 error resolved** — endpoint now returns `detail` field with real DB error message. Root cause: sponsorId=1 does not exist.
- **3 demo sponsor slots seeded** for viaplay-atletico-psg (id=21/11/22)
- **Team logos in campaign Overview tab** — `TeamLogo` component added to `OverviewTab.tsx`, renders home/away logos in broadcast cards
- **"Live" tab removed from campaign dashboard** — tabs are now Overview · Broadcasts · Components · Sponsors · Analytics · Settings
- **Contest edit modal** — pencil icon on each ContestCard opens a Dialog with fields: Title, Description, Image upload (file + URL), Prize, Type. Calls `PUT /api/contests/:id`.

### Mar-2026 (Session 1–2 — Architecture)
- Commerce API key moved from campaign level to sponsor level (`sponsors.commerceApiKey`)
- Shoppable Ad panel redesigned to 3-section layout (Pre-programmed Slots, Quick Fire, Session Log)
- Event Timeline redesigned as horizontal 0'–90' scrubber with Sportmonks integration
- MatchDataCard added to broadcast detail (team logos, score, key events)
- `broadcasts.sportmonksFixtureId`, `homeTeamName/Logo`, `awayTeamName/Logo`, `leagueName`, `matchStartingAt` added to schema
- `campaign_components.locationId` added for SDK slot targeting
- Analytics drill-down implemented (Global → App → Campaign → Broadcast)
- Dashboard KPI deltas (`GET /api/analytics/deltas`)
- Quick Access login renamed `reachu-admin` → `vio-admin`

### Feb-2026
- `broadcasts.viewerCount`, `peakViewers`, `externalId`, `duration` added
- `broadcast_ads`, `broadcast_products`, `chat_messages` tables added
- SDK two-step init architecture established
- EventTimeline, Live Chat, Shoppable Products panels added to broadcast detail
- Commerce API key delivered via `/v1/campaigns/:id/config` → `integrations.commerce`
