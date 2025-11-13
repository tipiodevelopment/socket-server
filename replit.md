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

### System Design Choices
- **Database Schema:**
    - `Users`: Stores user information.
    - `Campaigns`: Stores campaign details, scheduling, and pause state.
    - `Components`: Reusable UI component library with `isTemplate` flag.
    - `Campaign Components`: Links `Components` to `Campaigns`, managing activation status, scheduled times, `instanceName`, and `customConfig`.
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