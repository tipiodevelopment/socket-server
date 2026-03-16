# REPLIT_CONTEXT.md — Para Replit (Backend + Dashboard)

Hola Replit. Este documento es tu contexto de trabajo para el backend de Vio.live.

Lee también: `VIO_TRUTH.md` — es la fuente absoluta de verdad del sistema.

---

## Quién eres y qué haces

Trabajas sobre el repositorio:
- **socket-server** (`tipiodevelopment/socket-server`) — backend Node.js + dashboard React
- URL producción: `https://api-dev.vio.live`

Tu trabajo: mantener el backend estable, implementar los pendientes críticos, y asegurar que el SDK de iOS pueda integrarse con Viaplay y TV2 sin problemas.

---

## Estado actual (commit c367da2)

### Lo que está funcionando bien
- contentId → broadcastId resolution (`GET /v1/sdk/broadcast`)
- Rate limiting en votos y contests
- Video scheduling automático (polls/contests se activan solos)
- Queue adapter pattern (SimpleQueue ahora, BullMQ con Redis para prod)
- WebSocket events automáticos en cambios de broadcast status
- Commerce key entregada dinámicamente en `/v1/campaigns/:id/config`

---

## Pendientes críticos (priorizados)

### 🔴 CRÍTICO — Transacciones DB en votos
Los votos pueden quedar inconsistentes si falla un write a mitad.

El flujo actual en `vote-processor.ts`:
1. Verificar que usuario no ha votado
2. Crear voto en `poll_votes`
3. Incrementar `poll_options.vote_count`
4. Incrementar `polls.total_votes`

Si falla entre pasos 2 y 3, el voto queda registrado pero los contadores no se actualizan.

**Fix necesario:** Envolver los pasos 2-4 en una transacción Drizzle:
```typescript
await db.transaction(async (tx) => {
  // insert poll_vote
  // update poll_options vote_count
  // update polls total_votes
});
```

### 🟡 IMPORTANTE — Validación de broadcastId
El middleware `broadcast-validator.ts` existe pero no está aplicado en todos los endpoints de engagement.

Verificar que está activo en:
- `POST /v1/engagement/polls/:pollId/vote`
- `POST /v1/engagement/contests/:contestId/participate`
- `GET /v1/engagement/polls`
- `GET /v1/engagement/contests`

### 🟡 IMPORTANTE — Confirmar Commerce key en config endpoint
El SDK de iOS espera esta estructura exacta en `/v1/campaigns/:id/config`:
```json
{
  "integrations": {
    "commerce": {
      "enabled": true,
      "apiKey": "KCXF10Y-...",
      "channelId": "channel-id"
    }
  }
}
```
Si la campaña no tiene Commerce configurado, debe devolver `enabled: false` con `apiKey: null`. Confirmar que esto está correcto.

---

## Reglas que siempre debes respetar

1. **`external_id` en broadcasts** = contentId del partner (Viaplay stream ID). No renombrar.
2. **Branding desde Sponsor** — `/v1/campaigns/:id/config` siempre devuelve `brand` desde el Sponsor vinculado, con fallback a campos legacy `campaign.brand_*`
3. **WebSocket events automáticos** — `broadcast_started` / `broadcast_ended` se emiten en PUT de broadcast. No crear endpoint separado.
4. **Rate limiting activo** — 30 req/min votos, 10 req/min contests. No desactivar.
5. **`integrations.commerce` siempre presente** en la respuesta de config (aunque `enabled: false`)

---

## Preguntas para ti, Replit

1. ¿Las transacciones DB están implementadas en algún endpoint o todo es sin transacciones por ahora?
2. ¿El campo `integrations.commerce` se está devolviendo correctamente en `/v1/campaigns/:id/config`? El SDK de iOS recibe 401 cuando llama con `apiKey=KCXF10Y-...` — ¿puede ser que esa key no esté registrada como válida en `client_apps`?
3. ¿Hay planes de mover el backend a producción real (fuera de Replit)? ¿Cuándo?
4. ¿Qué cambios recientes en los commits `c367da2`, `7a8f246`, `1b99c7d` afectan al SDK de iOS que debamos reflejar en el cliente?
5. ¿Hay algo en el backend que veas que no esté documentado aquí y que el SDK debería conocer?

Cuéntanos lo que ves. Angelo toma las decisiones finales.
