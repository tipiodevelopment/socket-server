# Real-Time Event Broadcasting System

## Overview

This is a real-time event broadcasting application built with React, Express, and WebSockets. The system allows administrators to create and broadcast various types of events (products, polls, contests) to connected viewers in real-time. It features a split architecture with an admin dashboard for creating events and a viewer page for displaying them as they happen.

The application demonstrates a modern full-stack TypeScript setup with a Vite-powered React frontend, Express backend, WebSocket communication, and a comprehensive UI component library based on shadcn/ui.

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
- **Memory Storage:** Uses in-memory storage (`MemStorage` class) for events and client tracking. This is suitable for development and demos but not for production with multiple instances. The architecture supports swapping to persistent storage by implementing the `IStorage` interface.
- **WebSocket Path:** WebSocket server mounted on `/ws` path, separate from HTTP routes for clear separation of concerns.
- **Event Broadcasting:** Centralized broadcast function sends messages to all connected clients, with automatic cleanup of disconnected clients.
- **Client Tracking:** Maintains active client count and broadcasts updates to all viewers, providing real-time connection status.
- **Request Logging:** Custom middleware logs API requests with duration and truncated response data for debugging.

### Data Flow & Event System

**Event Types:**
The application supports three event types with strict schemas:
- **Product Events:** E-commerce product announcements with pricing and images
- **Poll Events:** Interactive polls with multiple choice options and duration
- **Contest Events:** Contest announcements with prizes and participation limits

**Schema Validation:**
- Zod schemas in `shared/schema.ts` define event structures
- Runtime validation ensures data integrity
- TypeScript types derived from schemas provide compile-time safety

**Event Lifecycle:**
1. Admin creates event via form submission
2. Server validates event data against schema
3. Event stored in memory (up to 100 recent events)
4. Event broadcast to all connected WebSocket clients
5. Viewers receive and display events in real-time

### Page Structure

**Admin Page (`/admin`):**
- Dashboard for creating and broadcasting events
- Multiple event forms: Add multiple products, polls, and contests with the "+" button
- Each event has its own "Send" button for independent broadcasting
- Remove events with the "X" button (maintains at least 1 form per type)
- Real-time event log showing broadcast history
- Connection status and client count display

**Viewer Page (`/viewer`):**
- Consumer-facing display for receiving events
- Real-time event notifications (with browser Notification API)
- Event history with visual event cards
- Connection status monitoring

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

### Development Tools
- **Vite:** Development server with HMR and optimized builds
- **esbuild:** Fast JavaScript/TypeScript bundler for server code
- **tsx:** TypeScript execution for development
- **Replit Plugins:** Development banner, cartographer, and runtime error overlay for Replit environment

### Database (Configured but Optional)
- **Neon Serverless PostgreSQL:** Configured via `@neondatabase/serverless`
- **Drizzle Kit:** Database migrations and schema management
- **Connection:** PostgreSQL via `DATABASE_URL` environment variable
- **Note:** Current implementation uses in-memory storage; database infrastructure ready for future persistent storage needs

### Build & Deployment Configuration
- **Development:** `tsx` runs TypeScript directly with hot reload
- **Production:** Vite builds client, esbuild bundles server into `dist/`
- **Static Assets:** Client builds to `dist/public`, served by Express in production
- **Environment:** `NODE_ENV` controls development vs production behavior