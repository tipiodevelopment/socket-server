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

-- Statements below are written idempotently (IF NOT EXISTS / duplicate_object
-- guards) because this migration was previously "applied" ad-hoc, piecemeal,
-- via `drizzle-kit push` against live environments before this repo had a
-- real migration runner — some environments may already have some of these
-- objects and not others. Safe to re-run regardless of partial state.

DO $$ BEGIN
  CREATE TYPE "user_role" AS ENUM ('super_admin', 'admin', 'operator', 'viewer');
EXCEPTION WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint

ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "firebase_uid" varchar(128);
--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "role" "user_role" NOT NULL DEFAULT 'viewer';
--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "sponsor_id" integer;
--> statement-breakpoint

DO $$ BEGIN
  ALTER TABLE "users" ADD CONSTRAINT "users_firebase_uid_unique" UNIQUE ("firebase_uid");
EXCEPTION WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
  ALTER TABLE "users" ADD CONSTRAINT "users_sponsor_id_sponsors_id_fk"
    FOREIGN KEY ("sponsor_id") REFERENCES "sponsors"("id");
EXCEPTION WHEN duplicate_object THEN null;
END $$;
