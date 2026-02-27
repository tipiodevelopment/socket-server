# TASKS_NOW — Replit · socket-server
**Deadline: Lunes mañana**  
**Objetivo: Backend sólido para que el SDK cierre el loop de engagement. Demo lista para TV2 el miércoles.**

---

## 🔴 1. Verificar endpoint crítico ahora mismo

```bash
curl "https://api-dev.vio.live/v1/campaigns/28/config?apiKey=xxl_api_key_507d4014243d8360"
```

Debe devolver exactamente:
```json
{
  "brand": {
    "name": "XXL Sports",
    "logoUrl": "https://...",
    "iconUrl": "https://..."
  },
  "features": {
    "enablePolls": true,
    "enableContests": true,
    "enableChat": true
  },
  "integrations": {
    "commerce": {
      "enabled": true/false,
      "apiKey": "KCXF10Y-..." o null,
      "channelId": "..." o null
    }
  }
}
```

Si no devuelve esto exactamente → fixear antes de todo lo demás.

---

## 🔴 2. Verificar flujo contentId

```bash
curl "https://api-dev.vio.live/v1/sdk/broadcast?contentId=real-madrid-barcelona-2025-01-24&country=NO&apiKey=viaplay_api_key_0c611e983b314ff8"
```

Debe devolver `hasEngagement: true` + broadcastId + polls activos.

Si devuelve `hasEngagement: false` → verificar que el broadcast con ese `external_id` existe y está `live`.

---

## 🔴 3. Transacciones DB en votos — CRÍTICO para producción

**Archivo:** `server/services/vote-processor.ts`

```typescript
// Envolver en transacción Drizzle
await db.transaction(async (tx) => {
  // 1. Verificar que usuario no ha votado (dentro de tx)
  // 2. INSERT poll_votes
  // 3. UPDATE poll_options SET vote_count = vote_count + 1
  // 4. UPDATE polls SET total_votes = total_votes + 1
});
```

Sin transacción, si falla entre pasos 2 y 3, el voto queda registrado pero los contadores no se actualizan.

---

## 🔴 4. Crear campaña con sponsor Elkjøp para testing

En el dashboard:
1. Crear nueva campaña
2. Asignar sponsor: **Elkjøp** (ya existe en el sistema)
3. Crear un broadcast con `external_id = "real-madrid-barcelona-2025-01-24"`
4. Crear 2 polls activos en ese broadcast
5. Anotar el `campaignId` y el `apiKey` de la Client App aquí

Esto permite a Cursor y Viobot testear el loop completo.

---

## 🟡 5. Cleanup Tipio — ver CLEANUP_TIPIO.md

- `IntegrationsTab.tsx` → eliminar sección "Tipio.no Liveshow" o marcar como "coming soon"
- `advanced-campaign.tsx` → eliminar referencias a Tipio Integration
- `shared/schema.ts` → renombrar tipos exportados `TipioLivestream` → eliminar o renombrar (NO tocar el campo DB `tipio_livestream_data`)

---

## 🟡 6. Broadcast validator en todos los endpoints de engagement

Verificar que `validateBroadcastId` middleware está aplicado en:
- `POST /v1/engagement/polls/:pollId/vote`
- `POST /v1/engagement/contests/:contestId/participate`

---

## 🟡 7. Dashboard — asegurarse que fluye sin errores

El flujo que debe funcionar sin bugs para la demo:
```
Crear campaña → Asignar sponsor → Crear broadcast → Programar poll → Ver en SDK
```

Probar entero y reportar cualquier error de UI o API.

---

## ✅ Reglas mientras trabajas

- `integrations.commerce` (NO `integrations.tipio`) — ya corregido, mantener
- Legacy (`/v1/sdk/config`, `campaignId: 28`) debe seguir funcionando
- WebSocket events `broadcast_started/ended` se emiten en PUT — no crear endpoint separado
- Cada fix en un commit separado con mensaje claro

**Cuando termines cada tarea, súbela. Viobot revisa y coordina con Cursor.**
