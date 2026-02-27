# TASKS_NOW — Replit · socket-server
**Deadline: Lunes mañana**  
**Objetivo: Backend sólido para que el SDK cierre el loop de engagement. Demo lista para TV2 el miércoles.**

---

## ✅ 1. Verificar endpoint crítico — HECHO

`GET /v1/campaigns/28/config?apiKey=xxl_api_key_507d4014243d8360`  
Devuelve `integrations.commerce` con `enabled`, `apiKey`, `channelId`. ✓

---

## ✅ 2. Verificar flujo contentId — HECHO

`GET /v1/sdk/broadcast?contentId=real-madrid-barcelona-2025-01-24&country=NO&apiKey=viaplay_api_key_0c611e983b314ff8`  
Devuelve `hasEngagement: true` + broadcastId + 2 polls activos. ✓

---

## ✅ 3. Transacciones DB en votos — HECHO

`createPollVoteWithCountUpdate` en `server/storage.ts` ahora verifica el voto duplicado **dentro** de la transacción Drizzle, eliminando la race condition. ✓

---

## ✅ 4. Datos de test con Elkjøp — HECHO

- Broadcast `real-madrid-vs-barcelona-2026-02-25` en campaña 35 (Viaplay Demo 2025, sponsor Elkjøp)
- Status: `live`, end_time: 3h desde ahora (27/02/2026)
- External ID: `real-madrid-barcelona-2025-01-24`
- Poll 15: "¿Quién ganará el partido?" (3 opciones)
- Poll 16: "¿Quién marcará el primer gol?" (4 opciones)
- API key para test: `viaplay_api_key_0c611e983b314ff8` ✓

---

## ✅ 5. Rename Commerce / documentación — HECHO

- `integrations.commerce` en API (NO `integrations.tipio`)
- UI SettingsTab: "Commerce Integration"
- Docs actualizados: `CURSOR_SDK_INFRASTRUCTURE.md`, `.cursorrules`, `DASHBOARD_FLOWS.md`, `replit.md` ✓

---

## 🟡 6. Broadcast validator en endpoints de engagement

Verificar que `validateBroadcastId` middleware está aplicado en:
- `POST /v1/engagement/polls/:pollId/vote`
- `POST /v1/engagement/contests/:contestId/participate`

---

## 🟡 7. Dashboard — flujo sin errores para demo

```
Crear campaña → Asignar sponsor → Crear broadcast → Programar poll → Ver en SDK
```

Probar entero y reportar cualquier error de UI o API.

---

## ❓ PREGUNTAS PENDIENTES — necesitan respuesta antes de continuar

**P1 — Cleanup Tipio en UI (archivos frontend):**

Los siguientes archivos aún muestran referencias a "Tipio.no Liveshow" que son visibles para el usuario:
- `client/src/components/dashboard/IntegrationsTab.tsx` — sección "Tipio.no Liveshow" con datos del livestream
- `client/src/pages/advanced-campaign.tsx` — Card "Tipio.no Liveshow"

¿Elimino estas secciones del UI, o las reemplazo con un placeholder "coming soon"?

**P2 — `tipioLivestreamSchema` en schema.ts:**

`shared/schema.ts` exporta `tipioLivestreamSchema` y `TipioLivestream` (tipos que ya no se usan en ningún lado). El campo DB `tipio_livestream_data` se mantiene.

¿Elimino los exports del schema (limpieza de código sin tocar la DB)?

---

## ✅ Reglas mientras trabajas

- `integrations.commerce` (NO `integrations.tipio`) — ya corregido, mantener
- Legacy (`/v1/sdk/config`, `campaignId: 28`) debe seguir funcionando
- WebSocket events `broadcast_started/ended` se emiten en PUT — no crear endpoint separado
- Cada fix en un commit separado con mensaje claro

**Cuando termines cada tarea, súbela. Viobot revisa y coordina con Cursor.**
