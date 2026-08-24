-- Surfaces & platforms.
--
-- Vocabulary (decided 2026-08-20):
--   Surface   = the publisher property where Vio runs (VG, TV2, Viaplay).
--   Platform  = web / iOS / Android / Vev / TV **within** a surface.
--   Placement = the slot inside a surface where a component renders (app_placements).
--   Channel   = a COMMERCE concept (the brand's product outlet) — never used for
--               the publisher side. `sponsors.commerce_channel_id` keeps that meaning.
--
-- `client_apps` IS the surface today. Renaming that table is a separate project:
-- the SDK contract exposes `clientAppId` (see GET /api/auth/token), so it needs
-- coordinated iOS/Kotlin releases. This table already uses the TARGET vocabulary
-- (`surface_platforms.surface_id`), so that future rename needs no change here.
--
-- Why: a surface is not one native app. VG is a single surface with web + iOS +
-- Android. Bundle ids/package names are per-platform, so they cannot live on the
-- surface — which is exactly why `client_apps.bundle_id` was being abused as a
-- slug ('viaplay-demo', 'tv2demo') and blocked registering a web/Vev surface.

CREATE TABLE IF NOT EXISTS surface_platforms (
  id serial PRIMARY KEY,
  surface_id integer NOT NULL REFERENCES client_apps(id) ON DELETE CASCADE,
  -- 'web' | 'ios' | 'android' | 'vev' | 'apple-tv' | 'android-tv' | 'fire-tv'
  kind varchar(32) NOT NULL,
  -- bundle id / package name / web domain / Vev project id. Null when the
  -- platform needs no external identifier yet.
  identifier varchar(255),
  enabled boolean NOT NULL DEFAULT true,
  created_at timestamp DEFAULT now() NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_surface_platforms_surface ON surface_platforms (surface_id);

-- One row per (surface, kind) while it has no identifier; several identifiers of
-- the same kind are allowed (e.g. two web domains) but never duplicated.
CREATE UNIQUE INDEX IF NOT EXISTS uniq_surface_platform_kind
  ON surface_platforms (surface_id, kind) WHERE identifier IS NULL;
CREATE UNIQUE INDEX IF NOT EXISTS uniq_surface_platform_identifier
  ON surface_platforms (surface_id, kind, identifier) WHERE identifier IS NOT NULL;

-- A surface is no longer assumed to be a native app: identifiers live on the
-- platform rows now. (bundle_id stays UNIQUE — Postgres allows many NULLs.)
ALTER TABLE client_apps ALTER COLUMN bundle_id DROP NOT NULL;

-- Backfill the TV platforms that were bolted onto client_apps as an array.
-- Native/web assignment for the existing surfaces is left to the dashboard —
-- guessing from a bundle_id that is really a slug would create wrong rows.
INSERT INTO surface_platforms (surface_id, kind, identifier)
SELECT id, unnest(tv_platforms), NULL
FROM client_apps
WHERE tv_enabled = true AND array_length(tv_platforms, 1) > 0
ON CONFLICT DO NOTHING;
