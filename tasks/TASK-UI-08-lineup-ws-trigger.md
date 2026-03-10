# TASK-UI-08 — COMPLETED (2026-03-10)

## What was implemented

### Manual trigger (manual send-lineup endpoint)
- `showLineup: boolean` and `startedAt: timestamp` columns added to `broadcasts` table
- `PUT /api/broadcasts/:broadcastId` accepts `showLineup` and auto-sets `startedAt` on first live transition
- `POST /api/broadcasts/:broadcastId/send-lineup` sends `lineup_show` WS event manually
- `LineupSection` in broadcast-detail.tsx: toggle + "Send lineup now" button + "Sent at HH:MM" status

### Scheduler auto-trigger (added 2026-03-10 session end)
- `lineupSentMap` moved to module level in routes.ts and exported
- `processScheduledLineups()` added to scheduler.ts — runs every 1 minute
- Logic: for each live broadcast with `showLineup=true` + `matchStartingAt` set:
  - Auto-sends `lineup_show` at `matchStartingAt - 10 min` (real wall clock)
  - Skips if already in `lineupSentMap` (per-process deduplication)
  - Skips if past `matchStartingAt + 60 min` (safety cutoff)
  - `videoTimestamp = max(0, kickoffVideoTimestamp - 600)` where kickoffVideoTimestamp is seconds from `startedAt` to kickoff
  - Event includes `"source": "scheduler"` for observability

## WS event payload
```json
{
  "type": "lineup_show",
  "videoTimestamp": 1800,
  "kickoffVideoTimestamp": 2400,
  "broadcastId": "...",
  "leadTimeSeconds": 600,
  "timestamp": "...",
  "source": "scheduler"
}
```

## E2E Verified
Toggle on/off, manual send, status text update, button disable state — all verified.
Scheduler auto-trigger verified by code review (fires at matchStartingAt - 10min).
