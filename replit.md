# Real-Time Event Broadcasting System

## Overview

This project is a real-time event broadcasting application using React, Express, and WebSockets. It enables multi-campaign management, where each campaign features isolated WebSocket channels, events, and configurations stored in PostgreSQL. Administrators can create campaigns and broadcast various events (products, polls, contests) to viewers in real-time. The system provides a modern full-stack TypeScript environment with a Vite-powered React frontend, an Express backend, WebSocket room-based communication, and a UI component library based on shadcn/ui.

## User Preferences

Preferred communication style: Simple, everyday language.

## System Architecture

### Frontend Architecture

**Technology Stack:**
- **Framework:** React 18 with TypeScript
- **Build Tool:** Vite
- **Routing:** Wouter
- **State Management:** TanStack Query (React Query)
- **UI Components:** Radix UI primitives with shadcn/ui
- **Styling:** Tailwind CSS with CSS variables

**Design Decisions:**
- **Aesthetic:** Premium gradient background, glass morphism for components, vibrant blue accents, Inter font family, and borderless design.
- **Responsive Design:** Full mobile responsiveness (320px - 768px) with Tailwind breakpoints (sm:, md:, lg:). Headers, grids, buttons, and typography adapt to screen size. Flex layouts stack on mobile, grids collapse to single columns, and interactive elements expand to full width for better touch targets.
- **Real-time:** Custom `useWebSocket` hook for connection management and reconnection logic.
- **Type Safety:** Shared Zod schemas for type-safe event structures.
- **Localization:** Complete English translation.
- **Navigation:** Back buttons on all sub-pages.

### Backend Architecture

**Technology Stack:**
- **Runtime:** Node.js with Express.js
- **WebSocket:** `ws` library
- **Type Safety:** TypeScript
- **ORM:** Drizzle ORM
- **Build:** esbuild

**Design Decisions:**
- **Database:** PostgreSQL with Drizzle ORM for campaign and event persistence.
- **WebSocket:** Campaign-specific channels (`/ws/:campaignId`) for isolated event streams; legacy `/ws` (campaign ID 0) for backward compatibility.
- **Event Broadcasting:** Events broadcast only to clients within the same campaign room.
- **Logging:** Custom middleware for API request logging.
- **Validation:** Server-side validation for `campaignId` before broadcasting.
- **Integration APIs:** Mock endpoint for Reachu.io channels, Tipio livestream data stored as JSON.
- **Simplified Design:** Client count tracking removed for demo simplicity - focuses solely on event broadcasting.

### Database Schema

**Campaigns Table:**
- Basic fields: `id`, `name`, `logo`, `description`, `createdAt`.
- Scheduling: `startDate`, `endDate`.
- Integrations: `reachuChannelId`, `reachuApiKey`, `tipioLiveshowId`, `tipioLivestreamData` (JSON object for Tipio configuration).

**Scheduled Components Table:**
- Linked to `campaignId` (cascade delete).
- Fields: `component type` (carousel, store_view, product_spotlight, liveshow_trigger, custom_component), `scheduledTime`, `endTime` (optional), `data` (JSON config), `status` (pending, sent, cancelled).
- Component Schemas: Carousel, Store View, Product Spotlight, Liveshow Trigger, Custom Component with specific configuration fields.
- Custom Component Type: References components from the library via `componentId`, enabling scheduled activation of reusable components.
- End Time Support: Components can have optional end time specified as:
  - Specific date/time for precise control
  - Duration (days + hours) with automatic calculation
  - No end time (runs until manually stopped)

**Components Table (Dynamic Components):**
- Reusable UI component library.
- Fields: `id` (UUID), `type` (banner, countdown, carousel_auto, carousel_manual, product_spotlight, offer_badge), `name`, `config` (JSON), `createdAt`.
- Purpose: Store reusable component configurations that can be shared across multiple campaigns.

**Campaign Components Table:**
- Links components to campaigns with real-time control.
- Fields: `id`, `campaignId`, `componentId`, `status` (active, inactive), `activatedAt`, `updatedAt`.
- Purpose: Enable dynamic activation/deactivation of components per campaign via WebSocket.
- Validation: Prevents same component from being active in multiple campaigns simultaneously.

### Data Flow & Event System

**Event Types:**
- Product Events (with `productId`, `name`, `pricing`, `images`)
- Poll Events (with multiple choices, optional images)
- Contest Events (with prizes, participation limits)

**Schema Validation:** Zod schemas in `shared/schema.ts` for runtime and compile-time validation.

**Event Lifecycle:** Admin creates event -> Server validates and stores in PostgreSQL -> Event broadcast to WebSocket clients in real-time.

**Historical Events:** Persisted events retrieved via `/api/events?campaignId=X`, merged with real-time events, with duplicate prevention.

### Dynamic Component Management System

**Architecture:**
- **Hybrid API + WebSocket:** REST API for configuration and CRUD operations, WebSocket for real-time status toggles and config updates.
- **Reusability:** Components created once in the library, reusable across multiple campaigns.
- **Conflict Prevention:** System validates that a component is not active in multiple campaigns simultaneously.
- **iOS Integration:** Each component has a unique ID that developers integrate into their iOS apps using code snippets like `ReachuComponent(componentId: "cmp_abc123")`.

**Component Types:**
1. **Banner:** Promotional banner with image, title, subtitle, CTA button and link.
2. **Countdown:** Timer displaying time remaining until a specified end date.
3. **Carousel Auto:** Automatic product carousel fed from a Reachu channel.
4. **Carousel Manual:** Product carousel with manually selected product IDs.
5. **Product Spotlight:** Highlight a specific product with optional text.
6. **Offer Badge:** Display promotional badge with customizable color and text.

**WebSocket Events:**
- `component_status_changed`: Broadcast when component is activated/deactivated in a campaign.
- `component_config_updated`: Broadcast when component configuration is edited.

**API Endpoints:**
- Campaigns: `GET/POST /api/campaigns`, `GET/PUT/DELETE /api/campaigns/:id`
- Scheduled Components: `GET /api/campaigns/:id/scheduled-components`, `POST /api/campaigns/:id/scheduled-components`, `PATCH /api/scheduled-components/:id`, `DELETE /api/scheduled-components/:id`
- Component Library: `GET/POST /api/components`, `PATCH/DELETE /api/components/:id`
- Campaign Components: `GET/POST /api/campaigns/:id/components`, `PATCH/DELETE /api/campaigns/:id/components/:cmpId`
- Validation: `GET /api/components/:id/availability` (check if component is available for activation)

**Workflow:**
1. Developer creates component in library (`/components` page) with type-specific configuration
2. Developer integrates component ID into iOS app code
3. Admin has two activation options:
   - **Manual Control:** Add component to campaign and toggle ON/OFF in real-time via Dynamic Components tab
   - **Scheduled Activation:** Schedule component for automatic activation at specific date/time via Scheduled Components tab
4. iOS app receives WebSocket updates and shows/hides component instantly
5. Admin can edit component config directly from Dynamic Components tab or Components Library; changes broadcast to all campaigns using the component

**Edit Feature:**
- Edit button (blue pencil icon) available on each dynamic component card
- Opens dialog with pre-filled form showing current configuration
- Type-specific forms for all 6 component types (banner, countdown, carousel_auto, carousel_manual, product_spotlight, offer_badge)
- Changes apply to all campaigns using the component
- Component cards now display relevant config info (e.g., banner title, countdown title, product ID, channel ID, badge text) for better visibility

### Page Structure

- **Campaigns Page (`/` or `/campaigns`):** Dashboard for managing campaigns, creating new ones, deleting existing campaigns (with confirmation dialog), and accessing admin/advanced settings and component library.
- **New Campaign Page (`/campaigns/new`):** Form for creating new campaigns with basic info, optional Reachu.io integration, and optional Tipio Livestream integration.
- **Campaign Admin Page (`/campaign/:id/admin`):** Campaign-specific dashboard for creating and broadcasting various event types (products, polls, contests). Features form state persistence, poll options with images, logo configuration (URL/upload), real-time event log, and connection status.
- **Campaign Viewer Page (`/campaign/:name/:id`):** Real-time event display for viewers, with notifications and event history.
- **Legacy Admin (`/admin`) & Viewer (`/viewer`) Pages:** Backward-compatible pages using campaign ID 0.
- **Advanced Campaign Page (`/campaign/:id/advanced`):** Tabbed interface with four tabs:
  - **Overview**: Unified dashboard with statistics cards (scheduled count, dynamic count, active count, upcoming count) and visual overview of all scheduled and dynamic components with intelligent status indicators (upcoming, active, ended, cancelled, completed for scheduled; active/inactive for dynamic).
  - **Integrations**: Reachu.io and Tipio.no integration configuration.
  - **Scheduled Components**: Timeline view with full edit capability for automated components.
  - **Dynamic Components**: Real-time component management with toggle controls.
- **Components Library Page (`/components`):** Central repository for reusable UI components. Create, edit, delete components with type-specific forms (banner, countdown, carousel_auto, carousel_manual, product_spotlight, offer_badge). Display iOS integration code snippets and usage status across campaigns.
- **Docs Page (`/docs`):** Integration documentation with code examples.

## External Dependencies

### UI & Styling
- **Radix UI:** Accessible component primitives.
- **Tailwind CSS:** Utility-first CSS framework.
- **class-variance-authority & clsx:** Dynamic styling utilities.
- **Lucide React:** Icon library.

### Data & State Management
- **TanStack Query:** Server state management.
- **React Hook Form:** Form state management with Zod resolvers.
- **Zod:** Schema validation.
- **Drizzle ORM & Drizzle Zod:** Database ORM and schema integration.

### Real-time Communication
- **ws (WebSocket):** WebSocket server.
- **Custom WebSocket Hook:** Client-side WebSocket management.

### File Upload & Object Storage
- **Uppy:** File uploader with `uppy/react` and `uppy/aws-s3` for direct cloud storage uploads.
- **Replit Object Storage:** Built-in cloud storage (via `@google-cloud/storage`).
- **ObjectStorageService:** Custom service for upload URL generation and file serving.

### Development Tools
- **Vite:** Frontend development and build.
- **esbuild:** Backend bundling.
- **tsx:** TypeScript execution for development.
- **Replit Plugins:** Development banner, cartographer, runtime error overlay.

### Database
- **Neon Serverless PostgreSQL:** Configured via `@neondatabase/serverless`.
- **Drizzle Kit:** Migrations and schema management.
- **Connection:** PostgreSQL via `DATABASE_URL` environment variable.
- **Note:** PostgreSQL is actively used for campaign and event storage.