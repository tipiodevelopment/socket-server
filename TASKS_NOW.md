# TASKS_NOW — socket-server

_Actualizado: 2026-03-02 · Viobot_

---

## ✅ COMPLETADO EN ESTA SESIÓN

### #160 — broadcastId en eventos WebSocket
- `pollEventSchema` / `contestEventSchema` incluyen `broadcastId?: string`
- Al conectar `/ws/:campaignId` → emite inmediatamente polls/contests activos con `broadcastId`
- Verificado: `/ws/35` entrega 2 polls con `broadcastId: "real-madrid-vs-barcelona-2026-02-25"` ✅

### #162 — sponsor.badgeText en config endpoint
- `GET /v1/campaigns/:id/config` → `sponsor.badgeText: { "no": "Sponset av", "en": "Sponsored by", "sv": "Sponsrad av" }`
- `brand.sponsorBadgeText` mantenido para compatibilidad ✅

### #163 — Commerce + ProductCarousel activados en campaña 35
- Commerce API key `KCXF10Y-W5T4PCR-GG5119A-Z64SQ9S` activada → `integrations.commerce.enabled: true` ✅
- Template `Elkjøp Product Carousel` creado con 4 product IDs → activo en campaña 35 ✅
- Dashboard ComponentsTab: forms añadidos para `carousel_auto`, `product_store` ✅

### #164 — ProductBanner activado en campaña 35
- `product-banner-template` actualizado: `productId: "408895"`, textos en noruego, colores Elkjøp
- Activado en campaña 35 con `locationId: "sport-detail-banner"` ✅
- Form en ComponentsTab: placeholder y nota actualizados para Commerce ✅

### #165 — Location Slot System
- **Backend:** `POST /api/campaigns/:id/components` acepta y persiste `locationId`
- **Backend:** `PATCH /api/campaigns/:id/components/:componentId` acepta `locationId` (sin requerir `status`)
- **Storage:** `updateCampaignComponentLocationId()` añadido a IStorage + DatabaseStorage
- **Dashboard:** dialog "Add Component" tiene selector de 5 location slots estándar
- **Datos campaña 35:** `product-banner-template → sport-detail-banner`, `Elkjøp Carousel → sport-detail-carousel`
- SDK verificado: `?locationId=sport-detail-banner` → `product_banner` ✅, `?locationId=sport-detail-carousel` → `product_carousel` ✅

---

## 🔴 SIGUIENTE — SDK iOS

### Lo que Angelo necesita para la demo TV2

```
1. Leer integrations.commerce.apiKey desde GET /v1/campaigns/:id/config
2. Instanciar VProductBanner con locationId: "sport-detail-banner"
3. Instanciar VProductCarousel con locationId: "sport-detail-carousel"
4. El SDK llama: GET /v1/sdk/components?campaignId=35&locationId=sport-detail-banner
5. Si hay componente activo → renderizarlo
```

**Backend listo — nada pendiente en Replit para esta parte.**

---

## ⚪ BACKLOG — Replit

| ID | Tarea | Prioridad |
|----|-------|-----------|
| VIO-003 | `GET /v1/sdk/broadcasts/:broadcastId/chat` — historial de chat | 🟡 Media |
| — | Transacciones DB en votos (insert poll_vote + update counts en una tx) | 🟡 Media |
| — | Paginación en listados de broadcasts y componentes | ⚪ Baja |
| — | Dashboard: editar `locationId` en componentes ya añadidos a campaña | ⚪ Baja |

---

## 📊 DATOS DEMO ACTIVOS — campaña 35

| Campo | Valor |
|-------|-------|
| Vio App API Key | `viaplay_api_key_0c611e983b314ff8` |
| campaignId | 35 |
| contentId | `real-madrid-barcelona-2025-01-24` |
| broadcastId | `real-madrid-vs-barcelona-2026-02-25` |
| Sponsor | Elkjøp (`#f7b23b`) |
| Commerce API Key | `KCXF10Y-W5T4PCR-GG5119A-Z64SQ9S` |
| Product Banner | productId `408895`, slot `sport-detail-banner` |
| Product Carousel | IDs `408841, 408874, 408895, 408896`, slot `sport-detail-carousel` |
| Polls activos | 15 (¿Quién ganará?) + 16 (¿Quién marcará?) |

---

## 🟡 #166 [BACKEND] Añadir locationId al serializer de /v1/sdk/campaigns

### Problema
`GET /v1/sdk/campaigns` devuelve componentes sin `locationId`.
El SDK carga componentes desde esa ruta — el campo llega `nil` y el slot system no funciona.

### Fix
En `server/routes.ts`, donde se serializa la respuesta de `/v1/sdk/campaigns`,
añadir `locationId` al objeto de cada componente.

Ya está implementado en `/v1/sdk/components` — es copiar el mismo campo.

Buscar donde se construye el array de componentes para la respuesta de campaigns,
algo como:
```js
// Antes:
{ id: cc.id, type: cc.type, name: cc.name, config: ..., status: cc.status }

// Después:
{ id: cc.id, type: cc.type, name: cc.name, config: ..., status: cc.status, locationId: cc.locationId || null }
```

### Criterio de aceptación
```
GET /v1/sdk/campaigns → campaigns[0].components[0].locationId === "sport-detail-carousel"
```
