# TASK-UI-02 — MatchDataCard: Sportmonks real data in broadcast detail

**Owner:** Replit  
**Status:** Ready — Viobot already seeded fixture data + matchEvents in DB  
**Priority:** HIGH — needed for Viaplay/TV2 demo

---

## Context

We have real Champions League data from Sportmonks for the demo broadcast:
- Fixture `19568482`: FC Barcelona vs Paris Saint Germain, 1 Oct 2025, CL Liguilla
- Result: Barcelona 1–2 PSG (Ferran Torres 19', Mayulu 38', Gonçalo Ramos 90')
- 18 events: goals, cards, substitutions — all real

The broadcast `viaplay-atletico-psg-2026-03-08` now has:
- `sportmonksFixtureId: 19568482`
- `homeTeamName: FC Barcelona`, `homeTeamLogo: <url>`
- `awayTeamName: Paris Saint Germain`, `awayTeamLogo: <url>`
- `metadata.matchEvents`: 18 real events from Sportmonks

---

## PART 1 — New backend endpoint: GET /api/sportmonks/fixture/:id/result

This endpoint fetches live from Sportmonks and formats for the UI.

```ts
GET /api/sportmonks/fixture/:fixtureId/result
// No auth required (public read)
// Cache in memory: 5min for finished matches, 30s for live
```

**Sportmonks call:**
```
GET https://api.sportmonks.com/v3/football/fixtures/:id
  ?include=events.type;participants;scores
  &api_token=hTAp0XE1x7CsBh1yi8g47OQh1dLhGPfygQTf08MnCbCY38dLFc73HuxxYBcJ
```

**Response format:**
```json
{
  "fixtureId": 19568482,
  "homeTeam": {
    "id": 83,
    "name": "FC Barcelona",
    "logo": "https://media.api-sports.io/football/teams/83.png"
  },
  "awayTeam": {
    "id": 591,
    "name": "Paris Saint Germain",
    "logo": "https://media.api-sports.io/football/teams/85.png"
  },
  "homeScore": 1,
  "awayScore": 2,
  "status": "FT",
  "date": "2025-10-01",
  "league": "Champions League",
  "events": [
    { "minute": 0,  "type": "kickoff",      "label": "Avspark" },
    { "minute": 19, "type": "goal",         "label": "Ferran Torres", "score": "1-0", "teamId": 83 },
    { "minute": 32, "type": "yellowcard",   "label": "Frenkie de Jong", "teamId": 83 },
    { "minute": 38, "type": "goal",         "label": "Senny Mayulu",   "score": "1-1", "teamId": 591 },
    { "minute": 44, "type": "yellowcard",   "label": "Nuno Mendes",    "teamId": 591 },
    { "minute": 45, "type": "halftime",     "label": "Pause · 1-1" },
    { "minute": 57, "type": "yellowcard",   "label": "Dani Olmo",      "teamId": 83 },
    { "minute": 78, "type": "yellowcard",   "label": "Marc Casadó",    "teamId": 83 },
    { "minute": 87, "type": "yellowcard",   "label": "Achraf Hakimi",  "teamId": 591 },
    { "minute": 90, "type": "goal",         "label": "Gonçalo Ramos",  "score": "1-2", "teamId": 591 },
    { "minute": 92, "type": "fulltime",     "label": "Fulltid · Barcelona 1-2 PSG" }
  ]
}
```

**Sportmonks type mapping:**
```ts
const typeMap: Record<string, string> = {
  GOAL: 'goal',
  OWNGOAL: 'owngoal',
  YELLOWCARD: 'yellowcard',
  REDCARD: 'redcard',
  SUBSTITUTION: 'substitution',
  VAR: 'var',
  PENALTY: 'penalty',
}
// Score: sum CURRENT scores per participant_id
// home/away determined by participants[].meta.location
```

---

## PART 2 — Remove manual Match Data form

In `client/src/pages/broadcast-detail.tsx`:
- **Delete** the entire "Match Data" section (score inputs, team inputs, minute spinner, status dropdown, "Update Score & Send Live" button)
- This section is ~80 lines starting with `<section>` or `<div>` labeled "Match Data"

---

## PART 3 — New component: MatchDataCard

New file: `client/src/components/match-data-card.tsx`

**Position in broadcast-detail:** directly below `<EventTimeline />`, above `<ActiveEngagement />`

**Props:**
```ts
interface MatchDataCardProps {
  broadcastId: string
  sportmonksFixtureId: number | null
  homeTeamName?: string | null
  homeTeamLogo?: string | null
  awayTeamName?: string | null
  awayTeamLogo?: string | null
}
```

**Behavior:**
- If `sportmonksFixtureId` is null → return null (render nothing)
- On mount → fetch `/api/sportmonks/fixture/:id/result`
- Loading state → show skeleton
- Error state → show nothing (silent fail, don't break the page)

**Visual layout:**
```
┌─────────────────────────────────────────────────────────┐
│  ⚽ Match                   Champions League · Liguilla  │
│─────────────────────────────────────────────────────────│
│  [logo]  FC Barcelona   1 — 2   Paris Saint Germain [logo] │
│                     FT · 1 okt 2025                    │
│─────────────────────────────────────────────────────────│
│  Matchhendelser                                         │
│  ▶ 0'    Avspark                                       │
│  ⚽ 19'  Ferran Torres ─────────────── Barça  1-0      │
│  🟡 32'  Frenkie de Jong               Barça           │
│  ⚽ 38'  Senny Mayulu ──────────────── PSG    1-1      │
│  🟡 44'  Nuno Mendes                   PSG             │
│  ⏸ 45'  Pause · 1-1                                   │
│  🟡 57'  Dani Olmo                     Barça           │
│  🟡 78'  Marc Casadó                   Barça           │
│  🟡 87'  Achraf Hakimi                 PSG             │
│  ⚽ 90'  Gonçalo Ramos ─────────────── PSG    1-2      │
│  ⏹ 92'  Fulltid · 1-2                                 │
│                         [↻ Refresh]  Updated just now  │
└─────────────────────────────────────────────────────────┘
```

**Event icon map:**
```ts
const icons = {
  kickoff: '▶️', goal: '⚽', owngoal: '↩️', yellowcard: '🟡',
  redcard: '🔴', substitution: '🔄', halftime: '⏸', fulltime: '⏹', var: '📺'
}
```

**Only show key events** (filter out substitutions from the list — too noisy):
```ts
const keyEvents = ['kickoff','goal','owngoal','yellowcard','redcard','halftime','fulltime','var']
events.filter(e => keyEvents.includes(e.type))
```

**Team badge** (left/right alignment per team):
- home team events → right-align team badge
- away team events → right-align team badge (different color)
- Use `homeTeam.id === event.teamId` to determine side

---

## PART 4 — Enforce fixture + externalId on Create Broadcast

In the Create/Edit Broadcast modal:
- `sportmonks_fixture_id` → **required**. Remove "optional" label. Block submit if empty. Show: "Velg en kamp fra Sportmonks"
- `externalId` → **required**. Label: "Content ID (Viaplay/TV2)". Block submit if empty. Show: "Påkrevd for SDK-integrasjon"
- Submit button disabled until both are filled

---

## PART 5 — EventTimeline integration (bonus, do after 1-4)

The EventTimeline already shows `metadata.matchEvents`. Update it to also show real Sportmonks events if `sportmonksFixtureId` is set:
- Merge `metadata.matchEvents` (Vio events: polls, ads, contests) with Sportmonks events (goals, cards)
- Sort by minute
- Show both layers together — Vio events above the line, match events below

---

## What Viobot is handling (DO NOT duplicate)

- ✅ Seeding `sportmonksFixtureId: 19568482` on the Viaplay broadcast
- ✅ Seeding `matchEvents` (18 real events) in metadata
- ✅ Team logos + names updated on both demo broadcasts
- ✅ All polls translated to Norwegian
- ✅ Task file committed and pushed to main

---

## Acceptance criteria

- [ ] `GET /api/sportmonks/fixture/:id/result` returns structured data
- [ ] MatchDataCard renders below EventTimeline, above ActiveEngagement  
- [ ] Real Barcelona 1-2 PSG data shows with logos and 10 key events
- [ ] Substitutions filtered out of the event list
- [ ] Card returns null silently when no fixture linked
- [ ] Create Broadcast blocks submit without fixture ID + externalId
- [ ] Refresh button works
