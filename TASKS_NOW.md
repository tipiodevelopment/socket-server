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

## 🟠 TASK-B08 — Sportmonks Integration (replaces previous B08 draft)

**Goal:** Link real football matches to broadcasts via Sportmonks API. Dashboard gets match picker UI; broadcasts show team logos/names. Score endpoint returns team logos for SDK.

**API Token secret:** `SPORTMONKS_API_TOKEN` = already set
**Base URL:** `https://api.sportmonks.com/v3/football`

---

### DB Migrations

```sql
-- Cache table
CREATE TABLE IF NOT EXISTS sportmonks_cache (
  id SERIAL PRIMARY KEY,
  type VARCHAR(50) NOT NULL,       -- 'leagues' or 'fixtures'
  league_id INT,
  date_from DATE,
  date_to DATE,
  data JSONB NOT NULL,
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Add to broadcasts table
ALTER TABLE broadcasts ADD COLUMN IF NOT EXISTS sportmonks_fixture_id INT;
ALTER TABLE broadcasts ADD COLUMN IF NOT EXISTS home_team_name VARCHAR(255);
ALTER TABLE broadcasts ADD COLUMN IF NOT EXISTS home_team_logo VARCHAR(512);
ALTER TABLE broadcasts ADD COLUMN IF NOT EXISTS away_team_name VARCHAR(255);
ALTER TABLE broadcasts ADD COLUMN IF NOT EXISTS away_team_logo VARCHAR(512);
ALTER TABLE broadcasts ADD COLUMN IF NOT EXISTS league_name VARCHAR(255);
ALTER TABLE broadcasts ADD COLUMN IF NOT EXISTS match_starting_at TIMESTAMP;
```

---

### Backend — New Endpoints

**GET /api/sportmonks/leagues**
- Check cache (type='leagues', updated_at < 2 days) → return cached data
- If stale/missing → fetch Sportmonks:
  `GET /football/leagues?api_token=TOKEN&per_page=150`
- Save to cache, return `[{id, name}]`
- If Sportmonks down → return stale cache (never fail)

**GET /api/sportmonks/fixtures?leagueId=501&from=2026-03-06&to=2026-03-13**
- Check cache for (leagueId, from, to) → return if < 2 days old
- If stale → fetch:
  `GET /football/fixtures/between/{from}/{to}?api_token=TOKEN&include=participants;league&per_page=50`
- Filter results by leagueId client-side (Sportmonks doesn't filter by league in this endpoint)
- Map participants: meta.location='home' → homeTeam, 'away' → awayTeam
- Save to cache
- Return:
```json
[{
  "fixtureId": 12345,
  "startingAt": "2026-03-08T20:00:00Z",
  "leagueName": "Premier League",
  "homeTeam": { "id": 1, "name": "Arsenal", "imagePath": "https://cdn.sportmonks.com/..." },
  "awayTeam": { "id": 2, "name": "Chelsea", "imagePath": "https://cdn.sportmonks.com/..." }
}]
```
- If Sportmonks down → return stale cache, never fail

**Update existing: GET /v1/sdk/broadcasts/:id/score**
- Add `homeTeamLogo` and `awayTeamLogo` to response (from broadcast row)
- Existing score fields stay the same

---

### Dashboard — BroadcastForm (create + edit)

**"Link Match" collapsible section** — appears in both create and edit forms.

**If no match linked:** Show button `🔗 Link Match` → expands section  
**If match linked:** Show match card (logos + teams + date) with `Change` button

**Expanded section flow:**
1. Dropdown **"League / Competition"** → `GET /api/sportmonks/leagues`
2. Date range: **From** / **To** (default: today → today+7 days)
3. Button **"Search Fixtures"** → `GET /api/sportmonks/fixtures?leagueId=&from=&to=`
4. Results list: mini logos + "Arsenal vs Chelsea · Sat Mar 8 · 20:00 CET"
5. Click a fixture → auto-fills:
   - `Broadcast Name` field: `"Arsenal vs Chelsea"` (only if name is empty)
   - homeTeamName, homeTeamLogo, awayTeamName, awayTeamLogo, leagueName, matchStartingAt, sportmonksFixtureId
6. Manual field: **External ID** (Viaplay/TV2 contentId, e.g. `barcelona-psg-2026-03-03`)

**Notes:**
- All times displayed in Europe/Oslo timezone
- `matchStartingAt` ≠ `startTime` — they are separate fields. startTime = when Vio stream starts
- All text in English

---

### Broadcast Card (list view)

If broadcast has match linked, show:
- Home + Away team logos (small, ~24px)
- `"Arsenal vs Chelsea"`
- `"Premier League · Mar 8 · 20:00"`
- Badge `FINISHED` (grey) if matchStartingAt + 2h is in the past

---

### Broadcast Detail View

Show match info section:
- Large logos side by side
- League name + date/time (Oslo tz)
- External ID shown as tag

---

### Cache Strategy
- Fetch on page load if cache > 2 days old
- Never block UI on Sportmonks — show "Loading..." then render
- On Sportmonks error → log warning, serve stale cache silently
