# TASK-UI-06 — Fix: guardar videoStartTime en polls/contests sin broadcastStartTime

## Problema

`POST /api/broadcasts/:id/polls` y `POST /api/broadcasts/:id/contests` solo guardan `videoStartTime`/`videoEndTime` si también se pasa `broadcastStartTime`. Si no hay `broadcastStartTime`, los campos se ignoran y el poll queda sin minuto en la timeline.

Además, `PUT /api/polls/:pollId` no acepta `videoStartTime`/`videoEndTime` en absoluto.

## Fix requerido

### 1. `POST /api/broadcasts/:id/polls` — guardar videoStartTime siempre

```typescript
// ANTES (solo guarda si hay broadcastStartTime)
if (videoStartTime !== undefined && videoEndTime !== undefined && broadcastStartTime) {
  pollData.videoStartTime = videoStartTime;
  pollData.videoEndTime = videoEndTime;
  // scheduling logic...
}

// DESPUÉS — guardar videoStartTime aunque no haya broadcastStartTime
if (videoStartTime !== undefined) pollData.videoStartTime = videoStartTime;
if (videoEndTime !== undefined) pollData.videoEndTime = videoEndTime;

// Scheduling calculado solo si hay broadcastStartTime
if (videoStartTime !== undefined && videoEndTime !== undefined && broadcastStartTime) {
  const scheduled = calculateScheduledTimes({ broadcastStartTime, videoStartTime, videoEndTime });
  pollData.broadcastStartTime = new Date(broadcastStartTime);
  pollData.scheduledStartTime = scheduled.scheduledStart;
  pollData.scheduledEndTime = scheduled.scheduledEnd;
}
```

### 2. `PUT /api/polls/:pollId` — añadir videoStartTime/videoEndTime

```typescript
// ANTES
const { question, isActive, duration, startTime, endTime } = req.body;

// DESPUÉS
const { question, isActive, duration, startTime, endTime, videoStartTime, videoEndTime } = req.body;
const updateData: any = {};
if (question !== undefined) updateData.question = question;
if (isActive !== undefined) updateData.isActive = isActive;
if (duration !== undefined) updateData.duration = duration ?? null;
if (startTime !== undefined) updateData.startTime = startTime ? new Date(startTime) : null;
if (endTime !== undefined) updateData.endTime = endTime ? new Date(endTime) : null;
if (videoStartTime !== undefined) updateData.videoStartTime = videoStartTime;
if (videoEndTime !== undefined) updateData.videoEndTime = videoEndTime;
```

### 3. Mismo fix para `POST /api/broadcasts/:id/contests` y `PUT /api/contests/:id`

Misma lógica: guardar `videoStartTime`/`videoEndTime` independientemente de `broadcastStartTime`.

## Por qué importa

`videoStartTime` (en segundos) es el que el dashboard usa para posicionar los puntos en la **Event Timeline**. Sin él, todos los polls/contests aparecen como "manual" y la timeline queda vacía.

Ejemplo: `videoStartTime: 2100` = minuto 35 del partido.

## Archivos a modificar

- `server/routes.ts` — rutas POST/PUT de polls y contests (aprox líneas 3408-3490, 3514-3560)

## Test

```bash
# Crear poll con videoStartTime, sin broadcastStartTime
curl -X POST https://api-dev.vio.live/api/broadcasts/test/polls \
  -H "Content-Type: application/json" \
  -d '{"question":"Test","options":["A","B"],"videoStartTime":2100,"videoEndTime":2190}'

# Respuesta debe incluir: "videoStartTime": 2100

# Update con PUT
curl -X PUT https://api-dev.vio.live/api/polls/67 \
  -H "Content-Type: application/json" \
  -d '{"videoStartTime":60,"videoEndTime":150}'

# Respuesta debe incluir: "videoStartTime": 60
```
