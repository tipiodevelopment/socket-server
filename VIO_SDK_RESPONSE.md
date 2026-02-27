# Respuesta al Reporte SDK – Vio Backend

**Para:** Equipo iOS (VioSwiftSDK)  
**Fecha:** Febrero 2026  
**Ref:** Reporte de validación – HTTP 401 en `/v1/campaigns/{id}/config`

---

## Diagnóstico confirmado

El error **401** tiene causa clara: el `ConfigAPIClient` está usando `KCXF10Y-W5T4PCR-GG5119A-Z64SQ9S` como `apiKey` para llamar al config endpoint de Vio. Esa key **no es una Vio App key** — es la key de **Tipio** (el sistema de productos, antes llamado Reachu). El backend Vio no la reconoce, devuelve 401.

Prueba manual confirmada:
```bash
# 401 — Tipio key, no válida para Vio
curl "https://api-dev.vio.live/v1/campaigns/28/config?apiKey=KCXF10Y-W5T4PCR-GG5119A-Z64SQ9S"

# 200 — Vio App key correcta
curl "https://api-dev.vio.live/v1/campaigns/28/config?apiKey=xxl_api_key_507d4014243d8360"
```

---

## Respuestas directas

### ¿Qué key usar para `GET /v1/campaigns/{id}/config`?

**`xxl_api_key_507d4014243d8360`** — la que el SDK llama `campaignAdminApiKey`.

Es la única key válida para todos los endpoints Vio de la campaña 28 (XXL).

### ¿El endpoint está activo en `api-dev.vio.live`?

Sí. Responde **200 con la key correcta** e incluye:
- Branding (brand.name, brand.logoUrl — del Sponsor)
- Feature flags
- Engagement settings
- Bloque Tipio: `integrations.tipio` (ver abajo)

### ¿La campaña 28 existe y está activa?

Sí, campaña 28 = XXL, activa y configurada correctamente.

---

## Modelo correcto de API keys

El SDK actualmente tiene 3 keys en `vio-config.json`. Eso es un error de diseño. El modelo correcto es **una sola Vio App key**:

### vio-config.json correcto
```json
{
  "apiKey": "xxl_api_key_507d4014243d8360",
  "restAPIBaseURL": "https://api-dev.vio.live",
  "webSocketBaseURL": "https://api-dev.vio.live",
  "liveShow": {
    "campaignId": 28
  }
}
```

### ¿Qué key usa cada endpoint?

| Endpoint | Key a usar | Campo en config |
|----------|-----------|----------------|
| `GET /v1/sdk/campaigns` | Vio App key | `apiKey` |
| `GET /v1/campaigns/{id}/config` | Vio App key | `apiKey` |
| `GET /v1/sdk/broadcast` | Vio App key | `apiKey` |
| `POST /v1/engagement/polls/{id}/vote` | Vio App key | `apiKey` |
| `POST /v1/engagement/contests/{id}/participate` | Vio App key | `apiKey` |
| `GET /v1/offers` | Vio App key | `apiKey` |
| **Tipio (productos)** | Tipio key | viene del servidor → `integrations.tipio.apiKey` |

### ¿De dónde saca el SDK la Tipio key?

No del `vio-config.json`. Del servidor:

```
GET /v1/campaigns/28/config?apiKey=xxl_api_key_507d4014243d8360
```

Respuesta incluye:
```json
{
  "integrations": {
    "tipio": {
      "enabled": true,
      "apiKey": "KCXF10Y-W5T4PCR-GG5119A-Z64SQ9S",
      "channelId": "tipio-channel-id"
    }
  }
}
```

- Si `enabled: true` → inicializar módulo Tipio con esa key
- Si `enabled: false` → no inicializar Tipio

Así la Tipio key vive en el servidor (configurada por campaña en el dashboard), no en el app.

---

## Cambio mínimo en el SDK (fix inmediato)

Si no se puede refactorizar todo ahora, el fix mínimo es:

**En `ConfigAPIClient.swift`**, cambiar la key usada para el config endpoint:

```swift
// ANTES (usa Tipio key — da 401)
private var apiKey: String {
    VioConfiguration.shared.apiKey  // KCXF10Y-...
}

// DESPUÉS (usa Vio App key — da 200)
private var apiKey: String {
    VioConfiguration.shared.campaigns?.campaignAdminApiKey ?? VioConfiguration.shared.apiKey
}
```

---

## Preguntas para el equipo iOS

Necesitamos estas respuestas para cerrar la integración:

### 1. ¿Pueden refactorizar a una sola Vio App key?
El ideal es eliminar `campaignAdminApiKey` y `campaignApiKey` del config y usar solo `apiKey = xxl_api_key_507d4014243d8360`. ¿Es factible en el sprint actual o prefieren el fix mínimo?

### 2. ¿Qué hace el SDK con `GET /v1/sdk/config`?
Vemos en el reporte que `CampaignManager` llama a `/v1/sdk/config`. Ese endpoint no existe en nuestra API — puede que sea un endpoint legacy o un error. ¿Cuál es la respuesta esperada de ese endpoint? ¿Se puede reemplazar por `/v1/sdk/campaigns`?

### 3. ¿Qué es `VioEnvironment.baseURL` (GraphQL)?
El reporte muestra `https://graph-ql-dev.vio.live/graphql` hardcodeado en `SdkClient` y `VCastingVideoPlayer`. ¿Es un backend separado de Vio o un sistema externo? ¿Lo gestiona el equipo de Replit o es independiente?

### 4. `event-streamer-angelo100.replit.app` — acción requerida
Es el mismo backend Vio, solo un dominio viejo. Todos sus endpoints ya existen en `api-dev.vio.live`. **No hay ningún servicio paralelo que mantener.**

Cambio requerido en el SDK: reemplazar la URL hardcodeada en `OfferBannerModels` y `EventStreamerManager`:
```swift
// ANTES (hardcodeado)
"https://event-streamer-angelo100.replit.app"

// DESPUÉS (dinámico desde config)
VioConfiguration.shared.campaignConfiguration.restAPIBaseURL
```

Los endpoints siguen siendo exactamente iguales:
- `GET /api/campaigns/{id}/active-components` → ya en `api-dev.vio.live`
- `WebSocket /ws/{campaignId}` → ya en `api-dev.vio.live`

### 5. ¿El `liveShow.campaignId` en el config es siempre 28?
¿O varía por entorno/build del app? Si varía, ¿cómo se configura para producción?

### 6. ¿Qué versión del SDK está en la demo Viaplay?
Necesitamos saber si están en una versión que ya soporta leer `integrations.tipio.apiKey` del response del config, o si necesitan actualizar el módulo Tipio también.

---

## Resumen de cambios en el backend (ya aplicados)

Para que el equipo iOS sepa qué cambió en `api-dev.vio.live`:

| Cambio | Descripción |
|--------|-------------|
| `integrations.tipio` | Bloque siempre presente en `/v1/campaigns/{id}/config` (antes no existía) |
| Auth directa | El config endpoint acepta `campaign.clientAppId` directo, sin requerir canal asignado |
| "Reachu" → "Tipio" | Renombrado en toda la API pública y UI del dashboard |

Los campos internos de DB siguen siendo `reachuApiKey` / `reachuChannelId` — no hay migración destructiva.
