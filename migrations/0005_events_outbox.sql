-- Adds the events_outbox table that backs the realtime placement events
-- (and, in future sprints, engagement / broadcast / cart-intent events).
--
-- Pattern: HTTP handlers INSERT a row into events_outbox INSIDE the same
-- transaction as the data UPDATE — atomicity guarantees the event will
-- never be lost if the data change committed (and never spuriously emitted
-- if the data change rolled back).
--
-- A separate worker (server/events/worker.ts) polls pending rows every
-- 500ms with `FOR UPDATE SKIP LOCKED` so multi-node deploys don't
-- double-process. Each row is retried up to 5 times before being marked
-- 'dead' for ops review.
--
-- Decisions locked (sprint 2026-04-28 PM, see TASK_PLACEMENTS.md):
--   1. Module-agnostic — `module` column distinguishes 'placements' vs
--      'engagement' vs 'broadcast' vs 'cart_intent' so the same table
--      backs every realtime event going forward.
--   2. Scope-agnostic — `scope_type + scope_id` lets a single emit
--      function fan out to campaign rooms, broadcast rooms, or user
--      direct channels.
--   3. JSONB payload — schema-on-read; each event type owns its shape
--      (TS types in server/events/types.ts).
--   4. server_timestamp at INSERT time, not at emit time — gives the SDK
--      a stable ordering signal even if the worker batches/reorders.

BEGIN;

CREATE TABLE IF NOT EXISTS "events_outbox" (
  "id"               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  -- Wire event type, e.g. 'placement_status_changed'. Becomes the `type`
  -- field in the JSON payload sent to WS clients.
  "topic"            TEXT NOT NULL,
  -- Module bucket for client-side subscription filtering. One of:
  -- 'placements' | 'engagement' | 'broadcast' | 'cart_intent'.
  "module"           TEXT NOT NULL,
  -- Routing target. Combined with scope_id picks the WS room/channel.
  -- One of: 'campaign' | 'broadcast' | 'user'.
  "scope_type"       TEXT NOT NULL,
  -- Numeric id of the routing target (campaign.id, end_users.id, etc.).
  -- Stored as bigint to fit any of those without coercion at write time.
  "scope_id"         BIGINT NOT NULL,
  -- Free-form payload. Each topic owns its shape (see types.ts).
  "payload"          JSONB NOT NULL,
  -- Server-authoritative timestamp at outbox INSERT. The SDK uses this
  -- for sequencing — out-of-order events with older timestamps are
  -- ignored.
  "server_timestamp" TIMESTAMPTZ NOT NULL DEFAULT now(),
  -- Lifecycle: pending → sent (success) | failed (transient) | dead
  -- (max attempts exceeded, needs ops attention).
  "status"           TEXT NOT NULL DEFAULT 'pending',
  "attempts"         INTEGER NOT NULL DEFAULT 0,
  "last_error"       TEXT,
  "created_at"       TIMESTAMPTZ NOT NULL DEFAULT now(),
  "processed_at"     TIMESTAMPTZ,
  CONSTRAINT events_outbox_status_check
    CHECK ("status" IN ('pending', 'sent', 'failed', 'dead')),
  CONSTRAINT events_outbox_module_check
    CHECK ("module" IN ('placements', 'engagement', 'broadcast', 'cart_intent')),
  CONSTRAINT events_outbox_scope_type_check
    CHECK ("scope_type" IN ('campaign', 'broadcast', 'user'))
);

-- Worker query: WHERE status='pending' ORDER BY created_at LIMIT 50
-- Partial index keeps it tiny once 'sent' rows pile up.
CREATE INDEX IF NOT EXISTS "events_outbox_pending_idx"
  ON "events_outbox" ("created_at")
  WHERE "status" = 'pending';

-- Audit / replay: "show me all events for campaign 36 in time order".
CREATE INDEX IF NOT EXISTS "events_outbox_scope_idx"
  ON "events_outbox" ("scope_type", "scope_id", "server_timestamp" DESC);

COMMIT;
