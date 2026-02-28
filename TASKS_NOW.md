# TASKS_NOW — Replit
> Actualizado: 2026-02-28 17:30 Oslo · por Viobot
> Lee también: SPRINT.md (arquitectura), VIO_TRUTH.md (naming y reglas)

---

## 🎯 Contexto — por qué existe este proyecto

**Vio.live** es una segunda pantalla para eventos deportivos.

El usuario ve el partido en TV. En el móvil tiene la app de Viaplay o TV2 con el SDK de Vio integrado. Cuando el partido tiene engagement activo, aparece un overlay con polls, contests, chat y score en tiempo real. En el momento de máxima emoción (un gol, una jugada clave) puede aparecer un producto comprable — una camiseta, una apuesta, lo que sea. El timing lo es todo.

**Por qué importa el dashboard:**
El dashboard es la herramienta del operador de Vio — la persona que durante el partido gestiona qué se muestra y cuándo. Crea los broadcasts, programa los polls, activa los componentes. Si el dashboard tiene huecos, el operador no puede trabajar. Si el operador no puede trabajar, la demo no funciona. Si la demo no funciona, no hay deal con Viaplay ni TV2.

**Dónde estamos ahora:**
Angelo está probando el SDK de iOS en Xcode conectándolo al backend real por primera vez. Vamos paso a paso — primero que cargue la campaña, luego el branding del sponsor, luego el broadcast, luego los polls. Cada paso que funciona es un paso más cerca de poder mostrarle esto a Viaplay y TV2.

**El flujo que debe funcionar:**
```
1. App launch → GET /v1/sdk/campaigns → campaña activa
2. GET /v1/campaigns/:id/config → branding del Sponsor (logo Elkjøp)
3. Usuario abre stream → GET /v1/sdk/broadcast?contentId=real-madrid-barcelona-2025-01-24&country=NO
4. hasEngagement: true → mostrar overlay de engagement
5. WebSocket /ws/35 → polls/contests/chat/score en tiempo real
```

Hoy Angelo está probando el SDK en Xcode. Vamos encontrando huecos y los documentamos aquí para que Replit los resuelva. No es crítica — es proceso normal de integración.

---

## ✅ Estado actual del backend (verificado 17:28 Oslo)

```
GET /health → {"status":"ok"} ✅
GET /v1/sdk/campaigns?apiKey=viaplay_api_key_0c611e983b314ff8
  → campaña 35 activa, endDate: 2026-03-04 ✅
GET /v1/sdk/broadcast?contentId=real-madrid-barcelona-2025-01-24&country=NO&apiKey=...
  → hasEngagement: true, status: live, 2 polls activos ✅
GET /v1/sdk/broadcasts/real-madrid-vs-barcelona-2026-02-25/score?apiKey=...
  → Real Madrid 2-1 Barcelona, min 65 ✅
```

---

## 🔴 TAREA 1 — Editar status de broadcast desde el dashboard (BLOQUEANTE)

**Por qué importa:**
El operador necesita controlar cuándo un broadcast está "live". Si no puede cambiarlo desde el dashboard, tiene que pedirle a un desarrollador que lo haga via curl — eso es inaceptable en una demo con Viaplay o TV2. El operador debe poder:
- Marcar un broadcast como `live` cuando empieza el partido
- Marcarlo como `ended` cuando termina
- Cambiar su estado si hay algún error

Hoy Angelo no pudo hacerlo y el broadcast estaba `ended` con fecha pasada. Viobot lo tuvo que corregir via API directamente.

**Problema encontrado hoy:** Desde el dashboard no se puede cambiar el status de un broadcast (live/upcoming/ended). Angelo intentó hacerlo y no pudo. Viobot tuvo que hacerlo via curl.

**Fix requerido:** En la página de detalle del broadcast (`/broadcasts/:broadcastId`) o en el dialog de edición del broadcast, añadir un select/toggle para cambiar el status.

**Campos que debe tener el dialog de edición de broadcast:**
- `name` ✅ (ya existe)
- `externalId` ✅ (ya existe)  
- `status` → select con opciones: `upcoming`, `live`, `ended` ← **FALTA ESTO**
- `startTime` ✅ (ya existe)
- `endTime` ✅ (ya existe)

**Cuando status cambia a `live`:**
- Emitir WS event `broadcast_started` a `/ws/:campaignId`
- Actualizar `status` en DB

**Cuando status cambia a `ended`:**
- Emitir WS event `broadcast_ended` a `/ws/:campaignId`

**Archivos a modificar:**
- `client/src/components/dashboard/` → el dialog de edición de broadcast
- `client/src/pages/broadcast-detail.tsx` → botones de control de status

---

## 🔴 TAREA 2 — Verificar que /v1/campaigns/:id/config devuelve branding correcto

**Por qué importa:**
El branding del sponsor (Elkjøp) es lo primero que ve el usuario cuando abre el overlay de Vio. Si el logo no carga o es incorrecto, la demo se ve rota. Viaplay necesita ver que el sistema de branding funciona — es parte del valor que vendemos: cada cliente ve su sponsor con su logo y colores, dinámicamente desde el backend.

El SDK llama a este endpoint al inicializar para obtener el logo del sponsor (Elkjøp).

**Verificar que devuelve:**
```json
{
  "brand": {
    "name": "Elkjøp",
    "logoUrl": "https://api-dev.vio.live/objects/uploads/adc65620-01ff-4c66-a7e2-de456495b9d1",
    "iconUrl": "..."
  },
  "features": { "enablePolls": true, "enableContests": true, "enableChat": true },
  "integrations": {
    "commerce": { "enabled": false, "apiKey": null, "channelId": null }
  }
}
```

**Test:**
```bash
curl "https://api-dev.vio.live/v1/campaigns/35/config?apiKey=viaplay_api_key_0c611e983b314ff8"
```

Si no devuelve `brand.logoUrl` con la URL de Elkjøp → el SDK no va a mostrar el logo del sponsor.

---

## 🟡 TAREA 3 — Historial de chat en el broadcast

**Por qué importa:**
Cuando un usuario abre el overlay de engagement a mitad del partido, debe ver los mensajes de chat anteriores — no una pantalla vacía. Es lo mismo que cuando abres WhatsApp: ves el historial, no empiezas de cero. Sin este endpoint, el chat parece roto aunque el WebSocket funcione perfectamente.

El SDK va a llamar a este endpoint cuando el usuario abra el overlay de engagement:

```
GET /v1/sdk/broadcasts/:broadcastId/chat?apiKey=...
```

**Implementar si no existe:**
```typescript
app.get('/v1/sdk/broadcasts/:broadcastId/chat', validateApiKey, async (req, res) => {
  const { broadcastId } = req.params;
  const limit = parseInt(req.query.limit as string) || 50;
  const messages = await storage.getChatMessages(broadcastId, { limit });
  res.json({ broadcastId, messages, count: messages.count });
});
```

---

## 🟡 TAREA 4 — Componentes por locationId

**Por qué importa:**
Los componentes (banners, countdown, carrusel de productos) son la capa de monetización. El desarrollador de Viaplay define en su código dónde pueden aparecer estos componentes — "aquí puede ir un banner", "aquí un countdown". El backend decide qué mostrar en cada slot. Sin este endpoint, los componentes nunca llegan al SDK aunque estén activos en el dashboard.

El SDK pide componentes filtrando por locationId (el desarrollador define slots en el código):

```
GET /v1/sdk/components?locationId=sport-banner&apiKey=...&campaignId=35
```

Si no existe este endpoint → los componentes de campaña (banners, countdown) no se muestran.

---

## 📋 DATOS DE DEMO (no tocar)

| Campo | Valor |
|-------|-------|
| apiKey Viaplay | `viaplay_api_key_0c611e983b314ff8` |
| campaignId | 35 |
| contentId | `real-madrid-barcelona-2025-01-24` |
| broadcastId | `real-madrid-vs-barcelona-2026-02-25` |
| país | `NO` |
| Score | Real Madrid 2 - Barcelona 1, min 65 |
| Polls activos | 15 (¿Quién ganará?) + 16 (¿Quién marcará el primer gol?) |

---

## ⛔ REGLAS — no romper

- `campaignId: 28` (demo XXL) → sigue funcionando
- `/v1/sdk/config` → no cambiar estructura de respuesta
- `integrations.commerce` → nunca renombrar a tipio
- El nombre del campo en DB puede seguir siendo `reachuApiKey` pero en la API siempre se expone como `integrations.commerce`

---

_Actualizado: 2026-02-28 17:30 Oslo · Viobot_
