import "./env";
import pg from "pg";
import { drizzle } from "drizzle-orm/node-postgres";
import * as schema from "@shared/schema";

if (!process.env.DATABASE_URL) {
  throw new Error(
    "DATABASE_URL must be set. Did you forget to provision a database?"
  );
}

const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });

pool.on("error", (err) => {
  console.error("[db.pool] connection error (recoverable):", (err as Error)?.message ?? err);
});

const db = drizzle({ client: pool, schema });

export { db, pool };
