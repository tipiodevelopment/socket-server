import { db } from '../server/db';
import { clientApps } from '../shared/schema';
import { eq } from 'drizzle-orm';

const WEBHOOK_URL = 'https://viopartnermockv2.azurewebsites.net/api/v1/partner/webhook';
const PARTNER_DEVICE_REGISTER_URL =
  'https://viopartnermockv2.azurewebsites.net/api/v1/partner/devices/register';

async function setupWebhookForClientApps() {
  console.log('\n=== Configurando webhook para ClientApps ===\n');
  console.log(`Webhook URL: ${WEBHOOK_URL}\n`);

  // Update Viaplay (ID 17)
  console.log('Actualizando Viaplay (ClientApp 17)...');
  await db
    .update(clientApps)
    .set({ webhookUrl: WEBHOOK_URL, partnerDeviceRegisterUrl: PARTNER_DEVICE_REGISTER_URL })
    .where(eq(clientApps.id, 17));

  const viaplay = await db.select().from(clientApps).where(eq(clientApps.id, 17)).limit(1);
  console.log(`✅ Viaplay: ${viaplay[0]?.name}`);
  console.log(`   Webhook: ${viaplay[0]?.webhookUrl}`);
  console.log(`   Device register: ${viaplay[0]?.partnerDeviceRegisterUrl}\n`);

  // Update TV2 (ID 18)
  console.log('Actualizando TV2 (ClientApp 18)...');
  await db
    .update(clientApps)
    .set({ webhookUrl: WEBHOOK_URL, partnerDeviceRegisterUrl: PARTNER_DEVICE_REGISTER_URL })
    .where(eq(clientApps.id, 18));

  const tv2 = await db.select().from(clientApps).where(eq(clientApps.id, 18)).limit(1);
  console.log(`✅ TV2: ${tv2[0]?.name}`);
  console.log(`   Webhook: ${tv2[0]?.webhookUrl}`);
  console.log(`   Device register: ${tv2[0]?.partnerDeviceRegisterUrl}\n`);

  console.log('✅ Ambas apps configuradas con el mismo webhook URL\n');
  process.exit(0);
}

setupWebhookForClientApps().catch(err => {
  console.error('Error:', err);
  process.exit(1);
});
