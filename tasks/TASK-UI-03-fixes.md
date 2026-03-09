# TASK-UI-03 — Demo Polish Fixes

**Owner:** Replit  
**Priority:** HIGH — needed before Viaplay/TV2 demo  
**Status:** Ready

---

## Fix 1 — Admin endpoint to seed poll votes

Add `POST /api/admin/polls/:id/seed-votes` (no auth in dev, or Bearer JWT).

```ts
app.post('/api/admin/polls/:pollId/seed-votes', async (req, res) => {
  const { pollId } = req.params;
  const { options } = req.body;
  // options: [{ id: number, voteCount: number }]
  // For each option: SET vote_count = voteCount (absolute, not increment)
  // Also recalculate totalVotes = sum of all option voteCounts
  // Returns updated poll with options
})
```

**Why:** All 3 demo polls have 0 votes. We need to seed realistic vote counts for the demo.

**Votes to seed (call this after deploying):**

Poll 28 — "Hvem scorer det første målet?"
- opt 66 FC Barcelona → 7992
- opt 67 Paris Saint Germain → 5920  
- opt 68 Ingen mål i 1. omgang → 888
- totalVotes: 14800

Poll 29 — "Hvem vinner kampen?"
- opt 69 FC Barcelona → 9506
- opt 70 Uavgjort → 3492
- opt 71 Paris Saint Germain → 6402
- totalVotes: 19400

Poll 30 — "Blir det mål på overtid?"
- opt 72 Ja → 4928
- opt 73 Nei → 6272
- totalVotes: 11200

---

## Fix 2 — Sportmonks status "Ikke startet" → "Slutt"

Already pushed to main (commit `796a4f2`). Replit needs to pull and deploy.

The fix reads `f.state_id` (numeric) before falling back to `f.state?.developer_name` (string).  
Sportmonks state_id 5 = FT. After deploy, `GET /api/sportmonks/fixture/19568482/result` should return `"status": "FT"` and the MatchDataCard badge should show "Slutt".

**Also:** invalidate the in-memory cache after deploy so it refetches.  
The `fixtureResultCache` Map should be cleared on startup — add `fixtureResultCache.clear()` in the init block or just restart.

---

## Fix 3 — Sponsor slots: productIds array schema issue

`POST /api/broadcasts/:id/sponsor-slots` returns 500 when `productIds` is sent as an integer array.

Check `insertBroadcastSponsorSlotSchema` — the Zod schema for `productIds` may not accept an array.  
Fix: ensure `productIds` is typed as `z.array(z.number()).optional()` in the insert schema.

Once fixed, Viobot will call:
```json
POST /api/broadcasts/viaplay-atletico-psg-2026-03-08/sponsor-slots
{
  "sponsorId": 1,
  "campaignId": 35,
  "role": "shoppable",
  "triggerType": "match_minute",
  "triggerValue": "45",
  "productIds": [17, 18],
  "autoExecute": false,
  "status": "scheduled"
}
```

---

## Fix 4 — DELETE /api/chat/:id

Add endpoint to delete individual chat messages.

```ts
app.delete('/api/chat/:id', async (req, res) => {
  await storage.deleteChatMessage(parseInt(req.params.id));
  res.status(204).send();
})
```

Add `deleteChatMessage(id: number)` to storage if missing.

**Why:** There are 8 old Spanish chat messages (ids 14–21) that need to be removed.  
After deploying: Viobot will DELETE ids 14, 15, 16, 17, 18, 19, 20, 21.

---

## Fix 5 — Total Votes counter in header

The broadcast header shows "Total Votes: 0" even though polls have votes.  
The counter should sum `totalVotes` across all polls in the broadcast.

Check `GET /api/broadcasts/:id` — the `totalVotes` field aggregation.

---

## Context — current demo broadcast state

Broadcast: `viaplay-atletico-psg-2026-03-08`  
Match: FC Barcelona 1–2 Paris Saint Germain | CL Liguilla | 1 okt 2025  
Fixture: `19568482` (Sportmonks)

Polls: 28, 29, 30 (all Norwegian, correct options, 0 votes — needs Fix 1)  
Contests: 15 (Vinn CL-billetter), 16 (Kampens spiller) — both Elkjøp-branded ✅  
Products: 17–20 (4 Elkjøp products) ✅  
Ads: 10 (Barça drakt), 11 (Samsung TV) ✅  
Chat: 33 messages, all Norwegian ✅  
MatchDataCard: 11 real match events from Sportmonks ✅

---

## Acceptance criteria

- [ ] POST /api/admin/polls/:id/seed-votes works, votes visible as % bars in UI
- [ ] MatchDataCard shows "Slutt" instead of "Ikke startet"
- [ ] Sponsor slots can be created with productIds array
- [ ] DELETE /api/chat/:id works
- [ ] Total Votes in header matches sum of poll votes
