# Real-Time Event Broadcasting System

## Overview

This project is a real-time event broadcasting application for multi-campaign management, enabling administrators to create campaigns and broadcast various real-time events (products, polls, contests) to viewers. It features a full-stack TypeScript environment with a React frontend (Vite), an Express backend, and WebSocket-based communication. The system uses isolated WebSocket channels per campaign, persistent configuration and event storage in PostgreSQL, and a dynamic UI component library built with shadcn/ui. The goal is to provide a robust, scalable solution for interactive real-time audience engagement.

## User Preferences

Preferred communication style: Simple, everyday language.

## System Architecture

### UI/UX Decisions
The frontend uses React 18 with TypeScript and Vite, styled with Tailwind CSS, and utilizes Radix UI primitives with shadcn/ui for components. The design features a premium gradient background, glass morphism, vibrant blue accents, Inter font, and a borderless, fully responsive design for mobile and desktop (320px - 768px).

### Technical Implementations
**Frontend:**
- **State Management:** TanStack Query.
- **Routing:** Wouter.
- **Real-time:** Custom `useWebSocket` hook for connection and reconnection.
- **Type Safety:** Shared Zod schemas.
- **Component Architecture:** Modular, self-contained dashboard tab components.

**Backend:**
- **Runtime:** Node.js with Express.js.
- **WebSockets:** `ws` library.
- **Database:** PostgreSQL with Drizzle ORM.
- **Scheduler Service:** Automatic component activation/deactivation based on scheduled times.
- **RESTful Event API:** Provides GET and POST endpoints for campaign events, persisting to PostgreSQL and broadcasting via WebSocket.

### Feature Specifications
- **Campaign Management:** Create, manage, and delete campaigns with associated integrations. Includes campaign lifecycle (startDate, endDate, isPaused) and a master control to pause/resume entire campaigns, overriding scheduled dates. Pause state is persistent.
- **WebSocket Architecture:** Isolated WebSocket channels per campaign (`/ws/:campaignId`).
- **Dynamic Component Management:**
    - A library of reusable UI components (Banner, Countdown, Carousel, Product Spotlight, Offer Badge, Offer Banner, Product Carousel, Product Banner, Product Store).
    - Components can be activated/deactivated manually or scheduled.
    - Component Library maintains 6 base templates and allows campaigns to add multiple instances of these templates with unique names and campaign-specific custom configurations.
    - Real-time updates via WebSockets for dynamic display.
    - Deeplink support for CTAs in components.
- **Event Broadcasting:** Supports Product, Poll, and Contest events, validated by Zod, stored in PostgreSQL, and broadcast to campaign-specific WebSocket clients.
    - **Saved Events with Smart Deduplication (Nov 2025):** The "Saved Events" section in OverviewTab displays previously created events for easy re-broadcasting. To prevent visual clutter from duplicate event names, the system implements hybrid deduplication:
        - **Default Behavior:** GET `/api/events/:campaignId` groups events by (type + event name/question) and returns only the most recent version of each unique combination
        - **Full History Access:** Optional `?includeAll=true` query parameter bypasses deduplication to return complete event history
        - **Performance:** Reduces UI payload from 50+ duplicate cards to ~9 unique events for typical campaigns
        - **Data Integrity:** All events remain in database for audit trail; deduplication is view-only
        - **React Best Practices:** Events use stable `event.id` as React keys instead of array index
        - **Example:** Campaign with 50 "Producto Persistente" broadcasts displays only the latest version in Saved Events section
    - **Template Component Multi-Campaign Support (Nov 2025):** Template components (isTemplate='true') can now be added to multiple campaigns simultaneously:
        - **Architecture:** `validateComponentAvailability(componentId, isTemplate, campaignId?)` accepts componentId + isTemplate boolean
        - **Template Behavior:** Returns `{available: true}` immediately for templates, bypassing multi-campaign restriction
        - **Regular Component Behavior:** Non-template components (isTemplate='false') remain restricted to single campaign
        - **Security:** Callers extract isTemplate from fetched component, preventing object mutation/tampering
        - **Performance:** Zero redundant database lookups (component fetched once by caller)
        - **Example:** "Product Banner" template can be added to Campaign 3, Campaign 19, and Campaign 20 without 409 conflicts
    - **Geographic Targeting & User Segmentation (Nov 2025):** Server-side segmentation enables A/B testing and geographic restrictions:
        - **Database Fields:** Added `isSegmented` (bool), `targetCountries` (array of ISO country codes), `targetPercentage` (1-100%)
        - **Deterministic Hashing:** Uses SHA256(`userId:campaignId`) % 100 to ensure consistent user assignment (same user always sees/doesn't see a campaign)
        - **Server-Side Filtering:** `/v1/offers` endpoint validates `userId`, `userCountry`, and campaign targeting before returning offers
        - **Dashboard UI:** "Targeting & Segmentation" section in Campaign Settings with:
          - Toggle to enable/disable segmentation
          - Multi-select of 18 countries (US, MX, AR, CO, BR, ES, CA, DE, FR, GB, IT, JP, AU, NZ, SG, IN, KR, CN)
          - Range slider + number input for user percentage (1-100%)
          - Real-time country search and badge display
        - **Query Parameters:** SDK passes `userId` and `userCountry` to endpoints: `GET /v1/offers?apiKey=xxx&campaignId=14&userId=user123&userCountry=MX`
        - **Behavior:** If user doesn't match targeting, returns empty offers array (no error, graceful degradation)
        - **Use Cases:** A/B testing (20% of users), regional campaigns (only Mexico), market testing

### System Design Choices
- **Multi-Tenant SaaS Architecture (Nov 2025):**
    - **Four-Level Hierarchy:** Users → Client Apps → Channels → Campaigns
    - **Isolation:** Complete data isolation between users (agencies/brands) and their client apps
    - **Performance:** Indexed foreign keys (user_id, client_app_id, channel_id) for optimized queries
    - **Session Simulation:** localStorage-based userId (`reachu_simulated_user_id`) until Reachu authentication integration
    - **Scoped Queries:** All campaign endpoints filter by userId for proper multi-tenant isolation
    
- **Database Schema:**
    - `Users`: Stores user info (id, reachuUserId, email?, name?). Represents agencies/brands managing multiple apps.
    - `Client Apps`: Mobile/web applications owned by users (id, userId, name, bundleId, apiKey). Example: "XXL", "VG", "Pregnancy App".
    - `Channels`: Marketing channels within client apps (id, clientAppId, name, description). Example: "XXL Home", "XXL Category".
    - `Campaigns`: Event campaigns within channels (id, channelId, userId, name, scheduling, pause state, matchId, matchName, matchStartTime). Links to Components and Events.
    - `Components`: Reusable UI component library with `isTemplate` flag.
    - `Campaign Components`: Links `Components` to `Campaigns`, managing activation status, scheduled times, `instanceName`, `customConfig`, and `matchId`.
    
- **SDK Integration Endpoints:**
    - **GET /v1/sdk/campaigns:** Auto-discovery endpoint to find all active campaigns for a client app
      - **Authentication:** Supports both `apiKey` query param and `X-App-Bundle-ID` header (prioritizes bundle ID)
      - **Filtering:** Optional `matchId` query param to filter campaigns by match association
      - **Response:** Returns array of active campaigns with components and matchContext
    - **GET /v1/sdk/config?apiKey=xxx&campaignId=yyy:** Returns campaign config (components, deeplinks, branding) for Swift SDK
      - **matchContext:** Optional object with matchId, matchName, startTime when campaign is associated with a match
    - **GET /v1/offers?apiKey=xxx&campaignId=yyy&userId=user123&userCountry=MX:** Returns active product offers filtered by user targeting
      - **matchContext:** Included per-offer when component has matchId, plus campaign-level matchContext
    - **Authentication:** API key-based authentication via `client_apps.api_key` or `X-App-Bundle-ID` header
    - **Scoping:** Campaign-level scoping (backend automatically resolves channel from campaignId)
    - **Targeting Parameters (Optional):**
      - `userId` (string): Unique user identifier for deterministic segmentation
      - `userCountry` (string): ISO country code (e.g., 'MX', 'US') for geographic targeting
    - **Response Format:** Includes campaignId, campaignName, channelId, channelName for client-side routing; offers array filtered by user eligibility
    - **HTTPS URLs:** All asset URLs (logos, images) enforced as HTTPS for iOS security requirements
    - **Match Context Support (Jan 2026):** Campaigns and components can be associated with external matches (sports events)
      - **Database Fields:** matchId, matchName, matchStartTime on campaigns; matchId on campaign_components
      - **WebSocket Events:** campaign_started, component_status_changed, component_config_updated now include optional matchId
      - **Dashboard UI:** "Match Context" section in Campaign Settings with fields for Match ID, Match Name, Match Start Time
- **Page Structure:**
    - **Campaigns Page:** Lists all campaigns.
    - **Campaign Dashboard:** Unified command center with tabs for Overview (campaign control, stats, saved events, create new event), Events (broadcasting interface), Scheduled (timeline), Components (management), Integrations (view only), and Settings.
    - **Campaign Viewer Page:** Public-facing event display.
    - **Components Library Page:** Manages reusable component templates.
    - **Docs Page:** Integration documentation.

## External Dependencies

### UI & Styling
- **Radix UI:** Accessible component primitives.
- **Tailwind CSS:** Utility-first CSS framework.
- **class-variance-authority & clsx:** Dynamic styling.
- **Lucide React:** Icon library.

### Data & State Management
- **TanStack Query:** Server state management.
- **React Hook Form:** Form state management.
- **Zod:** Schema validation.
- **Drizzle ORM & Drizzle Zod:** PostgreSQL ORM and schema integration.

### Real-time Communication
- **ws:** WebSocket server library.

### File Upload & Object Storage
- **Uppy:** File uploader (`uppy/react`, `uppy/aws-s3`).
- **Replit Object Storage:** Built-in cloud storage.

### Development Tools
- **Vite:** Frontend development and build.
- **esbuild:** Backend bundling.
- **tsx:** TypeScript execution for development.

### Database
- **Neon Serverless PostgreSQL:** Configured via `@neondatabase/serverless`.
- **Drizzle Kit:** Migrations and schema management.

## Pending Tasks

### API Key Management UI (Completed - Jan 2026)
- **Description:** Added Client Apps page at `/client-apps` to view and manage API Keys
- **Location:** `/client-apps` page accessible from user session and campaigns pages
- **Features implemented:**
  - Display API Key for each Client App (with copy button)
  - Toggle API Key visibility (show/hide)
  - Regenerate API Key with confirmation dialog
  - Create new Client Apps
  - Delete Client Apps
  - SDK configuration example code snippet
- **API Endpoints:** GET/POST `/api/client-apps`, PATCH/DELETE `/api/client-apps/:id`, POST `/api/client-apps/:id/regenerate-key`

### Campaign Logo Upload on Creation (Completed - Jan 2026)
- **Description:** Added image upload component to campaign creation form
- **Location:** `/campaigns/new` page - uses `ImageUploadWithPreview` component
- **Features:** Upload from file or paste URL, preview, remove uploaded image