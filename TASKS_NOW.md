# TASKS_NOW.md — Vio Backend (socket-server)
_Actualizado: 2026-03-05 12:20 Oslo_

## 🔴 ACTIVO AHORA

### TASK-B06 — Campo webhookUrl en campaigns + arquitectura agnóstica de push
**Prioridad: ALTA**

Vio es agnóstico de push notifications. En producción, el broadcaster (TV2, Viaplay) usa su propio stack.

**Arquitectura:**
```
Con webhookUrl → Vio llama POST webhookUrl con { userId, productId, campaignId, action: "cart_intent" }
Sin webhookUrl → Vio manda APNs directamente (modo demo)
```

**Cambios necesarios:**
1. Añadir `webhook_url VARCHAR(512)` a tabla `campaigns`
2. Exponer en dashboard (Settings tab) como "Cart Intent Webhook URL"
3. En `POST /api/campaigns/:id/cart-intent`:
   - Si `campaign.webhookUrl` existe → llamar webhook, no tocar APNs
   - Si no existe → comportamiento actual (APNs directo, modo demo)

---

## ✅ COMPLETADO HOY (Mar 5 2026)

- **TASK-B03** ✅ — `POST /api/broadcasts/:id/shoppable-ad`
  - Commerce GraphQL → emite WS `shoppable_ad` con producto real
  - Auth: `Authorization: <key>` sin Bearer

- **TASK-B04** ✅ — `POST /api/campaigns/:id/register-device`
  - Guarda `{ userId, deviceToken, platform }` en tabla `device_tokens`
  - Upsert por (campaignId, userId)

- **TASK-B05** ✅ — `POST /api/campaigns/:id/cart-intent`
  - Recibe click de Apple TV → manda push APNs al iPhone del userId
  - Tabla `cart_intents` creada

## ✅ COMPLETADO ANTES

- **TASK-B01** — `paymentMethods` en campañas + config SDK ✅ (Mar 4)
- **TASK-B02** — `POST /api/checkout/confirm-apple-pay` ✅ (Mar 4)
- `normalizeUrls()` en WS contest events ✅
- Carousel activado en campaña 36 ✅
- broadcastId en WS events ✅
- Sponsor badge en config endpoint ✅

## 📋 BACKLOG
- Demo mode endpoint: `POST /api/broadcasts/:id/demo/start`
- Highlights endpoint: `GET /v1/sdk/broadcasts/:id/highlights`
- Añadir `STRIPE_SECRET_KEY` para activar TASK-B02 en producción
- APNs cert TV2 real (Angelo provee cuando esté listo)
