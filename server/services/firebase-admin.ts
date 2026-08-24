import { initializeApp, cert, getApps, type App } from "firebase-admin/app";
import { getAuth, type Auth } from "firebase-admin/auth";
import { readFileSync } from "fs";
import { randomBytes } from "crypto";

/**
 * Firebase Admin SDK — used to CREATE the Firebase identity for a dashboard
 * user (so "Add user" in the dashboard yields a login-able account), which the
 * token-verification path (middleware/firebase-auth.ts, JWKS-only) can't do.
 *
 * The service account is a SECRET: it's loaded from a gitignored file whose
 * path is in FIREBASE_SERVICE_ACCOUNT_PATH. If that env is missing the SDK
 * degrades gracefully (isFirebaseAdminEnabled() === false) and user creation
 * falls back to inserting the DB row only.
 */

let app: App | null = null;
let initTried = false;

function init(): App | null {
  if (initTried) return app;
  initTried = true;
  const path = process.env.FIREBASE_SERVICE_ACCOUNT_PATH;
  if (!path) return null;
  try {
    const cred = JSON.parse(readFileSync(path, "utf8"));
    app = getApps()[0] ?? initializeApp({ credential: cert(cred) });
  } catch (e) {
    console.error("[firebase-admin] init failed:", (e as Error).message);
    app = null;
  }
  return app;
}

export function isFirebaseAdminEnabled(): boolean {
  return init() !== null;
}

function adminAuth(): Auth {
  const a = init();
  if (!a) throw new Error("Firebase Admin not configured (FIREBASE_SERVICE_ACCOUNT_PATH missing)");
  return getAuth(a);
}

/** Strong random temp password (satisfies any Firebase length/complexity policy). */
export function generateTempPassword(): string {
  return randomBytes(12).toString("base64url").slice(0, 14) + "!7";
}

export interface EnsuredFirebaseUser {
  uid: string;
  /** The generated temp password — only set when we CREATED the account. */
  tempPassword: string | null;
  /** True when a Firebase account for this email already existed (we linked it). */
  existed: boolean;
}

/**
 * Ensure a Firebase account exists for `email`. If one already exists, return
 * its uid (we don't touch its password). Otherwise create it with a generated
 * temp password and return both. Idempotent + safe to call on every "Add user".
 */
export async function ensureFirebaseUser(
  email: string,
  displayName?: string | null,
): Promise<EnsuredFirebaseUser> {
  const auth = adminAuth();
  try {
    const existing = await auth.getUserByEmail(email);
    return { uid: existing.uid, tempPassword: null, existed: true };
  } catch (e) {
    const code = (e as { errorInfo?: { code?: string }; code?: string }).errorInfo?.code
      ?? (e as { code?: string }).code;
    if (code !== "auth/user-not-found") throw e;
  }
  const tempPassword = generateTempPassword();
  const created = await auth.createUser({
    email,
    password: tempPassword,
    displayName: displayName ?? undefined,
    emailVerified: false,
  });
  return { uid: created.uid, tempPassword, existed: false };
}

/** Delete a Firebase account by uid — used to roll back if the DB insert fails. */
export async function deleteFirebaseUser(uid: string): Promise<void> {
  await adminAuth().deleteUser(uid);
}

export type SignupKind = "business" | "channel";

export interface PendingSignup {
  uid: string;
  email: string | null;
  displayName: string | null;
  brandName: string | null;
  kind: SignupKind;
}

/**
 * List Firebase identities the Commerce signup marked as a **business/brand**
 * (`business`) or a **channel** (`channel`) — top-level custom claims.
 * Populates Vio's pending-assignment inbox; the super_admin assigns the Vio
 * role from there. `brand_name`/`channel_name` carry the display label.
 *
 * CONTRACT with Commerce (coordinate the exact keys with vio-users-microservice):
 * bare booleans `business` / `channel` (we also tolerate `isBusiness`/`isChannel`).
 *
 * Paginates the whole project (staging-sized scan; revisit if the shared pool
 * grows large). Google/login-only identities carry no claim, so they never
 * appear here — those go through manual "Add user".
 */
export async function listPendingSignups(): Promise<PendingSignup[]> {
  const auth = adminAuth();
  const out: PendingSignup[] = [];
  let pageToken: string | undefined;
  do {
    const page = await auth.listUsers(1000, pageToken);
    for (const u of page.users) {
      const c = (u.customClaims ?? {}) as Record<string, unknown>;
      const isChannel = c.channel === true || c.isChannel === true;
      const isBusiness = c.business === true || c.isBusiness === true;
      if (!isChannel && !isBusiness) continue;
      const brandName =
        typeof c.brand_name === "string" ? c.brand_name
        : typeof c.channel_name === "string" ? c.channel_name
        : null;
      out.push({
        uid: u.uid,
        email: u.email ?? null,
        displayName: u.displayName ?? null,
        brandName,
        kind: isChannel ? "channel" : "business",
      });
    }
    pageToken = page.pageToken;
  } while (pageToken);
  return out;
}
