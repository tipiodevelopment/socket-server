# TASKS_NOW.md — Vio Backend (socket-server)
_Actualizado: 2026-03-04 23:38 Oslo_

## 🔴 ACTIVO AHORA

### TASK-B01 — Campo `paymentMethods` en campañas + config SDK
**Prioridad:** Alta  
**Branch:** `feature/payment-methods`

Añadir soporte para métodos de pago configurables por campaña.

#### 1. DB: campo `paymentMethods` en tabla `campaigns`
```sql
ALTER TABLE campaigns ADD COLUMN payment_methods JSONB DEFAULT '["apple_pay"]';
```

#### 2. Exponer en config SDK
`GET /v1/campaigns/:id/config` → añadir:
```json
{
  "checkout": {
    "paymentMethods": ["apple_pay", "klarna", "vipps"]
  }
}
```

#### 3. Dashboard UI
En la página de campaña añadir sección "Payment Methods" con checkboxes:
- ☑ Apple Pay
- ☑ Klarna
- ☐ Vipps
- ☐ Stripe Link

#### 4. Activar en campañas existentes (via dashboard o seed)
- Campaña 35 (Viaplay): `["apple_pay"]`
- Campaña 36 (TV2): `["apple_pay"]`

---

### TASK-B02 — `POST /api/checkout/confirm-apple-pay`
**Prioridad:** Media (necesario para producción, demo funciona sin esto)  
**Branch:** `feature/payment-methods`

Endpoint para confirmar pago Apple Pay con Stripe.

```
POST /api/checkout/confirm-apple-pay
Authorization: X-API-Key (SDK key)
Body: {
  "clientSecret": "pi_xxx_secret_xxx",
  "applePayToken": "<base64 del PKPaymentToken.paymentData>",
  "buyer": {
    "name": "Angelo Sepulveda",
    "email": "angelo@vio.live",
    "phone": "+47 900 00 000",
    "address": {
      "street": "Karl Johans gate 1",
      "city": "Oslo",
      "postalCode": "0154",
      "country": "NO"
    }
  }
}
Response: { "success": true, "orderId": "pi_xxx" }
```

**Implementación:**
```js
// 1. Decodificar el applePayToken (base64 → JSON)
// 2. Llamar Stripe:
const paymentMethod = await stripe.paymentMethods.create({
  type: 'card',
  card: { token: applePayTokenData }
});
const intent = await stripe.paymentIntents.confirm(clientSecret, {
  payment_method: paymentMethod.id
});
// 3. Retornar { success: intent.status === 'succeeded', orderId: intent.id }
```

**Nota:** La clave privada Apple Pay para descifrar el token en producción:
- Archivo: `~/vio-apple-pay.p12` (en angelos-air)
- Contraseña: `vio2026`
- Para Stripe: subir el certificado en dashboard.stripe.com → Settings → Apple Pay

---

## ✅ COMPLETADO RECIENTEMENTE
- Carousel `sport-detail-carousel` activado en campaña 36 (TV2) ✅
- Carousel `sport-home-carousel` activado en campaña 36 (TV2) ✅
- `normalizeUrls()` en WS contest events ✅
- broadcastId en pollEventSchema + contestEventSchema ✅
- Sponsor badge (`badgeText`) en config endpoint ✅

## 📋 BACKLOG
- Demo mode endpoint: `POST /api/broadcasts/:id/demo/start` — secuencia automática de eventos
- Highlights endpoint: `GET /v1/sdk/broadcasts/:id/highlights`
- Engagement products: backend resuelve productId → Commerce antes de emitir WS
