---
name: check-ws-events
description: Valida que todos los eventos WebSocket sigan el formato correcto del contrato VIO_TRUTH
user-invocable: true
---

Verifica que todos los eventos WebSocket del backend sigan el contrato definido en `VIO_TRUTH.md`.

## Formato requerido

Todos los eventos deben seguir: `{ type: "event_name", data: {...} }`

Eventos con broadcasts deben incluir `broadcastId`.

## Pasos

1. Busca todas las llamadas a `broadcastToCampaign()` y `broadcastToApp()` en `server/routes.ts` y `server/scheduler.ts`
2. Para cada llamada, extrae el JSON que se envia
3. Verifica contra el contrato de VIO_TRUTH.md:
   - `broadcast_started` / `broadcast_ended` — deben incluir broadcastId
   - `poll` — debe incluir `{ type: 'poll', broadcastId, data: { id, question, options, duration } }`
   - `contest` — debe incluir `{ type: 'contest', broadcastId, id, title, description, prize, imageUrl }`
   - `poll_results_updated` — debe incluir `{ type: 'poll_results_updated', broadcastId, pollId, results }`
   - `component_status_changed` — debe incluir `{ type: 'component_status_changed', componentId, status, component }`
   - `lineup_show` — debe incluir broadcastId
   - `campaign_ended` — debe incluir campaignId
4. Verifica que en la conexion WS inicial se emiten polls y contests activos con broadcastId
5. Genera reporte:
   - Total de eventos encontrados
   - Eventos que no siguen el formato
   - Eventos sin broadcastId donde deberian tenerlo
   - Eventos no documentados en VIO_TRUTH.md
