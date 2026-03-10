# TASK-UI-08 — COMPLETED (2026-03-10)

## What was implemented
- Added `showLineup: boolean` and `startedAt: timestamp` columns to `broadcasts` table in shared/schema.ts
- Ran `npm run db:push` to apply DB changes
- PUT /api/broadcasts/:broadcastId now accepts `showLineup` field
- Auto-sets `startedAt` when status changes to 'live' for the first time
- POST /api/broadcasts/:broadcastId/send-lineup sends `lineup_show` WS event with calculated videoTimestamp
- LineupSection in broadcast-detail.tsx upgraded with:
  - "Show lineup to viewers" toggle (Switch) — PATCH via PUT /api/broadcasts/:id
  - "Send lineup now" button — POST /api/broadcasts/:id/send-lineup
  - Status display: 'Not yet sent' / 'Sent at HH:MM'
  - Button disabled when showLineup=false

## E2E Verified
All flows verified: toggle on/off, send lineup, status text update, button disable state.
