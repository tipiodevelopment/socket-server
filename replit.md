# Real-Time Event Broadcasting System

## Overview

This project is a real-time event broadcasting application designed for multi-campaign management. It allows administrators to create and manage campaigns, broadcasting various real-time events (products, polls, contests) to viewers. The system features a modern full-stack TypeScript environment with a React frontend (Vite), an Express backend, and WebSocket-based communication. Key capabilities include isolated WebSocket channels per campaign, persistent configuration and event storage in PostgreSQL, and a dynamic UI component library built with shadcn/ui. The project aims to provide a robust, scalable solution for interactive real-time audience engagement.

## User Preferences

Preferred communication style: Simple, everyday language.

## System Architecture

### UI/UX Decisions
The frontend utilizes React 18 with TypeScript and Vite, styled with Tailwind CSS, and uses Radix UI primitives with shadcn/ui for components. The design aesthetic features a premium gradient background, glass morphism, vibrant blue accents, Inter font, and a borderless design. It is fully responsive across mobile and desktop breakpoints (320px - 768px), adapting layouts and interactive elements for optimal viewing and touch interactions.

### Technical Implementations
**Frontend:**
- **State Management:** TanStack Query.
- **Routing:** Wouter.
- **Real-time:** Custom `useWebSocket` hook handles connection and reconnection logic.
- **Type Safety:** Shared Zod schemas ensure type-safe event structures.
- **Localization:** English translation.
- **Navigation:** Back buttons on all sub-pages.

**Backend:**
- **Runtime:** Node.js with Express.js.
- **WebSockets:** `ws` library for real-time communication.
- **Database:** PostgreSQL with Drizzle ORM for data persistence.
- **Build:** esbuild.
- **URL Normalization:** Object storage URLs are automatically converted to absolute URLs for external client compatibility, detecting the base URL from environment variables or the first HTTP request.
- **Logging:** Custom middleware for API request logging.
- **Validation:** Server-side validation for campaign IDs.

### Feature Specifications
- **Campaign Management:** Administrators can create, manage, and delete campaigns. Each campaign can have associated integrations (Reachu.io, Tipio). Campaigns have a lifecycle defined by `startDate` and `endDate`.
- **WebSocket Architecture:** Each campaign (`/ws/:campaignId`) has an isolated WebSocket channel, ensuring events are broadcast only to relevant clients, managed by a `Map<campaignId, Set<WebSocket>>`.
- **Dynamic Component Management:**
    - A library of reusable UI components (e.g., Banner, Countdown, Carousel, Product Spotlight, Offer Badge, Offer Banner) configurable via a REST API.
    - Components can be activated/deactivated manually or scheduled for automatic display within specific campaigns.
    - **Component Type Uniqueness:** Only ONE component of each type can be active at any given time within a campaign. This ensures iOS apps can reliably import components by type without ambiguity (e.g., `activeComponents.first { $0.type == "banner" }` is guaranteed to return at most one result).
        - **Dynamic Components:** Backend validates that no other component of the same type is active before allowing activation
        - **Scheduled Components:** Backend validates that no other component of the same type has overlapping time ranges before allowing creation/update
        - **Error Handling:** Returns 409 Conflict with clear English error messages specifying the conflicting component/schedule
    - **Campaign-Specific Customization:** Each campaign can personalize component configurations (texts, images, links) without affecting the original template or other campaigns. Custom configurations are stored per campaign in `campaignComponents.customConfig`.
        - **UI Controls:** Purple "Customize" button (pencil icon) opens a dialog with all configurable fields
        - **Visual Indicators:** "Customized" badge (purple) appears on components with custom configurations
        - **Revert Functionality:** "Revert to Original" button sets customConfig to null, restoring template defaults
        - **Field Pre-population:** Dialog pre-fills with current values (customConfig || template.config)
        - **Immediate Updates:** Changes reflect in UI immediately after successful mutation
    - Real-time updates via WebSockets (`component_status_changed`, `component_config_updated`, `campaign_ended`) for dynamic display in client applications (e.g., iOS).
    - Prevents a component from being active in multiple campaigns simultaneously.
    - **Deeplink Support:** Components with CTAs (Banner, Offer Banner) support optional deeplinks for in-app navigation. When specified, deeplinks take priority over web links, enabling seamless transitions to specific app screens (e.g., `myapp://offers/weekly`). Supports both custom URL schemes and universal links.
    - Integration documentation with Swift code examples is provided for client-side implementation.
- **Event Broadcasting:** Supports Product, Poll, and Contest events, validated by Zod schemas, stored in PostgreSQL, and broadcast to campaign-specific WebSocket clients in real-time. Historical events are also retrievable.

### System Design Choices
- **Database Schema:**
    - `Users`: Stores user information (id, reachuUserId, firebaseToken) for multi-user architecture.
    - `Campaigns`: Stores campaign details (name, user, logo, description, scheduling, integration IDs).
    - `Scheduled Components`: Manages automated component display with `component type`, `scheduledTime`, `endTime`, `data` (JSON config), and `status`. Supports various component types and flexible end-time configurations.
    - `Components`: Reusable UI component library with `id`, `type`, `name`, and `config` (JSON).
    - `Campaign Components`: Links `Components` to `Campaigns` for real-time activation/deactivation. Includes `customConfig` (JSON, nullable) for campaign-specific configuration overrides. When null, uses the template's default config; when set, takes priority over template config.
- **Page Structure:**
    - **Campaigns Page:** Dashboard for campaign administration.
    - **New Campaign Page:** Form for campaign creation.
    - **Campaign Admin Page:** Campaign-specific dashboard for event broadcasting.
    - **Campaign Viewer Page:** Real-time event display for end-users.
    - **Advanced Campaign Page:** Tabbed interface for Overview, Integrations, Scheduled Components (timeline view), Dynamic Components (real-time toggle controls), and Library (integrated component management).
    - **Components Library Page:** Standalone page for managing reusable components.
    - **Docs Page:** Integration documentation with Swift code examples.

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