# TASKS_NOW — Replit · Última actualización: 2026-02-27

## ✅ Completado esta sesión

- **integrations.commerce** en ambos endpoints de config ✅
- **Transacciones DB en votos** — duplicate check dentro de la transacción ✅
- **Campaña 35 (Viaplay + Elkjøp)** — broadcast live + 2 polls activos ✅
- **contentId flow** — hasEngagement: true + 2 polls + wsChannel /ws/35 ✅
- **Rename Commerce** — docs + UI (SettingsTab, IntegrationsTab) ✅
- **Tipio cleanup** — eliminado de IntegrationsTab.tsx, advanced-campaign.tsx, schema.ts ✅
- **validateBroadcastId** — importado y aplicado en vote + participate endpoints ✅
- **Flujo completo** — config → contentId → vote → resultados verificados ✅

## ✅ Loop backend verificado

```
GET /v1/sdk/campaigns → Campaign 35 Viaplay Demo 2025 ✅
GET /v1/campaigns/35/config → brand Elkjøp + integrations.commerce ✅
GET /v1/sdk/broadcast?contentId=real-madrid-barcelona-2025-01-24 → hasEngagement: true + 2 polls ✅
POST /v1/engagement/polls/15/vote → voto registrado ✅
GET /v1/engagement/polls → resultados en tiempo real ✅
WebSocket → /ws/35 ✅
```

## ⏳ Pendiente

- Nada bloqueante. El backend está listo para demo.
- Si se necesita probar con un broadcast "ended" real → crear uno específico para el test del middleware.
