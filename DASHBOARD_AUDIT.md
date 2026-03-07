# DASHBOARD_AUDIT.md — Auditoría UI/UX Completa de Vio Dashboard

> **Fecha:** Marzo 2026  
> **Metodología:** Revisión de código fuente (client/src/pages + components/dashboard) + navegación asistida en browser  
> **Severidad:** 🔴 Crítico · 🟠 Importante · 🟡 Menor

---

## Índice

1. [Dashboard Home `/`](#1-dashboard-home-)
2. [Apps `/apps`](#2-apps-apps)
3. [App Detail `/apps/:id`](#3-app-detail-appsid)
4. [Campaigns `/campaigns`](#4-campaigns-campaigns)
5. [Campaign Detail — Tabs](#5-campaign-detail-campaignsid)
6. [Broadcasts `/broadcasts`](#6-broadcasts-broadcasts)
7. [Broadcast Detail `/broadcasts/:id`](#7-broadcast-detail-broadcastsid)
8. [Sponsors `/sponsors`](#8-sponsors-sponsors)
9. [Components `/components`](#9-components-components)
10. [Analytics `/analytics`](#10-analytics-analytics)
11. [Resumen por categoría](#11-resumen-por-categoría)

---

## 1. Dashboard Home `/`

### Visual / Spacing

**🟠 Inconsistencia de colores en los stat cards**
Los 4 stat cards del header usan colores de icono distintos sin criterio claro:
- "Live Broadcasts" → `bg-[#3d8b7a]/10`, `text-[#3d8b7a]`
- "Active Campaigns" → `bg-[#3d8b7a]/10`, `text-[#3d8b7a]`
- "Active Viewers" → `bg-emerald-500/20`, `text-emerald-400`
- "Engagement Rate" → `bg-orange-500/20`, `text-orange-400`

Los dos primeros usan el color de acento del sistema; los dos últimos usan colores diferentes (emerald y orange). Deberían tener un criterio consistente. Si el color cambia según si hay dato real o no, debería comunicarse visualmente de otro modo.

**🟡 Progress bar en App Cards sin etiqueta ni unidad**
Cada app card en el dashboard tiene una barra de progreso calculada como `Math.min(appCampaigns.length * 15, 100)`. Con 1 campaign muestra 15%, con 7 muestra 100%. No hay label que explique qué representa esta barra. Un usuario no puede intuir qué significa.

**🟡 Botones "Filter" y "Sort" decorativos en Live Broadcasts**
La tabla de "Live Broadcasts" tiene botones "Filter" y "Sort" que renderizan íconos de `<Filter>` y `<ArrowUpDown>` pero no tienen ningún `onClick`. Son puramente decorativos y generan expectativas que no se cumplen.

---

### Arquitectura de Información

**🟠 "Active Viewers" y "Engagement Rate" siempre muestran `--`**
Estos dos stat cards tienen `formattedValue="--"` y `change={0}` hardcodeados. Nunca muestran datos reales aunque hubiera información disponible. El indicador ↑12% en "Live Broadcasts" y ↑8% en "Active Campaigns" también son hardcodeados — no representan cambios reales. Estos números falsos crean una ilusión de datos en tiempo real que no existe.

**🟠 "New Campaign" button lleva a `/campaigns`, no a `/campaigns/new`**
El botón "New Campaign" del header del dashboard navega a `/campaigns` (la lista de campañas), no al formulario de creación. Para crear una campaña, el usuario debe encontrar el botón "New Campaign" dentro de esa lista. Son dos clics donde debería ser uno.

**🟠 Sección "Upcoming Campaigns" muestra cualquier campaña cuando no hay upcoming**
Cuando no hay campañas con `startDate` dentro de los próximos 7 días, la sección muestra `campaigns.slice(0, 3)` — es decir, las 3 primeras campañas de cualquier estado — pero con el título "Upcoming Campaigns". Esto es semánticamente incorrecto y confunde al operador.

**🟡 "Components" en campaign cards siempre muestra `--`**
En las campaign cards de la sección inferior, el campo "Components" siempre muestra `--`. El dato no se está cargando desde ningún endpoint. El layout tiene 3 columnas: Start Date / Broadcasts / Components — la tercera siempre está vacía.

**🟡 "Total Viewers" en app cards del dashboard siempre `--`**
Las app cards del dashboard muestran "Total Viewers: --" en todos los casos. El dato viene de un cálculo que no está implementado.

---

## 2. Apps `/apps`

### Visual / Spacing

**🟡 Botones "Edit" y "Settings" idénticos y redundantes**
Cada app card tiene dos botones en el footer: "Edit" (icono Pencil) y "Settings" (icono Settings). Ambos hacen `href={/apps/${app.id}}` — van al mismo sitio. Son funcionalmente idénticos. Solo debería haber uno, con el label "Manage" o "View".

**🟡 Progress bar de engagement sin contexto visual**
La barra de progreso bajo las stats de cada app muestra `app.stats.engagementPercent` pero no tiene label. Aparece flotando debajo de los números "Active Broadcasts" y "Total Viewers" sin explicar qué porcentaje representa. El texto a la derecha muestra el `%` pero sin un label como "Engagement".

**🟡 `APP_GRADIENTS` definido en dos archivos**
El array de gradientes de fondos para las app cards está definido de forma idéntica tanto en `dashboard.tsx` como en `apps.tsx`. Si se cambia en uno y no en el otro, las cards de las dos páginas se verán diferentes para el mismo app.

---

### Arquitectura de Información

**🟠 "Total Viewers" siempre muestra 0**
`app.stats.totalViewers` viene del endpoint `/api/client-apps/with-stats`, que devuelve `totalViewers: 0` para todos los apps porque el dato no está implementado. Debería mostrar `--` o no mostrarse, no `0` (que da la impresión de que hay cero espectadores).

**🟡 Bundle ID expuesto en font mono en la card**
El bundle ID (`com.viaplay.tv`) se muestra en la card pública con `font-mono`. Es un dato técnico interno que no necesita estar en la vista de lista. Podría mostrarse solo en el detalle del app.

---

## 3. App Detail `/apps/:id`

### Visual / Spacing

**🟡 Stat cards sin background consistente**
Los 4 stat cards de App Detail (`border border-white/10 rounded-lg p-5`) no tienen `background-color`. El fondo es transparente, a diferencia de los stat cards de otras páginas que usan `bg-white dark:bg-[#141824]`. Visualmente quedan inconsistentes con el sistema.

**🟡 Badge de status siempre blanco/negro**
El badge de status del app (`bg-white text-black text-[10px] uppercase font-bold rounded-full`) tiene el mismo color visual para "Active", "Paused" y "Archived". No hay diferenciación visual por estado.

---

### Arquitectura de Información

**🔴 Engagement Rate hardcodeado a 75% como fallback**
```tsx
const engagementRate = currentAppStats?.engagementRate || 75;
```
Si no hay dato de engagement (que es el caso siempre porque el campo no está implementado), el stat card muestra **75%**. Este número ficticio aparece como si fuera real. Debería mostrar `--` o N/A.

**🔴 "0 broadcasts" hardcodeado en Campaign list**
En la sección "Campaigns" del App Detail, cada campaign muestra:
```tsx
<span>0 broadcasts</span>
```
El valor `0` está hardcodeado. No se está consultando el `broadcastCount` de cada campaign. Todos los campaigns muestran "0 broadcasts" siempre.

**🟠 "Live Broadcasts" usa `broadcastCount` total**
```tsx
const liveBroadcastsCount = currentAppStats?.broadcastCount || 0;
```
El stat "Live Broadcasts" usa `broadcastCount` que es el total histórico, no los que están en estado `live`. El nombre del stat es engañoso.

**🟠 Icono `<Users>` usado para fecha de inicio**
En la lista de campaigns dentro de App Detail:
```tsx
<Users className="w-3 h-3" />
{campaign.startDate ? new Date(...).toLocaleDateString(...) : '—'}
```
El icono `<Users>` aparece junto a la fecha de inicio. Debería ser `<Calendar>`. El icono de personas al lado de una fecha es confuso semánticamente.

**🟡 Quick Actions y Edit Details: duplicación de acciones**
La página tiene dos vías para editar un app: el botón "Edit Details" en la sección "App Details" y el Quick Action "App Settings" del sidebar. Ambos abren dialogs de edición. La duplicación no añade valor y confunde la jerarquía de acciones.

---

## 4. Campaigns `/campaigns`

### Visual / Spacing

**🟡 Filter tabs y search bar en el mismo flex container**
La barra de filtros (All / Active / Upcoming / Ended / Paused) y el campo de búsqueda están en un `flex` con `justify-between`. En pantallas medianas, si hay muchos tabs, pueden solaparse con el search. No hay `flex-wrap` adecuado para los tabs (sí tiene `flex-wrap` pero con tamaño fijo del search `sm:w-72`).

**🟡 Status badge en modo ALL sin diferenciar contexto temporal**
El badge "ACTIVE" aparece en verde (`bg-[#3d8b7a]/15`) y el badge "ENDED" en gris muy similar al "UPCOMING". En una lista larga, la diferencia visual entre UPCOMING y ENDED es mínima (ambos son grises con texto gris, diferente shade). ENDED podría usar un tono más oscuro o añadir un icono.

---

### Arquitectura de Información

**🟠 Países mostrados como códigos ISO sin contexto**
```tsx
{countries.join(', ')}
```
Si una campaña tiene `targetCountries: ['NO', 'SE', 'DK']`, se muestra "NO, SE, DK" en la card. Los códigos ISO de 2 letras no son legibles para todos los operadores. Debería mostrarse el nombre completo o al menos tener un tooltip.

**🟠 Sponsor presente en data pero no en el label**
La campaña carga el `sponsorMap` y muestra el `sponsor.avatarUrl` como imagen al lado del nombre de la campaign, pero no hay un texto o badge que diga "Sponsor: Elkjøp". Un operador que no conoce los logos no puede identificar a qué sponsor pertenece la campaña.

**🟡 `broadcastCount` puede ser `undefined`**
```tsx
{campaign.broadcastCount || 0} broadcast{...}
```
El tipo `CampaignWithCount` extiende `Campaign` con `broadcastCount?: number` (opcional). Si no viene del backend, muestra `0 broadcasts`. No hay indicación de si es real o un fallback.

**🟡 No hay acción rápida de "Pause/Resume" en la lista**
Las campaigns con status "Paused" no tienen un botón de "Resume" directo desde la lista. Hay que entrar al detalle de la campaign → header → botón Pause/Play. Para flujos operacionales de alto volumen, debería haber un toggle inline.

**🟡 Sin opción de ordenar la lista**
No hay controles de ordenamiento. Por defecto se muestra en el orden de la DB. El operador no puede ordenar por fecha, nombre, o status.

---

## 5. Campaign Detail `/campaigns/:id`

### Tab: Overview

**🟡 Stats de "Total Views" y "Engagement Rate" siempre en 0**
El endpoint `/api/campaigns/:id/stats` devuelve `totalViews: 0` y `engagementRate: 0` en la mayoría de campaigns porque no hay tracking de vistas implementado. Los stat cards muestran `0` sin indicar que son datos no disponibles.

**🟡 Broadcast cards del Overview sin acción contextual clara**
Las broadcast cards en el Overview tab muestran estado Live/Upcoming/Ended con botones "Go Live" o "View". El botón "Go Live" para un broadcast upcoming debería llamarse "Start Broadcast" o ser más explícito sobre lo que hace (cambia el status a live y dispara el WebSocket).

---

### Tab: Broadcasts

**🟠 Filtros (All/Upcoming/Live/Ended) sin counter por estado**
Los filtros de broadcasts no muestran cuántos hay en cada estado: "All (12) · Live (1) · Upcoming (3) · Ended (8)". El operador tiene que cambiar de tab para descubrir cuántos hay en cada estado.

**🟡 "New Broadcast" abre el selector de Sportmonks solo en este contexto**
El dialog de creación de broadcast dentro del Campaign Dashboard incluye el selector de fixtures de Sportmonks. Pero el mismo dialog en `/broadcasts` global NO lo incluye. Esto crea inconsistencia en cómo se crean broadcasts según desde dónde se acceda.

---

### Tab: Components

**🟠 `locationId` no visible en la lista**
Los campaign components tienen un campo `locationId` (slot del SDK como `sport-detail-banner`). Este campo no se muestra en la lista de components del tab. El operador no puede ver qué slot está ocupando cada componente sin entrar a editarlo.

**🟡 Sin indicador de "active" / "scheduled" por componente**
Los campaign components pueden estar activos o tener fechas de activación. La lista del tab solo muestra nombre y tipo. No se ve si un componente está activo ahora o cuándo se activa.

---

### Tab: Live

**🟡 Controles de Live Event sin feedback de confirmación**
Al disparar un evento live (poll, contest, shoppable ad), el botón cambia a "Sending..." pero el feedback de éxito es solo un toast. No hay ningún indicador visual en la interfaz de que el evento fue disparado (timestamp de último envío, historial de eventos disparados en esta sesión).

---

### Tab: Analytics

**🟡 Analytics de campaña solo carga con `activeTab === 'analytics'`**
```tsx
enabled: !!campaignId && activeTab === 'analytics'
```
Los datos de analytics se cargan lazy. Si el usuario navega directamente al tab Analytics, hay un momento de loading visible. Podría pre-fetchear al abrir la campaign.

---

### Tab: Settings

**🟡 Sección "Danger Zone" siempre visible**
La sección "Danger Zone" con el botón de eliminar campaña está siempre visible al final del Settings tab, sin collapse ni confirmación visual especial hasta que se clicka. Debería estar más separada o colapsada por defecto.

**🟡 Commerce API key guardada sin confirmación visual**
El campo "Commerce API key" tiene un botón "Save" separado del resto del formulario. Si el usuario edita otros campos y hace scroll, puede no notar que Commerce tiene su propio botón de guardado. El patrón de auto-save del resto del form versus el botón explícito de Commerce es inconsistente.

---

## 6. Broadcasts `/broadcasts`

### Visual / Spacing

**🟠 "Ended" broadcasts con `opacity-60`**
```tsx
className="... opacity-60"
```
Los broadcasts en estado "Ended" tienen opacidad reducida al 60%. Esto puede hacer difícil leer el nombre y los datos, especialmente en pantallas con brillo bajo. La opacidad podría aplicarse solo al badge, no a toda la card.

**🟡 Icono `<BarChart3>` usado para viewers Y para polls en `EndedBroadcastCard`**
```tsx
// viewers:
<BarChart3 className="w-3 h-3" />
<span>{formatViewers(viewers)} viewers</span>
// polls:
<BarChart3 className="w-3 h-3" />
<span>{broadcast.pollCount} polls</span>
```
El mismo icono `<BarChart3>` se usa para espectadores (debería ser `<Users>`) y para polls. Esta reutilización hace el contenido ambiguo.

**🟡 El botón "Filter" (icono) no tiene tooltip ni label**
El botón cuadrado con `<Filter className="w-3.5 h-3.5" />` al lado del search no tiene label, tooltip, ni funcionalidad. Un icono sin label y sin acción no aporta nada.

---

### Arquitectura de Información

**🔴 Viewers y Engagement leídos de `broadcast.metadata`**
```tsx
const viewers = broadcast.metadata && typeof broadcast.metadata === 'object' && 'viewers' in broadcast.metadata
  ? Number((broadcast.metadata as Record<string, unknown>).viewers) || 0 : 0;
```
Los viewers y engagement en el `LiveBroadcastCard` se leen del campo JSON `metadata`, no del campo dedicado `viewerCount` que existe en el schema de `broadcasts`. El campo `broadcast.viewerCount` debería usarse. El acceso a `metadata` es frágil y no tipado.

**🟠 Campo "Metadata (JSON)" expuesto en el Create Broadcast dialog**
El formulario de creación tiene un campo "Metadata (JSON)" con `<Textarea>` donde el usuario puede escribir JSON crudo. Esto es un campo técnico interno que no debería exponerse directamente a los operadores del dashboard. Si hay datos específicos que necesitan configuración, deberían tener campos propios.

**🟠 El modal de creación de Broadcast en `/broadcasts` no tiene selector de partidos**
Al crear un broadcast desde la página global `/broadcasts`, el dialog es un formulario básico (Nombre, Descripción, Campaign, Start/End Time, Metadata). No tiene el selector de fixtures de Sportmonks que sí existe en el tab "Broadcasts" del Campaign Dashboard. Esto crea dos flujos de creación con capacidades diferentes.

**🟡 Broadcast cards no muestran el nombre del Client App**
`CampaignAppLabel` muestra `campaignName / clientAppName`, pero la jerarquía es `App → Campaign → Broadcast`. El orden visualmente sugiere que Campaign viene antes que App, lo que puede confundir.

---

## 7. Broadcast Detail `/broadcasts/:id`

### Visual / Spacing

**🔴 Progress bar del Event Timeline hardcodeada al 50%**
```tsx
<div className="h-full bg-[#3d8b7a] dark:bg-white rounded-full" style={{ width: '50%' }}></div>
```
La barra de progreso del Event Timeline siempre muestra 50%, independientemente del estado del broadcast o de cuántos eventos han ocurrido. Es decorativa y no representa ningún dato real.

**🔴 `topValues` array decorativo**
```tsx
const topValues = [16, 48, 32, 16, 24, 40, 8, 56];
```
Este array de valores aparece en el código del timeline pero no representa datos. Es un artefacto de diseño que no debería estar en producción.

---

### Arquitectura de Información

**🔴 Botones Play / SkipBack / SkipForward / Maximize sin funcionalidad**
Los 4 botones del Event Timeline section no tienen handlers `onClick`:
- `<SkipBack>` — sin acción
- `<Play>` — sin acción
- `<SkipForward>` — sin acción
- `<Maximize2>` (expand timeline) — sin acción

Son elementos de UI que generan expectativas de funcionalidad que no existe.

**🟠 Live Chat visible en broadcasts "Ended"**
El input de chat y el botón "Send" están visibles aunque el broadcast tenga status `ended`. No tiene sentido que el operador pueda enviar mensajes de chat en un broadcast que ya terminó. La sección debería estar en modo solo-lectura o mostrar un banner "This broadcast has ended".

**🟠 Sección de "Shoppable Ads" / Ads visible en broadcasts sin campaña Commerce**
Si el broadcast pertenece a una campaña sin Commerce integration configurada (`enabled: false`), la sección de Shoppable Ads debería mostrar un aviso de que Commerce no está configurado, en lugar de mostrar el formulario completo que fallará al enviarse.

**🟡 "Load Demo" button en producción**
Existe un botón para cargar datos de demo en el broadcast. En un entorno de producción con datos reales, este botón podría confundir o sobrescribir datos existentes sin un aviso claro de que se trata de datos de prueba.

**🟡 Analytics stats con `viewerCount` y `peakViewers` siempre en 0**
Los stats de "Viewers" y "Peak Viewers" en el header del broadcast detail siempre muestran 0. El campo `broadcast.viewerCount` existe en el schema pero no se actualiza en tiempo real vía WebSocket. El stat debería indicar "N/A" o "Tracking not active" en lugar de 0.

**🟡 Poll "Results" sin total de participantes**
En la sección de polls activos, cada opción muestra su porcentaje pero no el número absoluto de votos ni el total de participantes. "45%" no dice nada sin saber si son 45 de 100 votos o 45 de 4.500.

---

## 8. Sponsors `/sponsors`

### Visual / Spacing

**🟡 Color swatches sin labels visibles**
Los dos círculos de color (Primary y Secondary) en la sponsor card no tienen labels texto. Solo tienen `title` HTML (tooltip on hover). Un operador que no conoce el significado de los dos círculos no puede distinguir cuál es primary y cuál secondary sin hacer hover.

**🟡 Default colors violan el design system**
Al crear un nuevo sponsor, el formulario inicializa los colores con:
```tsx
primaryColor: '#3B82F6',  // azul
secondaryColor: '#8B5CF6', // púrpura
```
El design system de Vio establece explícitamente que se deben evitar gradientes blue/purple. Estos son los colores por defecto que ve el operador al crear un sponsor.

---

### Arquitectura de Información

**🟠 Sin página de detalle de sponsor**
No existe `/sponsors/:id`. Todo el CRUD de sponsors se maneja mediante modales superpuestos en la lista. No hay forma de ver:
- Las campaigns asociadas a este sponsor
- El historial de uso
- Una vista completa del perfil

**🟡 "Description" truncada a 2 líneas sin forma de expandir**
```tsx
className="text-xs text-gray-500 dark:text-white/40 line-clamp-2"
```
La descripción se recorta a 2 líneas. La única forma de ver la descripción completa es hacer click en "Edit", lo que sugiere edición cuando el objetivo era solo leer.

**🟡 Logo y Avatar mostrados sin diferenciación de roles**
En la card de sponsor se muestra el logo (imagen 12x12 cuadrada a la izquierda) y el avatar (imagen 8x8 redonda a la derecha). No hay labels que identifiquen cuál es el logo y cuál el avatar. La diferencia semántica entre ambos no es obvia sin contexto.

---

## 9. Components `/components`

### Visual / Spacing

**🟡 Cards con altura fija `h-48` que no adapta contenido**
```tsx
className="group ... flex flex-col h-48"
```
Todas las cards tienen altura fija de 48 unidades (192px). Si un component tiene un nombre largo, el texto se trunca. Si el nombre es muy corto, hay espacio vacío excesivo arriba del nombre.

**🟡 Heading de la página usa `h1` dentro del AppLayout que ya tiene heading**
```tsx
<h1 className="text-xl font-bold text-foreground">Component Library</h1>
```
El AppLayout tiene su propio sistema de breadcrumbs y títulos. El uso de un `h1` manualmente dentro del contenido crea una jerarquía de headings inconsistente con otras páginas (que usan el `title` prop del AppLayout).

---

### Arquitectura de Información

**🟠 No hay preview de configuración en las cards**
La card de un componente muestra solo:
- Icono del tipo
- Nombre
- Tipo (label)
- "Used in X campaigns"

No hay ningún dato de configuración visible. Para un componente `banner`, el operador no puede ver la URL de la imagen desde la lista. Para un `countdown`, no puede ver la fecha objetivo. Esto obliga a entrar a cada componente para saber qué contiene.

**🟡 `isTemplate` comparado como string**
```tsx
if (templatesOnly && c.isTemplate !== 'true') return false;
```
El campo `isTemplate` es `text` en la DB y se compara contra el string `'true'`. Aunque funciona, es un code smell que puede causar bugs si el valor cambia a booleano en el futuro.

**🟡 Filter "Spotlight" no cubre todos los tipos**
La opción de filtro "Spotlight" busca `lowerType.includes('spotlight')`, que solo captura `product_spotlight`. Pero el filter set es `['All', 'Banner', 'Countdown', 'Carousel', 'Spotlight', 'Badge']` — no existe filtro para `offer_banner`, `product_banner`, `product_store`. Un operador que quiera filtrar solo productos no puede.

**🟡 Botón de creación usa `<button>` nativo, no el componente `<Button>`**
```tsx
<button className="flex items-center space-x-2 px-4 py-2 bg-[#3d8b7a] ...">
```
El botón "New Component" usa un `<button>` HTML nativo con clases manuales, mientras que el resto del sistema usa el componente `<Button>` de shadcn/ui. Los estilos son similares pero no idénticos (hover states, focus rings, etc.).

---

## 10. Analytics `/analytics`

### Visual / Spacing

**🟡 Página sin subtítulo**
La página `/analytics` recibe `AppLayout` sin `subtitle`. Otras páginas como Campaigns ("Manage engagement campaigns across all your apps") o Broadcasts ("All broadcasts across campaigns") tienen subtítulos descriptivos. Analytics debería tener uno.

**🟡 `useChartTheme()` accede al DOM directamente**
```tsx
const isDark = document.documentElement.classList.contains('dark');
```
Esta función no usa React state ni context para detectar el tema. Si el usuario cambia de tema claro a oscuro mientras está en Analytics, los colores de los gráficos no se actualizan hasta que el componente se re-renderice por otra razón.

---

### Arquitectura de Información

**🟠 "Engagement" en Sponsor Performance sin unidad ni definición**
En la tabla "Sponsor Performance", cada sponsor muestra un número bajo la etiqueta "engagement". No está definido qué incluye: ¿votos? ¿participaciones en contests? ¿suma de ambos? Sin esta definición, el número es difícil de interpretar.

**🟠 Geographic Distribution: "X campaigns" como métrica ambigua**
```tsx
<span className="text-xs text-gray-400">{c.campaignCount} campaigns</span>
```
La distribución geográfica muestra "X campaigns" por país. No queda claro si significa:
- Campaigns que tienen ese país en `targetCountries`
- Usuarios registrados desde ese país
- Broadcasts activos en ese país

La métrica debería tener una descripción.

**🟡 Drill-down "Back" sin destino explícito**
Al navegar App → Campaign → Broadcast en el drill-down de Analytics, el botón "Back" simplemente dice "Back" o "Back to Overview". Cuando el usuario está en nivel de Campaign, el botón debería decir "← TV2 Demo App" (el nombre del app del que vino). En la navegación de tres niveles, "Back" sin contexto es confuso.

**🟡 Broadcast Activity chart: sin mensaje de "sin actividad"**
Si no hay broadcasts en los últimos 30 días, el chart de "Broadcast Activity (30 days)" renderiza vacío (sin barras) pero sin ningún mensaje explicativo. El usuario no sabe si es un error de carga o si genuinamente no hay datos.

**🟡 "Top Campaigns by Engagement" sin paginación**
Si hay muchas campaigns, la tabla "Top Campaigns by Engagement" muestra todas sin scroll o paginación controlada. Con 20+ campaigns podría hacerse muy larga. El componente `Most Used Components` también lista sin límite.

**🟡 Stat card "Components" sin subtext en Global KPIs**
Los stat cards de KPIs globales tienen `sub` con contexto adicional (ej: "3 paused · 12 ended"), pero "Components" y "Sponsors" solo muestran el número sin subtext. Debería indicar algo como "X templates".

---

## 11. Resumen por Categoría

### 🔴 Críticos (requieren fix inmediato)

| # | Página | Issue |
|---|--------|-------|
| 1 | App Detail | `engagementRate` hardcodeado a **75%** como fallback |
| 2 | App Detail | "0 broadcasts" hardcodeado en lista de campaigns |
| 3 | Broadcast Detail | Progress bar del timeline siempre al **50%** |
| 4 | Broadcast Detail | Botones Play/Skip/Expand sin ninguna funcionalidad |
| 5 | Broadcast Detail | `topValues` array decorativo hardcodeado |

### 🟠 Importantes (afectan experiencia del operador)

| # | Página | Issue |
|---|--------|-------|
| 6 | Dashboard Home | Stats "Active Viewers" y "Engagement Rate" siempre `--`; ↑ % hardcodeados |
| 7 | Dashboard Home | "New Campaign" button lleva a la lista, no al formulario |
| 8 | Dashboard Home | "Upcoming Campaigns" muestra cualquier campaign si no hay upcoming |
| 9 | Apps | "Total Viewers" siempre 0 |
| 10 | App Detail | "Live Broadcasts" usa `broadcastCount` total, no live |
| 11 | App Detail | Icono `<Users>` usado para fecha de inicio |
| 12 | Campaigns | Países mostrados como código ISO (NO, SE) |
| 13 | Campaigns | Sponsor visible como imagen pero no como nombre/label |
| 14 | Broadcasts | Viewers leídos de `metadata` JSON en lugar de `viewerCount` |
| 15 | Broadcasts | Campo "Metadata JSON" expuesto al operador |
| 16 | Broadcasts | Modal de creación sin selector de partidos Sportmonks |
| 17 | Broadcast Detail | Live Chat activo en broadcasts Ended |
| 18 | Broadcast Detail | Shoppable Ads sin aviso cuando Commerce no está configurado |
| 19 | Campaign Detail | `locationId` no visible en la lista de components |
| 20 | Campaign Detail | Filtros de broadcast sin counter por estado |
| 21 | Sponsors | Sin página de detalle (`/sponsors/:id`) |
| 22 | Components | Sin preview de configuración en las cards |
| 23 | Analytics | "Engagement" en Sponsor Performance sin definición |
| 24 | Analytics | Geographic Distribution: métrica "campaigns" ambigua |

### 🟡 Menores (mejoras de polish)

| # | Página | Issue |
|---|--------|-------|
| 25 | Dashboard Home | Progress bar en app cards sin etiqueta |
| 26 | Dashboard Home | Botones Filter/Sort decorativos |
| 27 | Dashboard Home | "Components" en campaign cards siempre `--` |
| 28 | Apps | Botones "Edit" y "Settings" van al mismo lugar |
| 29 | Apps | `APP_GRADIENTS` duplicado en dos archivos |
| 30 | Apps | Bundle ID expuesto en la card de lista |
| 31 | App Detail | Stat cards sin background consistente |
| 32 | App Detail | Badge de status sin colores por estado |
| 33 | App Detail | Duplicación Quick Actions / Edit Details |
| 34 | Campaigns | Sin ordenamiento de lista |
| 35 | Campaigns | Sin toggle Pause/Resume inline |
| 36 | Campaign Detail | "Danger Zone" siempre visible sin collapse |
| 37 | Campaign Detail | Commerce API key: botón Save separado del auto-save del resto |
| 38 | Campaign Detail | Analytics carga lazy sin pre-fetch |
| 39 | Broadcasts | Icono Filter sin label ni funcionalidad |
| 40 | Broadcasts | `<BarChart3>` usado para viewers y polls en EndedBroadcastCard |
| 41 | Broadcasts | "New Broadcast" desactivado sin tooltip explicativo |
| 42 | Broadcast Detail | "Load Demo" button en producción |
| 43 | Broadcast Detail | viewerCount y peakViewers siempre 0 |
| 44 | Broadcast Detail | Poll results sin totales absolutos |
| 45 | Sponsors | Default colors azul/púrpura violan design system |
| 46 | Sponsors | Color swatches sin labels visibles |
| 47 | Sponsors | Description truncada solo expandible via "Edit" |
| 48 | Sponsors | Logo y Avatar sin labels diferenciadores |
| 49 | Components | Cards con h-48 fijo |
| 50 | Components | h1 manual dentro del AppLayout |
| 51 | Components | isTemplate comparado como string |
| 52 | Components | Filter set incompleto (faltan product_store, etc.) |
| 53 | Components | Botón "New Component" usa `<button>` nativo |
| 54 | Analytics | Sin subtítulo en la página |
| 55 | Analytics | useChartTheme() accede al DOM sin React state |
| 56 | Analytics | Drill-down "Back" sin destino explícito |
| 57 | Analytics | Broadcast Activity chart sin mensaje de vacío |
| 58 | Analytics | Top Campaigns sin paginación |
| 59 | Analytics | StatCards "Components" y "Sponsors" sin subtext |

---

*Generado mediante revisión de código fuente de `client/src/pages/` + `client/src/components/dashboard/` + navegación en browser.*
