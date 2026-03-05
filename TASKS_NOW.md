# TASKS_NOW.md — Vio Backend (socket-server)
_Actualizado: 2026-03-05 Oslo_

## 🔴 ACTIVO AHORA

_Sin tareas activas pendientes._

---

## ✅ COMPLETADO RECIENTEMENTE

- **TASK-B03** — `POST /api/broadcasts/:id/shoppable-ad` ✅ (Mar 5 2026)
  - Auth: Bearer JWT (admin)
  - Resuelve producto via Commerce GraphQL (`https://graph-ql-dev.vio.live/graphql`, auth: `Authorization: <commerceApiKey>`)
  - Commerce key: `campaign.reachuApiKey` → fallback `COMMERCE_API_KEY` env → fallback hardcoded
  - Emite WS `shoppable_ad` con `{ type, broadcastId, product: { id, name, price, currency, imageUrl }, sponsor?, timestamp }`
  - Sponsor se resuelve de la tabla `sponsors` por `sponsorId` del request
  - Responde `{ success: true }`

- **TASK-B04** — `POST /api/campaigns/:id/register-device` ✅ (Mar 5 2026)
  - Auth: `X-Api-Key` (SDK key)
  - Upsert en tabla `device_tokens` por `(campaign_id, user_id)`
  - Responde `{ success: true }`

- **TASK-B05** — `POST /api/campaigns/:id/cart-intent` ✅ (Mar 5 2026)
  - Auth: `X-Api-Key` (SDK key)
  - Busca `deviceToken` del `userId` en tabla `device_tokens`
  - Manda push APNs via `node-apn`
  - Si APNs no configurado (faltan `APNS_CERT_P8`, `APNS_KEY_ID`, `APNS_TEAM_ID`) → loguea y responde `{ success: true, note: "apns_not_configured" }`
  - Bundle ID: `process.env.APNS_BUNDLE_ID` || `"viodev.tv2demo"`
  - **Pendiente para producción:** Angelo provee cert APNs → añadir secrets `APNS_CERT_P8`, `APNS_KEY_ID`, `APNS_TEAM_ID`

- **TASK-B01/B02** — paymentMethods + Apple Pay endpoint ✅ (Mar 4 2026)
- `normalizeUrls()` en WS contest events ✅
- `integrations.commerce` en ambos config endpoints ✅
- Carousel `sport-detail-carousel` / `sport-home-carousel` en campaña 36 ✅

## 📋 BACKLOG
- Demo mode endpoint: `POST /api/broadcasts/:id/demo/start` — secuencia automática de eventos
- Highlights endpoint: `GET /v1/sdk/broadcasts/:id/highlights`
- Añadir `STRIPE_SECRET_KEY` para activar TASK-B02 en producción
- Añadir `APNS_CERT_P8` + `APNS_KEY_ID` + `APNS_TEAM_ID` para APNs en producción (Angelo provee cert)
