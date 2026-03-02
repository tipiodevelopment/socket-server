# VIO TRUTH — Fuente Absoluta de Verdad
> Última actualización: 2026-03-02
> Mantenido por: Viobot — coordinador técnico entre Replit, Cursor y Angelo

---

## ⚠️ NOMENCLATURA — LEER PRIMERO

| Nombre | Qué es | Estado |
|--------|--------|--------|
| **Vio** | Plataforma de engagement para live events (polls, contests, chat, componentes) | Activo — foco principal |
| **Commerce** | Módulo de ecommerce — overlay de producto, checkout, carrusel de productos. Ex-Reachu. | Módulo opcional por campaña — **nombre definitivo** |
| **Tipio** | Servicio de livestream. Producto SEPARADO. NO es Commerce/Reachu. | Futuro lejano — no tocar |

---

## 🎯 VISIÓN DEL PRODUCTO

Vio es la **segunda pantalla oficial para eventos deportivos.**

El usuario ve el partido en la TV. En el móvil tiene el panel de Vio (integrado en la app de Viaplay/TV2) con:
- **Engagement** (CORE): polls, contests, chat en tiempo real — sincronizados con el partido
- **Commerce** (MONETIZACIÓN): banners, productos, carrusel, mini tienda — comprables en el momento de máxima emoción
- **Info**: estadísticas, live scores, highlights, tweets curados por moderador

**El loop de valor:**
```
Engagement engancha → atención sostenida → Commerce convierte
```

El timing es el producto. Una camiseta del Real Madrid en el minuto 90 tras un gol vale más que cualquier banner.

---

## 🏗️ ARQUITECTURA GLOBAL

```
[Viaplay / TV2 App]
       │
       │  contentId (stream ID del partner)
       ▼
[VioSwiftSDK / VioKotlinSDK]
       │
       ├── GET /v1/sdk/campaigns         → campañas + componentes
       ├── GET /v1/sdk/broadcast         → contentId → broadcastId + engagement
       ├── GET /v1/campaigns/:id/config  → config + Commerce key
       ├── GET /v1/sdk/components?locationId=  → componente activo por slot
       ├── POST /v1/engagement/polls/:id/vote
       └── WSS /ws/:campaignId
       ▼
[Backend Vio — api-dev.vio.live]
       │
       ├── PostgreSQL (Neon) · tablas · Drizzle ORM
       └── Si commerce.enabled = true ──▶ [graph-ql-dev.vio.live] (infraestructura separada)
```

### URLs definitivas
| Servicio | URL |
|----------|-----|
| Backend Vio | `https://api-dev.vio.live` |
| Dashboard admin | `https://api-dev.vio.live` |
| Commerce GraphQL | `https://graph-ql-dev.vio.live/graphql` |
| ~~event-streamer-angelo100.replit.app~~ | DEPRECADO → usar api-dev.vio.live |

---

## 📊 JERARQUÍA DE DATOS

```
Client App (ej. Viaplay iOS)
  └── Campaigns (una o varias)
       ├── Sponsor → fuente única de branding (logo, colores, badgeText)
       ├── Components → banners, carrusel, productos, mini tienda
       │    ├── locationId → slot semántico asignado por el operador
       │    └── (el SDK usa GET /v1/sdk/components?locationId= para resolver)
       └── Broadcasts → partidos / eventos deportivos
            ├── Polls (pre-programados + tiempo real, con broadcastId en WS)
            ├── Contests (pre-programados + tiempo real, con broadcastId en WS)
            └── Chat (con tweets curados por moderador de Viaplay)
```

---

## 🔐 AUTENTICACIÓN

### SDK — Una sola Vio App Key
```json
{
  "apiKey": "<Vio App API Key>",
  "restAPIBaseURL": "https://api-dev.vio.live",
  "webSocketBaseURL": "https://api-dev.vio.live"
}
```

### Keys de demo
| Key | Para qué |
|-----|----------|
| `viaplay_api_key_0c611e983b314ff8` | Demo Viaplay (campaña 35) |
| `xxl_api_key_507d4014243d8360` | Demo XXL (campaña 28) |
| `KCXF10Y-W5T4PCR-GG5119A-Z64SQ9S` | Commerce module (viene del servidor vía `integrations.commerce.apiKey`) |

### Commerce key — nunca en el config del app
El servidor la entrega en `GET /v1/campaigns/:id/config` → `integrations.commerce.apiKey`.
El bloque `integrations.commerce` siempre está presente (con `enabled: false` si no hay key).

---

## 📡 WEBSOCKET — EVENTOS

| Evento | Cuándo | Acción SDK |
|--------|--------|------------|
| `broadcast_started` | Broadcast → live | Activar polls/contests/chat |
| `broadcast_ended` | Broadcast → ended | Ocultar engagement |
| `poll_results_updated` | Voto recibido | Actualizar porcentajes |
| `poll` | Admin/operador dispara | Mostrar poll overlay (incluye `broadcastId`) |
| `contest` | Admin/operador dispara | Mostrar contest overlay (incluye `broadcastId`) |
| `component_status_changed` | Scheduler / manual | Mostrar/ocultar componente |
| `chat_message` | Chat en tiempo real | Añadir mensaje al feed |
| `tweet` | Moderador curado | Añadir tweet al feed |
| `score_update` | Datos de partido | Actualizar marcador |

**Al conectar al WebSocket:** el servidor emite inmediatamente los polls/contests activos del broadcast live con su `broadcastId` — el SDK no necesita hacer un fetch extra para tener estado inicial.

---

## 🧩 LOCATION SLOT SYSTEM (nuevo Mar 2026)

Los desarrolladores definen slots fijos en la UI del SDK con nombres semánticos. El operador asigna el componente desde el dashboard.

```swift
// SDK — el desarrollador lo define una vez
VProductBanner(locationId: "sport-detail-banner")
VProductCarousel(locationId: "sport-detail-carousel")
```

```
// Dashboard — el operador asigna por campaña
"Samsung TV Banner" → slot: sport-detail-banner
"Elkjøp Carousel"  → slot: sport-detail-carousel
```

```
// API — resolución por slot
GET /v1/sdk/components?campaignId=35&locationId=sport-detail-banner
→ { components: [{ type: "product_banner", config: { productId: "408895", ... }, locationId: "sport-detail-banner" }] }
```

### Slots estándar
```
sport-detail-banner      → Banner bajo el header en SportDetailView
sport-detail-carousel    → Carrusel en SportDetailView
sport-home-banner        → Banner en home de deportes
sport-home-carousel      → Carrusel en home de deportes
casting-overlay-banner   → Banner durante el stream
```

---

## 📋 TAREAS — REPLIT

### COMPLETADO (Mar 2026)
- ✅ `integrations.commerce` en `/v1/campaigns/:id/config` y `/v1/sdk/config`
- ✅ `broadcastId` en eventos WS poll/contest + estado inicial al conectar
- ✅ `sponsor.badgeText` localizado (no/en/sv) en config endpoint
- ✅ Commerce activado en campaña 35 (key `KCXF10Y-...`)
- ✅ ProductCarousel template + activo en campaña 35 (slot sport-detail-carousel)
- ✅ ProductBanner config (productId 408895, textos noruego) + activo (slot sport-detail-banner)
- ✅ Location Slot System: dashboard selector + API locationId + PATCH endpoint actualizado

### PENDIENTE (Replit)
- ⚪ `GET /v1/sdk/broadcasts/:broadcastId/chat` — historial de chat (VIO-003)
- ⚪ Transacciones DB en votos (insert + update en una sola tx)
- ⚪ Dashboard: editar `locationId` de componentes ya añadidos

---

## 📋 TAREAS — CURSOR (SDK iOS)

### Para la demo TV2
1. Parsear `integrations.commerce.apiKey` en `CampaignConfig` → inicializar módulo Commerce si `enabled: true`
2. Implementar `VProductBanner(locationId: "sport-detail-banner")` → llama a `/v1/sdk/components?locationId=sport-detail-banner`
3. Implementar `VProductCarousel(locationId: "sport-detail-carousel")` → llama a `/v1/sdk/components?locationId=sport-detail-carousel`
4. Reemplazar URL hardcodeada `event-streamer-angelo100.replit.app` → `restAPIBaseURL` del config

### BLOCKER pendiente (Kotlin)
- Migrar namespace `io.reachu.*` → `live.vio.*` (191 archivos) — después del miércoles

---

## 🛠️ VARIABLES DE ENTORNO BACKEND

| Variable | Requerida |
|----------|-----------|
| `DATABASE_URL` | ✅ |
| `SESSION_SECRET` | ✅ |
| `SCHEDULER_INTERVAL_MINUTES` | No (default: 1 min) |
| `USE_QUEUE` | No |

---

## 🗓️ DEALS COMERCIALES

| Partner | Estado |
|---------|--------|
| **Viaplay** | 4 reuniones. Jefe de producto. Noruega aprobado internamente. Pendiente decisión escandinava. |
| **TV2** | 2ª reunión el miércoles. Fase temprana. |

---

## 🔮 FUTURO (no tocar ahora)

- Usuarios viendo en móvil también pueden interactuar (ahora solo second screen TV)
- Modelos AI que automatizan el rol del operador — detectan momentos clave y lanzan polls/contests
- Tipio (livestream service) — futuro lejano
- KotlinSDK namespace migration → después del miércoles

---

_Actualizado: 2026-03-02 · Viobot_
