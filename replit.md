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

- **Broadcast Detail Page:** Displays real-time data for ads, products, chat, and analytics. Includes a live chat sidebar and a "Load Demo" button for seeding data (secondary/outline for ended broadcasts). Poll options show percentage + absolute vote count per option ("45% (234 votos)"). Includes a **Shoppable Ads** section with product ID input, sponsor selector, "Trigger Shoppable Ad" button (POST `/api/broadcasts/:id/trigger-shoppable-ad`), and a session log of triggered ads with timestamps. Shows a Commerce warning if not configured. Event timeline uses real `activeEvents / totalEvents * 100` progress, with Play/Skip/Maximize buttons. Live chat is disabled (read-only) when broadcast status is `ended`.
- **Sponsor Detail Page:** `/sponsors/:id` — shows sponsor profile (logo, colors, description), stats (total/active campaigns), and a list of linked campaigns. Accessible via "View" button on sponsor cards.
- **Component Library:** A grid-based library for reusable UI components with filtering and integration code snippets (e.g., iOS Swift). Components can be instanced multiple times per campaign.
- **Campaign Dashboard:** Tabs include Overview, Broadcasts, Components, Live, Analytics, and Settings. The "Live" tab manages real-time event triggers, and "Settings" configures campaign details. Forms auto-save to the database. Analytics tab is pre-fetched on page load (not lazy-loaded).
- **AppLayout:** Accepts `hideSearch` prop to hide the global header search bar on pages that have their own contextual search (e.g., /broadcasts, /components).
- **App Detail (`/apps/:id`):** Shows real viewer counts (sum from broadcast.viewerCount), broadcast counts per campaign, live broadcast count (status='live' only). Status badges: Active=teal, Paused=amber, Archived/Ended=gray.
- **Campaigns List (`/campaigns`):** Shows full country names via `Intl.DisplayNames`. Sponsor name + avatar displayed on cards. Engagement column shows sum of poll votes + contest participations. Badge colors: Active=teal, Paused=amber, Upcoming=gray, Ended=dark gray.
- **Dashboard (`/`):** "New Campaign" button navigates to /campaigns/new. App cards without logo show deterministic initials placeholder. Stats deltas via `GET /api/analytics/deltas`.
- **Sponsors (`/sponsors`):** Default colors on create: primaryColor `#3d8b7a`, secondaryColor `#141824`. Color swatch labels (Primary/Secondary) visible. SDK badge preview in sponsor cards.
- **Components (`/components`):** Config preview per type (banner→image, countdown→date, carousel→count). "Test" badge if name contains "test". Dynamic card height (min-h). isTemplate stored as boolean.
- **Sponsor Management:** CRUD operations for sponsors, including logo/avatar uploads and color configuration, linked to campaign branding.
- **Geographic Targeting & User Segmentation:** Server-side features for user segmentation based on location and other criteria using deterministic hashing.
- **Admin Panel:** Forms for polls, products, and contests start empty and load data from the database.
- **Broadcast Edit Dialog:** Allows editing broadcast name, externalId, status, startTime, and endTime. Status changes trigger WebSocket events.
- **Create Broadcast (global):** The "New Broadcast" dialog in `/broadcasts` includes an optional "Link to a Match" section with Sportmonks league + fixture selector. Selected fixture populates `sportmonksFixtureId`, team names/logos, and `matchStartingAt` on creation.
- **Demo Data:** TV2 app (campaign 36) has 3 broadcasts (~34K viewers peak). Viaplay app (campaigns 35/33/31) has 6+ broadcasts (~72K viewers peak). Live broadcasts: `tv2-eliteserien-live-2026-03-08` (Brann vs Molde), `viaplay-atletico-psg-2026-03-08` (Atlético Madrid vs PSG).
- **Channel and Client App Architecture:** Channels are standalone entities. SDK discovery resolves campaigns directly via `campaigns.client_app_id`.
- **Commerce Integration:** The ecommerce module is named "Commerce" in all public interfaces. The Commerce API key is delivered dynamically via config endpoints. Supports `product_carousel` and `product_banner` components linked to Commerce product IDs.
- **API Key Architecture:** The SDK uses a single Vio App API Key (`client_apps.api_key`) for all Vio backend endpoints. The Commerce module key is campaign-level, delivered via `integrations.commerce.apiKey` in the config response.
- **Location Slot System:** Campaign components can be assigned a `locationId` (e.g. `sport-detail-banner`, `sport-detail-carousel`). The SDK queries `GET /v1/sdk/components?locationId=` to resolve which component is active for each UI slot. Operators assign slots in the dashboard when adding components to a campaign.

### Database Tables

Key tables and their extensions:
- `broadcast_ads`: Ads linked to broadcasts (name, description, imageUrl, ctaUrl, adType, duration, isActive, displayOrder).
- `broadcast_products`: Shoppable products per broadcast (name, subtitle, price/originalPrice as varchar, buyUrl, status, displayOrder).
- `chat_messages`: Live chat messages per broadcast (username, message, createdAt, type, metadata).
- `broadcasts`: Extended with `viewerCount`, `peakViewers`, `externalId` (indexed on `(externalId, campaignId)`), and Sportmonks match fields: `sportmonksFixtureId`, `homeTeamName`, `homeTeamLogo`, `awayTeamName`, `awayTeamLogo`, `matchStartingAt`, `leagueName`.
- `campaign_components`: Extended with `locationId` for SDK slot identification.
- `sportmonks_cache`: Caches Sportmonks API responses (leagues + fixtures) for 2 days. Fields: `cacheType`, `leagueId`, `dateFrom`, `dateTo`, `data` (JSONB), `updatedAt`.

### API Architecture

- **Dashboard APIs (`/api/*`):** Session-based for internal operations (CRUD, configuration, uploads).
- **Admin APIs (`/v1/*`):** JWT Bearer token secured for full CRUD of broadcasts, polls, and contests.
- **SDK APIs (`/v1/sdk/*` and `/v1/engagement/*`):** API key authenticated for campaign discovery, configuration, engagement actions, offers, and localization.

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