# REPLIT_TASKS.md — Dashboard UI/UX Fixes

> Generated from unified audit (Viobot + Replit). Todas las tareas están completadas.

---

## DASHBOARD HOME `/`

- [x] **Stats ↑12%/↑8%**: Endpoint `GET /api/analytics/deltas` calcula % de cambio real (últimos 7 días vs 7 anteriores).
- [x] **Active Viewers / Engagement Rate**: Datos reales desde DB con demo data.
- [x] **"New Campaign" button**: Navega directamente a `/campaigns/new`.
- [x] **"Upcoming Campaigns" section**: Filtra por `startDate` dentro de próximos 7 días. Empty state si ninguna.
- [x] **App cards without images**: Placeholder con iniciales + color determinístico basado en hash del nombre.
- [x] **Progress bar label**: Label visible explicando qué representa el porcentaje.
- [x] **Filter/Sort buttons**: Eliminados si eran dummy; funcionales donde procede.
- [x] **"Components" in campaign cards**: Count real desde DB.
- [x] **Gap between KPI cards and "Client Apps"**: Spacing aumentado.
- [x] **Empty state "Live Broadcasts"**: Compacto.

---

## APPS `/apps`

- [x] **"Total Viewers"**: Suma real de `viewerCount` de todos los broadcasts de campañas de esa app. TV2: ~34K, Viaplay: ~72K.
- [x] **"Edit" + "Settings" buttons**: Eliminado duplicado, solo "Manage".
- [x] **Bundle ID in card**: Movido a detail page.
- [x] **Progress bar**: Eliminado.
- [x] **APP_GRADIENTS**: Eliminados, fondos planos oscuros.
- [x] **API key**: Masked en la tarjeta.

---

## APP DETAIL `/apps/:id`

- [x] **engagementRate hardcoded 75%**: Calculado desde DB real.
- [x] **"0 broadcasts" hardcoded**: `broadcastCount` real por campaña desde el endpoint.
- [x] **"Live Broadcasts" stat**: Cuenta solo broadcasts con `status='live'`.
- [x] **Users icon next to date**: Reemplazado por `Calendar`.
- [x] **Status badge**: Active=teal, Paused=amber, Archived/Ended=gray.
- [x] **Stat cards background**: Consistente con `border border-gray-200 dark:border-white/10 rounded-lg`.
- [x] **"Edit Details" + "App Settings" duplicates**: Un solo entry point.

---

## CAMPAIGNS `/campaigns`

- [x] **Country ISO codes**: Nombres completos via `Intl.DisplayNames` (ej: "NO" → "Norway").
- [x] **Sponsor label**: Nombre del sponsor visible como texto junto al logo.
- [x] **Add columns**: "Sponsor" y "Total Engagement" (votos + participaciones) visibles en tarjetas.
- [x] **Badge differentiation**: Active=teal, Paused=amber, Upcoming=gray, Ended=dark gray.
- [x] **Sort list**: Controls de sorting por fecha/nombre/estado.
- [x] **Pause/Resume inline**: Toggle en la fila.

---

## CAMPAIGN DETAIL `/campaigns/:id`

- [x] **locationId visible**: Visible en lista de componentes sin entrar en edit mode.
- [x] **Broadcast filter counters**: Contador por estado: All (N) · Live (N) · Upcoming (N) · Ended (N).
- [x] **Sportmonks consistency**: Fixture selector en "New Broadcast" global (`/broadcasts`) y en Campaign Detail.
- [x] **"Go Live" button**: Renombrado a "Start Broadcast".
- [x] **Poll results**: Porcentaje + votos absolutos: "45% (234 votos)".
- [x] **Analytics lazy load**: Pre-fetch al cargar la página (`enabled: true`).
- [x] **"Danger Zone" collapse**: Colapsado por defecto.
- [x] **Commerce API key save**: Unificado con el mismo patrón de guardado del resto del formulario.

---

## BROADCASTS `/broadcasts`

- [x] **Viewers field**: Lee desde `broadcast.viewerCount` directamente (no de metadata JSON).
- [x] **"Metadata JSON" field**: Eliminado del modal de creación.
- [x] **Sportmonks in Create Broadcast**: Selector de fixture añadido (sección "Link to a Match" opcional).
- [x] **Team logos in list**: Logos de equipos desde Sportmonks en las tarjetas.
- [x] **Start time in upcoming**: "Starts Mar 10 · 19:00" en tarjetas upcoming.
- [x] **Ended opacity**: Eliminada la `opacity-60` de tarjetas ended.
- [x] **BarChart3 icon**: `Users` para viewers, `BarChart3` para polls.
- [x] **Filter button**: Eliminado (ya hay tabs Live/Upcoming/Ended).
- [x] **Duplicate search bars**: Solo la barra contextual "Search broadcasts..." (global oculta via `hideSearch` prop en AppLayout).

---

## BROADCAST DETAIL `/broadcasts/:id`

- [x] **Timeline progress bar**: Progreso real: `activeEvents / totalEvents * 100`.
- [x] **Timeline buttons** (Play/Skip/Maximize): Implementados. Play activa el próximo evento inactivo, Skip salta al siguiente, Maximize expande la vista.
- [x] **topValues array**: Array hardcodeado eliminado.
- [x] **Live Chat on Ended**: Input deshabilitado + banner "Este broadcast ha terminado — el chat es de solo lectura".
- [x] **ext: ID in header**: Movido a sección "Developer" colapsada.
- [x] **Shoppable Ads section**: Sección con selector de producto/sponsor, botón "Trigger Shoppable Ad" (`POST /api/broadcasts/:id/trigger-shoppable-ad`) y log de sesión con timestamps.
- [x] **Shoppable Ads without Commerce**: Warning "Commerce not configured for this campaign" si `integrations.commerce.enabled === false`.
- [x] **ENDED state**: Resumen post-broadcast (total votos, participaciones, duración).
- [x] **viewerCount / peakViewers = 0**: Muestra N/A en lugar de 0.
- [x] **"Load Demo" CTA**: Deprioritizado visualmente (outline/secondary) cuando status es `ended`.

---

## SPONSORS `/sponsors`

- [x] **Sponsor detail page**: `/sponsors/:id` con perfil, campañas asociadas, historial.
- [x] **Default colors on create**: `primaryColor: '#3d8b7a'`, `secondaryColor: '#141824'`.
- [x] **Color swatch labels**: Labels "Primary" y "Secondary" visibles.
- [x] **SDK badge preview**: Preview del badge del sponsor como aparece en el overlay del SDK (rect redondeado con primaryColor, logo/iniciales, nombre).
- [x] **Active campaigns count**: "X active campaigns" en cada tarjeta.
- [x] **Description read mode**: Expansión sin entrar en edit mode.

---

## COMPONENTS `/components`

- [x] **Configuration preview**: Banner→thumbnail de imagen, Countdown→fecha target, Carousel→cantidad de productos.
- [x] **Test component tag**: Badge "Test" si el nombre contiene "test".
- [x] **Card height**: Dinámico con `min-h` (no `h-48` fijo).
- [x] **Filter set**: Filtros para `offer_banner`, `product_store`, `product_banner` añadidos.
- [x] **isTemplate type**: Comparación corregida de string `'true'` a boolean `true`.
- [x] **"New Component" button**: Usa `<Button>` de shadcn/ui.

---

## ANALYTICS `/analytics`

- [x] **Sponsor Performance "engagement"**: Tooltip definiendo engagement (votos + participaciones de contests).
- [x] **Geographic Distribution**: Renombrado a "Campaigns by target country".
- [x] **"Top Campaigns" table**: Ordenado por engagement total descendente.
- [x] **useChartTheme()**: Refactorizado con `useState` + `useEffect` + `MutationObserver` para detectar cambios de tema sin recargar.
- [x] **Drill-down "Back" button**: Muestra nombre del destino: "← TV2 Demo App".
- [x] **Empty chart**: "No hay actividad de broadcasts en los últimos X días" si no hay datos.
- [x] **Time period selector**: Botones Today / 7d / 30d.
- [x] **Chart contrast**: Barras con mayor contraste en dark mode (`#3d8b7a`).
- [x] **KPI "Components" and "Sponsors"**: Subtexto explicativo (ej: "X templates", "X activos").

---

## DEMO DATA (seed en DB)

- [x] TV2: ~34K total viewers, engagement ~4.2%, campaign 36, 3 broadcasts (live: `tv2-eliteserien-live-2026-03-08`)
- [x] Viaplay: ~72K total viewers, engagement ~6.8%, campaigns 35/33/31, 6+ broadcasts (live: `viaplay-atletico-psg-2026-03-08`)
- [x] Broadcast `created_at` distribuidos en últimos 30 días para el chart de analytics
- [x] Polls con votos reales: TV2 ~8.4K votos, Viaplay ~19.4K votos
- [x] Sponsor performance: Elkjøp con counts reales

---

## DO NOT TOUCH

- "Load Demo" button: mantener, solo deprioritizado visualmente en ended
- Naming de test campaigns/components: tarea del operador, fuera de scope
- ext: field en DB: mantener en DB, solo removido de UI visible
- Demo data de TV2 y Viaplay: NO modificar viewers, votes, ni IDs de broadcasts

---

## TASK UI-01 — Redesign "Create Broadcast" modal ✅ COMPLETADO

Redesign the Create Broadcast modal to match the following spec. Reference mockup: see HTML file shared by Angelo (Create Broadcast mockup).

### Layout
- Modal width: `max-w-5xl` (wider than current)
- Two sections: 1) Link Match Context (top), 2) Basic Info (bottom)

### Section 1 — Link Match Context (top, prominent)
This is the primary action. The operator picks the match first, and the form auto-fills.

**Controls (in a 4-column grid):**
- League/Competition selector (dropdown) — show league logo from Sportmonks CDN next to league name
- Date picker — defaults to today
- Search filter — text input to filter matches by team name

**Match list:**
- Scrollable list of fixtures from Sportmonks API filtered by league + date
- Each match item shows:
  - Home team logo (circular, from Sportmonks CDN) + Away team logo (overlapping)
  - "Home Team vs Away Team" name
  - Kick-off time
  - Stadium/venue name
- Selected state: blue border + blue background tint + checkmark icon filled blue
- Unselected hover: blue border subtle + hover bg

**On match select → auto-fill:**
- Broadcast Name → "{HomeTeam} vs {AwayTeam}"
- Start Time → kick-off datetime from Sportmonks

### Section 2 — Basic Info (below match section)
- **Broadcast Name** (full width) — auto-filled from match, editable. Required.
- **Campaign** (full width) — dropdown, required. Keep existing logic.
- **Description** (full width) — textarea
- **External Content ID** (full width) — text input, empty by default. Operator enters Viaplay/TV2 content ID. Helper text: "Used to map this broadcast to your video player content ID (e.g. Viaplay or TV2 stream ID)"
- **Start Time** / **End Time** — side by side, auto-filled start from match kick-off, editable
- **Metadata (JSON)** — textarea, keep as-is

### Visual style
- Follow the mockup: dark bg `#0F1115`, cards `#161B26`, inputs `#0a0e1a`
- Section headers with subtle top bar and label
- Same style as existing dashboard components

### Data source
- Leagues and fixtures from existing `/api/sportmonks/leagues` and `/api/sportmonks/fixtures` endpoints
- Team logos and league logos from `cdn.sportmonks.com` (already used in broadcasts list)

### Important
- All existing functionality must keep working (campaign assignment, broadcast creation POST)
- The match linking (sportmonks fixture ID stored in broadcast) must work same as current
- This modal is used from both `/broadcasts` and campaign detail — both must use the new design

---

## ARCH-01 — Multi-sponsor architecture (MAJOR REFACTOR)

> This is a foundational change. Do it carefully. Keep backward compatibility where possible.

---

### Overview

Campaigns need to support multiple sponsors. A broadcast can have multiple sponsor "slots" — each sponsor can own engagement (polls, badge, carousel) or shoppable ads, or both. Default is manual trigger; auto-execute is a future feature (add to schema but default false).

---

### DB Migration

**1. New table: `campaign_sponsors`**
```sql
CREATE TABLE campaign_sponsors (
  id SERIAL PRIMARY KEY,
  campaign_id INTEGER NOT NULL REFERENCES campaigns(id) ON DELETE CASCADE,
  sponsor_id INTEGER NOT NULL REFERENCES sponsors(id) ON DELETE CASCADE,
  role TEXT NOT NULL DEFAULT 'shoppable', -- 'engagement' | 'shoppable' | 'full'
  created_at TIMESTAMP DEFAULT NOW(),
  UNIQUE(campaign_id, sponsor_id)
);
```

**2. New table: `broadcast_sponsor_slots`**
```sql
CREATE TABLE broadcast_sponsor_slots (
  id SERIAL PRIMARY KEY,
  broadcast_id TEXT NOT NULL REFERENCES broadcasts(id) ON DELETE CASCADE,
  sponsor_id INTEGER NOT NULL REFERENCES sponsors(id) ON DELETE CASCADE,
  campaign_id INTEGER REFERENCES campaigns(id),
  role TEXT NOT NULL DEFAULT 'shoppable', -- 'engagement' | 'shoppable' | 'full'
  trigger_type TEXT NOT NULL DEFAULT 'manual', -- 'manual' | 'match_minute' | 'absolute_time'
  trigger_value TEXT, -- null for manual, "65" for match_minute, ISO timestamp for absolute_time
  auto_execute BOOLEAN DEFAULT FALSE,
  product_ids INTEGER[] DEFAULT '{}',
  status TEXT DEFAULT 'scheduled', -- 'scheduled' | 'active' | 'completed'
  executed_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT NOW()
);
```

**3. New table: `broadcast_campaigns` (many-to-many)**
```sql
CREATE TABLE broadcast_campaigns (
  id SERIAL PRIMARY KEY,
  broadcast_id TEXT NOT NULL REFERENCES broadcasts(id) ON DELETE CASCADE,
  campaign_id INTEGER NOT NULL REFERENCES campaigns(id) ON DELETE CASCADE,
  is_primary BOOLEAN DEFAULT FALSE, -- the main campaign for engagement
  created_at TIMESTAMP DEFAULT NOW(),
  UNIQUE(broadcast_id, campaign_id)
);
```

**4. Migrate existing data**
```sql
-- Migrate existing broadcast.campaign_id to broadcast_campaigns
INSERT INTO broadcast_campaigns (broadcast_id, campaign_id, is_primary)
SELECT id, campaign_id, TRUE FROM broadcasts WHERE campaign_id IS NOT NULL;

-- Keep broadcast.campaign_id for backward compat (do NOT drop it yet)
-- Just add the new tables alongside
```

**5. Add `sponsor_id` to `campaign_components`**
```sql
ALTER TABLE campaign_components ADD COLUMN IF NOT EXISTS sponsor_id INTEGER REFERENCES sponsors(id);
```

---

### Backend API changes

**New endpoints:**

```
GET  /api/campaigns/:id/sponsors              → list sponsors in campaign
POST /api/campaigns/:id/sponsors              → add sponsor to campaign { sponsorId, role }
DELETE /api/campaigns/:id/sponsors/:sponsorId → remove sponsor from campaign

GET  /api/broadcasts/:id/sponsor-slots        → list sponsor slots for broadcast
POST /api/broadcasts/:id/sponsor-slots        → create slot { sponsorId, campaignId, role, triggerType, triggerValue, productIds }
PUT  /api/broadcasts/:id/sponsor-slots/:slotId → update slot
DELETE /api/broadcasts/:id/sponsor-slots/:slotId → delete slot
POST /api/broadcasts/:id/sponsor-slots/:slotId/execute → manually trigger this slot (fires shoppable_ad WS event)
```

**Update existing `/api/campaigns/:id` response:**
Add `sponsors: [{ id, name, logoUrl, primaryColor, role }]` array.

**Update WS `shoppable_ad` event:**
Add `slotId` to payload so SDK can track which slot was fired.

**Update `POST /api/broadcasts/:id/shoppable-ad`:**
Accept `slotId` (optional) OR `productId + sponsorId` for ad-hoc triggers. If `slotId` provided, mark slot as executed.

---

### Commerce integration (connect real products)

The "Shoppable Products" section in broadcast detail must show REAL products from Commerce GraphQL.

**New backend endpoint:**
```
GET /api/commerce/products?campaignId=36
```
This endpoint queries `graph-ql-dev.vio.live/graphql` using:
- Auth: `Authorization: KCXF10Y-W5T4PCR-GG5119A-Z64SQ9S` (store as `COMMERCE_API_KEY` secret in Replit)
- Query: `GetProductsByIds(product_ids: [408841, 408874, 408895, 408896, 408898])`
- Fields: `id, title, images { url, order }, price { amount, amount_incl_taxes, currency_code }`

For now, product IDs per campaign are stored in `broadcast_sponsor_slots.product_ids`. The endpoint reads those IDs and fetches from Commerce.

**Remove hardcoded products** from broadcast-detail page. Replace with real Commerce data.

---

### Dashboard UI changes

**Campaign Detail → new "Sponsors" tab:**
- List all sponsors in this campaign with their role badge (Engagement / Shoppable / Full)
- "+ Add Sponsor" button → select from existing sponsors + assign role
- Each sponsor card shows: logo, name, color swatch, role, "Remove" action

**Broadcast Detail → "Shoppable Ads" section redesign:**

Replace current "Commerce Product ID" text input with:

1. **Sponsor selector** — dropdown of sponsors registered in this broadcast's campaign(s)
2. **Product selector** — after sponsor selected, show real products fetched from Commerce for that sponsor (images, titles, prices)
3. **Trigger config** — Manual (default) | Match Minute (number input) | Absolute Time (datetime picker)
4. **Pre-programmed slots list** — show all configured slots with status (Scheduled / Active / Completed) and a "▶ Fire Now" button for manual override
5. **Ad-hoc trigger** — quick panel to select sponsor + product and fire immediately

**Broadcast Detail → "Shoppable Products" section:**
- Replace hardcoded fake products with real Commerce products from `GET /api/commerce/products?campaignId=:id`
- Show: product image, title, price (NOK), "Fire Ad" button per product
- Remove fake "Products Active: 3 / Total Listed: 4" counters → real data

---

### SDK compatibility

No SDK changes needed. The WS `shoppable_ad` event format stays the same:
```json
{
  "type": "shoppable_ad",
  "broadcastId": "...",
  "campaignId": 36,
  "product": { "id": "408898", "name": "...", "price": 999, "currency": "NOK", "imageUrl": "..." },
  "sponsor": { "name": "Elkjøp", "logoUrl": "...", "primaryColor": "#f7b23b" },
  "timestamp": 1234567890
}
```
Just add `slotId` (optional, ignored by SDK if not present).

---

### Important constraints
- Do NOT drop `broadcasts.campaign_id` — keep for backward compat, populate from `broadcast_campaigns` where `is_primary = true`
- All existing broadcast/campaign functionality must keep working
- Commerce API key must be in Replit Secrets as `COMMERCE_API_KEY`, never hardcoded
- The auto_execute feature: add to schema and UI (toggle), but do NOT implement the cron/scheduler yet — just save the config
- Demo data: after migration, seed `campaign_sponsors` for campaign 35 (Elkjøp + Torshov Sport) and campaign 36 (Torshov Sport)

