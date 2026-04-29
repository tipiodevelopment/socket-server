-- Consolidates the placements model around `app_placements` as the single
-- source of truth for "what named placement instances does this app
-- implement". Eliminates the redundant legacy `app_components` table,
-- introduces soft-delete + audit, and makes `campaign_components` reference
-- a placement directly via FK instead of carrying a loose
-- (component_id, location_id) pair.
--
-- Decisions locked (sprint 2026-04-27 PM):
--   1. SDK manifest declares ONLY locations[] — placements are created via
--      dashboard `/apps/:id` "Add from library" form. Manifest sync-deletes
--      via `deprecated_at` (soft).
--   2. Library is read-only (6 canonical templates).
--   3. campaign_components has FK to app_placements; component_id +
--      location_id columns are dropped as redundant.
--   4. Multi-sponsor "only one active per (campaign, placement)" enforced
--      via partial UNIQUE index.
--
-- Coupled with a coordinated SDK + dashboard rollout. See
-- `docs/TASK_PLACEMENTS.md` "Sprint 2026-04-27 (PM)".

BEGIN;

-- ── Step 1: drop legacy app_components ─────────────────────────────────────
-- Fully redundant with app_placements (a placement implies the app supports
-- the underlying template). Cascade drops any leftover FKs.
DROP TABLE IF EXISTS "app_components" CASCADE;

-- ── Step 2: soft-delete on app_component_locations ────────────────────────
-- Manifest sync semantics: locations not in the new payload get
-- deprecated_at = now(), not hard-deleted. Existing app_placements pointing
-- at deprecated locations stay valid but the dashboard shows a warning.
ALTER TABLE "app_component_locations"
  ADD COLUMN IF NOT EXISTS "deprecated_at" TIMESTAMP NULL;

-- ── Step 3: soft-delete + audit on app_placements ─────────────────────────
ALTER TABLE "app_placements"
  ADD COLUMN IF NOT EXISTS "deprecated_at" TIMESTAMP NULL,
  ADD COLUMN IF NOT EXISTS "created_by" INTEGER REFERENCES "users"("id") ON DELETE SET NULL;

-- ── Step 4: app_placement_id + audit on campaign_components ───────────────
-- The campaign_components row now references the named placement directly.
-- ON DELETE RESTRICT — operator must soft-delete via dashboard before
-- placement removal cascades to campaign instances.
ALTER TABLE "campaign_components"
  ADD COLUMN IF NOT EXISTS "app_placement_id" INTEGER REFERENCES "app_placements"("id") ON DELETE RESTRICT,
  ADD COLUMN IF NOT EXISTS "created_by" INTEGER REFERENCES "users"("id") ON DELETE SET NULL;

-- ── Step 5: backfill app_placement_id from (component_id, location_id) ────
-- Match each campaign_components row to its app_placement via the campaign's
-- clientAppId. Rows without a location_id are unmapable in the new model.
UPDATE "campaign_components" cc
SET "app_placement_id" = ap.id
FROM "campaigns" cmp, "app_placements" ap
WHERE cc.campaign_id = cmp.id
  AND ap.client_app_id = cmp.client_app_id
  AND ap.component_id = cc.component_id
  AND ap.location_id = cc.location_id
  AND cc.location_id IS NOT NULL;

-- ── Step 6: delete orphan campaign_components ─────────────────────────────
-- Legacy rows that couldn't be backfilled (NULL location_id, or pointing at
-- a (component, location) combo no app_placement covers). Per "no legacy"
-- decision, these don't survive the consolidation.
DELETE FROM "campaign_components" WHERE "app_placement_id" IS NULL;

-- ── Step 7: lock app_placement_id as required ─────────────────────────────
ALTER TABLE "campaign_components" ALTER COLUMN "app_placement_id" SET NOT NULL;

-- ── Step 8: drop redundant component_id + location_id from cc ─────────────
-- Information lives in app_placements via the FK. CASCADE drops any
-- leftover indexes/constraints on these columns.
ALTER TABLE "campaign_components" DROP COLUMN IF EXISTS "component_id" CASCADE;
ALTER TABLE "campaign_components" DROP COLUMN IF EXISTS "location_id" CASCADE;

-- ── Step 9: partial UNIQUE for "one active per (campaign, placement)" ─────
-- Multi-sponsor rotation: operator can have multiple campaign_components
-- rows for the same placement (different sponsors / scheduled times), but
-- only ONE may be `status='active'` at any moment. Defense-in-depth with
-- the dashboard validation.
CREATE UNIQUE INDEX IF NOT EXISTS "idx_campaign_components_one_active"
  ON "campaign_components" ("campaign_id", "app_placement_id")
  WHERE "status" = 'active';

COMMIT;
