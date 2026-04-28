import "./env";
import { Pool, neonConfig } from '@neondatabase/serverless';
import { drizzle } from 'drizzle-orm/neon-serverless';
import ws from "ws";
import * as schema from "@shared/schema";

neonConfig.webSocketConstructor = ws;

if (!process.env.DATABASE_URL) {
  throw new Error(
    "DATABASE_URL must be set. Did you forget to provision a database?"
  );
}

export const pool = new Pool({ connectionString: process.env.DATABASE_URL });

// Catch idle-connection drops from Neon's WebSocket transport. Without
// this, a transient `Connection terminated unexpectedly` from a stale
// pool member surfaces as an unhandled error and crashes the entire
// Node process — taking down WS clients, the outbox worker, and the
// scheduler with it. Logging it lets the pool re-acquire a fresh
// connection on the next query and keeps the rest of the app alive.
pool.on('error', (err) => {
  console.error('[db.pool] connection error (recoverable):', (err as Error)?.message ?? err);
});

export const db = drizzle({ client: pool, schema });
