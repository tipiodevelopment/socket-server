# TASK UI-05 — Pending fixes (high priority)

**Status: TODO**
**Owner:** Replit

---

## Fix 1 — Sponsor slots `productIds` Zod schema (BLOCKING)

`POST /api/broadcasts/:id/sponsor-slots` still returns 500.

Test curl:
```bash
curl -X POST https://api-dev.vio.live/api/broadcasts/viaplay-atletico-psg-2026-03-08/sponsor-slots \
  -H "Authorization: Bearer <JWT>" \
  -H "Content-Type: application/json" \
  -d '{"sponsorId":1,"matchMinute":35,"productIds":[19],"type":"banner"}'
```

Fix: change Zod schema for `productIds` from `z.array(z.string())` to `z.array(z.number())`.

---

## Fix 2 — Contest edit modal with image upload

Implement an edit modal for contests in the broadcast detail view.

Fields:
- Title
- Description
- Image (file upload — JPG/PNG/WebP max 5MB, with preview)
- Prize text
- Type (vote / trivia)
- Correct answer (trivia only)
- Status (scheduled / active / ended)

**Image upload is required** — Angelo needs to upload images directly, not paste URLs.
Use the same file upload infrastructure as sponsor logos.

API: `PUT /api/contests/:id`

---

## Fix 3 — "Live" tab still visible in campaign dashboard

The "Live" tab was not removed in the latest deploy (still visible on staging.vio.live/campaigns/36).
Remove it from `campaign-dashboard.tsx` tabs array.

---

## Fix 4 — Team logos not showing in campaign broadcasts list

The `TeamLogo` component was added but logos are not rendering in the campaign overview.
Verify that `homeTeamLogo` and `awayTeamLogo` are returned by the campaigns/:id API and are passed to the broadcast list card component.

---

## Fix 5 — Rename RProduct* components

Components show names like "RProductCarousel 1", "RProductBanner 2".
Strip the "R" prefix from all component names that start with "RProduct".
Can be a one-time DB migration or a display fix in the frontend.
