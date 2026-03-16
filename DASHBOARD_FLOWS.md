# Vio — Dashboard: Flujos, Data Flow y User Flow
# Ultima actualizacion: Febrero 2026
# Version: 1.0

---

## Indice

1. [Arquitectura de Navegacion](#navegacion)
2. [Autenticacion de la Sesion Dashboard](#autenticacion)
3. [Jerarquia de Datos en el Dashboard](#jerarquia)
4. [Flujo por Pagina](#paginas)
   - [Dashboard Principal (`/`)](#dashboard-home)
   - [Apps (`/apps`, `/apps/:appId`)](#apps)
   - [Campaigns (`/campaigns`, `/campaigns/new`, `/campaigns/:campaignId`)](#campaigns)
   - [Campaign Dashboard — Tabs](#campaign-dashboard-tabs)
   - [Broadcast Detail (`/broadcasts/:broadcastId`)](#broadcast-detail)
   - [Sponsors (`/sponsors`)](#sponsors)
   - [Components (`/components`, `/components/:id`)](#components)
   - [Analytics (`/analytics`)](#analytics)
   - [Docs (`/docs`)](#docs)
5. [Data Flow: TanStack Query + API](#data-flow)
6. [Ciclo de Vida de una Campana](#lifecycle-campaign)
7. [Ciclo de Vida de un Broadcast](#lifecycle-broadcast)
8. [Flujo de Eventos en Tiempo Real (Live Tab)](#live-events)
9. [Flujo WebSocket — Dashboard vs SDK](#websocket-flow)
10. [Flujo de Subida de Archivos (Object Storage)](#file-upload)
11. [Flujo SDK End-to-End](#sdk-flow)
12. [Patrones de Cache e Invalidacion](#cache)
13. [Convenciones de Codigo](#convenciones)

---

## 1. Arquitectura de Navegacion <a name="navegacion"></a>

El shell de la aplicacion es `client/src/components/AppLayout.tsx`. Envuelve todas las paginas protegidas con:
- Sidebar de navegacion izquierda (fija)
- Header superior
- Contenido principal con `max-width: 1440px`

**Orden del sidebar:**
```
Dashboard → Apps → Campaigns → Sponsors → Broadcasts → Components → Analytics → Docs
```

**Router:** Wouter (`Switch` + `Route`) en `client/src/App.tsx`.

**Rutas registradas:**
```
/                          → Dashboard home
/apps                      → Lista de client apps
/apps/:appId               → Detalle de app con stats
/campaigns                 → Lista de campanas
/campaigns/new             → Crear nueva campana
/campaigns/:campaignId     → Campaign dashboard (6 tabs)
/broadcasts                → Lista global de broadcasts
/broadcasts/:broadcastId   → Detalle de broadcast
/sponsors                  → CRUD de sponsors
/components                → Component library (grid)
/components/:id            → Detalle de componente
/analytics                 → Analytics con drill-down
/docs                      → Visor OpenAPI interactivo
/campaign/:id/admin        → Panel admin legacy
/campaign/:name/:id        → Viewer legacy
```

**Rutas protegidas:** Todas menos `/user-session` usan `<RequireAuth>` (valida sesion activa).

---

## 2. Autenticacion de la Sesion Dashboard <a name="autenticacion"></a>

El dashboard usa **sesion basada en cookies** (express-session + SESSION_SECRET).

**Flujo de login:**
1. Usuario llega a `/user-session`
2. Llama `POST /api/auth/token` con credenciales
3. El servidor crea la sesion y devuelve JWT + userId
4. El contexto `UserContext` (`client/src/contexts/UserContext.tsx`) almacena el userId en memoria
5. Todas las llamadas `/api/*` incluyen la cookie de sesion automaticamente

**No confundir con las APIs externas:**
- Dashboard → cookies de sesion
- Admin API `/v1/*` → JWT Bearer token en `Authorization` header
- SDK API `/v1/sdk/*`, `/v1/engagement/*` → `X-Api-Key` header o `?apiKey=` query param

---

## 3. Jerarquia de Datos en el Dashboard <a name="jerarquia"></a>

```
Users
  └── Client Apps (client_apps)
        ├── API Key (para SDK)
        ├── Bundle ID (X-App-Bundle-ID)
        └── Campaigns (campaigns.client_app_id → FK a client_apps.id)
              ├── Channel (opcional, campaigns.channel_id → FK a channels.id)
              ├── Sponsor (campaigns.sponsor_id → FK a sponsors.id)
              │     └── Branding: logo, avatar, primaryColor, secondaryColor
              ├── Engagement Config (campaign_engagement_config)
              ├── UI Config (campaign_ui_config)
              ├── Feature Flags (campaign_feature_flags)
              ├── Campaign Components (campaign_components → components)
              ├── Form State (campaign_form_state) — estado de formularios Live tab
              └── Broadcasts (broadcasts.campaign_id)
                    ├── externalId — mapea contentId del partner (Viaplay, etc.)
                    ├── Polls (polls → poll_options → poll_votes)
                    ├── Contests (contests → contest_participations)
                    ├── Ads (broadcast_ads)
                    ├── Products (broadcast_products)
                    └── Chat Messages (chat_messages)
```

**Nota critica sobre Channels:**
- Los channels son **metadatos opcionales** a nivel de campana
- Los canales ya NO son duenos de campanas; las campanas se vinculan directamente a apps via `campaigns.client_app_id`
- El SDK descubre campanas por `clientAppId`, no por channel
- Asignar un channel es opcional y sirve solo para agrupacion/legado

**Nota critica sobre Sponsors:**
- El branding de una campana viene EXCLUSIVAMENTE del sponsor vinculado
- `sponsor.name` → `brand.name` en el SDK config
- `sponsor.avatarUrl` → `brand.iconUrl`
- `sponsor.logoUrl` → `brand.logoUrl`
- Los campos de branding directos en `campaigns` son fallback legacy

---

## 4. Flujo por Pagina <a name="paginas"></a>

### Dashboard Home (`/`) <a name="dashboard-home"></a>

**Proposito:** Vista rapida del estado global.

**Queries al montar:**
- `GET /api/client-apps/with-stats` — apps con conteo de campanas/broadcasts

**User flow:**
1. Usuario ve cards de apps con stats (broadcasts activos, campanas, etc.)
2. Puede navegar directamente a una app con click
3. No hay creacion desde esta pagina

---

### Apps (`/apps`, `/apps/:appId`) <a name="apps"></a>

**Pagina lista (`/apps`):**
- Query: `GET /api/client-apps`
- Crear app: `POST /api/client-apps` → invalida `['/api/client-apps']`
- Eliminar app: `DELETE /api/client-apps/:id` → invalida `['/api/client-apps']`

**Pagina detalle (`/apps/:appId`):**
- Query principal: `GET /api/client-apps/:id`
- Queries adicionales: `GET /api/client-apps/:id/campaigns`, `GET /api/client-apps/:id/channels`
- Stats: calculadas del response (no queries separadas, sin porcentajes hardcodeados)
- Regenerar API key: `POST /api/client-apps/:id/regenerate-key`
- Editar app: `PATCH /api/client-apps/:id`

---

### Campaigns (`/campaigns`, `/campaigns/new`, `/campaigns/:campaignId`) <a name="campaigns"></a>

**Lista (`/campaigns`):**
- Query: `GET /api/campaigns`
- Cada card muestra: nombre, status badge, sponsor, app vinculada
- Click en card → navega a `/campaigns/:campaignId`

**Nueva campana (`/campaigns/new`):**
- Form con: nombre, descripcion, app (select), sponsor (select), channel (select, opcional), fechas
- Submit: `POST /api/campaigns` → redirect a `/campaigns/:newId`
- Valida con schema Zod del `shared/schema.ts`

**Campaign Dashboard (`/campaigns/:campaignId`):**
Ver seccion dedicada abajo.

---

### Campaign Dashboard — Tabs <a name="campaign-dashboard-tabs"></a>

Archivo: `client/src/pages/campaign-dashboard.tsx`

**Estado compartido entre tabs:**
```typescript
const [activeTab, setActiveTab] = useState<string>('overview');
// Queries que se comparten:
const { data: campaign } = useQuery({ queryKey: ['/api/campaigns', campaignId] });
const { data: broadcasts } = useQuery({ queryKey: ['/api/broadcasts', { campaignId }] });
const { data: sponsors } = useQuery({ queryKey: ['/api/sponsors', userId] });
```

**Navigacion entre tabs:** via callback `onNavigateTab(tabName)` — NO se manipula el DOM ni se cambia URL.

---

#### Tab: Overview

Archivo: `client/src/components/dashboard/OverviewTab.tsx`

**Queries:**
- `GET /api/campaigns/:id` — datos de la campana
- `GET /api/campaigns/:id/stats` — KPIs (total broadcasts, viewers, etc.)
- `GET /api/campaigns/:id/broadcasts` (lazy, al activar tab)

**Data flow:**
```
OverviewTab monta
  → useQuery ['/api/campaigns', campaignId]     → muestra nombre, status, sponsor
  → useQuery ['/api/campaigns/:id/stats']       → muestra KPI cards
  → useQuery ['/api/campaigns/:id/broadcasts']  → muestra lista de broadcasts recientes
```

**Acciones:**
- Click en broadcast → navega a `/broadcasts/:broadcastId`
- Cambiar status de campana → `PATCH /api/campaigns/:id/toggle-pause` → invalida `['/api/campaigns', campaignId]`
- "New Broadcast" shortcut → activa tab `broadcasts` via `onNavigateTab('broadcasts')`

**Cache invalidation:** Crear o eliminar broadcasts invalida AMBAS keys:
```typescript
queryClient.invalidateQueries({ queryKey: ['/api/broadcasts'] });
queryClient.invalidateQueries({ queryKey: ['/api/campaigns', campaignId, 'broadcasts'] });
```

---

#### Tab: Broadcasts

Definido inline en `campaign-dashboard.tsx` como `BroadcastsTab`.

**Queries:**
- `GET /api/broadcasts?campaignId=X&status=Y` — lista filtrada por status

**Estados locales:**
```typescript
const [statusFilter, setStatusFilter] = useState<string>('all');
const [createOpen, setCreateOpen] = useState(false);
const [editBroadcast, setEditBroadcast] = useState<Broadcast | null>(null);
```

**Crear broadcast — form fields:**
- `name` (required)
- `externalId` — "External Content ID" — mapea contentId del partner (Viaplay stream ID, etc.)
- `status` — upcoming / live / ended
- `startTime`, `endTime`
- Panel colapsable **"Link Match"** — vincula un partido de Sportmonks al broadcast:
  - Selector de liga → `GET /api/sportmonks/leagues` (cache 2 días)
  - Date pickers: dateFrom / dateTo
  - Lista de fixtures → `GET /api/sportmonks/fixtures?leagueId=X&dateFrom=Y&dateTo=Z` (cache 2 días)
  - Al seleccionar fixture: auto-rellena el nombre del broadcast con "HomeTeam vs AwayTeam"
  - Guarda: `sportmonksFixtureId`, `homeTeamName`, `homeTeamLogo`, `awayTeamName`, `awayTeamLogo`, `matchStartingAt`, `leagueName`

**Data flow crear:**
```
Usuario llena form → POST /api/broadcasts { campaignId, name, externalId, ..., sportmonksFixtureId?, homeTeamName?, ... }
  → servidor crea broadcast
  → si status === 'live' → emite WS event broadcast_started a /ws/:campaignId
  → invalida ['/api/broadcasts', campaignId] + ['/api/campaigns', campaignId, 'broadcasts']
```

**Editar broadcast (lapicero icon en card):**
- Abre `EditBroadcastDialog` con campos: name, externalId, status, startTime, endTime + panel Link Match
- Submit: `PUT /api/broadcasts/:broadcastId`
- Si status cambia a 'live' → WS `broadcast_started`
- Si status cambia a 'ended' → WS `broadcast_ended`

**Broadcast cards con match vinculado:**
- Muestran logos de ambos equipos (componente `TeamLogo`) flanqueando el nombre del broadcast
- Muestran el nombre de la liga con icono Trophy debajo del nombre

**Eliminar broadcast:**
- `DELETE /api/broadcasts/:broadcastId`
- Invalida mismas query keys

**Navegar al detalle:**
- Click en nombre del broadcast → `navigate('/broadcasts/:broadcastId')`

---

#### Tab: Components

Archivo: `client/src/components/dashboard/ComponentsTab.tsx`

**Queries:**
- `GET /api/campaigns/:id/components` — componentes asignados a la campana
- `GET /api/components` — biblioteca global de componentes

**Acciones:**
- Asignar componente a campana: `POST /api/campaigns/:id/components { componentId, instanceName?, locationId?, status }`
- Actualizar config de componente en campana: `PATCH /api/campaigns/:id/components/:componentId/config`
- Activar/desactivar / actualizar locationId: `PATCH /api/campaigns/:id/components/:componentId { status?, locationId? }`
- Eliminar de campana: `DELETE /api/campaigns/:id/components/:componentId`

**Location Slot System (Mar 2026):**

El dialog "Add Component to Campaign" incluye un selector de Location Slot:
```
Select Component:        [Dropdown con componentes disponibles]
Instance Name:           [Input opcional — auto-generado si vacío]
Location Slot:           [Select opcional]
  Opciones:              None (manual activation)
                         sport-detail-banner
                         sport-detail-carousel
                         sport-home-banner
                         sport-home-carousel
                         casting-overlay-banner
```

El `locationId` se persiste en `campaign_components.location_id`. El SDK lo usa para resolver componentes por slot:
```
GET /v1/sdk/components?campaignId=35&locationId=sport-detail-banner
→ devuelve el componente activo para ese slot
```

Para actualizar el `locationId` de un componente ya añadido:
```
PATCH /api/campaigns/:id/components/:componentId
Body: { "locationId": "sport-detail-banner" }   ← no requiere "status"
```

---

#### Tab: Live

Renderiza dos subcomponentes:
- `<EventsTab campaignId={campaignId} campaign={campaign} />`
- `<ScheduledTab campaignId={campaignId} />`

**EventsTab** (`client/src/components/dashboard/EventsTab.tsx`):

**Proposito:** Disparar eventos en tiempo real a los SDKs conectados.

**Form state persistence — flujo:**
```
Tab monta
  → GET /api/form-state/:campaignId
  → useEffect carga state en productForms, pollForms, contestForms

Usuario modifica un campo
  → debounce (500ms) via useEffect
  → POST /api/form-state { campaignId, formType: 'product'|'poll'|'contest', formData }
  → se auto-guarda silenciosamente (sin boton Save)
```

**Enviar evento producto:**
```
Usuario llena form de producto → click "Send"
  → POST /api/events/product { name, price, imageUrl, campaignId }
  → servidor emite WS event { type: 'product', ...data } a /ws/:campaignId
  → todos los SDKs conectados reciben el evento
  → invalida ['/api/events']
```

**Enviar evento poll:**
```
  → POST /api/events/poll { question, options, duration, campaignId }
  → WS event { type: 'poll', ... }
```

**Enviar evento contest:**
```
  → POST /api/events/contest { title, description, campaignId }
  → WS event { type: 'contest', ... }
```

**ScheduledTab** (`client/src/components/dashboard/ScheduledTab.tsx`):
- `GET /api/campaigns/:id/scheduled-components` — lista de componentes programados
- Crear: `POST /api/campaigns/:id/scheduled-components` con `triggerType`, `triggerValue`, `componentId`
- Activar/desactivar: `PATCH /api/scheduled-components/:id`
- Eliminar: `DELETE /api/scheduled-components/:id`

---

#### Tab: Analytics

Definido inline en `campaign-dashboard.tsx`.

**Query (solo se ejecuta cuando `activeTab === 'analytics'`):**
```typescript
queryKey: ['/api/broadcasts', { campaignId }],
enabled: !!campaignId && activeTab === 'analytics',
```

**Datos mostrados:**
- KPI cards: total broadcasts, broadcasts live, total viewers, peak viewers
- Tabla de broadcasts: nombre, status badge, viewers, peakViewers, fecha

**Nota:** Esta es la vista analytics simplificada de la campana. Para analytics globales con drill-down completo → `/analytics`.

---

#### Tab: Settings

Archivos:
- `client/src/components/dashboard/SettingsTab.tsx`
- `client/src/components/dashboard/IntegrationsTab.tsx`

**SettingsTab — secciones y sus APIs:**

| Seccion | GET | PUT/PATCH |
|---------|-----|-----------|
| Basic Information | `GET /api/campaigns/:id` | `PUT /api/campaigns/:id` |
| Campaign Schedule | `GET /api/campaigns/:id` | `PUT /api/campaigns/:id` |
| Channel Assignment | `GET /api/channels` + `GET /api/campaigns/:id` | `PUT /api/campaigns/:id` { channelId } |
| Commerce Integration | `GET /api/campaigns/:id` | `PUT /api/campaigns/:id` { reachuApiKey } |
| Targeting & Segmentation | `GET /api/campaigns/:id` | `PUT /api/campaigns/:id` { targetCountries, isSegmented, ... } |
| Engagement Settings | `GET /api/campaigns/:id/engagement-config` | `PUT /api/campaigns/:id/engagement-config` |
| Feature Flags | `GET /api/campaigns/:id/feature-flags` | `PUT /api/campaigns/:id/feature-flags` |
| Danger Zone | — | `DELETE /api/campaigns/:id` |

**Flujo de guardado:**
```
Usuario modifica campo → click "Save"
  → PUT /api/campaigns/:id con body parcial
  → invalida ['/api/campaigns', campaignId]
  → muestra toast de exito/error
```

**Engagement config — campos:**
- `defaultPollDuration` (segundos)
- `defaultContestDuration` (segundos)
- `maxVotesPerPoll`
- `maxContestsPerBroadcast`
- `enableRealTimeUpdates` (boolean)
- `pollingInterval` (ms)

**Feature flags — campos:**
- `enablePolls`, `enableContests`, `enableChat`, `enableProducts`, `enableAds` (booleans)

**IMPORTANTE — Channel Assignment:**
- El channel es OPCIONAL — la campana funciona sin channel
- El select tiene opcion "No channel" (value="") para desvincular
- El SDK descubre la campana via `campaigns.client_app_id` directamente, NO via channel
- Solo asignar channel si se necesita por agrupacion o integracion legacy

**IntegrationsTab:**
- Muestra integraciones disponibles (Commerce, etc.)
- Commerce channels (legado): `GET /api/reachu/channels`

---

### Broadcast Detail (`/broadcasts/:broadcastId`) <a name="broadcast-detail"></a>

Archivo: `client/src/pages/broadcast-detail.tsx`

**Queries al montar:**
```typescript
['/api/broadcasts', broadcastId]               → datos del broadcast
['/api/campaigns', broadcast.campaignId]       → datos de la campana
['/api/broadcasts', broadcastId, 'analytics'] → viewerCount, peakViewers, votes, etc.
```

**Queries lazy (al activar seccion):**
```typescript
['/api/broadcasts', broadcastId, 'ads']        → lista de ads
['/api/broadcasts', broadcastId, 'products']   → productos
['/api/broadcasts', broadcastId, 'chat']       → mensajes (auto-refresh cada 10s)
```

**Layout:**
```
┌────────────────────────────────────────┬──────────────────┐
│ Header: nombre + badge status + stats  │                  │
├────────────────────────────────────────┤  Sidebar:        │
│ Event Timeline (polls + contests)      │  Tab: Live Chat  │
├────────────────────────────────────────┤  Tab: Analytics  │
│ Active Engagement (Polls) — azul       │                  │
├────────────────────────────────────────┤                  │
│ Contests & Trivia — purpura            │                  │
├────────────────────────────────────────┤                  │
│ Scheduled Ads — verde                  │                  │
├────────────────────────────────────────┤                  │
│ Shoppable Products (grid 4 cols)       │                  │
└────────────────────────────────────────┴──────────────────┘
```

**Flujo "Send Live" en un poll:**
```
Admin hace click "Send Live" en poll activo
  → POST /api/events/poll {
      question: poll.question,
      options: poll.options.map(o => o.text),
      duration: poll.duration,
      campaignId: broadcast.campaignId
    }
  → servidor: emite WS event { type: 'poll', ... } a /ws/:campaignId
  → SDKs conectados: muestran overlay con el poll
```

**Flujo "Send Live" en un contest:**
```
Admin hace click "Send Live" en contest activo
  → POST /api/events/contest {
      title, description, maxParticipants, prizeDescription, campaignId
    }
  → WS event { type: 'contest', ... } a /ws/:campaignId
```

**Flujo chat:**
```
Sidebar abierta en tab "Live Chat"
  → GET /api/broadcasts/:id/chat (auto-refresh cada 10s via refetchInterval)
  → Usuario escribe mensaje → click Send (o Enter)
  → POST /api/broadcasts/:id/chat { username, message }
  → invalida ['/api/broadcasts', broadcastId, 'chat']
```

**Flujo externalId (inline edit en header):**
```
Admin click icono lapicero junto al externalId
  → input inline se activa
  → usuario escribe nuevo ID → click check
  → PUT /api/broadcasts/:broadcastId { externalId: newValue }
  → invalida ['/api/broadcasts', broadcastId]
```

**Flujo "Load Demo":**
```
Admin click "Load Demo"
  → POST /api/seed-demo { broadcastId }
  → servidor inserta: 3 ads de demo + 3 productos demo + 5 mensajes de chat
  → invalida ads, products, chat queries
  → se muestran datos reales recien insertados
```

---

### Sponsors (`/sponsors`) <a name="sponsors"></a>

**Queries:**
- `GET /api/sponsors` — lista

**CRUD:**
- Crear: `POST /api/sponsors` con form (name, description, primaryColor, secondaryColor)
- Actualizar: `PATCH /api/sponsors/:id`
- Eliminar: `DELETE /api/sponsors/:id`

**Subida de logo/avatar:**
- Usa `ImageUploadWithPreview` component
- Upload va a Object Storage via Uppy (`POST /api/objects/upload` → S3 multipart)
- URL resultante se guarda en `sponsor.logoUrl` o `sponsor.avatarUrl`

**IMPORTANTE:** El sponsor es el unico dueno del branding visual. Su `primaryColor`, `secondaryColor`, `logoUrl`, `avatarUrl` se exponen al SDK via `GET /v1/campaigns/:id/config` en el objeto `brand` y `sponsor`.

---

### Components (`/components`, `/components/:id`) <a name="components"></a>

**Lista (`/components`):**
- `GET /api/components` — biblioteca completa
- `GET /api/components/usage` — cuantas campanas usa cada componente
- Filtro por tipo: Banner, Carousel, Poll Widget, etc.
- Toggle "Templates only"

**Detalle (`/components/:id`):**
- `GET /api/components/:id` — datos del componente
- Muestra: descripcion, codigo de integracion iOS Swift, campanas donde se usa
- `GET /api/components/:id/availability` — disponibilidad en campanas

---

### Analytics (`/analytics`) <a name="analytics"></a>

Archivo: `client/src/pages/analytics.tsx`

**Navegacion interna (sin cambio de URL, estado local):**
```typescript
type DrillDownLevel = 'global' | 'app' | 'campaign' | 'broadcast';
const [drillDown, setDrillDown] = useState<{ level: DrillDownLevel; id?: number }>({ level: 'global' });
```

**Nivel Global:**
- `GET /api/analytics/overview` — KPIs globales
- `GET /api/analytics/engagement` — top campanas, top componentes, actividad 30 dias
- `GET /api/analytics/geographic` — distribucion geografica
- `GET /api/analytics/sponsors` — ranking de sponsors

**Nivel App (drill-down):**
- `GET /api/analytics/apps/:appId` — KPIs de app + desglose por campana

**Nivel Campana (drill-down):**
- `GET /api/analytics/campaigns/:campaignId` — 6 KPI cards, timeline engagement, polls con distribucion de votos, contests, componentes

**Nivel Broadcast (drill-down):**
- `GET /api/analytics/broadcasts/:broadcastId` — 5 KPIs, timeline de votos (bar chart), resultados de polls y contests

**Data flow drill-down:**
```
Usuario ve tabla "Top Campaigns" → click en fila
  → setDrillDown({ level: 'campaign', id: campaignId })
  → componente re-renderiza con vista campaign
  → GET /api/analytics/campaigns/:id se ejecuta
  → breadcrumb: Global > Campaign Name
  → click en broadcast de la campana → nivel broadcast
```

---

### Docs (`/docs`) <a name="docs"></a>

Visor interactivo del `openapi.yaml` (~5700 lineas, 80 endpoints, 17 grupos). Renderizado con un visor OpenAPI integrado. Solo lectura.

---

## 5. Data Flow: TanStack Query + API <a name="data-flow"></a>

### Patron estandar de query:
```typescript
const { data, isLoading, error } = useQuery<TipoEsperado>({
  queryKey: ['/api/resource', id],          // key jerarquica con arrays
  // queryFn NO se define — el fetcher global en queryClient.ts lo maneja
});
```

**El fetcher global** (`client/src/lib/queryClient.ts`):
```typescript
queryFn: async ({ queryKey }) => {
  const url = Array.isArray(queryKey) ? queryKey.join('/') : queryKey;
  const res = await fetch(url, { credentials: 'include' });
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}
```

### Patron estandar de mutation:
```typescript
const mutation = useMutation({
  mutationFn: async (data) => apiRequest('POST', '/api/resource', data),
  onSuccess: () => {
    queryClient.invalidateQueries({ queryKey: ['/api/resource'] });
    toast({ title: 'Guardado' });
  },
  onError: (err) => {
    toast({ title: 'Error', description: err.message, variant: 'destructive' });
  }
});
```

**`apiRequest`** (`client/src/lib/queryClient.ts`): wrapper sobre `fetch` que:
- Incluye `credentials: 'include'`
- Serializa el body a JSON
- Lanza error si `!res.ok`

### Keys de cache jerarquicas:
```typescript
// CORRECTO — permite invalidar por jerarquia
queryKey: ['/api/broadcasts', broadcastId]
queryKey: ['/api/broadcasts', broadcastId, 'polls']

// INCORRECTO — no es invalidable en grupo
queryKey: [`/api/broadcasts/${broadcastId}/polls`]
```

---

## 6. Ciclo de Vida de una Campana <a name="lifecycle-campaign"></a>

```
Crear campana (/campaigns/new)
  → POST /api/campaigns { name, clientAppId, sponsorId, channelId?, ... }
  → campaignId generado
  → Redirect a /campaigns/:campaignId (tab Overview)

Configurar campana (tab Settings)
  → PUT /api/campaigns/:id (nombre, descripcion, fechas, canal, reachuApiKey = Commerce key)
  → PUT /api/campaigns/:id/engagement-config (duraciones, limites)
  → PUT /api/campaigns/:id/feature-flags (habilitar/deshabilitar features)

Asignar componentes (tab Components)
  → POST /api/campaigns/:id/components { componentId, config }

Preparar eventos (tab Live > EventsTab)
  → Los forms se guardan automaticamente en /api/form-state

Crear broadcasts (tab Broadcasts)
  → POST /api/broadcasts { campaignId, name, externalId, startTime, ... }

Activar campana
  → Estado 'active' en campaign
  → Scheduler revisa start/end dates cada 1 minuto

Pausar campana (desde Overview o via API)
  → PATCH /api/campaigns/:id/toggle-pause
  → campaigns.isPaused = 'true' (varchar)
  → Emite WS: { type: 'campaign_paused', campaignId }

Reanudar
  → PATCH /api/campaigns/:id/toggle-pause (toggle)
  → Emite WS: { type: 'campaign_resumed', campaignId }

Finalizar
  → campaigns.endTime alcanzado ← Scheduler
  → O admin actualiza endTime
  → Emite WS: { type: 'campaign_ended', campaignId }

Eliminar (Danger Zone)
  → DELETE /api/campaigns/:id
  → Redirect a /campaigns
```

---

## 7. Ciclo de Vida de un Broadcast <a name="lifecycle-broadcast"></a>

```
Crear broadcast (tab Broadcasts en campaign dashboard)
  → POST /api/broadcasts {
      campaignId, name, status: 'upcoming',
      externalId?,            ← mapea contentId del partner (e.g. Viaplay)
      startTime?, endTime?,
      sportmonksFixtureId?,   ← ID del partido en Sportmonks (opcional)
      homeTeamName?, homeTeamLogo?,
      awayTeamName?, awayTeamLogo?,
      matchStartingAt?, leagueName?
    }

Editar (dialog con lapicero icon)
  → PUT /api/broadcasts/:id { name, externalId, status, startTime, endTime,
                               sportmonksFixtureId, homeTeamName, homeTeamLogo,
                               awayTeamName, awayTeamLogo, matchStartingAt, leagueName }
  → Si status → 'live': WS broadcast_started emitido
  → Si status → 'ended': WS broadcast_ended emitido

Abrir detalle
  → /broadcasts/:broadcastId
  → Agregar polls, contests, ads, productos

Activar poll
  → POST /api/broadcasts/:id/polls { question, options, duration, isActive: true }
  → El SDK recibira el poll en GET /v1/sdk/broadcast si isActive=true

Enviar poll en vivo
  → POST /api/events/poll (desde Broadcast Detail o EventsTab)
  → WS push instantaneo a todos los SDKs conectados

Finalizar broadcast
  → PUT /api/broadcasts/:id { status: 'ended' }
  → WS broadcast_ended → SDKs ocultan componentes del broadcast
  → Componentes de campana (banners, carousels) siguen activos
```

---

## 8. Flujo de Eventos en Tiempo Real (Live Tab) <a name="live-events"></a>

```
Admin esta en tab Live (EventsTab)

PRODUCTO:
  Form: { name, price, imageUrl, ctaUrl, campaignId }
  → POST /api/events/product
  → server: storage.createEvent(data) + broadcastToChannel(campaignId, { type:'product', ... })
  → SDK recibe evento → muestra tarjeta shoppable

POLL:
  Form: { question, options: string[], duration: number, campaignId }
  → POST /api/events/poll
  → server: storage.createEvent + broadcastToChannel
  → SDK recibe → muestra overlay de votacion (duration segundos)

CONTEST:
  Form: { title, description, maxParticipants, prizeDescription, campaignId }
  → POST /api/events/contest
  → server: storage.createEvent + broadcastToChannel
  → SDK recibe → muestra overlay de participacion

DOUBLE PRODUCT (boton especial):
  Envia 2 productos en paralelo con 500ms de delay entre ellos
  → 2x POST /api/events/product
  → SDK recibe 2 eventos → muestra dos tarjetas

Todos los eventos se guardan en la tabla `events` para historial.
GET /api/events → lista todos los eventos recientes
GET /api/events/:campaignId → eventos filtrados por campana
```

---

## 9. Flujo WebSocket — Dashboard vs SDK <a name="websocket-flow"></a>

### Arquitectura WebSocket:
```
Servidor: ws library, montado sobre el servidor HTTP de Express
Canal por campana: /ws/:campaignId

┌──────────────┐     WS /ws/42     ┌─────────────────────────┐
│  iOS SDK     │ ◄─────────────── │  Express + ws server    │
│  Android SDK │ ◄─────────────── │  broadcastToChannel(42) │
└──────────────┘                   └─────────────────────────┘
                                            ▲
                                            │ triggers
                                   ┌────────────────┐
                                   │  Dashboard     │
                                   │  Admin Actions │
                                   └────────────────┘
```

### Eventos emitidos por el servidor:

| Evento | Disparado por | SDK Action |
|--------|--------------|------------|
| `campaign_started` | Scheduler (startDate) o API | Activar componentes de campana |
| `campaign_ended` | Scheduler (endDate) o API | Ocultar todo |
| `campaign_paused` | `PATCH /api/campaigns/:id/toggle-pause` | Ocultar temporalmente |
| `campaign_resumed` | `PATCH /api/campaigns/:id/toggle-pause` | Mostrar campana de nuevo |
| `broadcast_started` | `PUT /api/broadcasts/:id` status→'live' | Activar polls, contests, chat |
| `broadcast_ended` | `PUT /api/broadcasts/:id` status→'ended' | Ocultar solo broadcast; campana sigue |
| `poll` | `POST /api/events/poll` | Mostrar overlay poll |
| `contest` | `POST /api/events/contest` | Mostrar overlay contest |
| `product` | `POST /api/events/product` | Mostrar tarjeta shoppable |

### Estructura de todos los eventos:
```json
{
  "type": "poll",
  "campaignId": 42,
  "broadcastId": 15,
  "timestamp": "2026-02-26T10:00:00Z",
  // ...datos especificos del evento
}
```

### useWebSocket hook (dashboard):
- `client/src/hooks/useWebSocket.ts`
- Conecta a `ws://host/ws/:campaignId`
- Reconexion automatica con backoff
- Expone `{ lastEvent, sendMessage, isConnected }`

---

## 10. Flujo de Subida de Archivos (Object Storage) <a name="file-upload"></a>

```
Usuario selecciona imagen en ImageUploadWithPreview (Uppy)

1. Frontend solicita presigned URL:
   POST /api/objects/upload { filename, contentType }
   ← { uploadUrl, objectKey }

2. Uppy hace PUT directo a Object Storage con presigned URL
   (no pasa por el servidor Express)

3. Upload completo → Uppy devuelve objectKey
   → Se guarda en el campo correspondiente:
     sponsor.logoUrl = objectKey
     sponsor.avatarUrl = objectKey
     campaign.iconUrl = objectKey (legacy)

4. Para mostrar la imagen:
   El objectKey (/objects/uploads/{UUID}) se resuelve
   via PUBLIC_OBJECT_SEARCH_PATHS env var
```

---

## 11. Flujo SDK End-to-End <a name="sdk-flow"></a>

### Paso 1: App Launch

```
iOS SDK inicializa con:
  - bundleId: "com.viaplay.ios"
  - apiKey: "viaplay_api_key_..."

GET /v1/sdk/campaigns
  Headers: X-App-Bundle-ID: com.viaplay.ios
           X-Api-Key: viaplay_api_key_...

Server:
  1. Encuentra clientApp donde bundleId match
  2. Encuentra campaigns donde clientApp.id = campaigns.clientAppId
  3. Para cada campana activa, retorna components de tipo campana (banners, carousels)

Response:
{
  "campaigns": [{
    "campaignId": 35,
    "campaignName": "Viaplay Demo 2025",
    "websocketChannel": "/ws/35",
    "components": [{ "type": "banner", ... }]
  }]
}

SDK: guarda lista de campanas, conecta WS a /ws/35, muestra banners
```

### Paso 1b: Campaign Config (branding + Commerce key)

```
GET /v1/campaigns/35/config
  Headers: X-Api-Key: viaplay_api_key_...

Response:
{
  "brand": { "name": "Viaplay", "logoUrl": "..." },
  "features": { "enablePolls": true, "enableContests": true },
  "engagement": { "defaultPollDuration": 300 },
  "integrations": {
    "commerce": {
      "enabled": false,       ← true si hay key configurada en la campaña
      "apiKey": null,         ← la Commerce key si está configurada
      "channelId": null
    }
  }
}

SDK:
  - Aplica branding de campaña
  - Si integrations.commerce.enabled → inicializa módulo Commerce con esa apiKey
  - Si enabled: false → módulo Commerce no se inicializa
  - La Commerce key viene del campo campaigns.reachuApiKey en DB (nombre interno)
  - El módulo Commerce llama directo al servidor externo — no pasa por Vio
```

### Paso 2: Stream Open (contentId resolution)

```
Usuario abre stream "NFL Playoffs" en Viaplay
  contentId = "NFL_2026_PLAYOFFS" (ID de Viaplay)

GET /v1/sdk/broadcast?contentId=NFL_2026_PLAYOFFS&country=NO
  Headers: X-Api-Key: viaplay_api_key_...

Server:
  1. Valida API key → encuentra clientApp
  2. Busca broadcast donde externalId='NFL_2026_PLAYOFFS' AND campaign.clientAppId=app.id
  3. Si no encuentra → { hasEngagement: false }  (Cache: public, max-age=30)
  4. Si encuentra:
     a. Verifica campaign.targetCountries: si incluye 'NO' (o null = all) → OK
     b. Retorna datos completos

Response hasEngagement: true:
{
  "hasEngagement": true,
  "broadcastId": 15,
  "broadcastName": "NFL Playoffs Game",
  "status": "live",
  "campaignId": 35,
  "websocketChannel": "/ws/35",
  "campaignComponents": [{ "type": "banner", ... }],
  "broadcastComponents": {
    "chat": { "enabled": true },
    "polls": [{ "id": 1, "question": "Who wins?", "isActive": true, "duration": 30, "options": [...] }],
    "contests": [{ "id": 2, "title": "Pick the winner", "isActive": true }]
  }
}
// Cache: private, max-age=10, ETag presente

SDK: muestra polls/contests activos, habilita chat, escucha WS para eventos en vivo
```

### Paso 3: Engagement

```
Usuario vota en poll:
POST /v1/engagement/polls/:pollId/vote
  { optionId: 3, userId: "anon_abc123" }
  Headers: X-Api-Key: ...
  Rate limit: 10 votos/minuto por IP

Server: guarda voto, devuelve resultados actualizados

Usuario participa en contest:
POST /v1/engagement/contests/:contestId/participate
  { userId: "anon_abc123", answer: "Team A" }
  Rate limit: 5 participaciones/minuto por IP
```

### vio-config.json — UNA sola API key

El app iOS tiene un archivo de configuración con **una sola key Vio**:
```json
{
  "apiKey": "<Vio App API Key>",
  "restAPIBaseURL": "https://api-dev.vio.live",
  "webSocketBaseURL": "https://api-dev.vio.live"
}
```
- `apiKey` = `client_apps.api_key` en la DB
- Se usa para TODOS los endpoints Vio: `/v1/sdk/*`, `/v1/campaigns/*/config`, `/v1/engagement/*`, `/v1/offers`
- La Commerce key **NO va aquí** — la entrega el servidor dinámicamente

### Config del SDK (branding + Commerce key):

```
GET /v1/campaigns/:campaignId/config
  Headers: X-Api-Key: viaplay_api_key_...

Auth logic (en orden):
  1. directMatch = campaign.clientAppId === clientApp.id  ← principal
  2. Si tiene channelId → channelMatch = channel.clientAppId === clientApp.id  ← legacy fallback
  3. Si ninguno → 403

Response incluye:
  brand: {
    name: sponsor.name,           ← VIENE DEL SPONSOR
    iconUrl: sponsor.avatarUrl,   ← NO del campo legacy
    logoUrl: sponsor.logoUrl
  },
  sponsor: { id, name, primaryColor, secondaryColor, ... },
  features: { polls, contests, chat, products },
  engagement: { defaultPollDuration, maxVotesPerPoll, ... },
  integrations: {
    commerce: {
      enabled: true,              ← false si no hay key configurada
      apiKey: "COMMERCE-KEY",     ← campaigns.reachuApiKey en DB (nombre interno, no expuesto)
      channelId: "channel-id"     ← campaigns.reachuChannelId en DB (nombre interno, no expuesto)
    }
  }
```

**Flujo Commerce en el SDK:**
1. SDK llama `GET /v1/campaigns/{id}/config`
2. Lee `integrations.commerce.apiKey` del response
3. Si `enabled: true` → inicializa el módulo Commerce con esa key
4. El módulo Commerce llama **directo** al servidor externo usando esa key (no pasa por Vio)
5. Vio actúa solo como distribuidor seguro de la key — nunca hardcodeada en el app

---

## 12. Patrones de Cache e Invalidacion <a name="cache"></a>

### Reglas de invalidacion por accion:

| Accion | Query keys a invalidar |
|--------|----------------------|
| Crear broadcast | `['/api/broadcasts']`, `['/api/broadcasts', campaignId]`, `['/api/campaigns', campaignId, 'broadcasts']` |
| Editar broadcast | `['/api/broadcasts', broadcastId]` |
| Eliminar broadcast | `['/api/broadcasts']`, `['/api/campaigns', campaignId, 'broadcasts']` |
| Crear/editar poll | `['/api/broadcasts', broadcastId]` |
| Guardar campaign settings | `['/api/campaigns', campaignId]` |
| Guardar engagement config | `['/api/campaigns/:id/engagement-config']` |
| Guardar feature flags | `['/api/campaigns/:id/feature-flags']` |
| Enviar evento | `['/api/events']` |
| Subir imagen sponsor | `['/api/sponsors', sponsorId]` |

### Cache del SDK (no del dashboard):
- `hasEngagement: false` → `Cache-Control: public, max-age=30`
- `hasEngagement: true` → `Cache-Control: private, max-age=10` + `ETag` (hash del broadcastId + status)

---

## 13. Convenciones de Codigo <a name="convenciones"></a>

### Tipos compartidos:
- Siempre desde `shared/schema.ts` — nunca duplicar tipos
- Insert schemas: `createInsertSchema(tabla).omit({ id: true, createdAt: true })`
- Select types: `typeof tabla.$inferSelect`

### Data-testid (obligatorio):
```typescript
// Elementos interactivos
data-testid="button-submit"
data-testid="input-email"
data-testid="tab-overview"

// Elementos en listas (siempre con ID unico)
data-testid={`card-broadcast-${broadcast.id}`}
data-testid={`row-sponsor-${index}`}
data-testid={`badge-country-${code}`}
```

### Boton primario (patron del dashboard):
```tsx
<button className="px-4 py-1.5 bg-white hover:bg-gray-200 text-black rounded text-xs transition font-medium">
  Guardar
</button>
```

### Boton destructivo:
```tsx
<button className="px-4 py-1.5 bg-red-500/10 hover:bg-red-500/20 text-red-400 border border-red-500/20 rounded text-xs transition font-medium">
  Eliminar
</button>
```

### Seccion/card del dashboard:
```tsx
<div>
  <h2 className="text-sm font-semibold text-gray-400 uppercase mb-1">Titulo Seccion</h2>
  <p className="text-xs text-gray-500 mb-3">Descripcion opcional</p>
  <div className="border border-white/10 rounded-lg p-6">
    {/* contenido */}
  </div>
</div>
```

### Label de campo:
```tsx
<div className="text-xs text-gray-500 uppercase font-medium mb-1">Nombre del Campo</div>
```

### Zona de peligro:
```tsx
<div className="border border-red-500/20 bg-red-500/5 rounded-lg p-6">
  {/* acciones destructivas */}
</div>
```

### Archivos que NO se modifican nunca:
- `vite.config.ts`
- `server/vite.ts`
- `drizzle.config.ts`
- `package.json` (usar herramientas de paquetes en su lugar)

### Schema changes:
```bash
# Editar shared/schema.ts
# Luego:
npm run db:push
# Si hay warning de perdida de datos:
npm run db:push --force
```

---

*Documento generado para uso con Cursor AI. Refleja el estado del proyecto a Febrero 2026.*
