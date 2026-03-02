# Vio – Estado Actual del Sistema
**Fecha:** Marzo 2026  
**Propósito:** Fuente de verdad para el equipo. Qué está hecho, qué está pendiente y qué decisiones están tomadas.

---

## 1. Arquitectura en producción

### Backend (`api-dev.vio.live`)
- Node.js + Express + PostgreSQL (Neon Serverless)
- WebSockets con canales aislados por campaña (`/ws/{campaignId}`)
- Autenticación: JWT Bearer para APIs admin `/v1/*`, API key para SDK `/v1/sdk/*` y `/v1/engagement/*`
- Object Storage: Replit Object Storage para uploads de imágenes
- Deployment: **autoscale** (cambiado de `vm` en Feb 2026)

### Dashboard (`api-dev.vio.live`)
- React 18 + Vite + Tailwind CSS + Radix UI
- Multi-tenant: Apps → Campañas → Broadcasts
- Gestión de Sponsors, Componentes, Polls, Contests, Ads, Productos, Location Slots

### SDK iOS (`VioSwiftSDK`)
- Demo en `Demo/Viaplay`
- Conecta a `api-dev.vio.live`

---

## 2. Modelo de API Keys — DEFINITIVO

```
┌─────────────────────────────────────────────────────────┐
│                   vio-config.json                       │
│                                                         │
│  {                                                      │
│    "apiKey": "<Vio App API Key>",                       │
│    "restAPIBaseURL": "https://api-dev.vio.live",        │
│    "webSocketBaseURL": "https://api-dev.vio.live"       │
│  }                                                      │
│                                                         │
│  UNA sola key para TODOS los endpoints Vio.             │
│  Sin campaignAdminApiKey. Sin campaignApiKey.           │
└─────────────────────────────────────────────────────────┘
```

### Keys por cliente (en DB: `client_apps.api_key`)

| Cliente | Vio App API Key | Campaña principal |
|---------|----------------|-------------------|
| XXL | `xxl_api_key_507d4014243d8360` | 28 |
| Viaplay | `viaplay_api_key_0c611e983b314ff8` | 35 |

### Commerce key — entregada por el servidor

La Commerce key NO va en `vio-config.json`. El SDK la recibe al llamar al config endpoint:

```
GET /v1/campaigns/{id}/config?apiKey=<Vio App Key>
→ response.integrations.commerce.apiKey
```

- Si `enabled: true` → inicializar módulo Commerce
- Si `enabled: false` → no inicializar
- Fuente en DB: `campaigns.reachuApiKey` (nombre interno, no expuesto públicamente)

---

## 3. Endpoints SDK — todos operativos

| Método | Endpoint | Auth | Descripción |
|--------|----------|------|-------------|
| GET | `/v1/sdk/campaigns` | apiKey | Campañas activas + componentes de campaña |
| GET | `/v1/sdk/config` | apiKey | Config legacy por campaña (incluye `integrations.commerce`) |
| GET | `/v1/sdk/broadcast` | apiKey | Resolución contentId → broadcast |
| GET | `/v1/sdk/components` | apiKey | Componentes activos de campaña, filtrable por `?locationId=` |
| GET | `/v1/campaigns/{id}/config` | apiKey | Config dinámica + branding + Commerce key |
| POST | `/v1/engagement/polls/{id}/vote` | apiKey | Votar en poll |
| POST | `/v1/engagement/contests/{id}/participate` | apiKey | Participar en contest |
| GET | `/v1/engagement/polls` | apiKey | Polls activos |
| GET | `/v1/engagement/contests` | apiKey | Contests activos |
| GET | `/v1/engagement/config` | apiKey | Config de engagement por matchId |
| GET | `/v1/offers` | apiKey | Ofertas con targeting geográfico |
| GET | `/v1/localization/{lang}` | apiKey | Strings localizados |

### Flujo de inicialización SDK (orden correcto)

```
1. GET /v1/sdk/campaigns          → campañas activas + componentes
2. GET /v1/campaigns/{id}/config  → branding + Commerce key
3. (al abrir stream)
   GET /v1/sdk/broadcast?contentId=xxx&country=NO
                                  → hasEngagement true/false
4. (si hasEngagement: true)
   WebSocket wss://api-dev.vio.live/ws/{campaignId}
                                  → eventos en tiempo real
5. POST /v1/engagement/polls/{id}/vote  → votos
6. (por location slot)
   GET /v1/sdk/components?campaignId=35&locationId=sport-detail-banner
                                  → componente activo para ese slot
```

---

## 4. Bloque `integrations.commerce` — presente en ambos endpoints config

Tanto `/v1/sdk/config` como `/v1/campaigns/{id}/config` devuelven siempre:

```json
{
  "integrations": {
    "commerce": {
      "enabled": true,
      "apiKey": "KCXF10Y-W5T4PCR-GG5119A-Z64SQ9S",
      "channelId": null
    }
  }
}
```

`enabled: false` y `apiKey: null` cuando el administrador no ha configurado la Commerce API key.
Dashboard: **Campaign → Settings → Commerce Integration → API Key**

---

## 5. Location Slot System — NUEVO (Mar 2026)

Los desarrolladores definen slots fijos en el código del SDK con nombres semánticos. El operador asigna qué componente va en cada slot desde el dashboard.

```
Developer (Swift, una vez):
  VProductBanner(locationId: "sport-detail-banner")
  VProductCarousel(locationId: "sport-detail-carousel")

Operador (dashboard, por campaña):
  "Samsung TV Banner"   → locationId: sport-detail-banner
  "Elkjøp Carousel"    → locationId: sport-detail-carousel
```

### Slots estándar definidos por el SDK

| locationId | Descripción |
|------------|-------------|
| `sport-detail-banner` | Banner bajo el header en SportDetailView |
| `sport-detail-carousel` | Carrusel de productos en SportDetailView |
| `sport-home-banner` | Banner en la home de deportes |
| `sport-home-carousel` | Carrusel en la home de deportes |
| `casting-overlay-banner` | Banner durante el stream |

### API

```
GET /v1/sdk/components?campaignId=35&locationId=sport-detail-banner&apiKey=...
→ componente activo para ese slot (o array vacío si no hay ninguno)
```

### Dashboard
- Al añadir un componente a una campaña → selector "Location Slot (Optional)"
- El selector muestra los 5 slots estándar
- El `locationId` se asigna en `POST /api/campaigns/:id/components`
- Para modificar el slot de un componente existente: `PATCH /api/campaigns/:id/components/:componentId { "locationId": "..." }`

---

## 6. Estado campaña 35 — Demo Viaplay

| Campo | Valor |
|-------|-------|
| Vio App API Key | `viaplay_api_key_0c611e983b314ff8` |
| Commerce API Key | `KCXF10Y-W5T4PCR-GG5119A-Z64SQ9S` (`enabled: true`) |
| Sponsor | Elkjøp (`#f7b23b`, avatarUrl ✅, logoUrl ✅) |
| contentId | `real-madrid-barcelona-2025-01-24` |
| broadcastId | `real-madrid-vs-barcelona-2026-02-25` |
| Polls activos | 15 + 16 (con `broadcastId` en eventos WS) |
| ProductBanner | `productId: 408895`, slot `sport-detail-banner`, activo |
| ProductCarousel | IDs 408841/408874/408895/408896, slot `sport-detail-carousel`, activo |

---

## 7. Legacy — qué se mantiene y por qué

### `event-streamer-angelo100.replit.app`
- **Qué es:** Dominio viejo del mismo backend Vio — mismo código, mismos endpoints
- **Estado:** DEPRECADO — todos los endpoints ya existen en `api-dev.vio.live`
- **Acción para el SDK:** Reemplazar la URL hardcodeada por `VioConfiguration.shared.campaignConfiguration.restAPIBaseURL`

### `graph-ql-dev.vio.live/graphql`
- **Qué es:** Backend GraphQL independiente (no es este repositorio)
- **Uso en SDK:** `SdkClient`, `VCastingVideoPlayer`, `VCastingActiveView`
- **Decisión:** Fuera de scope de este proyecto

### Campos DB `reachuApiKey` / `reachuChannelId`
- **Qué son:** Nombre interno de los campos de Commerce en la DB
- **Por qué se mantienen:** Renombrar requiere migración destructiva
- **En la API pública:** Se exponen como `integrations.commerce.apiKey` / `integrations.commerce.channelId`

---

## 8. Nomenclatura — definitiva

| Concepto | Nombre público | Nombre en DB | Estado |
|----------|---------------|--------------|--------|
| Plataforma de engagement | **Vio** | — | Activo |
| Módulo de ecommerce | **Commerce** | `reachuApiKey` / `reachuChannelId` | Activo |
| Livestream service | **Tipio** | — | Futuro, no tocar |

**"Commerce" es el nombre definitivo para el módulo de ecommerce en todas las interfaces públicas.**

---

## 9. Cambios aplicados — historial

| Cambio | Versión | Estado |
|--------|---------|--------|
| `integrations.commerce` en `/v1/campaigns/{id}/config` | Feb 2026 | ✅ |
| `broadcastId` en eventos WS poll/contest + estado inicial al conectar | Mar 2026 | ✅ |
| `sponsor.badgeText` localizado en config endpoint | Mar 2026 | ✅ |
| Commerce (key `KCXF10Y-...`) activado en campaña 35 | Mar 2026 | ✅ |
| ProductCarousel template + activo en campaña 35 | Mar 2026 | ✅ |
| ProductBanner (productId 408895, textos noruego) activo en campaña 35 | Mar 2026 | ✅ |
| Location Slot System: `locationId` en dashboard + API + SDK | Mar 2026 | ✅ |
| UI: "Commerce Integration" en Settings tab (ex "Reachu Integration") | Feb 2026 | ✅ |
| Deploy: autoscale (ex vm) | Feb 2026 | ✅ |

---

_Actualizado: 2026-03-02 · Viobot_
