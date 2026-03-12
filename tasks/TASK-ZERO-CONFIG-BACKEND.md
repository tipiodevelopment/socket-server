# TASK: Zero-Config SDK — Backend Support

## Objetivo
Implementar el soporte backend para que el SDK funcione con configuración mínima.
Target: `VioSDK.configure(apiKey: "xxx")` — todo lo demás viene del backend.

## Contexto
El SDK actualmente requiere un `vio-config.json` con ~15 secciones de configuración
(theme, commerce apiKey, feature flags, URLs, etc.). El objetivo es eliminar ese archivo
y que el backend devuelva todo lo que el SDK necesita para funcionar.

---

## Task 1: Endpoint GET /v1/sdk/config

### Endpoint
```
GET /v1/sdk/config?apiKey=<apiKey>
```

### Response esperada
```json
{
  "clientApp": {
    "id": 17,
    "name": "Viaplay NO",
    "apiKey": "viaplay_api_key_0c611e983b314ff8"
  },
  "endpoints": {
    "restBase": "https://api-dev.vio.live",
    "webSocketBase": "https://api-dev.vio.live",
    "commerceGraphQL": "https://graph-ql-dev.vio.live/graphql"
  },
  "features": {
    "engagement": true,
    "adPlacements": true,
    "commerce": true,
    "lineup": true
  },
  "commerce": {
    "apiKey": "KCXF10Y-W5T4PCR-GG5119A-Z64SQ9S",
    "endpoint": "https://graph-ql-dev.vio.live/graphql"
  },
  "theme": {
    "primaryColor": "#FFFFFF",
    "accentColor": "#0066CC"
  },
  "markets": ["NO", "SE", "DK", "FI"]
}
```

### Lógica
1. Buscar clientApp por `apiKey`
2. Si no existe → 401 Unauthorized
3. Devolver la config del clientApp + integrations de la campaña activa (si existe)
4. `commerce.apiKey` viene de `campaigns.integrations.commerce.apiKey` (campaña activa para ese clientApp)
5. `features` por ahora todos `true` — se puede hacer configurable después por clientApp

---

## Task 2: Renombrar "Shoppable Ads" → "Sponsor Moments" en Dashboard

### Archivos a cambiar
- Cualquier string "Shoppable Ads" en el dashboard React → "Sponsor Moments"
- Cualquier label "Shoppable Ad" → "Sponsor Moment"
- NO cambiar el nombre de la tabla/columnas en DB (sigue siendo `sponsor_slots`)
- NO cambiar el API endpoint (sigue siendo `/api/broadcasts/:id/sponsor-slots`)
- Solo cambiar el texto visible en la UI

---

## Task 3: Añadir `type` a Sponsor Moments

### Schema DB — añadir columna a `sponsor_slots`
```sql
ALTER TABLE sponsor_slots 
ADD COLUMN type VARCHAR(50) NOT NULL DEFAULT 'product',
ADD COLUMN config JSONB DEFAULT '{}';
```

### Tipos soportados
| type | config fields |
|------|--------------|
| `product` | `{ productId, commerceProductId, cta }` |
| `lead` | `{ title, fields: ["email","phone"], cta }` |
| `poll_cta` | `{ pollId, message, cta }` |
| `contest_cta` | `{ contestId, message, cta }` |
| `link` | `{ url, title, cta }` |

### API
- `GET /api/broadcasts/:id/sponsor-slots` → incluir `type` y `config` en response
- `POST /api/broadcasts/:id/sponsor-slots` → aceptar `type` y `config`
- Default `type: "product"` para slots existentes (retrocompat)

### Dashboard
- Al crear/editar un Sponsor Moment → dropdown para seleccionar `type`
- Según el tipo, mostrar campos diferentes (productId, pollId, url, etc.)

---

## Prioridad
1. **Task 1 (GET /v1/sdk/config)** — blocker para SDK zero-config. Hacer primero.
2. **Task 2 (rename UI)** — quick win, solo texto. Hacer junto con Task 1.
3. **Task 3 (type system)** — más trabajo, puede ir después.

## Referencias
- Backend: `https://api-dev.vio.live`
- Dashboard: `https://staging.vio.live`
- SDK repo: `angelosv/VioSwiftSDK`, branch `feature/zero-config`
