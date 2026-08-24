-- Tenancy: operator/viewer belong to an admin (ADR-0007, F3 scoping).
--
-- admin is the tenant root — it already owns client_apps and sponsors via
-- their user_id FK. This adds the other half: which admin an operator or
-- viewer belongs to, so the API can scope their reads/writes to that admin's
-- apps and sponsors. NULL for super_admin (global) and for admin itself.

-- Idempotent for the same reason as 0007 — see its header comment.

ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "parent_admin_id" integer;
--> statement-breakpoint
DO $$ BEGIN
  ALTER TABLE "users" ADD CONSTRAINT "users_parent_admin_id_users_id_fk"
    FOREIGN KEY ("parent_admin_id") REFERENCES "users"("id");
EXCEPTION WHEN duplicate_object THEN null;
END $$;
