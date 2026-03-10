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
  "videoTimestamp": -600,
  "broadcastId": "<externalId>"
}
```

`videoTimestamp: -600` = 10 minutes before kickoff (negative = pre-match).
Use `timeline.currentVideoTime` or a fixed pre-kickoff offset.
If `broadcastStartTime` is null or in the past, use `videoTimestamp: 0`.

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
