/**
 * Server-side analytics mirror (F4 of the Vio Analytics plan).
 *
 * The funnel's server half: `ad_activation` and `cart_intent` are truths
 * only the backend knows (the slot-scheduler fired an ad; a TV user marked
 * "buy"). This module mirrors them to the vio-analytics collector through
 * the SAME transactional outbox that ships WS events — so a mirrored event
 * exists iff the data change committed, and delivery reuses the worker's
 * retries + dead-letter.
 *
 * Wire contract: vio-analytics `docs/EVENTS_CONTRACT.md` (repo
 * vio-live/vio-analytics). We build plain JSON here — the collector
 * validates everything at ingest; no schema dependency needed.
 *
 * Config (both required, otherwise mirroring is OFF and nothing enqueues):
 *   ANALYTICS_EVENTS_URL      e.g. https://events-dev.vio.live  (no path)
 *   ANALYTICS_INTERNAL_TOKEN  shared secret (collector's INTERNAL_EVENTS_TOKEN)
 *
 * Anti-double-count: these two names are `surface:'server'`-only in the
 * contract — clients can't forge them, and we never mirror what clients
 * already report (impressions, purchases).
 */

import { randomUUID } from "crypto";
import { eq } from "drizzle-orm";
import { endUsers, type CartIntent, type ShoppableAdActivation } from "@shared/schema";
import { enqueueEvent } from "./outbox";

export const ANALYTICS_MIRROR_TOPIC = "analytics_mirror";

export function isAnalyticsMirrorEnabled(): boolean {
  return Boolean(process.env.ANALYTICS_EVENTS_URL && process.env.ANALYTICS_INTERNAL_TOKEN);
}

/** Same loose tx type used by the outbox helper (see outbox.ts rationale). */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type DrizzleTxOrDb = any;

/**
 * Outbox payload shape for module:'analytics' rows. The worker POSTs
 * `{ client_app_id, events: [event] }` to the collector verbatim.
 */
export interface AnalyticsMirrorPayload {
  client_app_id: number;
  event: Record<string, unknown>;
  [key: string]: unknown; // satisfies EnqueueEventArgs['payload']
}

function num(v: unknown): number | undefined {
  const n = Number(v);
  return Number.isFinite(n) ? n : undefined;
}

/**
 * Mirror a shoppable-ad activation. Call INSIDE the same transaction as
 * the activation insert, with the returned row. No-op when mirroring is
 * off or the row can't be attributed to a client_app.
 */
export async function enqueueAdActivationMirror(
  tx: DrizzleTxOrDb,
  activation: ShoppableAdActivation,
  /** Fallback when the activation row has no clientAppId of its own. */
  fallbackClientAppId?: number | null,
): Promise<void> {
  if (!isAnalyticsMirrorEnabled()) return;
  const clientAppId = activation.clientAppId ?? fallbackClientAppId;
  if (!clientAppId) return; // legacy rows without app attribution — nothing to key the tenant on

  const snapshot = (activation.productSnapshot ?? {}) as Record<string, unknown>;
  const currency = typeof snapshot.currency === "string" ? snapshot.currency : undefined;
  const price = num(snapshot.price);

  const event: Record<string, unknown> = {
    // Generated at enqueue time and persisted in the outbox row, so worker
    // retries re-send the SAME event_id and the collector dedupes.
    event_id: randomUUID(),
    name: "ad_activation",
    ts: (activation.triggeredAt ?? new Date()).toISOString(),
    surface: "server",
    context: {
      campaign_id: activation.campaignId,
      broadcast_id: activation.broadcastId,
      sponsor_id: activation.sponsorId ?? undefined,
      activation_id: activation.id,
    },
    commerce: {
      items: [
        {
          product_id: String(activation.productId),
          ...(typeof snapshot.name === "string" ? { name: snapshot.name } : {}),
          ...(price !== undefined ? { price } : {}),
        },
      ],
      ...(price !== undefined ? { value: price } : {}),
      ...(currency ? { currency } : {}),
    },
    props: {
      source: activation.source,
      ...(activation.slotId ? { slot_id: activation.slotId } : {}),
    },
  };

  await enqueueEvent(tx, {
    topic: ANALYTICS_MIRROR_TOPIC,
    module: "analytics",
    scopeType: "campaign", // routing metadata only; the worker branches on module before scope
    scopeId: activation.campaignId,
    payload: { client_app_id: clientAppId, event } satisfies AnalyticsMirrorPayload,
  });
}

/**
 * Mirror a cart intent. Call INSIDE the same transaction as the intent
 * insert. Resolves the partner's external_user_id in the same tx so the
 * mirrored event joins with client-side identified events.
 */
export async function enqueueCartIntentMirror(
  tx: DrizzleTxOrDb,
  intent: CartIntent,
): Promise<void> {
  if (!isAnalyticsMirrorEnabled()) return;

  let externalUserId: string | undefined;
  try {
    const [endUser] = await tx
      .select({ externalUserId: endUsers.externalUserId })
      .from(endUsers)
      .where(eq(endUsers.id, intent.endUserId));
    externalUserId = endUser?.externalUserId ?? undefined;
  } catch {
    // Attribution enrichment must never break the intent write.
  }

  const event: Record<string, unknown> = {
    event_id: randomUUID(),
    name: "cart_intent",
    ts: (intent.triggeredAt ?? new Date()).toISOString(),
    surface: "server",
    ...(externalUserId ? { external_user_id: externalUserId } : {}),
    context: {
      campaign_id: intent.campaignId,
      sponsor_id: intent.sponsorId ?? undefined,
      activation_id: intent.sourceActivationId ?? undefined,
      campaign_component_id: intent.sourceComponentId ?? undefined,
      tv_session_id: intent.tvSessionId ?? undefined,
    },
    commerce: { items: [{ product_id: String(intent.productId) }] },
    props: {
      delivery_mode: intent.deliveryMode,
      user_connected: intent.userConnected,
    },
  };

  await enqueueEvent(tx, {
    topic: ANALYTICS_MIRROR_TOPIC,
    module: "analytics",
    scopeType: "campaign",
    scopeId: intent.campaignId,
    payload: { client_app_id: intent.clientAppId, event } satisfies AnalyticsMirrorPayload,
  });
}

/**
 * Worker-side dispatch: POST one mirrored event to the collector.
 * Throws on failure so the outbox marks the row for retry (and dead
 * after MAX_ATTEMPTS). Bounded by a 5s timeout — the worker holds row
 * locks while this runs.
 */
export async function dispatchAnalyticsMirror(payload: Record<string, unknown>): Promise<void> {
  const base = process.env.ANALYTICS_EVENTS_URL;
  const token = process.env.ANALYTICS_INTERNAL_TOKEN;
  if (!base || !token) {
    throw new Error("[analytics-mirror] ANALYTICS_EVENTS_URL / ANALYTICS_INTERNAL_TOKEN not configured");
  }
  const { client_app_id, event } = payload as unknown as AnalyticsMirrorPayload;

  const res = await fetch(`${base.replace(/\/$/, "")}/v1/events`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Internal-Token": token,
    },
    body: JSON.stringify({ client_app_id, events: [event] }),
    signal: AbortSignal.timeout(5_000),
  });
  if (res.status !== 202) {
    const body = await res.text().catch(() => "");
    throw new Error(`[analytics-mirror] collector returned ${res.status}: ${body.slice(0, 300)}`);
  }
  // 202 alone isn't success: the collector validates per-event and can
  // reject ours while still returning 202. Treat rejection as failure so
  // the outbox retries and (after MAX_ATTEMPTS) dead-letters with the
  // reason — silent loss is the one unacceptable outcome.
  const result = (await res.json().catch(() => null)) as {
    accepted?: number;
    rejected?: number;
    errors?: Array<{ index: number; reason: string }>;
  } | null;
  if (!result || result.accepted !== 1) {
    const reason = result?.errors?.[0]?.reason ?? "no acceptance reported";
    throw new Error(`[analytics-mirror] event rejected by collector: ${reason}`);
  }
}
