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

// Belt-and-suspenders. neon-serverless emits some errors on internal
// Client / WebSocket instances that the pool-level handler above
// doesn't see (the trace ends in `EventEmitter at index.mjs:395
// "Unhandled error"` because the listener chain hops past the pool
// before throwing). Process-level handlers are the only way to keep
// the Node process alive when the inner emitter has no listener.
//
// We log + swallow rather than exit. The pool auto-evicts dead
// clients; the next query opens a fresh one. Worst case is a single
// query fails and the caller retries.
process.on('uncaughtException', (err) => {
  const msg = (err as Error)?.message ?? String(err);
  if (msg.includes('Connection terminated') || msg.includes('Unhandled error')) {
    console.error('[db.process] swallowed neon-serverless connection drop (recoverable):', msg);
    return;
  }
  // Re-throw anything that isn't a known recoverable Neon transport
  // glitch — those still deserve to crash the process so we don't
  // mask real bugs.
  console.error('[db.process] uncaught (re-throwing):', err);
  throw err;
});

process.on('unhandledRejection', (reason) => {
  const msg = (reason as Error)?.message ?? String(reason);
  if (msg.includes('Connection terminated') || msg.includes('Unhandled error')) {
    console.error('[db.process] swallowed neon-serverless rejection (recoverable):', msg);
    return;
  }
  console.error('[db.process] unhandled rejection:', reason);
});

export const db = drizzle({ client: pool, schema });
