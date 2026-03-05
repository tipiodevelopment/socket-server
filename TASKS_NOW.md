# TASKS_NOW.md — Vio Backend (socket-server)
_Actualizado: 2026-03-05 Oslo_

## 🔴 ACTIVO AHORA

### TASK-B03 — POST /api/broadcasts/:id/shoppable-ad
**Prioridad: CRÍTICO — bloquea demo Apple TV**

Endpoint que dispara un shoppable ad durante un partido. El operador lo llama desde el dashboard cuando quiere mostrar un producto en la Apple TV del espectador.

**Request:**
```
POST /api/broadcasts/:id/shoppable-ad
Authorization: Bearer <adminToken>
Content-Type: application/json

{
  "productId": "408895",
  "sponsorId": 123
}
```

**Lo que hace:**
1. Resuelve el producto en Commerce GraphQL (`graph-ql-dev.vio.live`, auth: `Authorization: <commerceApiKey>`)
2. Emite evento WebSocket al canal `/ws/:broadcastId`:
```json
{
  "type": "shoppable_ad",
  "product": {
    "id": "408895",
    "name": "Samsung 85\" Neo QLED 4K TV",
    "price": 17990,
    "currency": "NOK",
    "imageUrl": "https://..."
  },
  "sponsor": {
    "name": "Elkjøp",
    "logoUrl": "https://api-dev.vio.live/objects/uploads/adc65620-01ff-4c66-a7e2-de456495b9d1",
    "primaryColor": "#003087"
  }
}
```
3. Responde `{ "success": true }`

**Commerce API Key:** `KCXF10Y-W5T4PCR-GG5119A-Z64SQ9S` (guardar como secret, no hardcodear)
**Commerce query:** `Channel { GetProductById(id, countryCode: "NO", currencyCode: "NOK") { id name images { url order } price { amount amount_incl_taxes currency_code } } }`

---

### TASK-B04 — POST /api/campaigns/:id/register-device
**Prioridad: CRÍTICO — necesario para push notifications**

El SDK iOS llama este endpoint al arrancar para registrar el deviceToken APNs del usuario.

**Request:**
```
POST /api/campaigns/:id/register-device
X-API-Key: <campaignApiKey>
Content-Type: application/json

{
  "userId": "angelo_demo_001",
  "deviceToken": "abc123...apns_token_hex",
  "platform": "ios"
}
```

**Lo que hace:**
- Upsert en tabla `device_tokens`: si userId ya existe → actualizar deviceToken
- Responde `{ "success": true }`

**Nueva tabla `device_tokens`:**
```sql
CREATE TABLE device_tokens (
  id SERIAL PRIMARY KEY,
  campaign_id INTEGER NOT NULL REFERENCES campaigns(id),
  user_id VARCHAR(255) NOT NULL,
  device_token VARCHAR(512) NOT NULL,
  platform VARCHAR(20) NOT NULL DEFAULT 'ios',
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  UNIQUE(campaign_id, user_id)
);
```

**Contexto — por qué userId:**
El userId lo inyecta la app del broadcaster al inicializar el SDK:
```swift
VioSDK.configure(apiKey: "tv2_api_key_...", userId: "user_12345")
```
En producción, TV2/Viaplay pasan su propio userId. Para la demo: `"angelo_demo_001"`.

---

### TASK-B05 — POST /api/campaigns/:id/cart-intent
**Prioridad: CRÍTICO — el corazón del flujo TV → iPhone**

La Apple TV llama este endpoint cuando el usuario da click en "Legg i handlekurv" con el mando. El backend manda una push notification al iPhone del mismo usuario.

**Request:**
```
POST /api/campaigns/:id/cart-intent
X-API-Key: <campaignApiKey>
Content-Type: application/json

{
  "productId": "408895",
  "userId": "angelo_demo_001"
}
```

**Lo que hace:**
1. Busca el `deviceToken` de ese `userId` en tabla `device_tokens` para esa campaña
2. Resuelve el nombre del producto (desde Commerce o desde el request body si se incluye)
3. Manda push via APNs:
   - `title`: `"Produkt lagt til"`
   - `body`: `"<nombre producto> — trykk for å kjøpe"`
   - `payload extra`: `{ "productId": "408895", "campaignId": 36, "action": "open_product" }`
4. Responde `{ "success": true }`

**APNs setup:**
- Librería recomendada: `@parse/node-apn` o `node-apn`
- Si APNs no está configurado aún → loguear el intent y responder `{ "success": true }` (no fallar)
- Certificado y bundleId: Angelo los provee cuando esté listo el cert de TV2

**Flujo completo:**
```
Apple TV (click mando)
  → POST /api/campaigns/36/cart-intent { productId, userId }
  → Backend busca deviceToken de userId
  → APNs push → iPhone
  → Usuario toca notificación
  → SDK abre VProductDetailOverlay con Apple Pay
```

---

## ✅ COMPLETADO RECIENTEMENTE

- **TASK-B01** — `paymentMethods` en campañas + config SDK ✅ (Mar 4 2026)
- **TASK-B02** — `POST /api/checkout/confirm-apple-pay` ✅ (Mar 4 2026)
- `normalizeUrls()` en WS contest events ✅
- Carousel `sport-detail-carousel` / `sport-home-carousel` en campaña 36 ✅
- broadcastId en pollEventSchema + contestEventSchema ✅
- Sponsor badge (`badgeText`) en config endpoint ✅

## 📋 BACKLOG
- APNs setup completo con cert TV2 (Angelo provee cert cuando esté listo)
- Demo mode endpoint: `POST /api/broadcasts/:id/demo/start`
- Highlights endpoint: `GET /v1/sdk/broadcasts/:id/highlights`
- Añadir `STRIPE_SECRET_KEY` para activar TASK-B02 en producción
