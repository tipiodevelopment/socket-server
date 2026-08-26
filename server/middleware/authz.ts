import type { Request, Response, RequestHandler } from "express";
import jwt from "jsonwebtoken";
import type { User } from "@shared/schema";
import type { FirebaseIdentity } from "./firebase-auth";
import { can, requiredCapabilityFor, type Role } from "./capabilities";

// Operator sessions (ADR-0007, F2/F3).
//
// The login page exchanges a verified Firebase ID token for a first-party
// httpOnly cookie holding a short JWT with the users.id. Every /api request
// re-reads the users row, so role changes and de-provisioning apply on the
// next request — no token revocation problem. The dashboard's existing
// fetch() calls already send credentials, so no client call-site changes.

export const SESSION_COOKIE = "vio_session";
const SESSION_TTL_SECONDS = 7 * 24 * 60 * 60;

declare global {
  namespace Express {
    interface Request {
      operator?: User;
    }
  }
}

function sessionSecret(): string {
  // Same fallback routes.ts uses for its JWT_SECRET.
  return process.env.SESSION_SECRET || "default-dev-secret";
}

export function createSessionToken(operatorId: number): string {
  return jwt.sign({ operatorId }, sessionSecret(), { expiresIn: SESSION_TTL_SECONDS });
}

export function setSessionCookie(res: Response, token: string): void {
  res.cookie(SESSION_COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV !== "development",
    maxAge: SESSION_TTL_SECONDS * 1000,
    path: "/",
  });
}

export function clearSessionCookie(res: Response): void {
  res.clearCookie(SESSION_COOKIE, { path: "/" });
}

function parseCookies(header: string | undefined): Record<string, string> {
  const out: Record<string, string> = {};
  if (!header) return out;
  for (const part of header.split(";")) {
    const eq = part.indexOf("=");
    if (eq === -1) continue;
    const key = part.slice(0, eq).trim();
    if (key) out[key] = decodeURIComponent(part.slice(eq + 1).trim());
  }
  return out;
}

export function readSessionOperatorId(req: Request): number | null {
  const token = parseCookies(req.headers.cookie)[SESSION_COOKIE];
  if (!token) return null;
  try {
    const decoded = jwt.verify(token, sessionSecret()) as { operatorId?: number };
    return typeof decoded.operatorId === "number" ? decoded.operatorId : null;
  } catch {
    return null;
  }
}

// ── Allowlist resolution ─────────────────────────────────────────────────

export interface OperatorDirectory {
  getUserByFirebaseUid(uid: string): Promise<User | undefined>;
  getUserByEmailInsensitive(email: string): Promise<User | undefined>;
  updateUser(id: number, data: Partial<{ firebaseUid: string; name: string | null }>): Promise<User | undefined>;
  createUser(data: { email: string; name?: string | null; firebaseUid: string; role: Role }): Promise<User>;
}

function bootstrapAdminEmails(): string[] {
  return (process.env.ADMIN_EMAILS ?? "")
    .split(",")
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean);
}

/**
 * Strict allowlist (owner decision 2026-06-10): a verified Firebase identity
 * only gets a session if a users row already exists for it. Match order:
 * firebase_uid, then email (linking the uid on first login). The only
 * exception is ADMIN_EMAILS — bootstrap so the first super_admin can
 * provision everyone else without touching SQL.
 */
export async function resolveAllowlistedOperator(
  dir: OperatorDirectory,
  identity: FirebaseIdentity,
): Promise<User | null> {
  const byUid = await dir.getUserByFirebaseUid(identity.uid);
  if (byUid) return byUid;

  const email = identity.email?.toLowerCase();
  if (!email) return null;

  const byEmail = await dir.getUserByEmailInsensitive(email);
  if (byEmail) {
    if (byEmail.firebaseUid && byEmail.firebaseUid !== identity.uid) {
      console.warn(`[authz] email ${email} is linked to another Firebase uid — refusing session`);
      return null;
    }
    const linked = await dir.updateUser(byEmail.id, {
      firebaseUid: identity.uid,
      name: byEmail.name ?? identity.name ?? null,
    });
    return linked ?? null;
  }

  if (bootstrapAdminEmails().includes(email)) {
    return dir.createUser({
      email,
      name: identity.name ?? null,
      firebaseUid: identity.uid,
      role: "super_admin",
    });
  }

  return null;
}

// ── Route policy ─────────────────────────────────────────────────────────

// End-user/demo surface that must stay reachable without an operator
// session (campaign-viewer public page, SDK token bootstrap, health).
const PUBLIC_API: Array<{ method: string; pattern: RegExp }> = [
  { method: "GET", pattern: /^\/api\/status$/ },
  { method: "POST", pattern: /^\/api\/auth\/token$/ },
  { method: "GET", pattern: /^\/api\/campaigns\/\d+$/ },
  { method: "GET", pattern: /^\/api\/events\/\d+$/ },
  // apiKey-authenticated SDK/external endpoints that happen to live under
  // /api. They carry their own apiKey auth (validateApiKey / getSponsorsByApiKey),
  // so they must bypass the OPERATOR session gate, not require a session.
  { method: "POST", pattern: /^\/api\/campaign\/payments\/apikey\/.+$/ },
];

export function isPublicApiPath(method: string, path: string): boolean {
  return PUBLIC_API.some((rule) => rule.method === method && rule.pattern.test(path));
}

// ── The /api gate ────────────────────────────────────────────────────────

export function createApiGate(opts: { loadOperator: (id: number) => Promise<User | undefined> }): RequestHandler {
  return async (req, res, next) => {
    // Mounted at app.use('/api', …): req.path lacks the mount prefix.
    const path = `${req.baseUrl}${req.path}`.replace(/\/+$/, "") || req.baseUrl;
    const method = req.method.toUpperCase();

    if (isPublicApiPath(method, path)) return next();

    const operatorId = readSessionOperatorId(req);
    if (!operatorId) {
      return res.status(401).json({ message: "Authentication required" });
    }

    const operator = await opts.loadOperator(operatorId);
    if (!operator) {
      clearSessionCookie(res);
      return res.status(401).json({ message: "Session no longer valid" });
    }

    const required = requiredCapabilityFor(method, path);
    if (!can(operator.role, required)) {
      return res.status(403).json({ message: `Your role (${operator.role}) lacks capability: ${required}` });
    }

    req.operator = operator;
    next();
  };
}
