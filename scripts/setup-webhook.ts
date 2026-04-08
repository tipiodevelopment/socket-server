import { db } from '../server/db';
import { campaigns } from '../shared/schema';
import { eq } from 'drizzle-orm';

// Get webhook URL from command line or use placeholder
const webhookUrl = process.argv[2] || 'https://webhook.site/REPLACE_WITH_YOUR_UUID';

async function setupWebhook() {
  console.log(`\nConfiguring webhook URL for Campaign 35...`);
  console.log(`Webhook URL: ${webhookUrl}\n`);

  if (webhookUrl.includes('REPLACE')) {
    console.log('⚠️  Please provide a real webhook.site URL:');
    console.log('   1. Visit https://webhook.site');
    console.log('   2. Copy your unique URL');
    console.log('   3. Run: npx tsx scripts/setup-webhook.ts https://webhook.site/YOUR-UUID\n');
    process.exit(1);
  }

  await db
    .update(campaigns)
    .set({ webhookUrl })
    .where(eq(campaigns.id, 35));

  console.log('✅ Webhook URL configured for Campaign 35\n');

  // Verify
  const updated = await db.select().from(campaigns).where(eq(campaigns.id, 35)).limit(1);
  console.log('Verification:');
  console.log(`  Campaign: ${updated[0].name}`);
  console.log(`  Webhook: ${updated[0].webhookUrl}\n`);

  process.exit(0);
}

setupWebhook().catch(err => {
  console.error('Error:', err);
  process.exit(1);
});
