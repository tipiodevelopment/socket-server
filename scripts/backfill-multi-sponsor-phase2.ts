/**
 * Phase 2 backfill for the multi-sponsor redesign.
 *
 * Populates the new columns introduced in Phase 1 so Phase 3 can enforce
 * NOT NULL constraints. Reachu legacy identity is NOT backfilled per the
 * locked decision #5 (reachu 100% out) — end-users will re-register fresh
 * via the ensure_user flow at SDK startup.
 *
 * Steps:
 *   1. campaigns.primary_sponsor_id      ← campaigns.sponsor_id (existing FK)
 *   2. sponsors.payment_methods          ← campaigns.payment_methods (for primary)
 *   3. polls.sponsor_id                  ← broadcast → campaign → primary
 *   4. contests.sponsor_id               ← broadcast → campaign → primary
 *   5. campaign_components.sponsor_id    ← campaign.primary_sponsor_id
 *   6. scheduled_components.sponsor_id   ← campaign.primary_sponsor_id
 *   7. broadcasts.engagement_enabled     ← has poll OR contest
 *   8. client_apps.tv_enabled            ← stays false (operator opts in per app)
 *
 * Usage:
 *   DATABASE_URL=... npx tsx scripts/backfill-multi-sponsor-phase2.ts         # dry-run (default)
 *   DATABASE_URL=... npx tsx scripts/backfill-multi-sponsor-phase2.ts --yes   # execute
 *
 * Idempotent — re-running with --yes on a clean DB is a no-op (WHERE ... IS NULL).
 */

import { Pool } from '@neondatabase/serverless';

async function main() {
  const execute = process.argv.includes('--yes');
  const url = process.env.DATABASE_URL;
  if (!url) {
    console.error('DATABASE_URL is required');
    process.exit(1);
  }
  const pool = new Pool({ connectionString: url });

  const steps = [
    {
      label: '1. campaigns.primary_sponsor_id ← sponsor_id',
      sql: `UPDATE campaigns
              SET primary_sponsor_id = sponsor_id
            WHERE primary_sponsor_id IS NULL AND sponsor_id IS NOT NULL`,
    },
    {
      label: '2. sponsors.payment_methods ← campaign.payment_methods (for primary)',
      sql: `UPDATE sponsors s
              SET payment_methods = COALESCE(c.payment_methods, '[]'::json)
            FROM (
              SELECT DISTINCT ON (primary_sponsor_id)
                     primary_sponsor_id, payment_methods
              FROM campaigns
              WHERE primary_sponsor_id IS NOT NULL
                AND payment_methods IS NOT NULL
              ORDER BY primary_sponsor_id, created_at DESC
            ) c
            WHERE s.id = c.primary_sponsor_id
              AND (s.payment_methods IS NULL OR s.payment_methods::text = '[]')`,
    },
    {
      label: '3. polls.sponsor_id ← broadcast → campaign → primary',
      sql: `UPDATE polls p
              SET sponsor_id = c.primary_sponsor_id
            FROM broadcasts b
            JOIN campaigns c ON c.id = b.campaign_id
            WHERE p.broadcast_id = b.broadcast_id
              AND p.sponsor_id IS NULL
              AND c.primary_sponsor_id IS NOT NULL`,
    },
    {
      label: '4. contests.sponsor_id ← broadcast → campaign → primary',
      sql: `UPDATE contests ct
              SET sponsor_id = c.primary_sponsor_id
            FROM broadcasts b
            JOIN campaigns c ON c.id = b.campaign_id
            WHERE ct.broadcast_id = b.broadcast_id
              AND ct.sponsor_id IS NULL
              AND c.primary_sponsor_id IS NOT NULL`,
    },
    {
      label: '5. campaign_components.sponsor_id ← campaign.primary_sponsor_id',
      sql: `UPDATE campaign_components cc
              SET sponsor_id = c.primary_sponsor_id
            FROM campaigns c
            WHERE cc.campaign_id = c.id
              AND cc.sponsor_id IS NULL
              AND c.primary_sponsor_id IS NOT NULL`,
    },
    {
      label: '6. scheduled_components.sponsor_id ← campaign.primary_sponsor_id',
      sql: `UPDATE scheduled_components sc
              SET sponsor_id = c.primary_sponsor_id
            FROM campaigns c
            WHERE sc.campaign_id = c.id
              AND sc.sponsor_id IS NULL
              AND c.primary_sponsor_id IS NOT NULL`,
    },
    {
      label: '7. broadcasts.engagement_enabled ← has poll OR contest',
      sql: `UPDATE broadcasts b
              SET engagement_enabled = true
            WHERE b.engagement_enabled = false
              AND (
                EXISTS (SELECT 1 FROM polls p WHERE p.broadcast_id = b.broadcast_id)
                OR EXISTS (SELECT 1 FROM contests c WHERE c.broadcast_id = b.broadcast_id)
              )`,
    },
  ];

  console.log(`Mode: ${execute ? 'EXECUTE (--yes)' : 'DRY RUN'}`);
  console.log('');

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    for (const step of steps) {
      if (execute) {
        const result = await client.query(step.sql);
        console.log(`  ${step.label}  → ${result.rowCount} rows`);
      } else {
        // Dry-run: convert UPDATE to SELECT count(*)
        const countSql = step.sql
          .replace(/^\s*UPDATE\s+(\w+)(?:\s+(\w+))?/i, (_m, table, alias) => `SELECT COUNT(*) FROM ${table}${alias ? ` ${alias}` : ''}`)
          .replace(/\n\s*SET\s+[^\n]*(?:\n\s*,[^\n]*)*\n/i, '\n')
          .replace(/^\s*SELECT COUNT\(\*\) FROM [^\n]*\n\s*FROM\s+/im, 'SELECT COUNT(*) FROM ');
        try {
          const r = await client.query(countSql);
          console.log(`  ${step.label}  → would update ~${r.rows[0].count} rows`);
        } catch {
          console.log(`  ${step.label}  → (dry-run count unavailable; run with --yes to apply)`);
        }
      }
    }

    if (execute) {
      await client.query('COMMIT');
      console.log('\n✓ Backfill committed.');
    } else {
      await client.query('ROLLBACK');
      console.log('\nDRY RUN — pass --yes to execute.');
    }
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('\nTransaction rolled back:', err);
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
