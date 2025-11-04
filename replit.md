# Real-Time Event Broadcasting System

## Overview

This project is a real-time event broadcasting application designed for multi-campaign management. It allows administrators to create and manage campaigns, broadcasting various real-time events (products, polls, contests) to viewers. The system features a modern full-stack TypeScript environment with a React frontend (Vite), an Express backend, and WebSocket-based communication. Key capabilities include isolated WebSocket channels per campaign, persistent configuration and event storage in PostgreSQL, and a dynamic UI component library built with shadcn/ui. The project aims to provide a robust, scalable solution for interactive real-time audience engagement.

## User Preferences

Preferred communication style: Simple, everyday language.

## Deployment

**Production Recommendation:** Use Reserved VM deployment for reliable WebSocket performance and 99.9% uptime. Autoscale deployments are not suitable for persistent WebSocket connections due to 15-minute idle timeout. See `DEPLOYMENT.md` for detailed deployment guide.

**Required Environment Variables:**
- `DATABASE_URL`: PostgreSQL connection string (auto-configured with Replit PostgreSQL)
- `SESSION_SECRET`: Random secret for session encryption
- `PORT`: Server port (auto-configured by Replit, defaults to 5000)

## System Architecture

### UI/UX Decisions
The frontend utilizes React 18 with TypeScript and Vite, styled with Tailwind CSS, and uses Radix UI primitives with shadcn/ui for components. The design aesthetic features a premium gradient background, glass morphism, vibrant blue accents, Inter font, and a borderless design. It is fully responsive across mobile and desktop breakpoints (320px - 768px), adapting layouts and interactive elements for optimal viewing and touch interactions.

### Technical Implementations
**Frontend:**
- **State Management:** TanStack Query.
- **Routing:** Wouter with simplified navigation flow.
- **Navigation Structure:**
    - Campaigns List (`/`) → Single "Manage Campaign" button → Campaign Dashboard (`/campaign/:id/dashboard`)
    - Dashboard has "Back to campaigns" button for easy return
    - "View Live" button provides quick access to public viewer page
    - Legacy routes (`/campaign/:id/admin`, `/campaign/:id/advanced`) remain for backward compatibility
- **Real-time:** Custom `useWebSocket` hook handles connection and reconnection logic.
- **Type Safety:** Shared Zod schemas ensure type-safe event structures.
- **Localization:** English translation.
- **Component Architecture:** Dashboard tabs are modular, self-contained components with their own queries and mutations.

**Backend:**
- **Runtime:** Node.js with Express.js.
- **WebSockets:** `ws` library for real-time communication.
- **Database:** PostgreSQL with Drizzle ORM for data persistence.
- **Build:** esbuild.
- **URL Normalization:** Object storage URLs are automatically converted to absolute URLs for external client compatibility, detecting the base URL from environment variables or the first HTTP request.
- **Logging:** Custom middleware for API request logging.
- **Validation:** Server-side validation for campaign IDs.
- **Scheduler Service:** Automatic component activation/deactivation based on scheduled times. Configurable interval via `SCHEDULER_INTERVAL_MINUTES` environment variable (default: 1 minute). Sends identical WebSocket events whether components are activated manually or automatically.
- **RESTful Event API:** Provides GET `/api/events/:campaignId` for retrieving campaign events and POST `/api/events/:campaignId` for creating events. Events are persisted to both in-memory storage (legacy compatibility) and PostgreSQL database, then broadcast via WebSocket.

### Feature Specifications
- **Campaign Management:** Administrators can create, manage, and delete campaigns. Each campaign can have associated integrations (Reachu.io, Tipio). Campaigns have a lifecycle defined by `startDate`, `endDate`, and `isPaused` state.
    - **Campaign Master Control:** Admins can pause/resume entire campaigns using a master toggle, independent of lifecycle dates. When paused, ALL components are hidden and the scheduler stops activating components. System broadcasts `campaign_paused` and `campaign_resumed` WebSocket events.
        - **Pause Priority:** isPaused state overrides lifecycle dates (checked first in isCampaignActive)
        - **Persistent State:** Pause state persists across server restarts
        - **UI Location:** Prominent master control toggle at top of Overview tab
    - **Campaign Lifecycle:** All components automatically respect campaign start and end dates. System broadcasts `campaign_started` and `campaign_ended` WebSocket events to notify clients.
        - **State Priority:** 1) Check isPaused → 2) Check startDate → 3) Check endDate → 4) Active
        - **Before startDate:** Components cannot activate, even if manually toggled
        - **During campaign (startDate ≤ now < endDate AND not paused):** Components can be activated/deactivated via manual toggle or scheduling
        - **After endDate:** All components automatically hidden
    - **Manual Component Toggle:** Admins can activate/deactivate individual components during active campaign (disabled when paused)
- **WebSocket Architecture:** Each campaign (`/ws/:campaignId`) has an isolated WebSocket channel, ensuring events are broadcast only to relevant clients, managed by a `Map<campaignId, Set<WebSocket>>`.
- **Dynamic Component Management:**
    - A library of reusable UI components configurable via a REST API, including:
        - **Standard Components:** Banner, Countdown, Carousel, Product Spotlight, Offer Badge, Offer Banner
        - **Reachu Product Components (NEW):**
            - `product_carousel`: Horizontal product slider with auto-play support (stores productIds, SDK fetches from Reachu API)
            - `product_banner`: Featured product promotional banner with custom background, title, CTA, and deeplink
            - `product_store`: Full catalog or filtered product grid/list view (supports "all" or "filtered" modes)
    - Components can be activated/deactivated manually or scheduled for automatic display within specific campaigns.
    - **Component Type Uniqueness:** Only ONE component of each type can be active at any given time within a campaign. This ensures iOS apps can reliably import components by type without ambiguity (e.g., `activeComponents.first { $0.type == "banner" }` is guaranteed to return at most one result).
        - **Dynamic Components:** Backend validates that no other component of the same type is active before allowing activation
        - **Scheduled Components:** Backend validates that no other component of the same type has overlapping time ranges before allowing creation/update
        - **Error Handling:** Returns 409 Conflict with clear English error messages specifying the conflicting component/schedule
    - **Campaign-Specific Customization:** Each campaign can personalize component configurations (texts, images, links, product IDs) without affecting the original template or other campaigns. Custom configurations are stored per campaign in `campaignComponents.customConfig`.
        - **UI Controls:** Purple "Customize" button (pencil icon) opens a dialog with all configurable fields
        - **Visual Indicators:** "Customized" badge (purple) appears on components with custom configurations
        - **Revert Functionality:** "Revert to Original" button sets customConfig to null, restoring template defaults
        - **Field Pre-population:** Dialog pre-fills with current values (customConfig || template.config)
        - **Immediate Updates:** Changes reflect in UI immediately after successful mutation
    - Real-time updates via WebSockets (`campaign_started`, `campaign_ended`, `campaign_paused`, `campaign_resumed`, `component_status_changed`, `component_config_updated`) for dynamic display in client applications (e.g., iOS).
    - Prevents a component from being active in multiple campaigns simultaneously.
    - **Deeplink Support:** Components with CTAs (Banner, Offer Banner, Product Banner) support optional deeplinks for in-app navigation. When specified, deeplinks take priority over web links, enabling seamless transitions to specific app screens (e.g., `myapp://offers/weekly` or `pregnancy://product/408841`). Supports both custom URL schemes and universal links.
    - Integration documentation with Swift code examples is provided for client-side implementation in `CAMPAIGN_LIFECYCLE.md`.
- **Event Broadcasting:** Supports Product, Poll, and Contest events, validated by Zod schemas, stored in PostgreSQL, and broadcast to campaign-specific WebSocket clients in real-time. Historical events are also retrievable.

### System Design Choices
- **Database Schema:**
    - `Users`: Stores user information (id, reachuUserId, firebaseToken) for multi-user architecture.
    - `Campaigns`: Stores campaign details (name, user, logo, description, scheduling, isPaused state, integration IDs).
    - `Components`: Reusable UI component library with `id`, `type`, `name`, and `config` (JSON).
    - `Campaign Components`: Links `Components` to `Campaigns` for both manual and automatic activation/deactivation. Includes:
        - `status`: Current activation state ('active' or 'inactive')
        - `scheduledTime` (nullable): Optional ISO timestamp for automatic activation
        - `endTime` (nullable): Optional ISO timestamp for automatic deactivation
        - `customConfig` (JSON, nullable): Campaign-specific configuration overrides. When null, uses the template's default config; when set, takes priority over template config.
        - Supports both manual toggle controls and automatic scheduler-based display in a unified table structure.
- **Page Structure:**
    - **Campaigns Page:** Dashboard listing all campaigns with "Manage Campaign" button for each.
    - **New Campaign Page:** Form for campaign creation.
    - **Campaign Dashboard:** Unified command center with 6 tabs (replaces previous Admin/Advanced split):
        - **Overview Tab (REDESIGNED - Minimalista):** Compact campaign control with pause/resume toggle, lifecycle status (dates), quick stats grid (active/scheduled components, total events), Components section with individual toggles and master controls ("All On" / "All Off"), **Saved Events section** with cards and one-click "Broadcast" buttons to re-send previously created events, and "Create New Event" section moved to bottom for creating fresh Product/Poll/Contest events. Master toggle uses Promise.allSettled for reliable partial-failure handling. Component toggles disabled when campaign paused. Design optimized for mobile with smaller buttons, compact spacing, and responsive grid layouts.
        - **Events Tab:** Real-time event broadcasting interface with Product/Poll/Contest forms, WebSocket connection status, event history log, and form auto-save
        - **Scheduled Tab:** Timeline view of scheduled components with "Trigger Now" button for manual activation before scheduled time
        - **Components Tab:** Dynamic component management with toggle switches for activation/deactivation, customization dialogs, add/remove functionality
        - **Integrations Tab:** Read-only view of Reachu.io and Tipio integration details configured during campaign creation
        - **Settings Tab:** Campaign metadata editor (name, description, dates, logo) and delete campaign functionality
    - **Campaign Viewer Page:** Public-facing real-time event display for end-users (accessed via `/campaign/:name/:id`).
    - **Components Library Page:** Standalone page for managing reusable component templates.
    - **Docs Page:** Integration documentation with Swift code examples.
    - **Legacy Pages (backward compatibility):** Admin and Advanced pages remain accessible but new navigation uses unified Campaign Dashboard.

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
- **Uppy:** File uploader with `uppy/react` and `uppy/aws-s3`.
- **Replit Object Storage:** Built-in cloud storage (via `@google-cloud/storage`).

### Development Tools
- **Vite:** Frontend development and build.
- **esbuild:** Backend bundling.
- **tsx:** TypeScript execution for development.

### Database
- **Neon Serverless PostgreSQL:** Configured via `@neondatabase/serverless` for campaign and event storage.
- **Drizzle Kit:** Migrations and schema management.