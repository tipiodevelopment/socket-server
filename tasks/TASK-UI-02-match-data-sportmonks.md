# TASK-UI-02 — Match Data: SDK Demo Events → Dashboard

**Owner:** Replit  
**Status:** Ready to implement  
**Context:** Viobot is seeding the matchEvents JSON via API in parallel.

---

## Summary

The SDK (VioSwiftSDK) has rich demo match event data for Barcelona-PSG and El Clásico.
We need to:
1. Seed this data into the broadcast `metadata.matchEvents` in the backend
2. Replace the manual Match Data form in broadcast-detail with a read-only match card
3. Enforce fixture linking on Create Broadcast

Viobot will call the backend API to seed the `matchEvents` JSON directly.
Replit should focus on the UI/UX changes and the new MatchDataCard component.

---

## Part 1 — Remove manual Match Data form

In `client/src/pages/broadcast-detail.tsx`:
- **Remove** the "Match Data" section (the form with home/away team text inputs, score spinners, minute, status dropdown, "Update Score & Send Live" button)
- **Replace** with `<MatchDataCard broadcastId={...} />` (see Part 2)
- **New position:** directly below `<EventTimeline>`, above `<ActiveEngagement>`

---

## Part 2 — MatchDataCard component (read-only)

New file: `client/src/components/match-data-card.tsx`

Data source: `broadcast.metadata.matchEvents` (already in DB, seeded by Viobot)
Supplemented by: `broadcast.homeTeamName`, `broadcast.awayTeamName`, `broadcast.homeTeamLogo`, `broadcast.awayTeamLogo`

### Display layout:

```
┌─────────────────────────────────────────────────────────┐
│  Match                                                   │
│                                                         │
│  [logo] Home Team    1  —  0    Away Team [logo]        │
│                    Fulltime                             │
│                                                         │
│  Match Events                                           │
│  ▶ 0'   Avspark                                        │
│  ⚽ 13'  A. Diallo (1-0)  assist: Bruno Fernandes      │
│  🟡 18'  Casemiro — Falta táctica                      │
│  ⚽ 32'  B. Mbeumo (2-0)  assist: Diogo Dalot          │
│  ⏸ 45'  Pause                                          │
│  ⚽ 67'  Griezmann (1-0)  assist: Félix                │
│  ⏹ 90'  Fulltid — 2-0                                  │
└─────────────────────────────────────────────────────────┘
```

### Event types to render (from matchEvents array):
| type | icon | what to show |
|------|------|--------------|
| kickoff | ▶️ | minute + label |
| goal | ⚽ | minute + player + score + assist (if present) |
| yellowcard | 🟡 | minute + player + reason (if present) |
| redcard | 🔴 | minute + player |
| substitution | 🔄 | minute + playerIn + playerOut |
| halftime | ⏸ | "Pause" |
| fulltime | ⏹ | "Fulltid — {score}" |

Only render key events (kickoff, goal, yellowcard, redcard, substitution, halftime, fulltime).
Do NOT render polls, tweets, chats, commentary in this card.

### If no matchEvents in metadata → render nothing (null).

---

## Part 3 — Seed endpoint (for Viobot to call)

New or existing: `PATCH /api/broadcasts/:broadcastId` should accept `metadata` merge.

If not already supported, add:

```ts
// In routes.ts, PATCH /api/broadcasts/:id
// Deep merge metadata instead of replace
const existing = broadcast.metadata || {}
const merged = { ...existing, ...body.metadata }
await storage.updateBroadcast(id, { metadata: merged })
```

Viobot will call this with the full `matchEvents` array for each demo broadcast.

---

## Part 4 — Enforce fixture on Create Broadcast

In the Create/Edit Broadcast modal:
- `sportmonks_fixture_id` field → mark as required, block submit if empty
- `externalId` (Viaplay/TV2 contentId) → mark as required, block submit if empty
- Error message: "A match and external content ID are required to create a broadcast"

---

## Demo broadcasts Viobot will seed:

| broadcastId | Match | Events |
|-------------|-------|--------|
| `viaplay-atletico-psg-2026-03-08` | Atlético Madrid vs PSG | Based on SDK BarcelonaPSG timeline adapted |
| `tv2-eliteserien-live-2026-03-08` | Brann vs Molde | Adapted Eliteserien events |

---

## Acceptance criteria

- [ ] Manual Match Data form removed from broadcast detail
- [ ] MatchDataCard renders below timeline, above Active Engagement
- [ ] MatchDataCard shows home/away logos + score + key match events
- [ ] MatchDataCard returns null if no matchEvents in metadata
- [ ] PATCH /api/broadcasts/:id supports metadata merge
- [ ] Create Broadcast blocks submit without fixture ID + externalId
