# TASK UI-05 — Pending fixes (high priority)

**Status: IN PROGRESS**
**Owner:** Replit

---

## ✅ Fix 1 — Sponsor slots `productIds` Zod schema (Mar-09-2026)

**Already correct.** `insertBroadcastSponsorSlotSchema` uses `productIds: z.array(z.number()).optional()` (shared/schema.ts line 442). The endpoint returns 201 successfully when using a valid `sponsorId` (3 or 4). The test curl in the task uses `sponsorId=1` which does not exist in the DB — that's the actual root cause of any 500s, not the schema.

---

## ✅ Fix 2 — Contest edit modal with image upload (Mar-09-2026)

Implemented pencil icon + edit Dialog inside `ContestCard` in `broadcast-detail.tsx`.

Fields:
- Title (required)
- Description (textarea)
- Image (ImageUploadWithPreview component — supports file upload + URL entry)
- Prize
- Type (vote / trivia / prediction via Select)

Calls `PUT /api/contests/:id` on save. Invalidates `/api/broadcasts/:broadcastId/contests` query cache on success. The `broadcastId` prop was added to `ContestCard`.

---

## ✅ Fix 3 — "Live" tab still visible in campaign dashboard (Mar-09-2026)

Removed in Session 3 of this day. `{ value: 'live', label: 'Live', icon: Zap }` removed from TABS array, content block removed, `EventsTab`/`ScheduledTab` imports removed.

---

## ✅ Fix 4 — Team logos not showing in campaign broadcasts list (Mar-09-2026)

Verified: `GET /api/campaigns/:id/broadcasts` returns `homeTeamLogo`/`awayTeamLogo` from the DB (Drizzle's `getCampaignBroadcasts` selects all columns). `TeamLogo` component was added to `OverviewTab.tsx` and renders correctly.

---

## ✅ Fix 5 — Rename RProduct* components (Mar-09-2026)

N/A — checked via `GET /api/components` and direct DB query. Zero components with names starting with "RProduct" exist in the database. Nothing to rename.
