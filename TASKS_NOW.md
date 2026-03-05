# TASKS_NOW.md — Vio Backend (socket-server)
_Actualizado: 2026-03-05 Oslo_

## 🔴 ACTIVO AHORA

_Sin tareas activas pendientes._

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
