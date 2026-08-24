// Applies pending SQL migrations from ./migrations non-interactively, and
// fails the process (non-zero exit) on any error — replaces `drizzle-kit
// push`, which does live interactive schema diffing against shared/schema.ts
// (ignoring the versioned migration files entirely) and can exit 0 even when
// it fails to apply anything, or hang forever on a confirmation prompt with
// no TTY to answer it. See docs/lessons in vio-handbook, 2026-08-24.
//
// Does NOT use drizzle-orm's built-in migrate()/readMigrationFiles(): those
// read migrations/meta/_journal.json, which is stale here (only has entries
// for 0000/0001 even though migration files go up to 0010) — trusting it
// would silently skip every later migration. This reads *.sql files from the
// migrations/ directory directly, sorted by filename (the zero-padded
// numeric prefix keeps them in order), and tracks applied ones by filename
// in its own table.
//
// One-time baseline: environments that ran on `push` before this script
// existed have no tracking table, but already have migrations 0000-0006
// reflected in their live schema (that's been the app's baseline for a long
// time). If the tracking table is empty AND the schema clearly predates
// tracking (public.users exists), we mark files up to and including 0006 as
// already applied without re-running them.
//
// Migrations 0007/0008 were themselves rewritten to be idempotent (IF NOT
// EXISTS / duplicate_object guards) because some environments may have
// partial state from prior broken `push` runs — see their file headers.

import { Client } from 'pg';
import { readFileSync, readdirSync } from 'fs';

const MIGRATIONS_DIR = './migrations';
const BASELINE_UP_TO = '0006_canonicalize_component_ids.sql';

if (!process.env.DATABASE_URL) {
  console.error('[migrate] DATABASE_URL is not set — refusing to start');
  process.exit(1);
}

const client = new Client({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
});

function listMigrationFiles() {
  return readdirSync(MIGRATIONS_DIR)
    .filter((f) => f.endsWith('.sql'))
    .sort();
}

async function main() {
  await client.connect();

  await client.query(`
    CREATE TABLE IF NOT EXISTS "public"."_migrations_applied" (
      id SERIAL PRIMARY KEY,
      name text NOT NULL UNIQUE,
      applied_at timestamptz NOT NULL DEFAULT now()
    )
  `);

  const { rows: appliedRows } = await client.query(
    'SELECT name FROM "public"."_migrations_applied"',
  );
  const applied = new Set(appliedRows.map((r) => r.name));

  const files = listMigrationFiles();

  if (applied.size === 0) {
    const { rows: usersExists } = await client.query(
      "SELECT to_regclass('public.users') IS NOT NULL AS ok",
    );
    if (usersExists[0].ok) {
      const baselineFiles = files.filter((f) => f <= BASELINE_UP_TO);
      console.log(
        `[migrate] Empty tracking table but schema already exists — baselining ${baselineFiles.length} pre-tracking migration(s) up to ${BASELINE_UP_TO}`,
      );
      for (const f of baselineFiles) {
        await client.query(
          'INSERT INTO "public"."_migrations_applied" (name) VALUES ($1) ON CONFLICT DO NOTHING',
          [f],
        );
        applied.add(f);
      }
    }
  }

  const pending = files.filter((f) => !applied.has(f));
  if (pending.length === 0) {
    console.log('[migrate] Nothing to apply — up to date.');
    return;
  }

  for (const file of pending) {
    console.log(`[migrate] Applying ${file}...`);
    const sql = readFileSync(`${MIGRATIONS_DIR}/${file}`, 'utf8');
    const statements = sql
      .split('--> statement-breakpoint')
      .map((s) => s.trim())
      .filter(Boolean);

    await client.query('BEGIN');
    try {
      for (const stmt of statements) {
        await client.query(stmt);
      }
      await client.query(
        'INSERT INTO "public"."_migrations_applied" (name) VALUES ($1)',
        [file],
      );
      await client.query('COMMIT');
    } catch (err) {
      await client.query('ROLLBACK');
      throw new Error(`Failed applying ${file}: ${err.message}`);
    }
  }

  console.log(`[migrate] Done. ${pending.length} migration(s) applied.`);
}

main()
  .then(() => client.end())
  .catch(async (err) => {
    console.error('[migrate] FAILED:', err.message);
    await client.end().catch(() => {});
    process.exit(1);
  });
