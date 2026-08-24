// Applies pending SQL migrations from ./migrations non-interactively, and
// fails the process (non-zero exit) on any error — replaces `drizzle-kit
// push`, which does live interactive schema diffing against shared/schema.ts
// (ignoring the versioned migration files entirely) and can exit 0 even when
// it fails to apply anything, or hang forever on a confirmation prompt with
// no TTY to answer it. See docs/lessons in vio-handbook, 2026-08-24.
//
// One-time baseline: environments that ran on `drizzle-kit push` before this
// script existed have no `drizzle.__drizzle_migrations` tracking table, but
// already have migrations 0000-0006 reflected in their live schema (that's
// been the app's baseline for a long time). If the tracking table is empty
// AND the schema clearly predates tracking (public.users exists), we mark
// migrations up to 0006 as already applied — by inserting one row whose
// created_at matches 0006's journal timestamp — before calling the real
// migrator. drizzle-orm's migrate() only compares the *latest* applied
// timestamp against each migration's folder timestamp, so this one row is
// enough to make it skip 0000-0006 and apply 0007+ correctly.
//
// Migrations 0007/0008 were themselves written idempotently (IF NOT EXISTS /
// duplicate_object guards) because some environments may have partial state
// from prior broken `push` runs — see their file headers.

import { Client } from 'pg';
import { migrate } from 'drizzle-orm/node-postgres/migrator';
import { drizzle } from 'drizzle-orm/node-postgres';
import { readFileSync } from 'fs';

const MIGRATIONS_FOLDER = './migrations';
const BASELINE_UP_TO_TAG = '0006_canonicalize_component_ids';

if (!process.env.DATABASE_URL) {
  console.error('[migrate] DATABASE_URL is not set — refusing to start');
  process.exit(1);
}

const client = new Client({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
});

async function main() {
  await client.connect();

  await client.query('CREATE SCHEMA IF NOT EXISTS "drizzle"');
  await client.query(`
    CREATE TABLE IF NOT EXISTS "drizzle"."__drizzle_migrations" (
      id SERIAL PRIMARY KEY,
      hash text NOT NULL,
      created_at bigint
    )
  `);

  const { rows: existing } = await client.query(
    'SELECT count(*)::int AS n FROM "drizzle"."__drizzle_migrations"',
  );

  if (existing[0].n === 0) {
    const { rows: usersExists } = await client.query(
      "SELECT to_regclass('public.users') IS NOT NULL AS ok",
    );
    if (usersExists[0].ok) {
      const journal = JSON.parse(
        readFileSync(`${MIGRATIONS_FOLDER}/meta/_journal.json`, 'utf8'),
      );
      const baseline = journal.entries.find((e) => e.tag === BASELINE_UP_TO_TAG);
      if (!baseline) {
        throw new Error(`Baseline migration tag ${BASELINE_UP_TO_TAG} not found in journal`);
      }
      console.log(
        `[migrate] Empty tracking table but schema already exists — baselining as of ${BASELINE_UP_TO_TAG} (created_at=${baseline.when})`,
      );
      await client.query(
        'INSERT INTO "drizzle"."__drizzle_migrations" (hash, created_at) VALUES ($1, $2)',
        ['baseline-pre-tracking-2026-08-24', baseline.when],
      );
    }
  }

  const db = drizzle(client);
  await migrate(db, { migrationsFolder: MIGRATIONS_FOLDER });
  console.log('[migrate] Done.');
}

main()
  .then(() => client.end())
  .catch(async (err) => {
    console.error('[migrate] FAILED:', err);
    await client.end().catch(() => {});
    process.exit(1);
  });
