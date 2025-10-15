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
- **Client Tracking:** Real-time client count per campaign.
- **Logging:** Custom middleware for API request logging.
- **Validation:** Server-side validation for `campaignId` before broadcasting.
- **Integration APIs:** Mock endpoint for Reachu.io channels, Tipio livestream data stored as JSON.

### Database Schema

**Campaigns Table:**
- Basic fields: `id`, `name`, `logo`, `description`, `createdAt`.
- Scheduling: `startDate`, `endDate`.
- Integrations: `reachuChannelId`, `reachuApiKey`, `tipioLiveshowId`, `tipioLivestreamData` (JSON object for Tipio configuration).

**Scheduled Components Table:**
- Linked to `campaignId` (cascade delete).
- Fields: `component type` (carousel, store_view, product_spotlight, liveshow_trigger), `scheduledTime`, `data` (JSON config), `status` (pending, sent, cancelled).
- Component Schemas: Carousel, Store View, Product Spotlight, Liveshow Trigger with specific configuration fields.

### Data Flow & Event System

**Event Types:**
- Product Events (with `productId`, `name`, `pricing`, `images`)
- Poll Events (with multiple choices, optional images)
- Contest Events (with prizes, participation limits)

**Schema Validation:** Zod schemas in `shared/schema.ts` for runtime and compile-time validation.

**Event Lifecycle:** Admin creates event -> Server validates and stores in PostgreSQL -> Event broadcast to WebSocket clients in real-time.

**Historical Events:** Persisted events retrieved via `/api/events?campaignId=X`, merged with real-time events, with duplicate prevention.

### Page Structure

- **Campaigns Page (`/` or `/campaigns`):** Dashboard for managing campaigns, creating new ones, and accessing admin/advanced settings.
- **New Campaign Page (`/campaigns/new`):** Form for creating new campaigns with basic info, optional Reachu.io integration, and optional Tipio Livestream integration.
- **Campaign Admin Page (`/campaign/:id/admin`):** Campaign-specific dashboard for creating and broadcasting various event types (products, polls, contests). Features form state persistence, poll options with images, logo configuration (URL/upload), real-time event log, and connection status.
- **Campaign Viewer Page (`/campaign/:name/:id`):** Real-time event display for viewers, with notifications and event history.
- **Legacy Admin (`/admin`) & Viewer (`/viewer`) Pages:** Backward-compatible pages using campaign ID 0.
- **Advanced Campaign Page (`/campaign/:id/advanced`):** Tabbed interface for extended management: Overview (scheduling), Integrations (Reachu/Tipio), Components (scheduled components with timeline view).
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