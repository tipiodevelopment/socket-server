-- Adds the `app_component_locations` table that backs the manifest registry.
--
-- Each row represents a placement slot the partner SDK has declared at app
-- boot via `Vio.registerPlacementLocation(...)`. The dashboard's "Add
-- placement" picker reads from this table (scoped per client_app_id) so the
-- operator can only bind a campaign_components instance to a slot the dev's
-- code actually exposes.
--
-- The unique index on (client_app_id, location_id) enforces idempotency for
-- the manifest upsert so the SDK can re-upload on every cold start without
-- creating duplicate rows.

CREATE TABLE IF NOT EXISTS "app_component_locations" (
  "id" SERIAL PRIMARY KEY,
  "client_app_id" INTEGER NOT NULL REFERENCES "client_apps"("id") ON DELETE CASCADE,
  "location_id" VARCHAR(100) NOT NULL,
  "display_name" VARCHAR(255),
  "created_at" TIMESTAMP NOT NULL DEFAULT NOW(),
  "updated_at" TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS "idx_app_component_locations_unique"
  ON "app_component_locations" ("client_app_id", "location_id");
