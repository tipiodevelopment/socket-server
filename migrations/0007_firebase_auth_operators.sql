-- Operator identity + roles for the dashboard (ADR-0007, F2).
--
-- Why this matters
-- ----------------
-- Until now the dashboard had no real authentication: a simulated session
-- (`reachu_simulated_user_id` in localStorage -> POST /api/users/ensure)
-- upserted a `users` row and minted a JWT, with no password and no roles.
-- ADR-0007 makes the Commerce Firebase project the single cross-product
-- IdP; this migration gives `users` what the backend needs to consume it:
--
--   - firebase_uid : links the row to the shared Firebase identity. Rows
--                    are pre-provisioned (STRICT ALLOWLIST, owner decision
--                    2026-06-10) with email + role; the uid attaches on the
--                    user's first successful login (matched by email).
--   - role         : hierarchical enum. super_admin (Vio team) > admin
--                    (registers client apps / sponsors) > operator (runs
--                    campaigns day-to-day) > viewer (read-only).
--   - sponsor_id   : viewer is the sponsor-facing role; this links the
--                    viewer to its sponsor for future scoped reads. NULL
--                    for internal roles.
--
-- Existing rows (simulated-session residue) default to 'viewer' with no
-- firebase_uid and no email match, so they cannot log in — harmless until
-- cleaned up. Role/permission enforcement lives in the API gate, which
-- re-reads the row per request, so role changes and de-provisioning take
-- effect immediately.

CREATE TYPE "user_role" AS ENUM ('super_admin', 'admin', 'operator', 'viewer');
--> statement-breakpoint

ALTER TABLE "users" ADD COLUMN "firebase_uid" varchar(128);
--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "role" "user_role" NOT NULL DEFAULT 'viewer';
--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "sponsor_id" integer;
--> statement-breakpoint

ALTER TABLE "users" ADD CONSTRAINT "users_firebase_uid_unique" UNIQUE ("firebase_uid");
--> statement-breakpoint
ALTER TABLE "users" ADD CONSTRAINT "users_sponsor_id_sponsors_id_fk"
  FOREIGN KEY ("sponsor_id") REFERENCES "sponsors"("id");
