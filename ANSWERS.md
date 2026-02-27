# Respuestas de Angelo — 2026-02-27

## P1 — Tipio UI en IntegrationsTab y advanced-campaign.tsx
**Respuesta: Sí, eliminar completamente.**
No dejar "coming soon". Fuera del scope actual. Limpiar del todo.

## P2 — tipioLivestreamSchema y TipioLivestream en schema.ts
**Respuesta: Sí, eliminar los exports.**
El campo DB `tipio_livestream_data` se mantiene. Solo limpiar los tipos exportados que ya no se usan.

## Próximo paso
Con estas limpiezas hecho, verificar el flujo completo:
```
GET /v1/sdk/campaigns → GET /v1/campaigns/35/config → GET /v1/sdk/broadcast?contentId=real-madrid-barcelona-2025-01-24 → WebSocket /ws/35
```
Confirmar que todo devuelve datos correctos y subir.
