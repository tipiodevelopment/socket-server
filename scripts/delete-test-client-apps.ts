/**
 * Data cleanup: delete test-only client_apps (no real bundleId, no campaigns,
 * no channels/components attached). Keeps VG, Pregnancy, Viaplay and TV2.
 *
 * Cascade deletes reach: channels, app_components, campaigns (if any —
 * should be none when this runs) — all via FK ON DELETE CASCADE.
 *
 * Usage:
 *   DATABASE_URL=... npx tsx scripts/delete-test-client-apps.ts         # dry-run
 *   DATABASE_URL=... npx tsx scripts/delete-test-client-apps.ts --yes   # execute
 *
 * The script refuses to delete apps that have any campaigns — run
 * `scripts/delete-non-demo-campaigns.ts` first if you added new test data.
 */

import { Pool } from '@neondatabase/serverless';

// Test/demo apps to remove. VG (2), Pregnancy (3), Viaplay (17), TV2 (18) stay.
const DELETE_IDS: number[] = [4, 5, 7, 9, 10, 11, 13, 19];

async function main() {
  const execute = process.argv.includes('--yes');
  const url = process.env.DATABASE_URL;
  if (!url) {
    console.error('DATABASE_URL is required');
    process.exit(1);
  }
  const pool = new Pool({ connectionString: url });

  // Show what we're about to delete and guard against unexpected campaigns
  const audit = await pool.query(
    `
    SELECT ca.id, ca.name, ca.bundle_id,
      (SELECT COUNT(*)::int FROM campaigns c WHERE c.client_app_id = ca.id) AS campaigns,
      (SELECT COUNT(*)::int FROM channels ch WHERE ch.client_app_id = ca.id) AS channels,
      (SELECT COUNT(*)::int FROM app_components ac WHERE ac.client_app_id = ca.id) AS components
    FROM client_apps ca
    WHERE ca.id = ANY($1::int[])
    ORDER BY ca.id
    `,
    [DELETE_IDS],
  );

  if (audit.rows.length === 0) {
    console.log('None of the target IDs exist. Database already clean.');
    await pool.end();
    return;
  }

  console.log(`Client apps to DELETE (${audit.rows.length}):`);
  let blocked = false;
  for (const r of audit.rows) {
    const stuff: string[] = [];
    if (r.campaigns > 0) stuff.push(`${r.campaigns} campaigns`);
    if (r.channels > 0) stuff.push(`${r.channels} channels`);
    if (r.components > 0) stuff.push(`${r.components} components`);
    const extra = stuff.length ? `  ⚠ has: ${stuff.join(', ')}` : '  (empty)';
    console.log(`  App ${String(r.id).padEnd(3)} ${r.name.padEnd(25)} ${r.bundle_id.padEnd(30)}${extra}`);
    if (r.campaigns > 0) blocked = true;
  }

  if (blocked) {
    console.error('\nRefusing to delete: at least one app still has campaigns. Run delete-non-demo-campaigns.ts first.');
    process.exit(1);
  }

  if (!execute) {
    console.log('\nDRY RUN — pass --yes to execute the delete.');
    await pool.end();
    return;
  }

  console.log('\nExecuting delete in transaction...');
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const result = await client.query(
      `DELETE FROM client_apps WHERE id = ANY($1::int[]) RETURNING id, name`,
      [DELETE_IDS],
    );
    await client.query('COMMIT');
    console.log(`Deleted ${result.rowCount} client_apps:`);
    for (const r of result.rows) console.log(`  ✓ App ${r.id} — ${r.name}`);
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
