-- Canonicalize the 3 components.id values that were stored as random UUIDs
-- (countdown, offer_banner, product_spotlight) to match the slug-style IDs
-- used by the other 3 templates (product_banner, product_carousel,
-- product_store).
--
-- Why this matters
-- ----------------
-- The `components` table is a 6-row read-only library of canonical
-- placement templates. The 3 newest templates (banner/carousel/store)
-- were created with hand-picked slug IDs ("product-banner-template",
-- etc.) so a developer reading SQL or a `/v2/mobile/...` response
-- recognises them at a glance. The 3 older templates (countdown,
-- offer_banner, product_spotlight) were created earlier with
-- random `gen_random_uuid()` values, which propagated to
-- `app_placements.component_id` (FK).
--
-- The drift surface this leaves:
--   - SDK responses ship a mix of slugs and UUIDs in the same `id`
--     column of `/v2/mobile/campaigns/:id/components`.
--   - `tests/sql casual queries` against placements need to JOIN
--     components every time to know which template a row uses, instead
--     of reading the human-meaningful slug straight from app_placements.
--   - The audit on 2026-04-29 flagged this as Q2 in the consolidation
--     plan; this migration is the answer.
--
-- What changes
-- ------------
-- 1. The FK `app_placements.component_id` → `components.id` gains
--    `ON UPDATE CASCADE`. The original constraint had `NO ACTION`,
--    which is why renaming a PK was impossible without dropping the
--    FK first. Going forward, any future rename is a single UPDATE.
--
-- 2. Three `components.id` values are renamed:
--      `1346badf-c31a-4113-8d8a-f255bb56bd25` → `countdown-template`
--      `5355258c-fad2-4196-b99e-7bbaf3908f4f` → `offer-banner-template`
--      `321ce3d4-82e3-4531-95c3-6f8f603d73eb` → `product-spotlight-template`
--    The CASCADE rule from step 1 propagates each rename automatically
--    to the matching `app_placements.component_id` rows.
--
-- Impact scope (verified on Neon `local/angelo-20260423-1814` 2026-04-29)
-- ---------------------------------------------------------------------
--   - 3 rows updated in `components`.
--   - 2 rows updated in `app_placements` (TV2 ap=20 spotlight, ap=21 offer_banner).
--   - 0 rows changed in `campaign_components` (FK is to app_placements.id, not to components.id).
--   - 0 hardcoded UUID references found anywhere in:
--     · server/routes.ts + scripts/  (backend)
--     · client/src/                  (dashboard)
--     · VioSwiftSDK/Sources/         (iOS SDK)
--     · InteractiveAds-vio/Sources/  (Apple TV SDK)
--     · openapi.yaml + Postman collection + docs/*.md
--     The drift script `npm run check:docs-drift` was clean both before
--     and after applying this migration locally.
--   - SDK side: the iOS decoder reads `componentId` as `String` (no UUID
--     parsing). Slugs decode identically.
--
-- Rollback
-- --------
-- If something breaks, the inverse migration:
--   ALTER TABLE app_placements DROP CONSTRAINT app_placements_component_id_fkey;
--   ALTER TABLE app_placements ADD CONSTRAINT app_placements_component_id_fkey
--     FOREIGN KEY (component_id) REFERENCES components(id) ON UPDATE NO ACTION;
--   UPDATE components SET id = '1346badf-c31a-4113-8d8a-f255bb56bd25' WHERE id = 'countdown-template';
--   UPDATE components SET id = '5355258c-fad2-4196-b99e-7bbaf3908f4f' WHERE id = 'offer-banner-template';
--   UPDATE components SET id = '321ce3d4-82e3-4531-95c3-6f8f603d73eb' WHERE id = 'product-spotlight-template';
-- (CASCADE on UPDATE means the app_placements rows revert automatically.)

BEGIN;

-- 1. Replace the FK with ON UPDATE CASCADE so the renames below propagate.
ALTER TABLE app_placements
  DROP CONSTRAINT app_placements_component_id_fkey;

ALTER TABLE app_placements
  ADD CONSTRAINT app_placements_component_id_fkey
  FOREIGN KEY (component_id) REFERENCES components(id)
  ON UPDATE CASCADE
  ON DELETE RESTRICT;

-- 2. Rename the 3 UUID PKs. CASCADE updates the matching app_placements rows.
UPDATE components SET id = 'countdown-template'
  WHERE id = '1346badf-c31a-4113-8d8a-f255bb56bd25';
UPDATE components SET id = 'offer-banner-template'
  WHERE id = '5355258c-fad2-4196-b99e-7bbaf3908f4f';
UPDATE components SET id = 'product-spotlight-template'
  WHERE id = '321ce3d4-82e3-4531-95c3-6f8f603d73eb';

-- 3. Sanity check: no UUID survivors should remain in either table.
DO $$
DECLARE
  uuid_components int;
  uuid_placements int;
BEGIN
  SELECT count(*) INTO uuid_components FROM components WHERE id ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$';
  SELECT count(*) INTO uuid_placements FROM app_placements WHERE component_id ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$';
  IF uuid_components > 0 OR uuid_placements > 0 THEN
    RAISE EXCEPTION 'canonicalize_component_ids: % UUIDs survived in components, % in app_placements — aborting', uuid_components, uuid_placements;
  END IF;
END $$;

COMMIT;
