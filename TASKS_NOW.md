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

---

## 🟡 #162 [BACKEND] Mover sponsorBadgeText de brand a sponsor

### Contexto
El SDK usa `sponsor.badgeText` para mostrar "Sponset av" / "Sponsored by" en el badge.
Actualmente el texto está en `brand.sponsorBadgeText` — debería estar en `sponsor` también
para que toda la data del sponsor esté en un único lugar.

### Cambio requerido en `server/routes.ts` o donde se construya el config

Añadir `badgeText` a la sección `sponsor` en la respuesta de `/v1/campaigns/:id/config`:

```json
"sponsor": {
    "id": 3,
    "name": "Elkjøp",
    "logoUrl": "...",
    "avatarUrl": "...",
    "primaryColor": "#f7b23b",
    "secondaryColor": "#f7b23b",
    "badgeText": {            ← AÑADIR ESTO
        "no": "Sponset av",
        "en": "Sponsored by",
        "sv": "Sponsrad av"
    }
}
```

### Notas
- Mantener `brand.sponsorBadgeText` también (no romper compatibilidad)
- El SDK ya tiene el fallback: lee `sponsor.badgeText` primero, fallback a `brand.sponsorBadgeText`
- Solo necesita añadirse al serializador/builder del config endpoint

### Criterio de aceptación
- [ ] `GET /v1/campaigns/35/config` devuelve `sponsor.badgeText` con textos localizados

---

## ℹ️ Contexto arquitectura sponsor (para referencia)

El SDK Swift usa una estructura `SponsorAssets` que centraliza todos los datos del sponsor:
- `sponsor.logoUrl` → badge "Sponset av Elkjøp"
- `sponsor.avatarUrl` → avatar circular en polls, contests, tweets
- `sponsor.primaryColor` → color acento (bordes, botones) — el SDK calcula contraste automáticamente
- `sponsor.secondaryColor` → color secundario
- `sponsor.badgeText` → texto localizado del badge

El app se despliega una sola vez y puede correr múltiples campañas con sponsors diferentes.
Todos los colores y assets del sponsor vienen del backend — nada hardcodeado en el SDK.
