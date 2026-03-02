# TASKS_NOW — socket-server

_Actualizado: 2026-03-02 · Viobot_

---

## 🔴 URGENTE — #160: WebSocket: añadir broadcastId a eventos poll/contest/score

### Contexto
El SDK Swift necesita saber a qué broadcast corresponde cada evento WebSocket.
Actualmente los eventos `poll` y `contest` no llevan `broadcastId` — el SDK no puede filtrar.

### Cambios requeridos

#### 1. `shared/schema.ts` — añadir broadcastId al schema
\`\`\`ts
export const pollEventSchema = z.object({
  id: z.number().optional(),
  type: z.literal("poll"),
  broadcastId: z.string().optional(), // ← AÑADIR
  data: z.object({ ... }),
  campaignLogo: z.string().optional(),
  timestamp: z.number()
});

// Igual para contestEventSchema y score events
\`\`\`

#### 2. `server/routes.ts` — incluir broadcastId al emitir poll
\`\`\`ts
const pollEvent: WebSocketEvent = {
  type: 'poll',
  broadcastId: req.body.broadcastId, // ← AÑADIR
  data: { ... },
  campaignLogo: ...,
  timestamp: Date.now()
};
\`\`\`

#### 3. Al conectar WebSocket — emitir estado inicial
Cuando un cliente conecta a `/ws/:campaignId`, si hay un broadcast activo,
emitir los polls/contests activos de ese broadcast para que el SDK tenga estado inicial:
\`\`\`ts
// En wss.on('connection', ...)
const activeBroadcast = await storage.getActiveBroadcastForCampaign(campaignId);
if (activeBroadcast) {
  const polls = await storage.getBroadcastPolls(activeBroadcast.broadcastId);
  polls.forEach(poll => {
    ws.send(JSON.stringify({
      type: 'poll',
      broadcastId: activeBroadcast.broadcastId,
      data: poll,
      timestamp: Date.now()
    }));
  });
}
\`\`\`

### Criterio de aceptación
- [ ] Evento `poll` incluye `broadcastId`
- [ ] Evento `contest` incluye `broadcastId`
- [ ] Al conectar, cliente recibe polls/contests activos del broadcast actual
- [ ] Tests pasan
