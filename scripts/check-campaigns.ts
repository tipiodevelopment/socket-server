import { db } from '../server/db';
import { campaigns, clientApps } from '../shared/schema';
import { eq } from 'drizzle-orm';

async function checkCampaigns() {
  console.log('\n=== CLIENT APPS ===');
  const apps = await db.select().from(clientApps);
  apps.forEach(app => {
    console.log(`ID: ${app.id} | Name: ${app.name} | API Key: ${app.apiKey?.substring(0, 20)}...`);
  });

  console.log('\n=== CAMPAIGNS (id 28, 35) ===');
  const campaignsToCheck = [28, 35];
  for (const id of campaignsToCheck) {
    const campaign = await db.select().from(campaigns).where(eq(campaigns.id, id)).limit(1);
    if (campaign.length > 0) {
      const c = campaign[0];
      console.log(`\nCampaign ${c.id}:`);
      console.log(`  Name: ${c.name}`);
      console.log(`  ClientAppId: ${c.clientAppId}`);
      console.log(`  WebhookUrl: ${c.webhookUrl || 'NOT SET'}`);
    } else {
      console.log(`\nCampaign ${id}: NOT FOUND`);
    }
  }

  console.log('\n=== ALL CAMPAIGNS ===');
  const allCampaigns = await db.select({
    id: campaigns.id,
    name: campaigns.name,
    clientAppId: campaigns.clientAppId,
    webhookUrl: campaigns.webhookUrl
  }).from(campaigns).limit(10);

  allCampaigns.forEach(c => {
    console.log(`ID: ${c.id} | Name: ${c.name} | ClientApp: ${c.clientAppId} | Webhook: ${c.webhookUrl ? 'SET' : 'NOT SET'}`);
  });

  process.exit(0);
}

checkCampaigns().catch(err => {
  console.error('Error:', err);
  process.exit(1);
});
