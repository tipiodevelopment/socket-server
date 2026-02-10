# Puntos Pendientes de Implementación - Socket Server

**Fecha:** 2026-01-23  
**Estado Actual:** 5/8 mejoras principales implementadas  
**Prioridad:** Alta para producción

---

## 📋 Resumen Ejecutivo

Se han implementado exitosamente:
- ✅ Filtrado por `isActive` en endpoints públicos
- ✅ Filtrado por `currentVideoTime` 
- ✅ Validación de inputs con Zod
- ✅ Índices en DB
- ✅ Validación de IDs de parámetros

**Faltan 3 mejoras importantes:**
1. **Transacciones en DB** (Crítico para consistencia de datos)
2. **Validación de `broadcastId` en endpoints SDK** (Mejora UX y seguridad)
3. **Paginación en endpoints de listado** (Performance)

---

## 🔴 1. Transacciones en DB (CRÍTICO)

### Problema Actual

**Archivo:** `server/services/vote-processor.ts`

```typescript
// Líneas 28-35
await storage.createPollVote({
  pollId,
  optionId,
  userId,
  broadcastId,
});

await storage.updatePollOptionVoteCount(optionId, 1);
```

**Riesgo:**
- Si `updatePollOptionVoteCount` falla después de `createPollVote`, el voto queda registrado pero el contador no se actualiza
- Inconsistencia de datos: `poll_votes` tiene un registro pero `poll_options.vote_count` no coincide
- Mismo problema en `total_votes` de la tabla `polls`

### Solución: Implementar Transacciones

#### Paso 1: Modificar `server/storage.ts`

**Agregar método transaccional para votos:**

```typescript
// En la interfaz IStorage (línea ~130)
createPollVoteWithCountUpdate(
  vote: InsertPollVote, 
  optionId: number
): Promise<PollVote>;

// En la implementación PostgreSQLStorage (después de createPollVote)
async createPollVoteWithCountUpdate(
  vote: InsertPollVote, 
  optionId: number
): Promise<PollVote> {
  return await db.transaction(async (tx) => {
    // 1. Crear el voto
    const [newVote] = await tx.insert(pollVotes).values(vote).returning();
    
    // 2. Actualizar contador de la opción
    await tx.update(pollOptions)
      .set({ voteCount: sql`${pollOptions.voteCount} + 1` })
      .where(eq(pollOptions.id, optionId));
    
    // 3. Actualizar contador total del poll
    await tx.update(polls)
      .set({ totalVotes: sql`${polls.totalVotes} + 1` })
      .where(eq(polls.id, vote.pollId));
    
    return newVote;
  });
}
```

**Agregar método transaccional para participaciones:**

```typescript
// En la interfaz IStorage
createContestParticipationWithUpdate(
  participation: InsertContestParticipation
): Promise<ContestParticipation>;

// En la implementación
async createContestParticipationWithUpdate(
  participation: InsertContestParticipation
): Promise<ContestParticipation> {
  return await db.transaction(async (tx) => {
    const [newParticipation] = await tx.insert(contestParticipations)
      .values(participation)
      .returning();
    
    // Aquí se pueden agregar actualizaciones adicionales si es necesario
    // Por ejemplo, actualizar contador de participaciones en el contest
    
    return newParticipation;
  });
}
```

#### Paso 2: Modificar `server/services/vote-processor.ts`

**Reemplazar operaciones separadas:**

```typescript
// ANTES (líneas 28-35):
await storage.createPollVote({
  pollId,
  optionId,
  userId,
  broadcastId,
});
await storage.updatePollOptionVoteCount(optionId, 1);

// DESPUÉS:
await storage.createPollVoteWithCountUpdate({
  pollId,
  optionId,
  userId,
  broadcastId,
}, optionId);
```

#### Paso 3: Verificar que Drizzle soporta transacciones

**Verificar imports en `server/storage.ts`:**

```typescript
import { db } from "./db";
// Asegurar que db tiene método transaction
// En Drizzle ORM, db.transaction() está disponible
```

**Impacto:** 🔴 **CRÍTICO** - Afecta consistencia de datos  
**Esfuerzo:** Medio (30-45 minutos)  
**Prioridad:** **ALTA** - Debe implementarse antes de producción

---

## ⚠️ 2. Validación de `broadcastId` en Endpoints SDK

### Problema Actual

**Archivos:** `server/routes.ts`

**Líneas 2579-2612 (GET `/v1/engagement/polls`):**
```typescript
app.get('/v1/engagement/polls', async (req, res) => {
  const broadcastId = req.query.broadcastId as string;
  if (!broadcastId) {
    return res.status(400).json({ message: 'broadcastId query parameter is required' });
  }
  // ⚠️ No valida que el broadcast exista
  const pollsList = await storage.getBroadcastPolls(broadcastId);
  // ...
});
```

**Líneas 2656-2681 (GET `/v1/engagement/contests`):**
```typescript
app.get('/v1/engagement/contests', async (req, res) => {
  const broadcastId = req.query.broadcastId as string;
  if (!broadcastId) {
    return res.status(400).json({ message: 'broadcastId query parameter is required' });
  }
  // ⚠️ No valida que el broadcast exista
  const contestsList = await storage.getBroadcastContests(broadcastId);
  // ...
});
```

**Problemas:**
- Si el `broadcastId` no existe, retorna array vacío `[]` en lugar de error 404
- El SDK no puede distinguir entre "no hay polls" y "broadcast no existe"
- Puede causar confusión en debugging

### Solución: Validar Existencia del Broadcast

#### Implementación

**Modificar GET `/v1/engagement/polls`:**

```typescript
// SDK: Get polls for a broadcast (public)
app.get('/v1/engagement/polls', async (req, res) => {
  try {
    const broadcastId = req.query.broadcastId as string;
    if (!broadcastId) {
      return res.status(400).json({ message: 'broadcastId query parameter is required' });
    }
    
    // ✅ NUEVO: Validar que el broadcast existe
    const broadcast = await storage.getBroadcast(broadcastId);
    if (!broadcast) {
      return res.status(404).json({ 
        message: 'Broadcast not found',
        broadcastId 
      });
    }
    
    const currentVideoTime = req.query.currentVideoTime ? parseInt(req.query.currentVideoTime as string) : undefined;

    const pollsList = await storage.getBroadcastPolls(broadcastId);
    let filteredPolls = pollsList.filter(poll => poll.isActive);

    if (currentVideoTime !== undefined && !isNaN(currentVideoTime)) {
      filteredPolls = filteredPolls.filter(poll => {
        if (poll.videoStartTime === null && poll.videoEndTime === null) return true;
        const start = poll.videoStartTime ?? 0;
        const end = poll.videoEndTime ?? Infinity;
        return currentVideoTime >= start && currentVideoTime <= end;
      });
    }

    const pollsWithPercentages = filteredPolls.map(poll => {
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

**Modificar GET `/v1/engagement/contests`:**

```typescript
// SDK: Get contests for a broadcast (public)
app.get('/v1/engagement/contests', async (req, res) => {
  try {
    const broadcastId = req.query.broadcastId as string;
    if (!broadcastId) {
      return res.status(400).json({ message: 'broadcastId query parameter is required' });
    }
    
    // ✅ NUEVO: Validar que el broadcast existe
    const broadcast = await storage.getBroadcast(broadcastId);
    if (!broadcast) {
      return res.status(404).json({ 
        message: 'Broadcast not found',
        broadcastId 
      });
    }
    
    const currentVideoTime = req.query.currentVideoTime ? parseInt(req.query.currentVideoTime as string) : undefined;

    const contestsList = await storage.getBroadcastContests(broadcastId);
    let filteredContests = contestsList.filter(contest => contest.isActive);

    if (currentVideoTime !== undefined && !isNaN(currentVideoTime)) {
      filteredContests = filteredContests.filter(contest => {
        if (contest.videoStartTime === null && contest.videoEndTime === null) return true;
        const start = contest.videoStartTime ?? 0;
        const end = contest.videoEndTime ?? Infinity;
        return currentVideoTime >= start && currentVideoTime <= end;
      });
    }

    res.json(filteredContests);
  } catch (error) {
    console.error('Error getting contests:', error);
    res.status(500).json({ message: 'Error getting contests' });
  }
});
```

**Consideración de Performance:**

Si esta validación se vuelve un cuello de botella (muchas requests), se puede:
1. Cachear broadcasts activos en Redis
2. O simplemente aceptar que retorne array vacío (menos ideal pero más rápido)

**Impacto:** 🟡 **MEDIO** - Mejora UX y debugging  
**Esfuerzo:** Bajo (10-15 minutos)  
**Prioridad:** **MEDIA** - Mejora pero no crítico

---

## 📄 3. Paginación en Endpoints de Listado

### Problema Actual

**Endpoints afectados:**
- GET `/v1/engagement/polls?broadcastId=xxx`
- GET `/v1/engagement/contests?broadcastId=xxx`
- GET `/api/broadcasts`
- GET `/api/campaigns`

**Problema:**
- Retornan TODOS los resultados sin límite
- Si un broadcast tiene 1000 polls, retorna las 1000
- Puede causar problemas de performance y memoria en el cliente

### Solución: Implementar Paginación

#### Paso 1: Modificar `server/storage.ts`

**Agregar métodos con paginación:**

```typescript
// En la interfaz IStorage
getBroadcastPolls(
  broadcastId: string, 
  options?: { limit?: number; offset?: number }
): Promise<Array<Poll & { options: PollOptionRecord[] }>>;

getBroadcastContests(
  broadcastId: string,
  options?: { limit?: number; offset?: number }
): Promise<Contest[]>;

getBroadcastPollsCount(broadcastId: string): Promise<number>;
getBroadcastContestsCount(broadcastId: string): Promise<number>;
```

**Implementación en PostgreSQLStorage:**

```typescript
async getBroadcastPolls(
  broadcastId: string,
  options?: { limit?: number; offset?: number }
): Promise<Array<Poll & { options: PollOptionRecord[] }>> {
  let query = db.select().from(polls)
    .where(eq(polls.broadcastId, broadcastId))
    .orderBy(desc(polls.createdAt));
  
  // Aplicar paginación si está presente
  if (options?.limit) {
    query = query.limit(options.limit);
  }
  if (options?.offset) {
    query = query.offset(options.offset);
  }
  
  const broadcastPolls = await query;
  
  const result: Array<Poll & { options: PollOptionRecord[] }> = [];
  for (const poll of broadcastPolls) {
    const options = await db.select().from(pollOptions)
      .where(eq(pollOptions.pollId, poll.id))
      .orderBy(pollOptions.displayOrder);
    result.push({ ...poll, options });
  }
  return result;
}

async getBroadcastPollsCount(broadcastId: string): Promise<number> {
  const [result] = await db.select({ count: sql<number>`count(*)` })
    .from(polls)
    .where(eq(polls.broadcastId, broadcastId));
  return result?.count ?? 0;
}

async getBroadcastContests(
  broadcastId: string,
  options?: { limit?: number; offset?: number }
): Promise<Contest[]> {
  let query = db.select().from(contests)
    .where(eq(contests.broadcastId, broadcastId))
    .orderBy(desc(contests.createdAt));
  
  if (options?.limit) {
    query = query.limit(options.limit);
  }
  if (options?.offset) {
    query = query.offset(options.offset);
  }
  
  return await query;
}

async getBroadcastContestsCount(broadcastId: string): Promise<number> {
  const [result] = await db.select({ count: sql<number>`count(*)` })
    .from(contests)
    .where(eq(contests.broadcastId, broadcastId));
  return result?.count ?? 0;
}
```

#### Paso 2: Modificar Endpoints en `server/routes.ts`

**GET `/v1/engagement/polls` con paginación:**

```typescript
// SDK: Get polls for a broadcast (public)
app.get('/v1/engagement/polls', async (req, res) => {
  try {
    const broadcastId = req.query.broadcastId as string;
    if (!broadcastId) {
      return res.status(400).json({ message: 'broadcastId query parameter is required' });
    }
    
    // Validar broadcast existe
    const broadcast = await storage.getBroadcast(broadcastId);
    if (!broadcast) {
      return res.status(404).json({ message: 'Broadcast not found', broadcastId });
    }
    
    // ✅ NUEVO: Paginación
    const limit = Math.min(parseInt(req.query.limit as string) || 50, 100); // Max 100
    const offset = parseInt(req.query.offset as string) || 0;
    const currentVideoTime = req.query.currentVideoTime ? parseInt(req.query.currentVideoTime as string) : undefined;

    // Obtener polls con paginación
    const pollsList = await storage.getBroadcastPolls(broadcastId, { limit, offset });
    let filteredPolls = pollsList.filter(poll => poll.isActive);

    if (currentVideoTime !== undefined && !isNaN(currentVideoTime)) {
      filteredPolls = filteredPolls.filter(poll => {
        if (poll.videoStartTime === null && poll.videoEndTime === null) return true;
        const start = poll.videoStartTime ?? 0;
        const end = poll.videoEndTime ?? Infinity;
        return currentVideoTime >= start && currentVideoTime <= end;
      });
    }

    const pollsWithPercentages = filteredPolls.map(poll => {
      const totalVotes = poll.totalVotes;
      const options = poll.options.map(opt => ({
        ...opt,
        percentage: totalVotes > 0 ? Math.round((opt.voteCount / totalVotes) * 10000) / 100 : 0
      }));
      return { ...poll, options };
    });
    
    // ✅ NUEVO: Retornar con metadata de paginación
    const total = await storage.getBroadcastPollsCount(broadcastId);
    
    res.json({
      polls: pollsWithPercentages,
      pagination: {
        limit,
        offset,
        total,
        hasMore: offset + pollsWithPercentages.length < total
      }
    });
  } catch (error) {
    console.error('Error getting polls:', error);
    res.status(500).json({ message: 'Error getting polls' });
  }
});
```

**GET `/v1/engagement/contests` con paginación:**

```typescript
// SDK: Get contests for a broadcast (public)
app.get('/v1/engagement/contests', async (req, res) => {
  try {
    const broadcastId = req.query.broadcastId as string;
    if (!broadcastId) {
      return res.status(400).json({ message: 'broadcastId query parameter is required' });
    }
    
    // Validar broadcast existe
    const broadcast = await storage.getBroadcast(broadcastId);
    if (!broadcast) {
      return res.status(404).json({ message: 'Broadcast not found', broadcastId });
    }
    
    // ✅ NUEVO: Paginación
    const limit = Math.min(parseInt(req.query.limit as string) || 50, 100);
    const offset = parseInt(req.query.offset as string) || 0;
    const currentVideoTime = req.query.currentVideoTime ? parseInt(req.query.currentVideoTime as string) : undefined;

    const contestsList = await storage.getBroadcastContests(broadcastId, { limit, offset });
    let filteredContests = contestsList.filter(contest => contest.isActive);

    if (currentVideoTime !== undefined && !isNaN(currentVideoTime)) {
      filteredContests = filteredContests.filter(contest => {
        if (contest.videoStartTime === null && contest.videoEndTime === null) return true;
        const start = contest.videoStartTime ?? 0;
        const end = contest.videoEndTime ?? Infinity;
        return currentVideoTime >= start && currentVideoTime <= end;
      });
    }

    // ✅ NUEVO: Retornar con metadata de paginación
    const total = await storage.getBroadcastContestsCount(broadcastId);
    
    res.json({
      contests: filteredContests,
      pagination: {
        limit,
        offset,
        total,
        hasMore: offset + filteredContests.length < total
      }
    });
  } catch (error) {
    console.error('Error getting contests:', error);
    res.status(500).json({ message: 'Error getting contests' });
  }
});
```

#### Paso 3: Actualizar Tipos TypeScript

**En `shared/schema.ts` o crear tipos nuevos:**

```typescript
export interface PaginatedResponse<T> {
  data: T[];
  pagination: {
    limit: number;
    offset: number;
    total: number;
    hasMore: boolean;
  };
}
```

**Impacto:** 🟡 **MEDIO** - Mejora performance  
**Esfuerzo:** Medio (45-60 minutos)  
**Prioridad:** **MEDIA** - Importante para escalabilidad

---

## 📊 Resumen de Prioridades

| # | Mejora | Impacto | Esfuerzo | Prioridad | Tiempo Estimado |
|---|--------|---------|----------|-----------|-----------------|
| 1 | Transacciones en DB | 🔴 Crítico | Medio | **ALTA** | 30-45 min |
| 2 | Validación broadcastId | 🟡 Medio | Bajo | Media | 10-15 min |
| 3 | Paginación | 🟡 Medio | Medio | Media | 45-60 min |

**Total estimado:** 1.5 - 2 horas

---

## 🎯 Plan de Implementación Recomendado

### Fase 1: Crítico (Hacer primero)
1. ✅ **Transacciones en DB** (30-45 min)
   - Modificar `storage.ts` para agregar métodos transaccionales
   - Actualizar `vote-processor.ts` y `contest-processor.ts`
   - Probar con casos edge (simular fallos)

### Fase 2: Mejoras UX (Hacer después)
2. ✅ **Validación broadcastId** (10-15 min)
   - Agregar validación en 2 endpoints
   - Probar con broadcastId inválido

3. ✅ **Paginación** (45-60 min)
   - Modificar `storage.ts` con métodos de paginación
   - Actualizar endpoints
   - Probar con diferentes límites y offsets

---

## 🧪 Testing Recomendado

### Para Transacciones:
```typescript
// Test: Simular fallo después de createPollVote
// Debe hacer rollback completo
```

### Para Validación broadcastId:
```bash
# Test 1: Broadcast no existe
curl "http://localhost:5000/v1/engagement/polls?broadcastId=invalid-id"
# Esperado: 404 Not Found

# Test 2: Broadcast existe pero sin polls
curl "http://localhost:5000/v1/engagement/polls?broadcastId=valid-id"
# Esperado: 200 OK con { polls: [], pagination: {...} }
```

### Para Paginación:
```bash
# Test 1: Primera página
curl "http://localhost:5000/v1/engagement/polls?broadcastId=xxx&limit=10&offset=0"

# Test 2: Segunda página
curl "http://localhost:5000/v1/engagement/polls?broadcastId=xxx&limit=10&offset=10"

# Test 3: Límite máximo
curl "http://localhost:5000/v1/engagement/polls?broadcastId=xxx&limit=200"
# Esperado: limit=100 (máximo permitido)
```

---

## 📝 Notas Adicionales

### Consideraciones de Backward Compatibility

**Paginación:**
- Si no se envía `limit`/`offset`, usar defaults (limit=50, offset=0)
- Mantener formato de respuesta compatible: si no hay paginación, retornar array directamente
- O mejor: siempre retornar objeto con `polls`/`contests` y `pagination`

**Validación broadcastId:**
- Cambio de comportamiento: antes retornaba `[]`, ahora retorna `404`
- Esto es una mejora, pero puede romper clientes que esperan array vacío
- Considerar: retornar `200` con `{ polls: [], broadcastExists: false }` como alternativa

### Optimizaciones Futuras

1. **Cache de broadcasts activos** en Redis para validación rápida
2. **Cursor-based pagination** en lugar de offset (mejor para grandes datasets)
3. **Batch loading** de opciones de polls para reducir queries N+1

---

## ✅ Checklist de Implementación

### Transacciones
- [ ] Agregar `createPollVoteWithCountUpdate` en `IStorage`
- [ ] Implementar método en `PostgreSQLStorage`
- [ ] Actualizar `vote-processor.ts` para usar nuevo método
- [ ] Agregar `createContestParticipationWithUpdate` (si aplica)
- [ ] Probar con casos de fallo
- [ ] Verificar rollback funciona correctamente

### Validación broadcastId
- [ ] Agregar validación en GET `/v1/engagement/polls`
- [ ] Agregar validación en GET `/v1/engagement/contests`
- [ ] Probar con broadcastId inválido
- [ ] Probar con broadcastId válido pero sin polls/contests

### Paginación
- [ ] Agregar métodos con paginación en `IStorage`
- [ ] Implementar en `PostgreSQLStorage`
- [ ] Agregar métodos `getBroadcastPollsCount` y `getBroadcastContestsCount`
- [ ] Actualizar GET `/v1/engagement/polls` con paginación
- [ ] Actualizar GET `/v1/engagement/contests` con paginación
- [ ] Probar con diferentes límites y offsets
- [ ] Verificar que `hasMore` funciona correctamente

---

**Fin del Documento**
