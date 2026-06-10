import type { Request, Response, NextFunction, RequestHandler } from "express";
import { createRemoteJWKSet, jwtVerify, type JWTVerifyGetKey } from "jose";

// Google publishes the rotating public keys that sign every Firebase ID
// token. Verification is pure crypto against these keys — no runtime call
// to Firebase and no service account needed (ADR-0007).
const FIREBASE_JWKS_URL =
  "https://www.googleapis.com/service_accounts/v1/jwk/securetoken@system.gserviceaccount.com";

export interface FirebaseIdentity {
  uid: string;
  email?: string;
  emailVerified?: boolean;
  name?: string;
  signInProvider?: string;
}

declare global {
  namespace Express {
    interface Request {
      firebaseIdentity?: FirebaseIdentity;
    }
  }
}

interface FirebaseAuthOptions {
  projectId: string;
  /** Test seam — inject a local JWKS instead of fetching Google's. */
  getKey?: JWTVerifyGetKey;
}

export function createFirebaseAuth({ projectId, getKey }: FirebaseAuthOptions): RequestHandler {
  const keyResolver = getKey ?? createRemoteJWKSet(new URL(FIREBASE_JWKS_URL));

  return async function firebaseAuthHandler(req: Request, res: Response, next: NextFunction) {
    const header = req.headers.authorization ?? "";
    const token = header.startsWith("Bearer ") ? header.slice("Bearer ".length) : null;

    if (!token) {
      return res.status(401).json({ message: "Missing Authorization: Bearer <Firebase ID token>" });
    }

    try {
      const { payload } = await jwtVerify(token, keyResolver, {
        issuer: `https://securetoken.google.com/${projectId}`,
        audience: projectId,
        algorithms: ["RS256"],
      });

      if (!payload.sub) {
        return res.status(401).json({ message: "Token has no subject (uid)" });
      }

      req.firebaseIdentity = {
        uid: payload.sub,
        email: typeof payload.email === "string" ? payload.email : undefined,
        emailVerified: payload.email_verified === true,
        name: typeof payload.name === "string" ? payload.name : undefined,
        signInProvider: (payload.firebase as { sign_in_provider?: string } | undefined)?.sign_in_provider,
      };

      next();
    } catch {
      return res.status(401).json({ message: "Invalid or expired Firebase ID token" });
    }
  };
}

let defaultHandler: RequestHandler | null = null;

// Env-driven instance for app wiring. Responds 501 (not 500) when the env
// is not configured so an unconfigured deploy degrades loudly but harmlessly.
export const firebaseAuth: RequestHandler = (req, res, next) => {
  const projectId = process.env.FIREBASE_PROJECT_ID;
  if (!projectId) {
    return res.status(501).json({ message: "FIREBASE_PROJECT_ID is not configured on this environment" });
  }
  if (!defaultHandler) {
    defaultHandler = createFirebaseAuth({ projectId });
  }
  return defaultHandler(req, res, next);
};
