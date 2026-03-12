# Vio - Real-Time Event Broadcasting Platform

## Overview
Vio is a multi-tenant SaaS platform for managing real-time event broadcasts with interactive audience engagement features like polls, contests, ads, and shoppable products. It allows administrators to create and manage broadcasts with custom sponsor branding. The platform supports multi-tenant use cases for agencies and brands, ensuring data isolation for client applications, channels, and campaigns. The business vision is to provide a comprehensive solution for interactive live event broadcasting, enhancing audience engagement and offering significant market potential for brands and content creators.

## User Preferences
- Preferred communication style: Simple, everyday language (Spanish).
- Publishing rule: Every time the app is published, update the `.cursorrules` file with the latest project details, architecture changes, new endpoints, and any relevant implementation notes.

## System Architecture

### Design System
The platform utilizes a monochromatic dark theme:
- **Background:** `#0a0e1a`
- **Cards/Surfaces:** `#141824` with `border-white/10`
- **Text:** White primary, `text-gray-400` secondary, `text-gray-500` muted
- **Accent:** White background with black text for active elements
- **Status Badges:** Teal for Live (with pulse), bordered for Upcoming, low opacity for Ended
- **Broadcast Element Colors:** Blue for polls, Purple for contests, Green for ads
- **Icons:** Lucide React
- **Font:** Inter

### Technical Stack
**Frontend:** React 18, Vite, TypeScript, Tailwind CSS, Radix UI, shadcn/ui, TanStack Query v5, Wouter routing, React Hook Form, Zod, Lucide React, Recharts, Uppy.
**Backend:** Node.js, Express.js, TypeScript, PostgreSQL (Neon Serverless) via Drizzle ORM, `ws` WebSockets, in-memory scheduler.
**Auth:** Session-based for Dashboard (`/api/*`), JWT Bearer tokens for Admin APIs (`/v1/*`), API key for SDK APIs (`/v1/sdk/*`, `/v1/engagement/*`).

### Project Structure
The project is structured with a `shared` directory for schemas, `server` for API logic and services, and `client` for the React frontend. Key components include `App.tsx` for routing, `AppLayout.tsx` for the main shell, and dedicated directories for UI components, dashboard features, and pages.

### Data Model Hierarchy
The data model is organized hierarchically: `Users → Client Apps → Campaigns → Broadcasts → Polls / Contests / Ads / Products` and `Campaign Components`. Sponsors are linked to campaigns.

### API Architecture
- **Dashboard APIs (`/api/*`):** Session-based, internal CRUD operations.
- **Admin APIs (`/v1/*`):** JWT authenticated, full control over broadcast elements.
- **SDK APIs (`/v1/sdk/*`, `/v1/engagement/*`):** API key authenticated, for campaign discovery, configuration, and engagement actions.
- **Analytics APIs (`/api/analytics/*`):** Session-based, for hierarchical analytics data.

### Feature Specifications
- **Campaign Management:** Multi-tenant support with sponsor branding and audience targeting.
- **Broadcast Management:** Real-time scheduling, activation, monitoring, and integration with Sportmonks fixtures.
- **Interactive Components:** Real-time polls, contests, shoppable ads, and banners via WebSockets.
- **Event Timeline:** Horizontal 0'-90' scrubber merging Sportmonks and engagement events.
- **Commerce Integration:** Sponsor-specific Commerce API keys for shoppable ads.
- **Sportmonks Integration:** Fixture selection, server-side proxy with caching, and display of match data.
- **Location Slot System:** `campaign_components.locationId` for dynamic SDK content placement.
- **User Segmentation:** Server-side geographic targeting.
- **Analytics:** Drill-down from global to specific broadcast levels.
- **SDK:** Two-step initialization for campaign and broadcast content.

### Key Pages
Core routes include a dashboard, client app management, campaign lists and detailed views, broadcast lists and details, sponsor management, component library, and analytics. Campaign details feature tabs for Overview, Broadcasts, Components, Sponsors, Analytics, and Settings.

## External Dependencies

- **UI:** Radix UI, Tailwind CSS, shadcn/ui, Lucide React, Recharts
- **Data Management:** TanStack Query v5, React Hook Form, Zod, Drizzle ORM, Drizzle Zod, Drizzle Kit
- **Real-time:** `ws` WebSocket library
- **File Upload:** Uppy (`uppy/react`, `uppy/aws-s3`), Replit Object Storage
- **Database:** Neon Serverless PostgreSQL (`@neondatabase/serverless`)
- **Sports Data:** Sportmonks API v3 (`SPORTMONKS_API_TOKEN`)
- **Commerce:** External GraphQL API at `graph-ql-dev.vio.live/graphql`