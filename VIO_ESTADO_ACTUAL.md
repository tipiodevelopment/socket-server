# Vio – Estado Actual del Sistema
**Fecha:** Febrero 2026  
**Propósito:** Fuente de verdad para el equipo. Qué está hecho, qué está pendiente y qué decisiones están tomadas.

---

## 1. Arquitectura en producción

### Backend (`api-dev.vio.live`)
- Node.js + Express + PostgreSQL (Neon Serverless)
- WebSockets con canales aislados por campaña (`/ws/{campaignId}`)
- Autenticación: JWT Bearer para APIs admin `/v1/*`, API key para SDK `/v1/sdk/*` y `/v1/engagement/*`
- Object Storage: Replit Object Storage para uploads de imágenes

### Dashboard (`vio.live` o dominio Replit)
- React 18 + Vite + Tailwind CSS + Radix UI
- Multi-tenant: Apps → Campañas → Broadcasts
- Gestión de Sponsors, Componentes, Polls, Contests, Ads, Productos

### SDK iOS (`VioSwiftSDK`)
- Demo en `Demo/Viaplay`
- Conecta a `api-dev.vio.live`
- Tiene también conexión legacy a `event-streamer-angelo100.replit.app` (ver Sección 5)

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

### Tipio key — entregada por el servidor

La Tipio key NO va en `vio-config.json`. El SDK la recibe al llamar al config endpoint:

```
GET /v1/campaigns/{id}/config?apiKey=<Vio App Key>
→ response.integrations.tipio.apiKey
```

- Si `enabled: true` → inicializar módulo Tipio
- Si `enabled: false` → no inicializar
- Fuente en DB: `campaigns.reachuApiKey` (nombre interno, no expuesto públicamente)

---

## 3. Endpoints SDK — todos operativos

| Método | Endpoint | Auth | Descripción |
|--------|----------|------|-------------|
| GET | `/v1/sdk/campaigns` | apiKey | Campañas activas + componentes de campaña |
| GET | `/v1/sdk/config` | apiKey | Config legacy por campaña (incluye `integrations.tipio`) |
| GET | `/v1/sdk/broadcast` | apiKey | Resolución contentId → broadcast |
| GET | `/v1/campaigns/{id}/config` | apiKey | Config dinámica + branding + Tipio |
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
2. GET /v1/campaigns/{id}/config  → branding + Tipio key
3. (al abrir stream)
   GET /v1/sdk/broadcast?contentId=xxx&country=NO
                                  → hasEngagement true/false
4. (si hasEngagement: true)
   WebSocket wss://api-dev.vio.live/ws/{campaignId}
                                  → eventos en tiempo real
5. POST /v1/engagement/polls/{id}/vote  → votos
```

---

## 4. Bloque `integrations.tipio` — presente en ambos endpoints

Tanto `/v1/sdk/config` como `/v1/campaigns/{id}/config` devuelven:

```json
{
  "integrations": {
    "tipio": {
      "enabled": false,
      "apiKey": null,
      "channelId": null
    }
  }
}
```

`enabled: true` solo cuando el administrador configure la Tipio API key desde el dashboard:
**Campaign → Settings → Tipio Integration → API Key**

---

## 5. Legacy — qué se mantiene y por qué

### `event-streamer-angelo100.replit.app`
- **Qué es:** Dominio viejo del mismo backend Vio — mismo código, mismos endpoints
- **Por qué aún aparece:** Está hardcodeado en `OfferBannerModels` y `EventStreamerManager` del SDK iOS
- **Estado:** DEPRECADO — se puede eliminar ahora
- **Acción para el SDK:** Reemplazar la URL hardcodeada por `VioConfiguration.shared.campaignConfiguration.restAPIBaseURL`
- **Endpoints que usaba → ya existen en `api-dev.vio.live`:**
  - `GET /api/campaigns/{id}/active-components` ✅ (línea 2237 en routes.ts)
  - `WebSocket /ws/{campaignId}` ✅

### `graph-ql-dev.vio.live/graphql`
- **Qué es:** Backend GraphQL independiente (no es este repositorio)
- **Quién lo gestiona:** No es responsabilidad de este backend
- **Uso en SDK:** `SdkClient`, `VCastingVideoPlayer`, `VCastingActiveView`
- **Decisión:** Fuera de scope de este proyecto por ahora

### Campos DB `reachuApiKey` / `reachuChannelId`
- **Qué son:** Nombre interno de los campos de Tipio en la DB
- **Por qué se mantienen:** Renombrar requiere migración destructiva
- **En la API pública:** Se exponen como `integrations.tipio.apiKey` / `integrations.tipio.channelId`

---

## 6. Historial de naming

| Nombre público | Periodo | Nombre en DB |
|----------------|---------|--------------|
| Reachu | Hasta ene 2026 | `reachuApiKey` |
| Commerce | Feb 2026 (transitorio, ~días) | `reachuApiKey` |
| **Tipio** | Feb 2026 → ahora | `reachuApiKey` |

**"Tipio" es el nombre definitivo.** No habrá más cambios de nombre.

---

## 7. Reporte del problema 401 (SDK iOS)

### Causa
El `ConfigAPIClient.swift` usaba `KCXF10Y-W5T4PCR-GG5119A-Z64SQ9S` (Tipio key) para autenticarse en Vio. Esa key no existe en `client_apps.api_key` → 401.

### Solución para el SDK
**Fix mínimo** — en `ConfigAPIClient.swift`:
```swift
// Usar campaignAdminApiKey (xxl_api_key_...) en lugar de apiKey (KCXF10Y-...)
private var apiKey: String {
    VioConfiguration.shared.campaigns?.campaignAdminApiKey ?? VioConfiguration.shared.apiKey
}
```

**Solución definitiva** — refactorizar `vio-config.json` a una sola key:
```json
{
  "apiKey": "xxl_api_key_507d4014243d8360",
  "restAPIBaseURL": "https://api-dev.vio.live",
  "webSocketBaseURL": "https://api-dev.vio.live"
}
```

---

## 8. Dudas abiertas

Estas preguntas están pendientes de respuesta del equipo iOS (ver `VIO_SDK_RESPONSE.md`):

### Alta prioridad
1. **¿Pueden refactorizar a una sola Vio App key?**  
   Impacta directamente cuándo se puede simplificar el modelo de config en el SDK.

2. **`/v1/sdk/config` vs `/v1/campaigns/{id}/config` — ¿cuál usa el SDK actualmente?**  
   Ambos existen y ahora ambos incluyen `integrations.tipio`. Pero si el SDK usa `/v1/sdk/config`, necesita pasar `?campaignId=28` en la URL o da 400.

### Media prioridad
3. **¿El `liveShow.campaignId: 28` es hardcodeado o dinámico por build?**  
   Si es hardcodeado, el flujo de discovery (`GET /v1/sdk/campaigns`) no se está aprovechando.

4. ~~`event-streamer-angelo100.replit.app` — ¿cuándo se puede deprecar?~~  
   **RESUELTO:** Es el mismo backend Vio, solo un dominio viejo. El SDK solo necesita reemplazar la URL hardcodeada por `restAPIBaseURL`. Todos los endpoints ya existen en `api-dev.vio.live`.

### Baja prioridad
5. **¿Qué versión del SDK está en demo Viaplay?**  
   Para saber si ya soporta leer `integrations.tipio.apiKey` del config response.

6. **`graph-ql-dev.vio.live` — ¿quién lo gestiona y cuándo se documenta?**  
   No bloquea nada hoy pero habría que documentarlo para que Cursor lo entienda.

---

## 9. Cambios aplicados en esta sesión

| Cambio | Archivo(s) | Estado |
|--------|-----------|--------|
| `integrations.tipio` en `/v1/campaigns/{id}/config` | `server/routes.ts` | ✅ |
| `integrations.tipio` en `/v1/sdk/config` | `server/routes.ts` | ✅ |
| UI: "Tipio Integration" en Settings tab | `SettingsTab.tsx` | ✅ |
| Reachu → Commerce → Tipio en docs | `CURSOR_SDK_INFRASTRUCTURE.md`, `.cursorrules`, `DASHBOARD_FLOWS.md`, `replit.md` | ✅ |
| Respuesta al reporte iOS | `VIO_SDK_RESPONSE.md` | ✅ |
| Auth guard config endpoint (`directMatch \|\| channelMatch`) | `server/routes.ts` | ✅ (sesión anterior) |
| Breadcrumbs completos en todas las páginas | `AppLayout.tsx`, `broadcast-detail.tsx` | ✅ (sesión anterior) |
| Broadcast externalId inline editable | `broadcast-detail.tsx`, `campaign-dashboard.tsx` | ✅ (sesión anterior) |
