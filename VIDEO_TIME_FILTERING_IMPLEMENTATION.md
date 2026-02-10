# Implementación de Filtrado por Video Time - Socket Server

**Fecha:** 2026-01-23  
**Objetivo:** Agregar soporte para filtrar polls y contests por tiempo de video en los endpoints SDK

---

## Cambios Requeridos

### 1. Modificar `server/routes.ts` - Endpoint GET `/v1/engagement/polls`

**Ubicación:** Línea ~2568

**Código Actual:**
```typescript
app.get('/v1/engagement/polls', async (req, res) => {
  try {
    const broadcastId = req.query.broadcastId as string;
    if (!broadcastId) {
      return res.status(400).json({ message: 'broadcastId query parameter is required' });
    }
    const pollsList = await storage.getBroadcastPolls(broadcastId);
    const pollsWithPercentages = pollsList.map(poll => {
      const totalVotes = poll.totalVotes;
      const options = poll.options.map(opt => ({
        ...opt,
        percentage: totalVotes > 0 ? Math.round((opt.voteCount / totalVotes) * 10000) / 100 : 0
      }));
      return { ...poll, options };
    });
    res.json(pollsWithPercentages);
  } catch (error) {
    console.error('Error getting polls:', error);
    res.status(500).json({ message: 'Error getting polls' });
  }
});
```

**Código Modificado:**
```typescript
app.get('/v1/engagement/polls', async (req, res) => {
  try {
    const broadcastId = req.query.broadcastId as string;
    const videoTime = req.query.videoTime ? parseInt(req.query.videoTime as string, 10) : undefined;
    
    if (!broadcastId) {
      return res.status(400).json({ message: 'broadcastId query parameter is required' });
    }
    
    let pollsList = await storage.getBroadcastPolls(broadcastId);
    
    // Filtrar por videoTime si está presente
    if (videoTime !== undefined && !isNaN(videoTime)) {
      pollsList = pollsList.filter(poll => {
        // Si tiene video scheduling, usar esos campos
        if (poll.videoStartTime !== null && poll.videoEndTime !== null) {
          return videoTime >= poll.videoStartTime && videoTime < poll.videoEndTime;
        }
        // Si no tiene video scheduling, usar isActive
        return poll.isActive;
      });
    } else {
      // Si no hay videoTime, filtrar solo por isActive
      pollsList = pollsList.filter(poll => poll.isActive);
    }
    
    const pollsWithPercentages = pollsList.map(poll => {
      const totalVotes = poll.totalVotes;
      const options = poll.options.map(opt => ({
        ...opt,
        percentage: totalVotes > 0 ? Math.round((opt.voteCount / totalVotes) * 10000) / 100 : 0
      }));
      return { ...poll, options };
    });
    res.json(pollsWithPercentages);
  } catch (error) {
    console.error('Error getting polls:', error);
    res.status(500).json({ message: 'Error getting polls' });
  }
});
```

---

### 2. Modificar `server/routes.ts` - Endpoint GET `/v1/engagement/contests`

**Ubicación:** Línea ~2628

**Código Actual:**
```typescript
app.get('/v1/engagement/contests', async (req, res) => {
  try {
    const broadcastId = req.query.broadcastId as string;
    if (!broadcastId) {
      return res.status(400).json({ message: 'broadcastId query parameter is required' });
    }
    const contestsList = await storage.getBroadcastContests(broadcastId);
    res.json(contestsList);
  } catch (error) {
    console.error('Error getting contests:', error);
    res.status(500).json({ message: 'Error getting contests' });
  }
});
```

**Código Modificado:**
```typescript
app.get('/v1/engagement/contests', async (req, res) => {
  try {
    const broadcastId = req.query.broadcastId as string;
    const videoTime = req.query.videoTime ? parseInt(req.query.videoTime as string, 10) : undefined;
    
    if (!broadcastId) {
      return res.status(400).json({ message: 'broadcastId query parameter is required' });
    }
    
    let contestsList = await storage.getBroadcastContests(broadcastId);
    
    // Filtrar por videoTime si está presente
    if (videoTime !== undefined && !isNaN(videoTime)) {
      contestsList = contestsList.filter(contest => {
        // Si tiene video scheduling, usar esos campos
        if (contest.videoStartTime !== null && contest.videoEndTime !== null) {
          return videoTime >= contest.videoStartTime && videoTime < contest.videoEndTime;
        }
        // Si no tiene video scheduling, usar isActive
        return contest.isActive;
      });
    } else {
      // Si no hay videoTime, filtrar solo por isActive
      contestsList = contestsList.filter(contest => contest.isActive);
    }
    
    res.json(contestsList);
  } catch (error) {
    console.error('Error getting contests:', error);
    res.status(500).json({ message: 'Error getting contests' });
  }
});
```

---

## Lógica de Filtrado

### Cuando `videoTime` está presente:
1. **Si el poll/contest tiene `videoStartTime` y `videoEndTime`:**
   - Incluir solo si: `videoStartTime <= videoTime < videoEndTime`
   - Esto permite que polls/contests se activen/desactiven basado en el tiempo de video

2. **Si el poll/contest NO tiene `videoStartTime`/`videoEndTime`:**
   - Usar `isActive` como fallback (comportamiento legacy)

### Cuando `videoTime` NO está presente:
- Filtrar solo por `isActive` (comportamiento actual, backward compatible)

---

## Testing

### Test 1: Sin videoTime (backward compatible)
```bash
curl "http://localhost:5000/v1/engagement/polls?broadcastId=barcelona-psg-2025-01-23"
# Debe retornar solo polls con isActive=true
```

### Test 2: Con videoTime dentro del rango
```bash
curl "http://localhost:5000/v1/engagement/polls?broadcastId=barcelona-psg-2025-01-23&videoTime=300"
# Debe retornar polls donde videoStartTime <= 300 < videoEndTime
```

### Test 3: Con videoTime fuera del rango
```bash
curl "http://localhost:5000/v1/engagement/polls?broadcastId=barcelona-psg-2025-01-23&videoTime=1000"
# No debe retornar polls que tienen videoStartTime=300, videoEndTime=600
```

### Test 4: Con videoTime pero poll sin video scheduling
```bash
# Si un poll tiene videoStartTime=null, videoEndTime=null
# Debe usar isActive como fallback
```

---

## Ejemplo de Uso desde SDK iOS

```swift
// Cargar polls para un tiempo de video específico
let url = "https://api.example.com/v1/engagement/polls?broadcastId=\(broadcastId)&videoTime=\(currentVideoTime)"
// Retorna solo polls activas en ese momento del video
```

---

## Notas

- ✅ **Backward compatible:** Si no se envía `videoTime`, funciona igual que antes
- ✅ **No requiere cambios en DB:** Usa campos existentes (`videoStartTime`, `videoEndTime`)
- ✅ **No requiere cambios en storage.ts:** El filtrado se hace en routes.ts
- ✅ **Filtrado eficiente:** Se filtra en memoria después de obtener datos (aceptable para la mayoría de casos)

---

## Próximos Pasos (Opcional)

Si en el futuro queremos optimizar para broadcasts con muchas polls/contests, podemos:

1. **Agregar filtrado en la query SQL:**
   ```typescript
   // En storage.ts, modificar getBroadcastPolls para aceptar videoTime
   async getBroadcastPolls(broadcastId: string, videoTime?: number): Promise<...> {
     let query = db.select().from(polls)
       .where(eq(polls.broadcastId, broadcastId));
     
     if (videoTime !== undefined) {
       query = query.where(and(
         eq(polls.broadcastId, broadcastId),
         lte(polls.videoStartTime, videoTime),
         gt(polls.videoEndTime, videoTime)
       ));
     }
     // ...
   }
   ```

2. **Agregar índices en DB:**
   ```sql
   CREATE INDEX IF NOT EXISTS idx_polls_video_times 
   ON polls(broadcast_id, video_start_time, video_end_time);
   ```

Pero por ahora, el filtrado en memoria es suficiente.

---

**Fin del Documento**
