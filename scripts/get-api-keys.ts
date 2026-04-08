import { db } from '../server/db';
import { clientApps } from '../shared/schema';
import { eq } from 'drizzle-orm';

async function getApiKeys() {
  const viaplay = await db.select().from(clientApps).where(eq(clientApps.id, 17)).limit(1);
  const tv2 = await db.select().from(clientApps).where(eq(clientApps.id, 18)).limit(1);

  console.log('\n=== API KEYS FOR TESTING ===\n');

  if (viaplay.length > 0) {
    console.log('Viaplay (ClientApp 17):');
    console.log(`  API Key: ${viaplay[0].apiKey}`);
    console.log(`  Campaign 35 belongs to this app`);
  }

  console.log('');

  if (tv2.length > 0) {
    console.log('TV2 (ClientApp 18):');
    console.log(`  API Key: ${tv2[0].apiKey}`);
    console.log(`  Should get 403 when accessing Campaign 35`);
  }

  console.log('\n');
  process.exit(0);
}

getApiKeys().catch(err => {
  console.error('Error:', err);
  process.exit(1);
});
