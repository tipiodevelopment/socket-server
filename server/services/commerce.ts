/**
 * Commerce GraphQL — verification of a sponsor's channel key.
 *
 * A sponsor sells through ONE commerce channel, and `sponsors.commerce_api_key`
 * is what makes it real: Vio sends it as the Authorization header to fetch that
 * channel's products. A wrong key produces a sponsor that looks configured but
 * renders nothing, so we check it at save time instead of at campaign time.
 *
 * One Commerce user may own several channels with different keys — the key is
 * the CHANNEL selector, which is why it is pasted by hand rather than derived.
 */

const COMMERCE_URL = () => process.env.COMMERCE_GRAPHQL_URL;

export type KeyCheck =
  | { status: 'valid' }
  | { status: 'invalid'; reason: string }
  /** No COMMERCE_GRAPHQL_URL configured — we cannot tell, so we don't block. */
  | { status: 'unknown'; reason: string };

/**
 * Ping Commerce with the key. Uses the cheapest possible query (`{__typename}`)
 * so it costs nothing beyond the auth check.
 */
export async function verifyCommerceApiKey(apiKey: string, timeoutMs = 8000): Promise<KeyCheck> {
  const url = COMMERCE_URL();
  if (!url) return { status: 'unknown', reason: 'COMMERCE_GRAPHQL_URL is not configured' };

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: apiKey },
      body: JSON.stringify({ query: '{__typename}' }),
      signal: controller.signal,
    });
    const body = await res.json().catch(() => null) as
      | { data?: unknown; errors?: Array<{ message?: string; extensions?: { code?: string } }> }
      | null;

    if (body?.data) return { status: 'valid' };

    const err = body?.errors?.[0];
    // Commerce answers 500 + UNAUTHENTICATED for a bad key, so trust the payload
    // over the HTTP status.
    if (err?.extensions?.code === 'UNAUTHENTICATED' || /auth/i.test(err?.message ?? '')) {
      return { status: 'invalid', reason: err?.message || 'Authentication failed' };
    }
    if (err) return { status: 'unknown', reason: err.message || 'Commerce returned an error' };
    return { status: 'unknown', reason: `Unexpected response (HTTP ${res.status})` };
  } catch (e) {
    // Network trouble or timeout: we genuinely don't know, so don't block a save.
    const msg = (e as Error).name === 'AbortError' ? 'Commerce did not answer in time' : (e as Error).message;
    return { status: 'unknown', reason: msg };
  } finally {
    clearTimeout(timer);
  }
}
