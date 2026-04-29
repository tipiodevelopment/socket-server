-- Phase 3: enforce NOT NULL on sponsor FKs that Phase 1 landed as nullable.
-- Pre-conditions:
--   1. Phase 1 applied (columns exist, nullable).
--   2. Phase 2 backfill executed.
--   3. Operator has resolved every campaign with `primary_sponsor_id IS NULL`
--      (either assigned a sponsor via dashboard or deleted the campaign). The
--      45 orphan `campaign_components` + 1 `scheduled_component` cascade from
--      those campaigns — they disappear when the campaign is cleaned.
--
-- Each statement will fail loudly if NULLs remain on the column, pointing at
-- which table still has unresolved rows.

ALTER TABLE campaigns            ALTER COLUMN primary_sponsor_id SET NOT NULL;
ALTER TABLE polls                ALTER COLUMN sponsor_id         SET NOT NULL;
ALTER TABLE contests             ALTER COLUMN sponsor_id         SET NOT NULL;
ALTER TABLE campaign_components  ALTER COLUMN sponsor_id         SET NOT NULL;
ALTER TABLE scheduled_components ALTER COLUMN sponsor_id         SET NOT NULL;
