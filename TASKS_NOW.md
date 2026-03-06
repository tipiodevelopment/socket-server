# TASKS_NOW.md — Vio Backend (socket-server)
_Actualizado: 2026-03-05 Oslo_

## 🔴 ACTIVO AHORA

### TASK-B07 — APNs integration — push notification real al iPhone
**Prioridad: CRÍTICO — último paso para flujo TV → iPhone completo**

Cuando `POST /api/campaigns/:id/cart-intent` se llama y NO hay webhookUrl → mandar push real via APNs.

**Instalar:**
```bash
npm install @parse/node-apn
```

**Secrets necesarios (Angelo los provee):**
- `APNS_KEY` — contenido completo del archivo .p8
- `APNS_KEY_ID` — 10 caracteres (de developer.apple.com → Keys)
- `APNS_TEAM_ID` — 10 caracteres (Team ID de la cuenta Apple)
- `APNS_BUNDLE_ID` — `viodev.tv2demo`

**Implementación en cart-intent (modo demo — sin webhookUrl):**
```typescript
import apn from '@parse/node-apn';

const provider = new apn.Provider({
  token: {
    key: process.env.APNS_KEY,      // contenido del .p8
    keyId: process.env.APNS_KEY_ID,
    teamId: process.env.APNS_TEAM_ID,
  },
  production: false  // true en producción
});

const notification = new apn.Notification();
notification.expiry = Math.floor(Date.now() / 1000) + 3600;
notification.badge = 1;
notification.sound = 'default';
notification.alert = {
  title: 'Produkt lagt til',
  body: `${productName} — trykk for å kjøpe`
};
notification.payload = {
  productId: productId,
  campaignId: campaignId,
  action: 'open_product'
};
notification.topic = process.env.APNS_BUNDLE_ID || 'viodev.tv2demo';

await provider.send(notification, deviceToken);
```

**Si secrets no están configurados → loguear y responder success (no fallar)**

**Flujo completo tras esto:**
```
Apple TV click → POST cart-intent
  → backend busca deviceToken del userId en device_tokens
  → APNs push → iPhone
  → Usuario toca notificación
  → SDK llama VioSDK.openProduct(id: productId)
  → VProductDetailOverlay abre con Apple Pay
```

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

---

## 🟠 SIGUIENTE — TASK-B08: Sportmonks Integration

**Objetivo:** Al crear/editar un broadcast en el dashboard, poder buscar partidos de fútbol via Sportmonks y autocompletar datos del equipo.

**API:** 
- Token secret: `SPORTMONKS_API_TOKEN` = `hTAp0XE1x7CsBh1yi8g47OQh1dLhGPfygQTf08MnCbCY38dLFc73HuxxYBcJ`
- Base URL: `https://api.sportmonks.com/v3/football`

### DB — Migraciones necesarias

**Tabla nueva: `sportmonks_cache`**
```sql
CREATE TABLE sportmonks_cache (
  id SERIAL PRIMARY KEY,
  type VARCHAR(50) NOT NULL,  -- 'leagues' o 'fixtures'
  league_id INT,              -- null para leagues, filled para fixtures
  date_from DATE,
  date_to DATE,
  data JSONB NOT NULL,
  updated_at TIMESTAMP DEFAULT NOW()
);
```

**Columnas a añadir en `broadcasts`:**
```sql
ALTER TABLE broadcasts ADD COLUMN IF NOT EXISTS sportmonks_fixture_id INT;
ALTER TABLE broadcasts ADD COLUMN IF NOT EXISTS home_team_name VARCHAR(255);
ALTER TABLE broadcasts ADD COLUMN IF NOT EXISTS home_team_logo VARCHAR(512);
ALTER TABLE broadcasts ADD COLUMN IF NOT EXISTS away_team_name VARCHAR(255);
ALTER TABLE broadcasts ADD COLUMN IF NOT EXISTS away_team_logo VARCHAR(512);
ALTER TABLE broadcasts ADD COLUMN IF NOT EXISTS match_starting_at TIMESTAMP;
```

### Backend — 2 endpoints nuevos

**GET /api/sportmonks/leagues**
- Buscar en caché (tabla sportmonks_cache tipo 'leagues')
- Si caché tiene menos de 2 días → devolver caché
- Si no → fetch `https://api.sportmonks.com/v3/football/leagues?api_token=TOKEN&per_page=150`
- Guardar en caché y devolver `[{id, name}]`

**GET /api/sportmonks/fixtures?leagueId=501&from=2026-03-06&to=2026-03-13**
- Buscar en caché para esa leagueId + rango fechas
- Si caché < 2 días → devolver caché
- Si no → fetch `https://api.sportmonks.com/v3/football/fixtures/between/{from}/{to}?api_token=TOKEN&include=participants;league&per_page=50`
- Filtrar por leagueId en el resultado (Sportmonks no soporta filter directo en este endpoint)
- Guardar en caché
- Devolver:
```json
[{
  "fixtureId": 12345,
  "startingAt": "2026-03-08T20:00:00",
  "leagueName": "Premier League",
  "homeTeam": { "id": 1, "name": "Arsenal", "imagePath": "https://cdn.sportmonks.com/..." },
  "awayTeam": { "id": 2, "name": "Chelsea", "imagePath": "https://cdn.sportmonks.com/..." }
}]
```

### Dashboard — BroadcastForm

En el formulario de crear/editar broadcast añadir sección "Partido":

1. Dropdown **"Competición"** → `GET /api/sportmonks/leagues`
2. Date pickers: **Desde** / **Hasta** (default: hoy → hoy+7 días)
3. Botón **"Buscar partidos"** → `GET /api/sportmonks/fixtures?leagueId=&from=&to=`
4. Lista de partidos con escudos de equipos + fecha/hora
5. Al seleccionar → autocompleta en el form:
   - homeTeamName, homeTeamLogo
   - awayTeamName, awayTeamLogo
   - matchStartingAt
   - sportmonksFixtureId
6. Campo manual **"External ID"** (contentId de Viaplay/TV2, ej: `barcelona-psg-2026-03-03`)

### Caché importante
- NO hacer request a Sportmonks en cada render
- Refresh solo: al abrir la página de broadcasts + si caché > 2 días
- Sportmonks tiene rate limits — respetar la caché siempre
