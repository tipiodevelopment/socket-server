/**
 * Klarna Payments — order creation (Express Checkout completion).
 *
 * The Vio Web SDK's Klarna Express button authorizes the purchase client-side
 * and yields an `authorization_token`. That token is NOT an order — this
 * module exchanges it for a real Klarna order via the Payments API:
 *
 *   POST {base}/payments/v1/authorizations/{authorizationToken}/order
 *   Authorization: Basic base64(username:password)
 *
 * Sandbox ("playground") by default — set KLARNA_API_BASE to go live.
 * Credentials come from env (never hardcoded):
 *   KLARNA_API_USERNAME, KLARNA_API_PASSWORD  (playground vs production-scoped)
 *   KLARNA_API_BASE        (default https://api.playground.klarna.com)
 *
 * Standalone by design — does NOT create a Vio Commerce order. Wiring the
 * resulting order_id into Vio Commerce (PlaceOrder) is a separate step.
 */

const DEFAULT_KLARNA_BASE = "https://api.playground.klarna.com";

/** One order line, amounts in the currency's MINOR unit (øre/cents). */
export interface KlarnaOrderLine {
  name: string;
  quantity: number;
  unit_price: number;
  total_amount: number;
  tax_rate?: number;
  total_tax_amount?: number;
  reference?: string;
  /** Klarna line type, e.g. "shipping_fee" for a shipping line. */
  type?: string;
}

export interface CreateKlarnaOrderInput {
  authorizationToken: string;
  purchaseCountry: string; // e.g. "NO"
  purchaseCurrency: string; // e.g. "NOK"
  locale: string; // e.g. "nb-NO"
  orderLines: KlarnaOrderLine[];
  /** Optional — defaults to sum of line totals (keeps Klarna's amount check happy). */
  orderAmount?: number;
  merchantReference1?: string;
  confirmationUrl?: string;
  /** Capture funds immediately. Default false (authorize → capture on fulfilment). */
  autoCapture?: boolean;
}

export interface KlarnaOrderResult {
  order_id: string;
  redirect_url?: string;
  fraud_status?: string;
  authorized_payment_method?: unknown;
}

/** Thrown when the Klarna API credentials are not configured. */
export class KlarnaConfigError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "KlarnaConfigError";
  }
}

/** Thrown when Klarna rejects the request (non-2xx). Carries the upstream body. */
export class KlarnaApiError extends Error {
  constructor(
    public readonly status: number,
    public readonly body: unknown,
  ) {
    super(`Klarna API error ${status}`);
    this.name = "KlarnaApiError";
  }
}

/**
 * Create a Klarna order from a Klarna Express authorization token.
 * Throws KlarnaConfigError (missing creds) or KlarnaApiError (Klarna 4xx/5xx).
 */
export async function createKlarnaOrder(
  input: CreateKlarnaOrderInput,
): Promise<KlarnaOrderResult> {
  const username = process.env.KLARNA_API_USERNAME;
  const password = process.env.KLARNA_API_PASSWORD;
  if (!username || !password) {
    throw new KlarnaConfigError(
      "KLARNA_API_USERNAME / KLARNA_API_PASSWORD not configured",
    );
  }
  const base = process.env.KLARNA_API_BASE || DEFAULT_KLARNA_BASE;
  const auth = Buffer.from(`${username}:${password}`).toString("base64");

  // Derive amounts from the lines so Klarna's consistency check
  // (order_amount === Σ line.total_amount) always holds.
  const orderAmount =
    input.orderAmount ??
    input.orderLines.reduce((sum, l) => sum + l.total_amount, 0);
  const orderTaxAmount = input.orderLines.reduce(
    (sum, l) => sum + (l.total_tax_amount ?? 0),
    0,
  );

  const body = {
    purchase_country: input.purchaseCountry,
    purchase_currency: input.purchaseCurrency,
    locale: input.locale,
    order_amount: orderAmount,
    order_tax_amount: orderTaxAmount,
    order_lines: input.orderLines.map((l) => ({
      name: l.name,
      quantity: l.quantity,
      unit_price: l.unit_price,
      total_amount: l.total_amount,
      tax_rate: l.tax_rate ?? 0,
      total_tax_amount: l.total_tax_amount ?? 0,
      ...(l.reference ? { reference: l.reference } : {}),
      ...(l.type ? { type: l.type } : {}),
    })),
    ...(input.merchantReference1
      ? { merchant_reference1: input.merchantReference1 }
      : {}),
    ...(input.confirmationUrl
      ? { merchant_urls: { confirmation: input.confirmationUrl } }
      : {}),
    auto_capture: input.autoCapture ?? false,
  };

  const url = `${base}/payments/v1/authorizations/${encodeURIComponent(
    input.authorizationToken,
  )}/order`;

  const res = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Basic ${auth}`,
    },
    body: JSON.stringify(body),
  });

  const text = await res.text();
  let json: any;
  try {
    json = text ? JSON.parse(text) : undefined;
  } catch {
    json = text;
  }

  if (!res.ok) {
    throw new KlarnaApiError(res.status, json);
  }
  return json as KlarnaOrderResult;
}

/** Resolve credentials + base URL, or throw KlarnaConfigError. */
function klarnaAuth(): { base: string; auth: string } {
  const username = process.env.KLARNA_API_USERNAME;
  const password = process.env.KLARNA_API_PASSWORD;
  if (!username || !password) {
    throw new KlarnaConfigError(
      "KLARNA_API_USERNAME / KLARNA_API_PASSWORD not configured",
    );
  }
  return {
    base: process.env.KLARNA_API_BASE || DEFAULT_KLARNA_BASE,
    auth: Buffer.from(`${username}:${password}`).toString("base64"),
  };
}

/** A shipping option Klarna can render for the customer to pick. Amounts in minor units. */
export interface KlarnaShippingOption {
  id: string;
  method?: string;
  description?: string;
  price: number;
  tax_amount?: number;
  tax_rate?: number;
  preselected?: boolean;
  shipping_method?: string;
}

export interface CreateKlarnaSessionInput {
  purchaseCountry: string; // e.g. "NO"
  purchaseCurrency: string; // e.g. "NOK"
  locale: string; // e.g. "nb-NO"
  orderLines: KlarnaOrderLine[];
  /** Optional — defaults to sum of line totals. */
  orderAmount?: number;
  /** Optional shipping choices Klarna shows in its flow. */
  shippingOptions?: KlarnaShippingOption[];
}

export interface KlarnaPaymentMethodCategory {
  identifier: string;
  name: string;
  asset_urls?: { descriptive?: string; standard?: string };
}

export interface KlarnaSessionResult {
  session_id: string;
  client_token: string;
  payment_method_categories?: KlarnaPaymentMethodCategory[];
}

/**
 * Create a Klarna Payments **session**. Returns a `client_token` the browser
 * feeds to the Klarna Payments widget (`Klarna.Payments.init`), plus the
 * available `payment_method_categories`. This is the server half of the
 * classic (widget) flow — no public clientId / origin handshake involved.
 *
 *   POST {base}/payments/v1/sessions   (Basic auth)
 *
 * Throws KlarnaConfigError (missing creds) or KlarnaApiError (Klarna 4xx/5xx).
 */
export async function createKlarnaSession(
  input: CreateKlarnaSessionInput,
): Promise<KlarnaSessionResult> {
  const { base, auth } = klarnaAuth();

  const orderAmount =
    input.orderAmount ??
    input.orderLines.reduce((sum, l) => sum + l.total_amount, 0);
  const orderTaxAmount = input.orderLines.reduce(
    (sum, l) => sum + (l.total_tax_amount ?? 0),
    0,
  );

  const body = {
    purchase_country: input.purchaseCountry,
    purchase_currency: input.purchaseCurrency,
    locale: input.locale,
    order_amount: orderAmount,
    order_tax_amount: orderTaxAmount,
    order_lines: input.orderLines.map((l) => ({
      name: l.name,
      quantity: l.quantity,
      unit_price: l.unit_price,
      total_amount: l.total_amount,
      tax_rate: l.tax_rate ?? 0,
      total_tax_amount: l.total_tax_amount ?? 0,
      ...(l.reference ? { reference: l.reference } : {}),
      ...(l.type ? { type: l.type } : {}),
    })),
    ...(input.shippingOptions && input.shippingOptions.length > 0
      ? { shipping_options: input.shippingOptions }
      : {}),
  };

  const res = await fetch(`${base}/payments/v1/sessions`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Basic ${auth}`,
    },
    body: JSON.stringify(body),
  });

  const text = await res.text();
  let json: any;
  try {
    json = text ? JSON.parse(text) : undefined;
  } catch {
    json = text;
  }
  if (!res.ok) {
    throw new KlarnaApiError(res.status, json);
  }
  return json as KlarnaSessionResult;
}
