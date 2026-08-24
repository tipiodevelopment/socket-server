import { neon } from '@neondatabase/serverless';

async function main() {
  const DEV_URL =
    'postgresql://neondb_owner:npg_cbnrWC9z2LBH@ep-summer-star-a89av46e-pooler.eastus2.azure.neon.tech/neondb?channel_binding=require&sslmode=require';

  const sql = neon(DEV_URL);

  console.log('--- Full custom_config for campaign 38 components ---');
  const cc = await sql`SELECT id, instance_name, app_placement_id, custom_config FROM campaign_components WHERE campaign_id = 38 ORDER BY id`;
  for (const row of cc as any[]) {
    console.log(`\n  cc id=${row.id} (${row.instance_name}) placement=${row.app_placement_id}`);
    console.log('  custom_config:', JSON.stringify(row.custom_config, null, 2));
  }

  console.log('\n--- All public tables ---');
  const all = await sql`
    SELECT table_name FROM information_schema.tables
    WHERE table_schema='public'
    ORDER BY table_name
  `;
  console.log((all as any[]).map(r => r.table_name).join(', '));

  process.exit(0);
}

main().catch(err => { console.error(err); process.exit(1); });
