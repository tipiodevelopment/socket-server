import { Campaign } from "@shared/schema";

/**
 * Cached base URL detected at server startup
 * Set via setBaseUrl() during server initialization
 */
let cachedBaseUrl: string | null = null;

/**
 * Check if a campaign is currently active based on its endDate
 * @param campaign The campaign to check
 * @returns true if campaign is active (endDate is null or in the future)
 */
export function isCampaignActive(campaign: Campaign): boolean {
  if (!campaign.endDate) {
    return true; // No end date means campaign runs indefinitely
  }
  
  const now = new Date();
  const endDate = new Date(campaign.endDate);
  
  return endDate > now;
}

/**
 * Detect and set the base URL at server startup
 * This should be called once when the server starts
 */
export function detectAndCacheBaseUrl(): void {
  // Try REPLIT_DOMAINS first (Replit production)
  if (process.env.REPLIT_DOMAINS) {
    const domains = process.env.REPLIT_DOMAINS.split(',');
    cachedBaseUrl = `https://${domains[0]}`;
    console.log(`[Utils] Detected base URL from REPLIT_DOMAINS: ${cachedBaseUrl}`);
    return;
  }
  
  // Try REPL_SLUG + REPL_OWNER (Replit alternative format)
  if (process.env.REPL_SLUG && process.env.REPL_OWNER) {
    cachedBaseUrl = `https://${process.env.REPL_SLUG}-${process.env.REPL_OWNER}.replit.app`;
    console.log(`[Utils] Detected base URL from REPL_SLUG: ${cachedBaseUrl}`);
    return;
  }
  
  // Try VERCEL_URL (Vercel deployments)
  if (process.env.VERCEL_URL) {
    cachedBaseUrl = `https://${process.env.VERCEL_URL}`;
    console.log(`[Utils] Detected base URL from VERCEL_URL: ${cachedBaseUrl}`);
    return;
  }
  
  // Try RAILWAY_PUBLIC_DOMAIN (Railway deployments)
  if (process.env.RAILWAY_PUBLIC_DOMAIN) {
    cachedBaseUrl = `https://${process.env.RAILWAY_PUBLIC_DOMAIN}`;
    console.log(`[Utils] Detected base URL from RAILWAY_PUBLIC_DOMAIN: ${cachedBaseUrl}`);
    return;
  }
  
  // Try custom PUBLIC_URL environment variable (recommended for production)
  if (process.env.PUBLIC_URL) {
    cachedBaseUrl = process.env.PUBLIC_URL;
    console.log(`[Utils] Using base URL from PUBLIC_URL: ${cachedBaseUrl}`);
    return;
  }
  
  // Development fallback
  if (process.env.NODE_ENV === 'development') {
    cachedBaseUrl = 'http://localhost:5000';
    console.log(`[Utils] Using development base URL: ${cachedBaseUrl}`);
    return;
  }
  
  // Production without env vars - this should be configured!
  console.warn('[Utils] WARNING: No base URL env vars found. Set PUBLIC_URL environment variable for production deployments.');
  cachedBaseUrl = null;
}

/**
 * Get the base URL for this server instance
 * Can optionally derive from request if env vars are not configured
 * @param protocol Optional protocol from request (e.g., 'https')
 * @param host Optional host from request (e.g., 'example.com')
 * @returns The base URL (e.g., https://event-streamer-angelo100.replit.app)
 */
export function getBaseUrl(protocol?: string, host?: string): string {
  // If we have a cached value, use it
  if (cachedBaseUrl) {
    return cachedBaseUrl;
  }
  
  // If request context is provided, derive from it and cache for future use
  if (protocol && host) {
    const derivedUrl = `${protocol}://${host}`;
    console.log(`[Utils] Derived base URL from request: ${derivedUrl}`);
    cachedBaseUrl = derivedUrl; // Cache for WebSocket and future requests
    return derivedUrl;
  }
  
  // Final fallback - this should only happen in misconfigured production
  console.error('[Utils] ERROR: Base URL not configured and no request context available. Using localhost fallback.');
  return 'http://localhost:5000';
}

/**
 * Convert relative object storage URLs to absolute URLs
 * @param value Any value that might contain URLs
 * @param protocol Optional protocol from request (e.g., 'https')
 * @param host Optional host from request (e.g., 'example.com')
 * @returns The same value with URLs normalized to absolute
 */
export function normalizeUrls(value: any, protocol?: string, host?: string): any {
  if (value === null || value === undefined) {
    return value;
  }
  
  // If it's a string that looks like an object storage path, convert it
  if (typeof value === 'string' && value.startsWith('/objects/')) {
    return `${getBaseUrl(protocol, host)}${value}`;
  }
  
  // If it's an array, normalize each element
  if (Array.isArray(value)) {
    return value.map(item => normalizeUrls(item, protocol, host));
  }
  
  // If it's an object, normalize all properties
  if (typeof value === 'object') {
    const normalized: any = {};
    for (const [key, val] of Object.entries(value)) {
      normalized[key] = normalizeUrls(val, protocol, host);
    }
    return normalized;
  }
  
  // Return primitive values as-is
  return value;
}
