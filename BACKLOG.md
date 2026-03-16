# BACKLOG — Vio.live
> Fuente de verdad de todas las tareas. Actualizado por Viobot.
> Lee también: VIO_TRUTH.md (nomenclatura y arquitectura), SPRINT.md (contexto técnico)

---

## Cómo usar este documento

- **IDs**: VIO-XXX — nunca se reutilizan
- **Estado**: 🔴 blocker · 🟡 en progreso · ⚪ pendiente · ✅ hecho
- **Propietario**: Replit (backend/dashboard) · Viobot/Claude (SDK Swift) · Alan (SDK Kotlin) · Viobot (infra/docs)
- Cuando termines una tarea → cambia el estado a ✅ y añade la fecha

---

## SPRINT ACTIVO — Semana 1 Mar

### VIO-003 · Replit · ⚪ pendiente
**Endpoint historial de chat por broadcast**

Por qué: Cuando el usuario abre el overlay a mitad del partido, debe ver los mensajes anteriores. Sin historial, el chat parece vacío aunque el WebSocket funcione.

Implementar:
  GET /v1/sdk/broadcasts/:broadcastId/chat?apiKey=...&limit=50
  → { broadcastId, messages: [...], count: N }

---

### VIO-004 · Replit · ✅ 2026-03-02
**Endpoint componentes por locationId**

`GET /v1/sdk/components?locationId=sport-detail-banner&apiKey=...&campaignId=35` operativo.
Dashboard con selector de location slot en "Add Component". `PATCH` endpoint acepta `locationId`.
Campaña 35: banner en sport-detail-banner, carousel en sport-detail-carousel.

---

### VIO-006 · Viobot · 🟡 en progreso
**Validar que branding del Sponsor se aplica en el overlay**

Verificado que llega brand=Elkjøp + logoUrl desde backend. Pendiente confirmar que se renderiza en el overlay en el Simulator.

---

### VIO-007 · Viobot · ✅ 2026-03-01
**Validar flujo contentId → hasEngagement → overlay**

contentId real-madrid-barcelona-2025-01-24 → hasEngagement:true → STEP 3 ✅ → STEP 4 WebSocket → STEP 5 loadEngagement.
Barcelona-PSG → hasEngagement:false → sin overlay. ✅

---

### VIO-008 · Viobot · ⚪ pendiente
**Conectar BackendMatchDataService en MatchHeaderView**

El header muestra 0-0 hardcodeado. Debe mostrar Real Madrid 2-1 Barcelona desde backend.
Archivo: Sources/VioCastingUI/Components/Match/MatchHeaderView.swift
Depende de: VIO-007 ✅

---

### VIO-009 · Viobot · ⚪ pendiente
**Chat en tab "All" mezclado con polls/contests**

Depende de: VIO-003 (endpoint historial chat)

---

## KOTLIN — FUERA DEL SPRINT ACTUAL
> No mezclar con el flujo Swift/backend hasta que esté estabilizado.

### VIO-010 · Alan · ⚪ pendiente (futuro)
**Migrar namespace io.reachu → live.vio en KotlinSDK (191 archivos)**
Cuando atacar: Después de que el flujo Swift + backend esté validado end-to-end.

---

## COMPLETADO

### VIO-025 · Replit · ✅ 2026-03-02
**#166: locationId en serializer /v1/sdk/campaigns**
- `locationId: cc.locationId || null` añadido al `map()` de componentes en `/v1/sdk/campaigns`
- Verificado: `RProductCarousel 1 → "sport-detail-carousel"`, `RProductBanner 1 → "sport-detail-banner"` ✅

---

### VIO-024 · Replit · ✅ 2026-03-02
**#165: Location Slot System — dashboard + API**
- `campaign_components.locationId` persistido en `POST /api/campaigns/:id/components`
- `PATCH /api/campaigns/:id/components/:componentId` acepta `locationId` sin requerir `status`
- `updateCampaignComponentLocationId()` añadido a IStorage + DatabaseStorage
- Dashboard: selector de 5 slots estándar en dialog "Add Component to Campaign"
- Campaña 35: `product-banner-template → sport-detail-banner`, `Elkjøp Carousel → sport-detail-carousel`
- Verificado: `?locationId=sport-detail-banner` → `product_banner` ✅, `?locationId=sport-detail-carousel` → `product_carousel` ✅

---

### VIO-023 · Replit · ✅ 2026-03-02
**#164: ProductBanner activado en campaña 35**
- `product-banner-template` actualizado: `productId: "408895"`, "Kampanjepris — Samsung Neo QLED", colores Elkjøp
- Activado en campaña 35 con `instanceName: "RProductBanner 1"`, `locationId: "sport-detail-banner"`
- Form ComponentsTab: placeholder `408895` y nota "ID del producto en Commerce. El título es editorial."

---

### VIO-022 · Replit · ✅ 2026-03-02
**#163: Commerce + ProductCarousel activados en campaña 35**
- Commerce API key `KCXF10Y-W5T4PCR-GG5119A-Z64SQ9S` → `integrations.commerce.enabled: true`
- Template "Elkjøp Product Carousel" creado con IDs `408841, 408874, 408895, 408896`
- Activo en campaña 35 con `instanceName: "RProductCarousel 1"`, `locationId: "sport-detail-carousel"`
- ComponentsTab: forms añadidos para `carousel_auto` (channelId + displayCount) y `product_store`
- `product_carousel` form: campo `channelId` añadido

---

### VIO-021 · Replit · ✅ 2026-03-02
**#162: sponsor.badgeText en config endpoint**
- `sponsor.badgeText` añadido a `/v1/campaigns/:id/config` con textos localizados ✅
- `brand.sponsorBadgeText` mantenido para compatibilidad ✅
- Verificado: `{ "no": "Sponset av", "en": "Sponsored by", "sv": "Sponsrad av" }` ✅

### VIO-020 · Replit · ✅ 2026-03-02
**#160: broadcastId en eventos WebSocket + estado inicial al conectar**

- `pollEventSchema` y `contestEventSchema` incluyen `broadcastId?: string` ✅
- `/api/events/poll`, `/api/events/contest`, `/api/campaigns/:id/events` → pasan `broadcastId` del request ✅
- EventsTab auto-detecta el broadcast live y lo incluye en las peticiones de poll/contest ✅
- Al conectar `/ws/:campaignId` → se emiten polls/contests activos del broadcast live con `broadcastId` ✅
- Verificado: conectar a /ws/35 entrega inmediatamente 2 polls con `broadcastId: "real-madrid-vs-barcelona-2026-02-25"` ✅

### VIO-003 · Replit · ✅ verificado 2026-03-02
GET /v1/sdk/broadcasts/:broadcastId/chat operativo — verificado en producción.

### VIO-004 · Replit · ✅ verificado 2026-03-02
GET /v1/sdk/components?locationId= operativo — verificado en producción.

### VIO-001 · Replit · ✅ 2026-02-28
Status buttons "Go Live" / "End" en lista de broadcasts del dashboard.

### VIO-002 · Replit · ✅ 2026-02-28
/v1/campaigns/:id/config devuelve brand=Elkjøp, logoUrl, commerce.enabled. Verificado.

### VIO-005 · Viobot · ✅ 2026-03-01
discoverCampaigns(broadcastId: nil) en ViaplayApp.swift al launch. 1 campaign encontrada.

### VIO-007 · Viobot · ✅ 2026-03-01
contentId flow completo — STEP 1-5 verificados en Simulator.

### VIO-011 · Viobot · ✅ 2026-02-27
Fix 401 ConfigAPIClient.swift — usa Vio App API Key.

### VIO-012 · Viobot · ✅ 2026-02-27
Tipio eliminado del SDK Swift.

### VIO-013 · Viobot · ✅ 2026-02-27
BackendMatchDataService — score/stats/polling fallback 30s.

### VIO-014 · Viobot · ✅ 2026-02-27
BroadcastTeam en modelos — homeTeam/awayTeam en BroadcastValidationResult.

### VIO-015 · Replit · ✅ 2026-02-27
Endpoints match data — /score, /stats, /livescores operativos.

### VIO-016 · Replit · ✅ 2026-02-27
Chat y tweets via WebSocket.

### VIO-017 · Replit · ✅ 2026-02-28
Health check + deploy en autoscale.

### VIO-018 · Viobot · ✅ 2026-02-28
VIO_TRUTH.md v5 — Tipio eliminado, flujo paso a paso.

### VIO-019 · Viobot · ✅ 2026-03-01
Memory leaks corregidos:
- NSCache límites en VioDesignSystem/CachedAsyncImage + GraphQLOpsSingleFile
- monitorPlayerStatus Timer: guardado en controlsTimer, [weak item, weak self]
- startCountdown Timer: @State countdownTimer, [weak self], .onDisappear invalida
- HighlightVideoCard: token guardado en @State loopToken, removeObserver(token) correcto
- BroadcastContextSetup: guard isSettingUp contra llamadas concurrentes SwiftUI
- refreshCampaignsForContext: guard activeCampaigns.isEmpty evita loop infinito

---

## DATOS DE DEMO

| Campo | Valor |
|-------|-------|
| apiKey Viaplay | viaplay_api_key_0c611e983b314ff8 |
| campaignId | 35 |
| contentId | real-madrid-barcelona-2025-01-24 |
| broadcastId | real-madrid-vs-barcelona-2026-02-25 |
| país | NO |
| Score demo | Real Madrid 2 - 1 Barcelona, min 65 |
| Sponsor | Elkjøp |
| Polls activos | 15 (¿Quién ganará?) + 16 (¿Quién marcará el primer gol?) |
| Campaña expira | 2026-03-04 |

---

_Actualizado: 2026-03-01 21:42 Oslo · Viobot_
