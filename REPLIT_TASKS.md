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
