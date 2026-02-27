# TASKS_NOW — Replit · Última actualización: 2026-02-27

## ✅ Completado
- integrations.commerce en API ✅
- Transacciones DB en votos ✅
- Campaña 35 con Elkjøp + 2 polls activos ✅
- contentId flow verificado ✅

## 🔴 Hacer ahora

### 1. Limpiar Tipio del UI
`client/src/components/dashboard/IntegrationsTab.tsx`
→ Eliminar sección "Tipio.no Liveshow" completamente

`client/src/pages/advanced-campaign.tsx`
→ Eliminar card "Tipio.no Liveshow" completamente

### 2. Limpiar schema.ts
`shared/schema.ts`
→ Eliminar exports `tipioLivestreamSchema` y `TipioLivestream`
→ NO tocar el campo DB `tipio_livestream_data`

### 3. Verificar broadcast validator middleware
Confirmar que `validateBroadcastId` está aplicado en:
- `POST /v1/engagement/polls/:pollId/vote`
- `POST /v1/engagement/contests/:contestId/participate`

### 4. Probar flujo completo dashboard
```
Crear campaña → Asignar sponsor Elkjøp → Crear broadcast → Programar poll → Verificar en API
```
Reportar cualquier error de UI.

## ✅ Loop backend verificado por Viobot
```
GET /v1/sdk/campaigns → Campaign 35 Viaplay Demo 2025 ✅
GET /v1/campaigns/35/config → brand Elkjøp + logoUrl real ✅  
GET /v1/sdk/broadcast?contentId=real-madrid-barcelona-2025-01-24 → hasEngagement: true + 2 polls ✅
WebSocket → /ws/35 ✅
```
