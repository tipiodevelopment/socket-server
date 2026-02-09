# Real-Time Event Broadcasting System

## Overview

This project is a real-time event broadcasting application for multi-campaign management. It enables administrators to create campaigns and broadcast various real-time events (products, polls, contests) to viewers. The system provides a robust, scalable solution for interactive real-time audience engagement using a full-stack TypeScript environment with a React frontend, an Express backend, and WebSocket-based communication. It features isolated WebSocket channels per campaign, persistent configuration and event storage in PostgreSQL, and a dynamic UI component library. The architecture supports multi-tenant SaaS, allowing different users (agencies/brands) to manage their client applications, channels, and campaigns with complete data isolation.

## User Preferences

Preferred communication style: Simple, everyday language.

## System Architecture

### UI/UX Decisions
The frontend uses React 18 with TypeScript and Vite, styled with Tailwind CSS, and built with Radix UI primitives and shadcn/ui. The design incorporates a premium gradient background, glass morphism, vibrant blue accents, Inter font, and a borderless, fully responsive design for various screen sizes (320px - 768px).

### Technical Implementations
**Frontend:**
- **State Management:** TanStack Query.
- **Routing:** Wouter.
- **Real-time:** Custom `useWebSocket` hook.
- **Type Safety:** Shared Zod schemas.
- **Component Architecture:** Modular, self-contained dashboard tab components.

**Backend:**
- **Runtime:** Node.js with Express.js.
- **WebSockets:** `ws` library.
- **Database:** PostgreSQL with Drizzle ORM.
- **Scheduler Service:** Automates component activation/deactivation.
- **RESTful Event API:** Manages campaign events, persisting to PostgreSQL and broadcasting via WebSocket.

### Feature Specifications
- **Campaign Management:** Full CRUD operations for campaigns, including lifecycle management (start/end dates, pause state). Supports master control for pausing/resuming campaigns.
- **WebSocket Architecture:** Isolated channels per campaign (`/ws/:campaignId`).
- **Dynamic Component Management:**
    - A library of reusable UI components (e.g., Banner, Countdown, Product Spotlight).
    - Components can be activated/deactivated manually or via scheduling.
    - Supports multiple instances of base templates with unique configurations per campaign.
    - Real-time updates via WebSockets and deeplink support for CTAs.
- **Event Broadcasting:** Supports Product, Poll, and Contest events. Events are validated by Zod, stored in PostgreSQL, and broadcast to campaign-specific WebSocket clients.
    - **Saved Events with Smart Deduplication:** Displays the most recent version of unique events in the UI, while retaining full history in the database.
    - **Template Component Multi-Campaign Support:** Allows template components to be added to multiple campaigns simultaneously.
    - **Geographic Targeting & User Segmentation:** Server-side segmentation using database fields (`isSegmented`, `targetCountries`, `targetPercentage`) and deterministic hashing for consistent user assignment. Filters offers based on user location and segmentation rules.
- **Broadcast Management:** Supports creating, managing, and tracking the status of broadcasts (upcoming, live, ended). Integrates with a scheduler for automatic status transitions. Includes endpoints for managing polls and contests, and real-time WebSocket events for updates (e.g., poll results, broadcast status).

### System Design Choices
- **Multi-Tenant SaaS Architecture:** Four-level hierarchy (Users → Client Apps → Channels → Campaigns) with complete data isolation and indexed foreign keys for optimized queries.
- **Database Schema:** `Users`, `Client Apps`, `Channels`, `Campaigns`, `Components`, `Campaign Components` tables manage the hierarchical structure and relationships.
- **SDK Integration Endpoints:**
    - **`/v1/sdk/campaigns`**: Auto-discovery of active campaigns for a client app, supporting API key or bundle ID authentication, and optional `matchId` filtering.
    - **`/v1/sdk/config`**: Returns campaign configuration for Swift SDK, including components, deeplinks, branding, and optional `matchContext`.
    - **`/v1/offers`**: Returns active product offers filtered by user targeting, with optional `userId` and `userCountry` parameters for segmentation.
    - All asset URLs enforced as HTTPS.
    - **Match Context Support:** Campaigns and components can be associated with external matches (sports events) with dedicated database fields and WebSocket event inclusion.
- **Broadcast Management System:** Dedicated tables (`broadcasts`, `polls`, `poll_options`, `poll_votes`, `contests`, `contest_participations`) with auto-generated slugs for broadcast IDs. Features admin APIs with JWT authentication for CRUD operations, and SDK APIs for listing, engaging, and participating in broadcasts. Polls and contests support video-relative scheduling fields (`videoStartTime`, `videoEndTime`, `scheduledStartTime`, `scheduledEndTime`) for future video timing integration.
- **Dynamic Configuration System:** New database tables (`campaign_translations`, `campaign_engagement_config`, `campaign_ui_config`, `campaign_feature_flags`, `sdk_translations`) to manage comprehensive dynamic configurations for SDK campaigns. Provides SDK endpoints (`/v1/campaigns/{campaignId}/config`, `/v1/engagement/config`, `/v1/localization/{language}`) and dashboard UI for managing brand, engagement, UI theme, and feature flags. Broadcasts `config:updated` WebSocket events upon changes.
- **Page Structure:** Dedicated pages for Campaigns (listing), Campaign Dashboard (overview, events, scheduled, components, integrations, settings), Campaign Viewer (public-facing), Components Library, Broadcasts (listing), Broadcast Detail (overview, polls, contests), and Docs.
- **Future Infrastructure Scaffolding:**
    - `server/queue/`: Message queue scaffolding (types, queues, workers) prepared for BullMQ/Redis integration.
    - `server/services/`: Extracted vote/contest processing logic ready for async worker execution.
    - `server/middleware/rate-limiter.ts`: Rate limiting middleware (passthrough until Redis is available).
    - `server/middleware/broadcast-validator.ts`: BroadcastId validation middleware.
    - `server/utils/scheduling.ts`: Video-relative timestamp calculation utilities.
    - `client/src/components/scheduling/`: SchedulingForm, VideoTimeInput, TimelineView components (prepared, not integrated).

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