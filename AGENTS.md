# AGENTS.md

This file provides guidance to Codex (Codex.ai/code) when working with code in this repository.

## Project Overview

Vio is a multi-tenant SaaS platform for real-time event broadcasting with interactive engagement (polls, contests, shoppable ads, live chat). Built with React + Express + PostgreSQL + WebSockets, designed for iOS/Android SDK integration.

This repo (`vio-backend`, formerly `socket-server`) is the Vio platform backend.

## Commands

All commands run from the repo root:

```bash
# Development
npm run dev                # Start dev server (tsx, port 5000)
npm run build              # Vite (frontend) + esbuild (backend) → dist/
npm run start              # Production: node dist/preserver.js
npm run check              # TypeScript type-check

# Database
npm run db:push            # Push Drizzle schema to Neon DB
npm run db:seed            # Seed dev data

# Tests
npm run test               # Jest
npm run test:watch         # Watch mode
npm run test:coverage      # Coverage report
```

## Architecture

### Three-layer API

| Layer | Path | Auth | Consumer |
|-------|------|------|----------|
| Dashboard | `/api/*` | Session (express-session) | React SPA |
| Admin | `/v1/*` | JWT Bearer (`Authorization: Bearer <token>`) | External admin |
| SDK | `/v1/sdk/*`, `/v1/engagement/*` | API Key (`X-Api-Key` header or `?apiKey=`) | Mobile SDKs |
| Analytics | `/api/analytics/*` | Session | React SPA |

### Key source files

- `server/routes.ts` — All API routes (~6000 lines, single file)
- `server/storage.ts` — `IStorage` interface + `DatabaseStorage` implementation. All DB ops go through this.
- `shared/schema.ts` — Drizzle table definitions + Zod validation schemas (shared between client/server)
- `server/analytics.ts` — Direct SQL queries for analytics endpoints
- `server/redis.ts` — Redis cache, rate limiting, user presence, pub/sub
- `server/services/vote-processor.ts` — Vote queue processing
- `server/services/contest-processor.ts` — Contest participation processing
- `server/services/ios-flow.ts` — APNs push notifications
- `server/scheduler.ts` — Auto-activate/deactivate components on schedule
- `client/src/App.tsx` — Wouter router with all frontend routes

### WebSocket

Campaign-isolated channels at `/ws/:campaignId`. Events: `broadcast_started`, `poll_created`, `poll_updated`, `poll_closed`, `contest_created`, `ad_triggered`, `chat_message`, etc. Heartbeat ping every 30s, presence tracked in Redis with 90s TTL.

### Data model hierarchy

```
Users → ClientApps (bundleId, apiKey)
  → Campaigns (targeting, segmentation, sponsor)
    → Broadcasts (externalId, sportmonks fixture)
      → Polls, Contests, Ads, Products, Chat
    → CampaignComponents (scheduled activation)
```

### SDK two-step flow

1. App launch: `GET /v1/sdk/campaigns` (returns active campaigns + components)
2. Content open: `GET /v1/sdk/broadcast?contentId=xxx&country=NO` (resolves externalId → broadcast with engagement data)

## Tech Stack

- **Frontend**: React 18, Vite, Tailwind CSS, shadcn/ui (Radix), TanStack Query v5, Wouter, Recharts
- **Backend**: Express, TypeScript, Drizzle ORM, Neon Serverless PostgreSQL, `ws` WebSockets
- **Cache**: Redis (ioredis) with in-memory fallback
- **Infra**: Docker (Node 20), GitHub Actions → Azure AKS, also deployed on Replit

## Conventions

- All DB operations go through `IStorage` interface (except analytics which uses raw SQL)
- Validation uses Zod schemas from `shared/schema.ts` — define once, validate on both sides
- Frontend uses TanStack Query with `staleTime=Infinity` and manual invalidation after mutations
- Rate limiting: Redis-backed sorted sets, falls back to in-memory Map
- Icons: Lucide React only
- Routing (frontend): Wouter (`Link`, `useLocation`, `useParams`)
- Auth middleware: `requireBearerAuth` (JWT), `requireApiKeyAuth` (API key), session-based (dashboard)

## Deployment

- Push to `develop` branch triggers GitHub Actions → Docker build → AKS deploy
- Health endpoints: `/health`, `/_health`
- WebSocket connections require Reserved VM deployment (not Autoscale)
- Env downloaded from Azure Storage at Docker runtime
