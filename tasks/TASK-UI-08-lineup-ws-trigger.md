# TASK-UI-08 — Lineup WebSocket trigger + dashboard toggle

## Context
The Swift SDK is ready to receive a `lineup_show` WebSocket event and render the starting XI
in the All-feed timeline at the correct `videoTimestamp`.

This task implements the backend side:
1. Per-broadcast toggle `showLineup` in the dashboard
2. Auto-trigger of `lineup_show` WS event 10 minutes before broadcast start
3. Manual "Send now" button in dashboard (for demo use)

---

## Backend changes

### 1. DB — add column to `broadcasts`

```sql
ALTER TABLE broadcasts ADD COLUMN show_lineup BOOLEAN NOT NULL DEFAULT false;
```

### 2. Schema / ORM (Drizzle)

In `shared/schema.ts` (`broadcasts` table):
```ts
showLineup: boolean('show_lineup').notNull().default(false),
```

### 3. PATCH /api/broadcasts/:id — accept showLineup

Already does deep-merge on metadata. Add `showLineup` to the updateable fields:
```ts
const { showLineup, ...otherFields } = req.body;
if (showLineup !== undefined) updateData.showLineup = showLineup;
```

### 4. Auto-trigger scheduler

In server startup (or a cron-like interval every 60 s), check:
```
For each broadcast where status = 'live' AND showLineup = true AND broadcastStartTime IS NOT NULL:
  if (now >= broadcastStartTime - 10 min) AND lineup not yet sent:
    broadcast WS event lineup_show
    mark lineupSent = true (in-memory map, reset on server restart)
```

WS payload:
```json
{
  "type": "lineup_show",
  "videoTimestamp": 1200,
  "kickoffVideoTimestamp": 1800,
  "broadcastId": "<externalId>",
  "leadTimeSeconds": 600
}
```

### How to calculate videoTimestamp (IMPORTANT)

The stream may start 5, 15, or 30+ minutes before kickoff.
`videoTimestamp` is ALWAYS relative to stream start (seconds since broadcast went live).
NEVER hardcode -600.

```ts
// broadcastStartedAt: when broadcast status changed to "live" (Date)
// kickoffAt: Sportmonks fixture starting_at (Date)
// leadTimeSeconds: how many seconds before kickoff to show lineup (e.g. 600 = 10 min)

const now = Date.now();
const kickoffAt = new Date(fixture.starting_at).getTime();
const broadcastStartedAt = new Date(broadcast.started_at).getTime(); // see note below

// Seconds into the video where kickoff occurs
const kickoffVideoTimestamp = Math.max(0, (kickoffAt - broadcastStartedAt) / 1000);

// When to show lineup in video time
const videoTimestamp = Math.max(0, kickoffVideoTimestamp - leadTimeSeconds);

// Example: stream starts 20 min before kickoff, lead = 10 min
//   kickoffVideoTimestamp = 1200, videoTimestamp = 600
// Example: stream starts AT kickoff, lead = 10 min
//   kickoffVideoTimestamp = 0, videoTimestamp = 0 (show immediately)
```

### Add `started_at` to broadcasts

Add column to track when the broadcast actually went live:
```sql
ALTER TABLE broadcasts ADD COLUMN started_at TIMESTAMPTZ;
```
Set it automatically when `status` changes to `"live"`:
```ts
if (req.body.status === 'live' && broadcast.status !== 'live') {
  updateData.startedAt = new Date();
}
```
If `started_at` is null (not yet live), do not send lineup_show yet.

### 5. Manual "Send lineup now" endpoint (for demo)

```
POST /api/broadcasts/:id/send-lineup
→ broadcasts lineup_show via WS immediately with videoTimestamp = <current video time or 0>
→ 400 if showLineup is false
→ 404 if broadcast not found
```

---

## Dashboard changes (React)

In `client/src/components/broadcast-detail.tsx`, add a "Lineup" section:

```
┌─────────────────────────────────────────┐
│ 🏟️  Lineup                              │
│                                         │
│  [  ] Show lineup to viewers            │
│       (Auto-sends 10 min before start)  │
│                                         │
│  [Send lineup now ▶]   (manual trigger) │
│                                         │
│  Status: Not yet sent / Sent at 14:23   │
└─────────────────────────────────────────┘
```

- Toggle `showLineup` calls `PATCH /api/broadcasts/:id { showLineup: true/false }`
- "Send lineup now" calls `POST /api/broadcasts/:id/send-lineup`
- Show status badge (Not sent / Sent)
- If no Sportmonks fixture linked → show warning: "Link a Sportmonks fixture first"

---

## WS broadcast format

Broadcast to all connected clients on channel `/ws/:campaignId`:

```json
{
  "type": "lineup_show",
  "videoTimestamp": -600,
  "broadcastId": "newcastle-united-vs-fc-barcelona-2026-03-10"
}
```

---

## Notes
- `lineup_show` requires `sportmonks_fixture_id` to be set on the broadcast
- If fixture is missing, return `{ success: false, error: "No fixture linked" }` from send-lineup
- The SDK fetches lineup data independently from `/v1/sdk/broadcasts/:id/lineup` (TASK-UI-07)
- `lineup_show` only tells the SDK *when* to display it — not the data itself
- In-memory `lineupSent` map is acceptable (resets on restart, demo-safe)

---

## Priority
High — needed before UCL Mar 11 demo night.

## Depends on
- TASK-UI-07 (lineup endpoint from Sportmonks) — must be deployed first
