# Real-Time Event Broadcasting System

## Overview

This is a real-time event broadcasting application built with React, Express, and WebSockets. The system supports multi-campaign management where each campaign has its own isolated WebSocket channel, events, and configuration stored in PostgreSQL. Administrators can create multiple campaigns and broadcast various types of events (products, polls, contests) to connected viewers in real-time.

The application demonstrates a modern full-stack TypeScript setup with a Vite-powered React frontend, Express backend, WebSocket room-based communication, PostgreSQL persistence, and a comprehensive UI component library based on shadcn/ui.

## User Preferences

Preferred communication style: Simple, everyday language.

## System Architecture

### Frontend Architecture

**Technology Stack:**
- **Framework:** React 18 with TypeScript
- **Build Tool:** Vite for fast development and optimized production builds
- **Routing:** Wouter for lightweight client-side routing
- **State Management:** TanStack Query (React Query) for server state and data fetching
- **UI Components:** Radix UI primitives with shadcn/ui styling system
- **Styling:** Tailwind CSS with CSS variables for theming

**Design Decisions:**
- **Component Library:** Uses shadcn/ui components built on Radix UI primitives, providing accessible, unstyled components that can be customized. This offers better flexibility than pre-styled libraries while maintaining accessibility standards.
- **Dark Theme:** Application enforces dark mode with a custom color scheme defined in CSS variables, creating a consistent visual experience.
- **Real-time Communication:** Custom `useWebSocket` hook manages WebSocket connections, handling reconnection logic and message processing in a reusable way.
- **Type Safety:** Shared schema definitions between client and server using Zod ensures type-safe event structures across the stack.

### Backend Architecture

**Technology Stack:**
- **Runtime:** Node.js with Express.js
- **WebSocket:** ws library for real-time bidirectional communication
- **Type Safety:** TypeScript for end-to-end type safety
- **ORM:** Drizzle ORM configured (though database storage not actively used)
- **Build:** esbuild for fast server-side bundling

**Design Decisions:**
- **PostgreSQL Storage:** Uses PostgreSQL database with Drizzle ORM for persistent storage of campaigns and events. Events are linked to campaigns via `campaignId` foreign key.
- **WebSocket Rooms:** Campaign-specific WebSocket channels at `/ws/:campaignId` isolate event streams. Legacy `/ws` path (campaign ID 0) maintained for backward compatibility.
- **Event Broadcasting:** Events broadcast only to clients in the same campaign room, preventing cross-campaign message pollution.
- **Client Tracking:** Per-campaign client count tracking with real-time updates to all viewers in that campaign.
- **Request Logging:** Custom middleware logs API requests with duration and truncated response data for debugging.
- **Campaign Validation:** Server-side validation ensures campaignId exists before broadcasting events, preventing accidental cross-campaign broadcasts.

### Database Schema (Extended)

**Campaigns Table:**
- Basic fields: id, name, logo, description, createdAt
- **Scheduling fields:** startDate, endDate (nullable timestamps for campaign scheduling)
- **Reachu.io integration:** reachuChannelId, reachuApiKey (connects to Reachu channel for product fetching)
- **Tipio.no integration:** tipioLiveshowId (connects campaign to Tipio liveshow)

**Scheduled Components Table:**
- Links to campaign via campaignId (foreign key with cascade delete)
- Component type: carousel, store_view, product_spotlight, liveshow_trigger
- scheduledTime: When component should be automatically displayed
- data: JSON configuration specific to component type
- status: pending, sent, cancelled (tracks component lifecycle)
- Ordered by scheduledTime for chronological component execution

**Component Type Schemas:**
- **Carousel:** productIds array, autoRotate flag, intervalSeconds
- **Store View:** categoryId (optional), layout (grid/list), maxItems
- **Product Spotlight:** productId, highlightText (optional), durationSeconds
- **Liveshow Trigger:** liveshowId, autoStart flag

### Data Flow & Event System

**Event Types:**
The application supports three event types with strict schemas:
- **Product Events:** E-commerce product announcements with productId (from external system), name, pricing and images
- **Poll Events:** Interactive polls with multiple choice options (each option can have optional image/logo) and duration
- **Contest Events:** Contest announcements with prizes and participation limits

**Schema Validation:**
- Zod schemas in `shared/schema.ts` define event structures
- Runtime validation ensures data integrity
- TypeScript types derived from schemas provide compile-time safety

**Event Lifecycle:**
1. Admin creates event via form submission
2. Server validates event data against schema
3. Event stored in PostgreSQL database (campaign-specific)
4. Event broadcast to all connected WebSocket clients in campaign channel
5. Viewers receive and display events in real-time

**Historical Events:**
- GET /api/events?campaignId=X retrieves persisted events from database
- Admin and viewer pages load historical events on mount via React Query
- Real-time events from WebSocket merged with historical events
- Duplicate prevention: Events checked by type, timestamp, and data before adding
- Event persistence enables viewers to see past events even if they missed the live broadcast

### Page Structure

**Campaigns Page (`/` or `/campaigns`):**
- Campaign management dashboard
- List of all created campaigns with cards showing name, description, and creation date
- Campaign creation form for new campaigns
- Click on campaign to navigate to viewer page

**Campaign Admin Page (`/campaign/:id/admin`):**
- Campaign-specific dashboard for creating and broadcasting events
- Multiple event forms: Add multiple products, polls, and contests with the "+" button
- Each event has its own "Send" button for independent broadcasting to that campaign's viewers
- Remove events with the "X" button (maintains at least 1 form per type)
- **Form State Persistence:** Form values automatically save to database and restore on page refresh (auto-save with 1-second debounce)
- **Poll Options with Images:** Poll system supports individual images for each option
  - Each option is an object with text and optional imageUrl
  - Add/remove poll options dynamically with "Legg til" button
  - Each option can have a logo (e.g., team logos for sports polls)
  - Option images can be provided via URL or file upload
  - Backend automatically converts relative URLs to absolute URLs
  - Backwards compatible: old comma-separated options auto-migrate to new format
- Campaign logo configuration with dual input methods:
  - URL input for existing logos
  - Direct file upload using Replit Object Storage
  - Real-time logo preview
- Real-time event log showing broadcast history for this campaign
- Connection status and client count display for this campaign

**Campaign Viewer Page (`/campaign/:name/:id`):**
- Campaign-specific viewer page showing events for selected campaign
- Real-time event notifications (with browser Notification API)
- Event history with visual event cards
- Connection status monitoring
- WebSocket connects to `/ws/:campaignId` for isolated event stream

**Legacy Admin Page (`/admin`):**
- Backward-compatible admin page (uses campaign ID 0)
- WebSocket connects to `/ws` for legacy broadcasts
- Maintained for existing integrations

**Legacy Viewer Page (`/viewer`):**
- Backward-compatible viewer page (uses campaign ID 0)
- Receives events from legacy admin

**Advanced Campaign Page (`/campaign/:id/advanced`):**
- Extended campaign management for Reachu.io and Tipio.no integration
- Three-tab interface:
  - **Overview Tab:** Campaign details with start/end dates for scheduling
  - **Integrations Tab:** Reachu channel configuration (API key, channel ID) and Tipio liveshow connection
  - **Components Tab:** Scheduled components management with timeline view
- Four types of scheduled components:
  - **Carousel:** Auto-rotating product showcase from Reachu
  - **Store View:** Grid/list of products from a category
  - **Product Spotlight:** Time-limited highlight of specific product
  - **Liveshow Trigger:** Automatic Tipio liveshow initiation
- Visual component status tracking (pending, sent, cancelled)
- Component scheduling with specific date/time triggers
- Accessed via "Avanzado" button on campaign cards

**Docs Page (`/docs`):**
- Integration documentation with code examples
- Swift WebSocket client implementation examples
- Copy-to-clipboard functionality for easy integration

## External Dependencies

### UI & Styling
- **Radix UI:** Comprehensive collection of accessible component primitives (accordion, dialog, dropdown, etc.)
- **Tailwind CSS:** Utility-first CSS framework with PostCSS processing
- **class-variance-authority & clsx:** Dynamic className generation and conditional styling
- **Lucide React:** Icon library for consistent iconography

### Data & State Management
- **TanStack Query:** Server state management, caching, and synchronization
- **React Hook Form:** Form state management with `@hookform/resolvers` for validation
- **Zod:** Schema validation and TypeScript type inference
- **Drizzle ORM & Drizzle Zod:** Database ORM with Zod schema integration

### Real-time Communication
- **ws (WebSocket):** WebSocket server implementation
- **Custom WebSocket Hook:** Client-side WebSocket connection management with auto-reconnect

### File Upload & Object Storage
- **Uppy:** Modern file uploader with dashboard UI
  - **@uppy/core:** Core upload functionality with progress tracking
  - **@uppy/react:** React integration components
  - **@uppy/dashboard:** Drag-and-drop upload interface with Norwegian translations
  - **@uppy/aws-s3:** Direct upload to cloud storage via presigned URLs
- **Replit Object Storage:** Built-in cloud storage for uploaded files
  - **@google-cloud/storage:** GCS client for Replit's object storage backend
  - **ObjectStorageService:** Custom service layer for upload URL generation and file serving
  - **ObjectAcl:** Access control layer for public/private file permissions
- **Upload Flow:**
  1. Client requests presigned upload URL from `/api/objects/upload`
  2. File uploaded directly to object storage via PUT request
  3. Server normalizes object path via `/api/campaign-logo`
  4. Logo URL updated in application state
  5. Uploaded logos served via `/objects/:objectPath` endpoint

### Development Tools
- **Vite:** Development server with HMR and optimized builds
- **esbuild:** Fast JavaScript/TypeScript bundler for server code
- **tsx:** TypeScript execution for development
- **Replit Plugins:** Development banner, cartographer, and runtime error overlay for Replit environment

### Database (Configured but Optional)
- **Neon Serverless PostgreSQL:** Configured via `@neondatabase/serverless`
- **Drizzle Kit:** Database migrations and schema management
- **Connection:** PostgreSQL via `DATABASE_URL` environment variable
- **Note:** Current implementation uses PostgreSQL for campaigns and events storage; database infrastructure fully integrated with campaign system

### Build & Deployment Configuration
- **Development:** `tsx` runs TypeScript directly with hot reload
- **Production:** Vite builds client, esbuild bundles server into `dist/`
- **Static Assets:** Client builds to `dist/public`, served by Express in production
- **Environment:** `NODE_ENV` controls development vs production behavior