# Vio - Real-Time Event Broadcasting Platform

## Overview

Vio is a real-time event broadcasting platform designed for multi-campaign management. It enables administrators to create and manage real-time broadcasts with custom sponsor branding and interactive elements such as polls, contests, ads, and shoppable products. The platform focuses on scalable, interactive audience engagement, supporting multi-tenant SaaS for agencies and brands to manage client applications, channels, and campaigns with data isolation. Its core purpose is to facilitate dynamic interaction during live events and campaigns, enhancing audience participation and providing valuable analytics.

## User Preferences

Preferred communication style: Simple, everyday language (Spanish).
Publishing rule: Every time the app is published, update the `.cursorrules` file with the latest project details, architecture changes, new endpoints, and any relevant implementation notes.

## System Architecture

### Design System

Vio employs a monochromatic dark theme. The primary background is `#0a0e1a`, with cards using `#141824`. Text is white, with `text-gray-400` for secondary and `text-gray-500` for muted text. Accent colors utilize white backgrounds with dark text, avoiding blue/purple gradients. Icons are sourced from Lucide React, and the font used is Inter. Status badges are specifically styled for "Live," "Upcoming," and "Ended" states. Broadcast elements are color-coded: polls in blue, contests in purple, and ads in green.

### Technical Implementation

The platform is built using a full-stack TypeScript environment.

**Frontend:**
- **Framework:** React 18 with Vite
- **Styling:** Tailwind CSS, Radix UI, shadcn/ui
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

- **Campaign Management:** Allows creation of campaigns with sponsor branding and interactive elements.
- **Broadcast Management:** Supports real-time broadcast scheduling, activation, and monitoring.
- **Interactive Components:** Includes polls, contests, shoppable ads, and banners for audience engagement.
- **Analytics:** Provides detailed insights into viewer counts, engagement rates, and component performance, with drill-down capabilities.
- **SDK Integration:** Offers a robust SDK for integrating Vio functionalities into client applications, including real-time updates and engagement actions.
- **Commerce Integration:** Features a dedicated "Commerce" module to manage product listings and shoppable ad experiences, with API keys stored per sponsor.
- **Sportmonks Integration:** Seamlessly integrates with Sportmonks API for real-time sports event data, enhancing broadcast content with live match information and event timelines.
- **Location Slot System:** Enables dynamic component placement within client applications via `locationId`.
- **User Segmentation:** Server-side geographic targeting and user segmentation.

### API Architecture

- **Dashboard APIs (`/api/*`):** Session-based for internal CRUD operations and configurations.
- **Admin APIs (`/v1/*`):** Secured with JWT Bearer tokens for full control over broadcasts, polls, and contests.
- **SDK APIs (`/v1/sdk/*` and `/v1/engagement/*`):** API key authenticated for campaign discovery, configuration, and engagement actions.

### Deployment

The platform is deployed using `autoscale`. At current traffic levels, it runs as a single instance, allowing in-memory WebSockets and the scheduler to function effectively. Future scaling to multiple instances will require Redis Pub/Sub for WebSocket broadcasting and BullMQ for the scheduler.

## External Dependencies

- **UI & Styling:** Radix UI, Tailwind CSS, class-variance-authority, clsx, Lucide React.
- **Data & State Management:** TanStack Query v5, React Hook Form, Zod, Drizzle ORM, Drizzle Zod.
- **Real-time Communication:** `ws` (WebSocket library).
- **File Upload & Object Storage:** Uppy (with `uppy/react`, `uppy/aws-s3`), Replit Object Storage.
- **Database:** Neon Serverless PostgreSQL (via `@neondatabase/serverless`), Drizzle Kit.
- **Sports Data:** Sportmonks API v3 (`SPORTMONKS_API_TOKEN`).