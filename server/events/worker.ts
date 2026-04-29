/**
 * Outbox worker.
 *
 * Polls events_outbox every 500ms, ships pending rows to WS clients via
 * `broadcastToCampaign` (and, in future, broadcast/user-scoped emit
 * primitives), marks 'sent' on success, retries up to 5 times on failure
 * before marking 'dead'.
 *
 * Multi-node safe via `FOR UPDATE SKIP LOCKED` — when several Node
 * instances run this loop concurrently, each row is processed by exactly
 * one of them.
 *
 * Sprint 2026-04-28 PM. See server/events/types.ts for payload shapes
 * and migrations/0005_events_outbox.sql for the table contract.
 */

import { sql, eq, and, lt } from "drizzle-orm";
import { db } from "../db";
import { eventsOutbox } from "@shared/schema";
import type { EventScopeType, WsEventEnvelope } from "./types";
// `broadcastToCampaign` is an `export let` from routes.ts that gets
// rebound when registerRoutes() runs. The let-binding pattern means we
// always read the live function reference, not a stale snapshot at
// import time.
import { broadcastToCampaign } from "../routes";

// ── Tunables ────────────────────────────────────────────────────────────────

const POLL_INTERVAL_MS = 500;
const MAX_ATTEMPTS = 5;
const BATCH_SIZE = 50;

// ── State ──────────────────────────────────────────────────────────────────

let timer: NodeJS.Timeout | null = null;
let inFlight = false; // Reentrancy guard if a tick takes >POLL_INTERVAL_MS.

// ── Public API ─────────────────────────────────────────────────────────────

export function startOutboxWorker(): void {
  if (timer) {
    console.warn("[outbox] worker already started");
    return;
  }
  timer = setInterval(() => {
    void processOutbox();
  }, POLL_INTERVAL_MS);
  console.log(`[outbox] worker started (poll=${POLL_INTERVAL_MS}ms, batch=${BATCH_SIZE}, maxAttempts=${MAX_ATTEMPTS})`);
}

export function stopOutboxWorker(): void {
  if (timer) {
    clearInterval(timer);
    timer = null;
    console.log("[outbox] worker stopped");
  }
}

/**
 * One tick of the loop. Exposed for tests + manual trigger.
 *
 * Picks up to BATCH_SIZE pending rows with `FOR UPDATE SKIP LOCKED`,
 * fans them out, marks each row sent/failed/dead. The transaction holds
 * the lock for the duration so a concurrent worker on another node sees
 * SKIP LOCKED and grabs different rows.
 */
export async function processOutbox(): Promise<void> {
  if (inFlight) return; // Drop this tick; previous one still running.
  inFlight = true;
  try {
    await db.transaction(async (tx) => {
      const pending = await tx.execute(sql`
        SELECT id, topic, module, scope_type, scope_id, payload, server_timestamp, attempts
        FROM events_outbox
        WHERE status = 'pending' AND attempts < ${MAX_ATTEMPTS}
        ORDER BY created_at
        LIMIT ${BATCH_SIZE}
        FOR UPDATE SKIP LOCKED
      `);

      // tx.execute returns { rows: [...] } on neon-serverless.
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const rows: any[] = (pending as any).rows ?? (Array.isArray(pending) ? pending : []);

      for (const row of rows) {
        const id: string = row.id;
        const attempts: number = Number(row.attempts ?? 0);
        try {
          dispatchOne({
            topic: row.topic,
            module: row.module,
            scopeType: row.scope_type as EventScopeType,
            scopeId: Number(row.scope_id),
            payload: row.payload ?? {},
            serverTimestamp: row.server_timestamp instanceof Date
              ? row.server_timestamp
              : new Date(row.server_timestamp),
          });

          await tx.update(eventsOutbox)
            .set({
              status: "sent",
              attempts: attempts + 1,
              processedAt: new Date(),
              lastError: null,
            })
            .where(eq(eventsOutbox.id, id));
        } catch (err) {
          const next = attempts + 1;
          const message = err instanceof Error ? err.message : String(err);
          await tx.update(eventsOutbox)
            .set({
              status: next >= MAX_ATTEMPTS ? "dead" : "pending",
              attempts: next,
              lastError: message.slice(0, 1000),
            })
            .where(eq(eventsOutbox.id, id));
          console.warn(`[outbox] dispatch failed for ${id} (attempt ${next}): ${message}`);
        }
      }
    });
  } catch (err) {
    // Top-level errors (DB unreachable, lock timeout, etc.) — don't kill
    // the loop, just log and let the next tick try again.
    console.error("[outbox] tick failed:", err);
  } finally {
    inFlight = false;
  }
}

// ── Dispatcher ─────────────────────────────────────────────────────────────

interface DispatchArgs {
  topic: string;
  module: string;
  scopeType: EventScopeType;
  scopeId: number;
  payload: Record<string, unknown>;
  serverTimestamp: Date;
}

/**
 * Routes an outbox row to the right WS emit primitive based on
 * `scopeType`. Today we support `campaign` (placement events). Adding
 * `broadcast` and `user` is a follow-up — they'll plug in here without
 * touching `processOutbox` itself.
 */
function dispatchOne(args: DispatchArgs): void {
  const envelope: WsEventEnvelope = {
    type: args.topic,
    module: args.module as WsEventEnvelope["module"],
    serverTimestamp: args.serverTimestamp.toISOString(),
    ...args.payload,
  };
  const message = JSON.stringify(envelope);

  switch (args.scopeType) {
    case "campaign":
      // Pass `module` so the WS layer applies per-socket subscription
      // filtering. Sockets that never sent `subscribe` remain on the
      // firehose path (backward-compat for dashboard / legacy SDKs).
      broadcastToCampaign(args.scopeId, message, args.module);
      return;
    case "broadcast":
      // Future: broadcast-scoped emit. Throwing keeps the row in
      // 'failed' state until the primitive lands rather than silently
      // dropping events.
      throw new Error(
        `[outbox] scope_type='broadcast' not implemented yet (event topic='${args.topic}')`,
      );
    case "user":
      // Future: direct user emit (cart-intent migration target).
      throw new Error(
        `[outbox] scope_type='user' not implemented yet (event topic='${args.topic}')`,
      );
    default:
      throw new Error(`[outbox] unknown scope_type '${args.scopeType}'`);
  }
}
