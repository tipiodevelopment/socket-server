# TASKS_NOW.md — Vio Backend (socket-server)
_Actualizado: 2026-03-05 Oslo_

## 🔴 ACTIVO AHORA

### TASK-B07 — APNs integration — push notification real al iPhone
**Prioridad: CRÍTICO — último paso para flujo TV → iPhone completo**

Cuando `POST /api/campaigns/:id/cart-intent` se llama y NO hay webhookUrl → mandar push real via APNs.

**Instalar:**
```bash
npm install @parse/node-apn
```

**Secrets necesarios (Angelo los provee):**
- `APNS_KEY` — contenido completo del archivo .p8
- `APNS_KEY_ID` — 10 caracteres (de developer.apple.com → Keys)
- `APNS_TEAM_ID` — 10 caracteres (Team ID de la cuenta Apple)
- `APNS_BUNDLE_ID` — `viodev.tv2demo`

**Implementación en cart-intent (modo demo — sin webhookUrl):**
```typescript
import apn from '@parse/node-apn';

const provider = new apn.Provider({
  token: {
    key: process.env.APNS_KEY,      // contenido del .p8
    keyId: process.env.APNS_KEY_ID,
    teamId: process.env.APNS_TEAM_ID,
  },
  production: false  // true en producción
});

const notification = new apn.Notification();
notification.expiry = Math.floor(Date.now() / 1000) + 3600;
notification.badge = 1;
notification.sound = 'default';
notification.alert = {
  title: 'Produkt lagt til',
  body: `${productName} — trykk for å kjøpe`
};
notification.payload = {
  productId: productId,
  campaignId: campaignId,
  action: 'open_product'
};
notification.topic = process.env.APNS_BUNDLE_ID || 'viodev.tv2demo';

await provider.send(notification, deviceToken);
```

**Si secrets no están configurados → loguear y responder success (no fallar)**

**Flujo completo tras esto:**
```
Apple TV click → POST cart-intent
  → backend busca deviceToken del userId en device_tokens
  → APNs push → iPhone
  → Usuario toca notificación
  → SDK llama VioSDK.openProduct(id: productId)
  → VProductDetailOverlay abre con Apple Pay
```

---

## ✅ COMPLETADO HOY (Mar 5 2026)

- **TASK-B06** — `webhookUrl` en campaigns + arquitectura agnóstica de push ✅
  - Campo `webhook_url VARCHAR(512)` añadido a tabla `campaigns` (DB migrada)
  - Dashboard SettingsTab → sección "Cart Intent Webhook" con input URL + descripción del payload
  - `POST /api/campaigns/:id/cart-intent` — lógica webhook-first:
    - Si `campaign.webhookUrl` → `POST webhookUrl { userId, productId, campaignId, action: "cart_intent" }` → `{ success: true, mode: "webhook" }`
    - Sin webhookUrl → APNs directo (modo demo) → comportamiento anterior

- **TASK-B03** — `POST /api/broadcasts/:id/shoppable-ad` ✅
  - Commerce GraphQL → emite WS `shoppable_ad` con producto real
  - Auth: `Authorization: <key>` sin Bearer

- **TASK-B04** — `POST /api/campaigns/:id/register-device` ✅
  - Upsert en tabla `device_tokens` por (campaignId, userId)

- **TASK-B05** — `POST /api/campaigns/:id/cart-intent` ✅
  - Webhook-first (B06) → APNs directo como fallback (demo)

## ✅ COMPLETADO ANTES

- **TASK-B01/B02** — paymentMethods + Apple Pay endpoint ✅ (Mar 4)
- `normalizeUrls()` en WS contest events ✅
- `integrations.commerce` en ambos config endpoints ✅
- Carousel activado en campaña 36 ✅

## 📋 BACKLOG
- Demo mode endpoint: `POST /api/broadcasts/:id/demo/start`
- APNs en producción: añadir `APNS_CERT_P8`, `APNS_KEY_ID`, `APNS_TEAM_ID` (Angelo provee cert)
- Stripe en producción: añadir `STRIPE_SECRET_KEY`
