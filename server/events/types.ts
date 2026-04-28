/**
 * Wire-level types for the events_outbox + WS subscribe protocol.
 *
 * These types describe what crosses two boundaries:
 *   1. HTTP handler → outbox row (`enqueueEvent` argument)
 *   2. Worker → WS client JSON message (after wrapping with topic/module/timestamp)
 *
 * Adding a new event in the future = add the payload interface here, the
 * topic constant, and one case in the SDK switch. No table change.
 *
 * Sprint 2026-04-28 PM. See TASK_PLACEMENTS.md "Sprint 2026-04-28 PM".
 */

// ────────────────────────────────────────────────────────────────────────────
// Modules — bucket for client-side subscription filtering.
// ────────────────────────────────────────────────────────────────────────────

export const EVENT_MODULES = [
  "placements",
  "engagement",
  "broadcast",
  "cart_intent",
] as const;

export type EventModule = (typeof EVENT_MODULES)[number];

// ────────────────────────────────────────────────────────────────────────────
// Scopes — routing target. Determines which WS connections receive the event.
// ────────────────────────────────────────────────────────────────────────────
//   'campaign'  → all sockets on /ws/:campaignId
//   'broadcast' → broadcast-scoped subscribers (future)
//   'user'      → direct unicast to a specific end_user (cart-intent today)

export const EVENT_SCOPE_TYPES = ["campaign", "broadcast", "user"] as const;
export type EventScopeType = (typeof EVENT_SCOPE_TYPES)[number];

// ────────────────────────────────────────────────────────────────────────────
// Topic registry — every wire `type` value lives here.
// ────────────────────────────────────────────────────────────────────────────
// Naming rule: <module-singular>_<verb>_<noun>. Past-tense verb because
// the event describes something that already happened on the server.

export const PLACEMENT_TOPICS = {
  STATUS_CHANGED: "placement_status_changed",
  CONFIG_UPDATED: "placement_config_updated",
  ACTIVATION_SWAPPED: "placement_activation_swapped",
} as const;

export type PlacementTopic =
  (typeof PLACEMENT_TOPICS)[keyof typeof PLACEMENT_TOPICS];

// ────────────────────────────────────────────────────────────────────────────
// Placement event payloads.
// ────────────────────────────────────────────────────────────────────────────
// These are the `payload` JSONB shapes. The worker wraps them with
// `{type, module, serverTimestamp, ...payload}` before sending to clients,
// so don't repeat those wrapping fields here.

/**
 * Operator paused or resumed a placement binding. Hard cut on the SDK
 * side — no animation. `inactive` makes the carousel disappear; `active`
 * brings it back (config + products are unchanged).
 *
 * Naming note: the dashboard exposes this as "Pause" / "Resume" verbs to
 * the operator, but the underlying DB column is `campaign_components.status`
 * which stores `'active' | 'inactive'`. The wire payload mirrors the DB
 * vocabulary; the SDK is free to render "Paused" in UI copy.
 */
export interface PlacementStatusChangedPayload {
  campaignId: number;
  appPlacementId: number;
  campaignComponentId: number;
  /** New value of campaign_components.status. */
  status: "active" | "inactive";
}

/**
 * Operator changed customConfig (productIds, title, layout, autoPlay,
 * interval, showSponsorLogo, etc.). The SDK applies the new config in
 * place. If `productIdsChanged=true`, the view shows a brief skeleton
 * while reloading the catalog; otherwise the swap is silent.
 */
export interface PlacementConfigUpdatedPayload {
  campaignId: number;
  appPlacementId: number;
  campaignComponentId: number;
  /** Full merged config (templateConfig + customConfig overlay). */
  customConfig: Record<string, unknown>;
  /** Hint for the SDK to decide whether to show a skeleton. */
  productIdsChanged: boolean;
}

/**
 * Multi-sponsor rotation: within a single (campaignId, appPlacementId)
 * the active campaign_components row swapped from A → B. Atomic at the
 * DB layer (single transaction). One event, two component IDs so the
 * SDK can replace the active component cleanly.
 */
export interface PlacementActivationSwappedPayload {
  campaignId: number;
  appPlacementId: number;
  fromCampaignComponentId: number;
  toCampaignComponentId: number;
  fromSponsorId: number | null;
  toSponsorId: number | null;
  /** Full new component shape (config + sponsor metadata) so the SDK
   * doesn't need a follow-up GET to render. */
  newComponent: {
    id: number;
    componentTypeId: string;
    sponsorId: number | null;
    customConfig: Record<string, unknown> | null;
    status: "active" | "inactive";
  };
}

// ────────────────────────────────────────────────────────────────────────────
// Outbox row argument shape (HTTP handler → enqueueEvent).
// ────────────────────────────────────────────────────────────────────────────

export interface EnqueueEventArgs {
  topic: string;
  module: EventModule;
  scopeType: EventScopeType;
  scopeId: number;
  payload: Record<string, unknown>;
}

// ────────────────────────────────────────────────────────────────────────────
// WS message envelope sent to clients.
// ────────────────────────────────────────────────────────────────────────────
// What ends up on the wire after the worker JSON.stringify's a row.

export interface WsEventEnvelope<TPayload = Record<string, unknown>> {
  type: string;
  module: EventModule;
  serverTimestamp: string; // ISO-8601, UTC
  // …payload fields are spread at the top level (not nested) for
  // backward-compat with the existing event shape used by polls/contests.
  [key: string]: unknown;
  payload?: TPayload; // legacy callers that prefer a nested payload field
}

// ────────────────────────────────────────────────────────────────────────────
// Subscribe protocol (client → server).
// ────────────────────────────────────────────────────────────────────────────

export interface SubscribeMessage {
  type: "subscribe";
  modules: EventModule[];
}

export function isSubscribeMessage(msg: unknown): msg is SubscribeMessage {
  if (typeof msg !== "object" || msg === null) return false;
  const m = msg as Record<string, unknown>;
  if (m.type !== "subscribe") return false;
  if (!Array.isArray(m.modules)) return false;
  return m.modules.every(
    (mod) => typeof mod === "string" && (EVENT_MODULES as readonly string[]).includes(mod)
  );
}
