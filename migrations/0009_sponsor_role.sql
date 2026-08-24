-- Sponsor role (ADR-0007/0008 — interim toward the Brand-tenant model).
--
-- A `sponsor` is a brand-facing user: linked to ONE sponsor via users.sponsor_id,
-- read-only, scoped to their own brand's footprint (which surfaces/campaigns use
-- their brand + its data). Served by the self-scoped /api/sponsor/me/* surface.
-- No parent_admin_id — a sponsor is not inside a publisher tenant. See the
-- handbook platform-definition (Brand = its own tenant) for the target model.

ALTER TYPE "user_role" ADD VALUE IF NOT EXISTS 'sponsor';
