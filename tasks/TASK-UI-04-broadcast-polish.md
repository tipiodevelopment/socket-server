# TASK UI-04 — Broadcast demo polish

**Status: COMPLETED**  
**Owner:** Replit

---

## Fix 1 — "votos" → "votes" in poll display

In `broadcast-detail.tsx` (and any other poll rendering component), the vote count label shows in Spanish:
```
(4,928 votos)
```
Should be:
```
(4,928 votes)
```
Search for all instances of `votos` in the frontend and replace with `votes`.

---

## Fix 2 — Hide "Load Demo" button in production view

The "Load Demo" button is visible on the broadcast detail header. This should only appear in a dev/internal mode, not in the production-facing dashboard view.

Either:
- Remove it entirely, OR
- Hide it behind a `?dev=true` query param or an env flag

---

## Fix 3 — Sponsor slots `productIds` Zod schema error

`POST /api/broadcasts/:id/sponsor-slots` returns `{"error":"Failed to create sponsor slot"}` when `productIds` is an integer array.

Likely the Zod schema expects `string[]` but the payload sends `number[]`. Fix the schema to accept `z.array(z.number())` for `productIds`.

**Test payload:**
```json
{
  "sponsorId": 1,
  "matchMinute": 35,
  "productIds": [19],
  "type": "banner"
}
```
Expected: `201 Created` with the new slot.

After fixing, Viobot will create these 3 slots:
- min 35: productIds [19] (Samsung TV)
- min 45: productIds [17, 18] (Barça + PSG drakt)
- min 70: productIds [20] (Soundbar)

---

## Fix 4 — "VIaplay" typo → "Viaplay"

The app name shows as "VIaplay" (capital I) in several places. Fix the app name in the database or wherever it's stored to be "Viaplay".

---

## Fix 5 — Engagement Rate not calculating

The dashboard header shows `--%` for Engagement Rate. This should calculate:
```
Engagement Rate = (total votes + contest entries) / viewers * 100
```
For the Viaplay broadcast: 45,400 votes / 19,600 viewers ≈ 231% (expected for sports engagement).

---

## Fix 6 — Status "Live" inconsistency

The broadcast `viaplay-atletico-psg-2026-03-08` shows Status: "Live" in the header badge, but MatchDataCard correctly shows "Slutt" (FT). 

The broadcast status in DB is `live` — this is intentional for the demo (keeps polls/chat active). No change needed, but the Status badge label could say "Demo" or "Ended" instead of "Live" to avoid confusion. Leave this for discussion.

---

## Notes
- Fixes 1–4 are quick (< 1h total)
- Fix 3 (sponsor slots) is needed so Viobot can seed the remaining shoppable ad slots
- Fix 5 may require a new analytics calculation endpoint

---

## ⚠️ Follow-up (2026-03-09 17:49)

**Fix 3 (sponsor slots) NOT resolved** — endpoint still returns 500 after latest deploy.

Test:
```bash
curl -X POST https://api-dev.vio.live/api/broadcasts/viaplay-atletico-psg-2026-03-08/sponsor-slots \
  -H "Authorization: Bearer <JWT>" \
  -H "Content-Type: application/json" \
  -d '{"sponsorId":1,"matchMinute":35,"productIds":[19],"type":"banner"}'
# Returns: {"error":"Failed to create sponsor slot"}
```

Once fixed, Viobot will seed 3 slots:
- min 35: productIds [19]
- min 45: productIds [17, 18]  
- min 70: productIds [20]

---

## Fix 7 — Team logos not showing in campaign broadcasts list

In `campaigns/:id` overview, the broadcasts list cards do not render team logos even when `homeTeamLogo` and `awayTeamLogo` are set in the broadcast.

The broadcast detail page (MatchDataCard) shows them correctly — the issue is only in the campaign overview list view.

Add team logo circles (overlapping, like the broadcasts list page) to each broadcast card in the campaign overview.

---

## Fix 8 — Remove "Live" tab from campaigns view (legacy)

The campaign detail page has a "Live" tab alongside Overview, Broadcasts, Components, Sponsors, Analytics, Settings.

This is a legacy tab and should be removed entirely.

---

## Fix 9 — Rename "RProduct*" components → remove "R" prefix

Active components show names like "RProductCarousel 1", "RProductBanner 2". The "R" prefix is legacy from Reachu.

Rename them in the DB:
- "RProductCarousel 1" → "ProductCarousel 1"
- "RProductCarousel 2" → "ProductCarousel 2"
- "RProductBanner 1" → "ProductBanner 1"
- "RProductBanner 2" → "ProductBanner 2"

Or add a migration to strip leading "R" from component names that start with "RProduct".
