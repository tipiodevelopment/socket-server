/**
 * Data cleanup: delete all campaigns except the ones backing active demos
 * (Viaplay apps + TV2 apps). Everything else in the `campaigns` table
 * (test campaigns, old demos, orphan entries) is removed.
 *
 * Cascade deletes reach: broadcasts, events, scheduled_components,
 * campaign_components, campaign_sponsors, campaign_form_state,
 * device_tokens, campaign_translations (all via FK ON DELETE CASCADE).
 *
 * Usage:
 *   DATABASE_URL=... npx tsx scripts/delete-non-demo-campaigns.ts         # dry-run (default)
 *   DATABASE_URL=... npx tsx scripts/delete-non-demo-campaigns.ts --yes   # execute
 *
 * The script is idempotent: running it again when there's nothing to delete
 * is a no-op.
 */

import { Pool } from '@neondatabase/serverless';

// Keep these campaign ids — Viaplay (app 17) and TV2 (app 18) live demos.
const KEEP_IDS: number[] = [3, 31, 33, 35, 36];

async function main() {
  const execute = process.argv.includes('--yes');
  const url = process.env.DATABASE_URL;
  if (!url) {
    console.error('DATABASE_URL is required');
    process.exit(1);
  }
  const pool = new Pool({ connectionString: url });

  // 1. Show impact
  const toDelete = await pool.query<{ id: number; name: string }>(
    `SELECT id, name FROM campaigns WHERE id <> ALL($1::int[]) ORDER BY id`,
    [KEEP_IDS],
  );

  if (toDelete.rows.length === 0) {
    console.log('Nothing to delete. Database already clean.');
    await pool.end();
    return;
  }

  console.log(`Campaigns to DELETE (${toDelete.rows.length}):`);
  for (const r of toDelete.rows) console.log(`  C${r.id} — ${r.name}`);

  const totals = await pool.query(
    `
    SELECT
      (SELECT COUNT(*)::int FROM broadcasts           WHERE campaign_id <> ALL($1::int[])) AS broadcasts,
      (SELECT COUNT(*)::int FROM events               WHERE campaign_id <> ALL($1::int[])) AS events,
      (SELECT COUNT(*)::int FROM scheduled_components WHERE campaign_id <> ALL($1::int[])) AS sched,
      (SELECT COUNT(*)::int FROM campaign_components  WHERE campaign_id <> ALL($1::int[])) AS comps,
      (SELECT COUNT(*)::int FROM campaign_sponsors    WHERE campaign_id <> ALL($1::int[])) AS sponsors,
      (SELECT COUNT(*)::int FROM campaign_form_state  WHERE campaign_id <> ALL($1::int[])) AS forms,
      (SELECT COUNT(*)::int FROM device_tokens        WHERE campaign_id <> ALL($1::int[])) AS device_tokens,
      (SELECT COUNT(*)::int FROM campaign_translations WHERE campaign_id <> ALL($1::int[])) AS translations
    `,
    [KEEP_IDS],
  );
  console.log('\nCascade impact:', totals.rows[0]);

  if (!execute) {
    console.log('\nDRY RUN — pass --yes to execute the delete.');
    await pool.end();
    return;
  }

  // 2. Execute in a single transaction so we can roll back on error
  console.log('\nExecuting delete in transaction...');
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const result = await client.query(
      `DELETE FROM campaigns WHERE id <> ALL($1::int[]) RETURNING id`,
      [KEEP_IDS],
    );
    await client.query('COMMIT');
    console.log(`Deleted ${result.rowCount} campaigns. IDs: ${result.rows.map((r: any) => r.id).join(', ')}`);
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('Transaction rolled back:', err);
    process.exitCode = 1;
  } finally {
    client.release();
    await pool.end();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
