# TASK DEMO-01 — Timeline visual + demo data for past broadcasts

**Status: TODO**
**Priority: HIGH — needed to impress Viaplay/TV2**

---

## Part 1 — Event Timeline redesign

The current timeline shows dots floating in a white area. It needs to look like a real broadcast timeline — like a video editor or sports broadcast control panel.

### Current issues
- Dots have no labels — you can't tell what event happened at what time
- No match context (score, minute) on the timeline
- No shoppable ad events shown on timeline
- Play/Skip buttons exist but do nothing meaningful
- Timeline only shows polls/contests, not the full broadcast story

### Redesign spec

**Timeline should look like a horizontal scrubber with event markers:**

```
|—[⚽ KO]——[📊 Poll]——[🏆 Goal!]——[🛍️ Ad]——[📊 Poll]——[🏆 Goal!]——[🛍️ Ad]——[⏹ FT]|
0'          15'        38'          45'        62'         79'          85'       90'
```

Each event marker:
- Icon: ⚽ kickoff, 📊 poll, 🏆 goal/contest, 🛍️ shoppable ad, ⏹ final whistle
- Color dot: blue=poll, purple=contest, green=shoppable ad, white=match event
- Tooltip on hover: event name + time + result (e.g. "¿Quién marcará? — 53% Atlético")
- Clicking an event marker scrolls to that event in Active Engagement section

**Progress bar:** shows match completion (0' → 90')
**Left stat:** "X events fired" instead of "X of Y events active"
**Right stat:** actual match duration or "90' FT" for ended matches

---

## Part 2 — Demo data for past broadcasts

Seed realistic match data for ended broadcasts so the timeline looks alive and impressive.

### Broadcasts to seed (all ENDED):

**1. Barcelona vs PSG (barcelona-psg-2026-03-03) — TV2**
Result: Barcelona 2-1 PSG
```
00' — Kickoff
12' — Poll: "¿Quién marcará el primer gol?" (Lewandowski 67%, Mbappé 33%) — 8,400 votes
38' — Shoppable Ad: Torshov Sport — Nike Jersey 999 NOK
39' — GOAL: Lewandowski 1-0 ⚽
45' — Poll: "¿Acabará así el partido?" (Yes 61%, No 39%) — 12,100 votes
52' — Contest: "Predict the final score" — 3,200 participants
67' — GOAL: Mbappé 1-1 ⚽ (penalty)
71' — Poll: "¿Llegará el 2-1?" (Yes 74%, No 26%) — 15,800 votes
79' — Shoppable Ad: Torshov Sport — Adidas Boots 1,299 NOK
84' — GOAL: Ferran Torres 2-1 ⚽
90' — Full Time
Total: 34.2K viewers, 26,000 votes, 3,200 contest entries
```

**2. Atlético Madrid vs PSG (viaplay-atletico-psg-2026-03-08) — Viaplay**
Result: Atlético 1-0 PSG
```
00' — Kickoff
22' — Poll: "¿Atlético o PSG llega a semis?" (Atlético 53%, PSG 47%) — 10,200 votes
35' — Shoppable Ad: Elkjøp — Samsung 85" TV 17,990 NOK
44' — Poll: "¿Habrá gol antes del descanso?" (Yes 48%, No 52%) — 9,800 votes
58' — Contest: "Man of the Match" — 4,100 participants
67' — GOAL: Griezmann 1-0 ⚽ (header)
73' — Shoppable Ad: Elkjøp — Samsung Soundbar 6,999 NOK
80' — Poll: "¿Aguanta el 1-0?" (Yes 71%, No 29%) — 18,400 votes
90' — Full Time
Total: 19.6K viewers, 19,400 votes, 4,100 contest entries
```

**3. Real Madrid vs Barcelona — El Clásico (existing broadcast)**
Result: Real Madrid 2-1 Barcelona
```
00' — Kickoff
08' — Poll: "¿Quién ganará El Clásico?" (Madrid 61%, Barça 39%) — 24,100 votes
23' — GOAL: Vinícius Jr 1-0 ⚽
31' — Shoppable Ad: Elkjøp — Samsung TV
38' — Poll: "¿Remontada del Barça?" (Yes 44%, No 56%) — 18,700 votes
42' — GOAL: Lewandowski 1-1 ⚽
55' — Contest: "Predict second half goals" — 6,800 participants  
68' — Shoppable Ad: Elkjøp — Soundbar
77' — GOAL: Bellingham 2-1 ⚽
85' — Poll: "¿Gol más del Madrid?" (Yes 38%, No 62%) — 21,300 votes
90' — Full Time
Total: 29K viewers, 64,100 votes, 6,800 contest entries
```

### How to seed
For each broadcast:
1. Add poll/contest records with realistic vote counts and timestamps
2. Add `broadcast_events` entries (or use broadcast metadata) for goals and match events
3. Update broadcast `viewerCount`, `peakViewers`, total votes aggregate
4. Add shoppable ad log entries with timestamps

---

## Part 3 — Timeline shows all event types

Update `EventTimeline` component to show:
- Match events (goals, kickoff, FT) — from broadcast metadata or new `match_events` field
- Polls — blue dots with label
- Contests — purple dots with label  
- Shoppable ads — green dots with label (product name + sponsor)

Each dot: hover tooltip with event details + result.

The timeline for a past match should tell the full story of the broadcast at a glance.
