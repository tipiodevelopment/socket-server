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

## ✅ #167 [FULL-STACK] Dashboard de Concursos — Fase 1

### Cambios implementados

**Schema** (`shared/schema.ts`):
- `contests.imageUrl: varchar("image_url", { length: 1000 })` añadido ✅
- DB migrada con `npm run db:push` ✅

**API** (`server/routes.ts`):
- `POST /api/broadcasts/:id/contests` — acepta y persiste `imageUrl` + emite WS event si `isActive: true` ✅
- `PUT /api/contests/:id` — acepta `imageUrl` + emite WS event al activar (`isActive: true`) ✅

**WebSocket — formato de evento contest** (unificado):
```json
{
  "type": "contest",
  "broadcastId": "real-madrid-vs-barcelona-2026-02-25",
  "id": "9",
  "title": "Elkjøp Konkurranse",
  "description": "Delta og vinn to billetter...",
  "prize": "To billetter til Champions League",
  "contestType": "giveaway",
  "imageUrl": "https://...",
  "isActive": true,
  "timestamp": 1741042800000
}
```
- Initial state al conectar WS también usa este formato ✅

**UI** (`client/src/pages/broadcast-detail.tsx`):
- Campo "Image URL" añadido al form "Create Contest" ✅
- ContestCard: muestra thumbnail si hay `imageUrl`, sino Trophy icon ✅

**Verificado:**
- `POST` con `imageUrl` → respuesta incluye `imageUrl` ✅
- Contest eliminado del demo ✅

---

## ✅ #166 [BACKEND] Añadir locationId al serializer de /v1/sdk/campaigns

`GET /v1/sdk/campaigns` ahora incluye `locationId` en cada componente.
Verificado:
- `RProductCarousel 1: locationId="sport-detail-carousel"` ✅
- `RProductBanner 1: locationId="sport-detail-banner"` ✅

---

## Aclaración: Tres imágenes distintas en el Contest Card

El card de concurso tiene **3 imágenes con orígenes distintos**:

### 1. `imageUrl` — Imagen del premio/concurso
- **Qué es**: Imagen grande del concurso (Samsung TV, tickets Champions, spinner "SPINN OG VINN")
- **Origen**: La sube el operador al crear el contest en el dashboard
- **Campo**: `contests.image_url` en la DB
- **Se muestra**: Banner principal del card (full width, ~140px)
- **Dashboard**: `ImageUploadWithPreview` en el form de creación de contest ✅ (implementado Mar 2026)

### 2. `sponsor.avatarUrl` — Avatar circular del sponsor
- **Qué es**: Icono circular pequeño (ej: logo cuadrado Elkjøp)
- **Origen**: `GET /v1/campaigns/:id/config` → `brand.iconUrl`
- **Se muestra**: Círculo 32×32 en el header del card
- **NO se configura por contest** — viene del campaign config

### 3. `sponsor.logoUrl` — Badge del sponsor
- **Qué es**: Logo horizontal del sponsor (ej: "ELKJØP")
- **Origen**: `GET /v1/campaigns/:id/config` → `brand.logoUrl`
- **Se muestra**: Badge top-right del card con color primario del sponsor
- **NO se configura por contest** — viene del campaign config

```
┌─────────────────────────────┐
│ [Avatar] Elkjøp       [Logo]│  ← brand.iconUrl + brand.logoUrl
├─────────────────────────────┤
│   [  imagen del premio  ]   │  ← contests.image_url (sube el operador)
├─────────────────────────────┤
│ Delta og vinn to billetter  │
│ 🏆 To billetter Champions   │
│ [      Delta-knappen  ]     │
└─────────────────────────────┘
```

---

## ✅ RESUELTO (Mar 4 2026): imageUrl absoluta en WS events de contests

**Fix aplicado en `server/routes.ts`** en las 3 ubicaciones de emisión WS:
- Snapshot inicial al conectar (~línea 289)
- POST /api/broadcasts/:id/contests al crear con isActive (~línea 3473)
- PUT /api/contests/:id al activar (~línea 3518)

`normalizeUrls(contest.imageUrl)` convierte `/objects/uploads/xxx` → `https://api-dev.vio.live/objects/uploads/xxx`.

Verificado: `GET /v1/campaigns/35/config` devuelve `integrations.commerce` con `apiKey: "KCXF10Y-..."` ✅
