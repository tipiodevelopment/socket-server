-- Adds the `app_placements` table — named instances of placements the dev's
-- app implements. Replaces the implicit cross-product of
-- (app_components × app_component_locations) with an explicit declaration
-- of which (component_type, location, name) tuples the app actually renders.
--
-- The contract:
--   1. Dev's SDK declares placements at app boot via the new manifest v2
--      payload `placements[]: [{name, componentType, locationId, customConfig?}]`.
--   2. Backend resolves componentType → component_id (library template) and
--      upserts a row here per declared placement.
--   3. Dashboard's "Add placement" picker lists rows from this table for the
--      campaign's clientAppId — operator picks ONE named placement, then
--      assigns sponsor + product list. Cannot pick a (component, location)
--      combo the dev hasn't declared.
--
-- Two UNIQUE indexes (Option 3 from the design discussion):
--   - (client_app_id, name) — name is the human-facing id, must be unique
--     per app so the operator picker label is unambiguous.
--   - (client_app_id, component_id, location_id) — the SDK can only
--     register one placement per (type, slot). Prevents two `product_carousel`
--     rows in the same `home_top` slot — if the dev needs A/B variants,
--     declare two distinct location_ids (e.g. `home_top_a`, `home_top_b`).

CREATE TABLE IF NOT EXISTS "app_placements" (
  "id" SERIAL PRIMARY KEY,
  "client_app_id" INTEGER NOT NULL REFERENCES "client_apps"("id") ON DELETE CASCADE,
  "component_id" VARCHAR NOT NULL REFERENCES "components"("id") ON DELETE RESTRICT,
  "location_id" VARCHAR(100) NOT NULL,
  "name" VARCHAR(255) NOT NULL,
  "custom_config" JSON,
  "created_at" TIMESTAMP NOT NULL DEFAULT NOW(),
  "updated_at" TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS "idx_app_placements_unique_name"
  ON "app_placements" ("client_app_id", "name");

CREATE UNIQUE INDEX IF NOT EXISTS "idx_app_placements_unique_slot"
  ON "app_placements" ("client_app_id", "component_id", "location_id");

CREATE INDEX IF NOT EXISTS "idx_app_placements_client_app"
  ON "app_placements" ("client_app_id");

-- Backfill existing campaign_components → app_placements so the dashboard
-- picker has matching entries for placements already in use. Auto-name from
-- (instance_name | template name) — operator can rename later.
--
-- Important: we backfill ONLY from campaign_components (placements actually
-- in use), NOT from the (app_components × app_component_locations) cross
-- product. The cross product would create false positives — e.g. if TV2
-- registered 3 component types and 5 locations, we'd auto-create 15 rows,
-- of which only 6 might actually be implemented in the app's UI. Better to
-- start empty for everything else; the dev's v2 SDK manifest declares the
-- rest explicitly.
INSERT INTO "app_placements" ("client_app_id", "component_id", "location_id", "name")
SELECT DISTINCT
  cmp.client_app_id,
  cc.component_id,
  cc.location_id,
  COALESCE(cc.instance_name, c.name || ' — ' || cc.location_id) AS name
FROM "campaign_components" cc
INNER JOIN "campaigns" cmp ON cmp.id = cc.campaign_id
INNER JOIN "components" c ON c.id = cc.component_id
WHERE cc.location_id IS NOT NULL
  AND cmp.client_app_id IS NOT NULL
ON CONFLICT ("client_app_id", "component_id", "location_id") DO NOTHING;
