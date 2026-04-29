/**
 * Outbox enqueue helper.
 *
 * HTTP handlers call `enqueueEvent(tx, args)` INSIDE the same Drizzle
 * transaction as the data UPDATE. Atomicity guarantees the event will be
 * emitted iff the data change committed.
 *
 * The worker (server/events/worker.ts) is responsible for actually
 * shipping the row to WS clients; this helper just persists the intent.
 *
 * Sprint 2026-04-28 PM. See server/events/types.ts for payload shapes.
 */

import { eventsOutbox } from "@shared/schema";
import type { EnqueueEventArgs } from "./types";

/**
 * Drizzle's transaction callback parameter type. Kept loose (`any`) to
 * mirror server/storage.ts which passes `tx` around without explicit
 * typing — Drizzle's actual type is `PgTransaction<…>` parameterized
 * over the schema and pg dialect, and importing it adds friction with
 * the neon-serverless adapter we use. The runtime contract is "anything
 * with .insert(...).values(...)" which is true for both `db` and `tx`.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type DrizzleTxOrDb = any;

/**
 * Enqueue an event for the worker to ship. MUST be called inside a
 * Drizzle transaction so it commits atomically with the data change.
 *
 * Example:
 * ```ts
 * await db.transaction(async (tx) => {
 *   await tx.update(campaignComponents).set({status: 'paused'}).where(...);
 *   await enqueueEvent(tx, {
 *     topic: PLACEMENT_TOPICS.STATUS_CHANGED,
 *     module: 'placements',
 *     scopeType: 'campaign',
 *     scopeId: 36,
 *     payload: { campaignId: 36, appPlacementId: 5, ... }
 *   });
 * });
 * ```
 */
export async function enqueueEvent(
  tx: DrizzleTxOrDb,
  args: EnqueueEventArgs,
): Promise<void> {
  await tx.insert(eventsOutbox).values({
    topic: args.topic,
    module: args.module,
    scopeType: args.scopeType,
    scopeId: args.scopeId,
    payload: args.payload,
    // status, attempts, server_timestamp, created_at all default in DB.
  });
}
