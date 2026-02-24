# Vio - Real-Time Event Broadcasting Platform

## Overview

Vio is a real-time event broadcasting platform designed for multi-campaign management. It enables administrators to create campaigns with custom sponsor branding and manage real-time broadcasts that include interactive elements like polls, contests, ads, and shoppable products. The platform aims to provide a scalable solution for interactive audience engagement, supporting multi-tenant SaaS for agencies and brands to manage their client applications, channels, and campaigns with data isolation.

## User Preferences

Preferred communication style: Simple, everyday language (Spanish).
Publishing rule: Every time the app is published, update the `.cursorrules` file with the latest project details, architecture changes, new endpoints, and any relevant implementation notes.

## System Architecture

### Design System

Vio employs a monochromatic dark theme. The primary background is `#0a0e1a`, with cards and surfaces at `#141824`. Text is primarily white, with `text-gray-400` for secondary and `text-gray-500` for muted text. Accent colors use white backgrounds with dark text. The system strictly avoids blue/purple gradients. Icons are exclusively from Lucide React, and the font is Inter. Status badges are distinctively styled for "Live," "Upcoming," and "Ended" states, and broadcast elements (Polls, Contests, Ads) are color-coded in blue, purple, and green, respectively.

### Technical Implementation

The platform is built with a full-stack TypeScript environment.

**Frontend:**
- **Framework:** React 18 with Vite
- **Styling:** Tailwind CSS, Radix UI, and shadcn/ui
- **State Management:** TanStack Query v5
- **Routing:** Wouter
- **Real-time:** Custom `useWebSocket` hook
- **Forms:** React Hook Form with Zod validation
- **Icons:** Lucide React
- **File Upload:** Uppy with AWS S3 multipart support

**Backend:**
- **Runtime:** Node.js + Express.js
- **Database:** PostgreSQL (Neon Serverless) with Drizzle ORM
- **WebSockets:** `ws` library, providing isolated channels per campaign.
- **Authentication:** JWT Bearer tokens for admin APIs and API key validation for SDK endpoints.
- **Object Storage:** Replit Object Storage for file uploads.
- **Scheduler:** In-memory interval-based service for component activation/deactivation.

### Feature Specifications

- **Broadcast Detail Page:** All data is real (no hardcoded mocks). Queries `/api/broadcasts/:id/ads`, `/api/broadcasts/:id/products`, `/api/broadcasts/:id/chat`, `/api/broadcasts/:id/analytics`. Live chat sidebar with functional send button. Analytics tab shows real poll/contest/viewer data. "Load Demo" button seeds real data via `/api/seed-demo`. Event timeline built from real polls and contests.
- **Component Library:** A grid-based library for reusable UI components, allowing filtering and providing integration code snippets (e.g., iOS Swift). Components can be instanced multiple times per campaign with unique configurations.
- **Campaign Dashboard:** A tabbed interface for campaign management, including overview, events, scheduled components, integrations, and settings. Analytics tab now shows real broadcast performance data (total broadcasts, live count, total/peak viewers, per-broadcast table).
- **Sponsor Management:** CRUD operations for sponsors, including logo/avatar uploads and color configuration, linked to campaign branding.
- **Geographic Targeting & User Segmentation:** Server-side features for segmenting users based on location and other criteria, using deterministic hashing for consistent assignment.
- **Admin Panel:** Forms for polls/products/contests now start empty (no Apple/PSG demo data). Data loads from DB via form state API.
- **App Detail:** Stats cards no longer show hardcoded trend percentages (↑12%, ↑8%, etc.).

### Database Tables

New tables added in this session:
- `broadcast_ads` — ads linked to broadcasts (name, description, imageUrl, ctaUrl, adType, duration, isActive, displayOrder)
- `broadcast_products` — shoppable products per broadcast (name, subtitle, price/originalPrice as varchar, buyUrl, status, displayOrder)
- `chat_messages` — live chat messages per broadcast (username, message, createdAt)
- Broadcasts table extended with `viewerCount` and `peakViewers` integer columns

### API Architecture

- **Dashboard APIs (`/api/*`):** Session-based, for internal dashboard operations, including CRUD for core entities, campaign configuration, broadcast management, and file uploads.
- **Admin APIs (`/v1/*`):** Secured with JWT Bearer tokens, providing full CRUD for broadcasts, polls, and contests.
- **SDK APIs (`/v1/sdk/*` and `/v1/engagement/*`):** Authenticated via API keys, enabling campaign auto-discovery, configuration retrieval for SDKs, engagement actions (voting, contest participation), offer retrieval with targeting, and localization strings.

## External Dependencies

- **UI & Styling:** Radix UI, Tailwind CSS, class-variance-authority, clsx, Lucide React.
- **Data & State Management:** TanStack Query v5, React Hook Form, Zod, Drizzle ORM, Drizzle Zod.
- **Real-time Communication:** `ws` (WebSocket library).
- **File Upload & Object Storage:** Uppy (with `uppy/react`, `uppy/aws-s3`), Replit Object Storage.
- **Development Tools:** Vite, esbuild, tsx.
- **Database:** Neon Serverless PostgreSQL (via `@neondatabase/serverless`), Drizzle Kit.