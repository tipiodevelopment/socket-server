/**
 * Fase 1.7 audit (per VioSwiftSDK MULTI-SPONSOR-ALIGNMENT-PLAN.md):
 *
 * Lists every active campaign_components row, joined with its sponsor
 * + app_placement, surfacing data gaps that would trip the iOS SDK's
 * fail-fast paths introduced in Fase 1.2 / 1.5 ("🔴 NIL — skipping").
 *
 * Specifically flags:
 *   - sponsor_id IS NULL (schema NOT NULL should prevent this; if it
 *     appears, the constraint was bypassed somehow → fix the data).
 *   - sponsor with empty/null commerce_api_key (visual-only sponsors
 *     legitimately have this; logging surfaces them so the operator
 *     knows that those placements can render UI but adds will skip).
 *   - dangling sponsor_id (FK orphan, shouldn't happen with
 *     ON DELETE RESTRICT but worth verifying).
 *
 * Read-only — no mutations.
 *
 * Run:
 *   npx tsx scripts/audit-campaign-components-sponsor.ts <campaignId>
 *   npx tsx scripts/audit-campaign-components-sponsor.ts        (audits all)
 */
import { neon } from '@neondatabase/serverless';

async function main() {
  const url = process.env.DATABASE_URL;
  if (!url) {
    console.error('DATABASE_URL not set in env. source .env first or run via npx dotenv-cli.');
    process.exit(1);
  }
  const sql = neon(url);

  const campaignFilterArg = process.argv[2];
  const campaignId = campaignFilterArg ? Number(campaignFilterArg) : null;
  if (campaignFilterArg && Number.isNaN(Number(campaignFilterArg))) {
    console.error(`Invalid campaignId arg: ${campaignFilterArg}`);
    process.exit(1);
  }

  console.log(
    `--- Audit campaign_components ${campaignId ? `for campaign ${campaignId}` : '(ALL)'} ---\n`
  );

  // Pull every campaign_component (active + inactive) joined with sponsor
  // and app_placement. status='active' is the one the SDK serves; we list
  // all so the operator can see scheduled/inactive rows too if they're
  // about to flip on.
  const rows = campaignId
    ? await sql`
        SELECT
          cc.id           AS cc_id,
          cc.campaign_id  AS campaign_id,
          cc.status       AS cc_status,
          cc.instance_name,
          cc.broadcast_id,
          cc.sponsor_id,
          cc.app_placement_id,
          ap.location_id  AS placement_location,
          ap.name         AS placement_name,
          ap.component_id AS placement_template,
          s.id            AS sponsor_id_resolved,
          s.name          AS sponsor_name,
          s.commerce_api_key,
          c.name          AS campaign_name,
          c.primary_sponsor_id
        FROM campaign_components cc
        LEFT JOIN sponsors s         ON s.id = cc.sponsor_id
        LEFT JOIN app_placements ap  ON ap.id = cc.app_placement_id
        LEFT JOIN campaigns c        ON c.id = cc.campaign_id
        WHERE cc.campaign_id = ${campaignId}
        ORDER BY cc.status DESC, cc.id`
    : await sql`
        SELECT
          cc.id           AS cc_id,
          cc.campaign_id  AS campaign_id,
          cc.status       AS cc_status,
          cc.instance_name,
          cc.broadcast_id,
          cc.sponsor_id,
          cc.app_placement_id,
          ap.location_id  AS placement_location,
          ap.name         AS placement_name,
          ap.component_id AS placement_template,
          s.id            AS sponsor_id_resolved,
          s.name          AS sponsor_name,
          s.commerce_api_key,
          c.name          AS campaign_name,
          c.primary_sponsor_id
        FROM campaign_components cc
        LEFT JOIN sponsors s         ON s.id = cc.sponsor_id
        LEFT JOIN app_placements ap  ON ap.id = cc.app_placement_id
        LEFT JOIN campaigns c        ON c.id = cc.campaign_id
        ORDER BY cc.campaign_id, cc.status DESC, cc.id`;

  if (rows.length === 0) {
    console.log('  (no rows)\n');
    process.exit(0);
  }

  let issuesFound = 0;
  let activeOk = 0;
  let activeNoCommerce = 0;
  const issues: string[] = [];

  // Group by campaign for readability
  const byCampaign = new Map<number, any[]>();
  for (const row of rows as any[]) {
    if (!byCampaign.has(row.campaign_id)) {
      byCampaign.set(row.campaign_id, []);
    }
    byCampaign.get(row.campaign_id)!.push(row);
  }

  for (const [cid, group] of byCampaign) {
    const head = group[0];
    console.log(
      `\n=== Campaign ${cid} "${head.campaign_name}" (primary_sponsor_id=${head.primary_sponsor_id}) ===`
    );
    for (const row of group) {
      const statusBadge = row.cc_status === 'active' ? '🟢' : '⚪';
      const broadcastNote = row.broadcast_id ? ` broadcast=${row.broadcast_id}` : '';
      const sidLabel =
        row.sponsor_id == null
          ? '⚠️ NULL'
          : row.sponsor_id_resolved == null
            ? `⚠️ DANGLING (FK to deleted sponsor ${row.sponsor_id})`
            : `${row.sponsor_id} ${row.sponsor_name}`;
      const commerceLabel = (() => {
        if (row.sponsor_id == null || row.sponsor_id_resolved == null) {
          return '— (no sponsor)';
        }
        const k = row.commerce_api_key as string | null;
        if (!k || !k.trim()) return '⚠️ EMPTY (visual-only sponsor → adds will SKIP per Fase 1.2/1.5 fail-fast)';
        return `OK (…${k.slice(-6)})`;
      })();

      console.log(
        `  ${statusBadge} cc=${row.cc_id} placement="${row.placement_location}" (${row.placement_name})  sponsor=${sidLabel}  commerce=${commerceLabel}${broadcastNote}`
      );

      // Track issues only for active rows (those the SDK actually serves).
      if (row.cc_status === 'active') {
        if (row.sponsor_id == null) {
          issues.push(`Campaign ${cid} cc=${row.cc_id}: sponsor_id IS NULL`);
          issuesFound++;
        } else if (row.sponsor_id_resolved == null) {
          issues.push(
            `Campaign ${cid} cc=${row.cc_id}: dangling sponsor_id=${row.sponsor_id} (no row in sponsors)`
          );
          issuesFound++;
        } else if (!row.commerce_api_key || !row.commerce_api_key.trim()) {
          activeNoCommerce++;
          // Not strictly an issue (visual-only sponsors are allowed)
          // but flagged so the operator confirms intent.
        } else {
          activeOk++;
        }
      }
    }
  }

  console.log('\n--- Summary ---');
  console.log(`  Active rows OK (sponsor + commerce key): ${activeOk}`);
  console.log(`  Active rows with sponsor but no commerce key: ${activeNoCommerce}`);
  console.log(`  Active rows with hard data issues: ${issuesFound}`);

  if (issues.length > 0) {
    console.log('\n--- Issues to fix ---');
    for (const i of issues) console.log(`  • ${i}`);
    process.exit(2);
  }

  if (activeNoCommerce > 0) {
    console.log(
      '\n  Note: rows with no commerce key are intended for visual-only sponsors (e.g. branding-only).'
    );
    console.log(
      '  Adds against those placements will hit the iOS SDK fail-fast (`🔴 NIL`) — confirm that is intended.'
    );
  }

  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
