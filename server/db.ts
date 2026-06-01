import "./env";
import * as schema from "@shared/schema";

if (!process.env.DATABASE_URL) {
  throw new Error(
    "DATABASE_URL must be set. Did you forget to provision a database?"
  );
}

const isLocal = /localhost|127\.0\.0\.1/.test(process.env.DATABASE_URL);

// Local dev uses standard pg driver (no WebSocket proxy needed).
// Cloud envs use @neondatabase/serverless with WebSocket transport.
const { db, pool } = await (isLocal ? createLocalDb() : createNeonDb());
export { db, pool };

async function createLocalDb() {
  const { default: pg } = await import("pg");
  const { drizzle } = await import("drizzle-orm/node-postgres");
  const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });
  const db = drizzle({ client: pool, schema });
  return { db, pool };
}

async function createNeonDb() {
  const { Pool, neonConfig } = await import("@neondatabase/serverless");
  const { drizzle } = await import("drizzle-orm/neon-serverless");
  const { default: ws } = await import("ws");

  neonConfig.webSocketConstructor = ws;
  const pool = new Pool({ connectionString: process.env.DATABASE_URL });

  pool.on("error", (err) => {
    console.error("[db.pool] connection error (recoverable):", (err as Error)?.message ?? err);
  });

  process.on("uncaughtException", (err) => {
    const msg = (err as Error)?.message ?? String(err);
    if (msg.includes("Connection terminated") || msg.includes("Unhandled error")) {
      console.error("[db.process] swallowed neon-serverless connection drop (recoverable):", msg);
      return;
    }
    console.error("[db.process] uncaught (re-throwing):", err);
    throw err;
  });

  process.on("unhandledRejection", (reason) => {
    const msg = (reason as Error)?.message ?? String(reason);
    if (msg.includes("Connection terminated") || msg.includes("Unhandled error")) {
      console.error("[db.process] swallowed neon-serverless rejection (recoverable):", msg);
      return;
    }
    console.error("[db.process] unhandled rejection:", reason);
  });

  const db = drizzle({ client: pool, schema });
  return { db, pool };
}
