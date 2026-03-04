# TASKS_NOW.md — Vio Backend (socket-server)
_Actualizado: 2026-03-04 Oslo_

## 🔴 ACTIVO AHORA

_Sin tareas activas pendientes._

---

## ✅ COMPLETADO RECIENTEMENTE

- **TASK-B01** — `paymentMethods` en campañas + config SDK ✅ (Mar 4 2026)
  - Campo `payment_methods JSONB` añadido a tabla `campaigns` (DB migrada)
  - `GET /v1/campaigns/:id/config` → `checkout.paymentMethods: [...]` siempre presente
  - Dashboard SettingsTab → sección "Payment Methods" con checkboxes (Apple Pay, Klarna, Vipps, Stripe Link)
  - Campañas 35 (Viaplay) y 36 (TV2) inicializadas con `["apple_pay"]`

- **TASK-B02** — `POST /api/checkout/confirm-apple-pay` ✅ implementado (Mar 4 2026)
  - Auth: `X-Api-Key` (SDK key)
  - Decodifica `applePayToken` (base64 → JSON) + llama Stripe para confirmar PaymentIntent
  - Responde: `{ success: true, orderId: "pi_xxx", status: "succeeded" }`
  - Errores manejados: `STRIPE_NOT_CONFIGURED` (503), `MISSING_PARAMS` (400), `INVALID_TOKEN` (400), `CARD_ERROR` (402)
  - **Pendiente para producción:** añadir `STRIPE_SECRET_KEY` como secret en Replit. Subir cert Apple Pay en dashboard.stripe.com → Settings → Apple Pay (archivo `~/vio-apple-pay.p12`, contraseña `vio2026`).

- `normalizeUrls()` en WS contest events ✅
- Carousel `sport-detail-carousel` / `sport-home-carousel` activado en campaña 36 ✅
- broadcastId en pollEventSchema + contestEventSchema ✅
- Sponsor badge (`badgeText`) en config endpoint ✅
- `integrations.commerce` en ambos config endpoints ✅

## 📋 BACKLOG
- Demo mode endpoint: `POST /api/broadcasts/:id/demo/start` — secuencia automática de eventos
- Highlights endpoint: `GET /v1/sdk/broadcasts/:id/highlights`
- Engagement products: backend resuelve productId → Commerce antes de emitir WS
- Añadir `STRIPE_SECRET_KEY` a secrets de Replit para activar TASK-B02 en producción
