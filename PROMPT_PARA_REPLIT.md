# Prompt para Replit: Implementar 3 Mejoras Pendientes

**Prioridad:** ALTA - Crítico para producción  
**Fecha:** 2026-02-10  
**Estado:** 5/8 mejoras implementadas, faltan 3 críticas

---

## 🎯 Objetivo

Implementar las 3 mejoras pendientes identificadas en `PENDIENTES_IMPLEMENTACION.md`:

1. **Transacciones en DB** (CRÍTICO - Consistencia de datos)
2. **Validación de `broadcastId` en endpoints SDK** (Mejora UX y seguridad)
3. **Paginación en endpoints de listado** (Performance)

---

## 🔴 TAREA 1: Implementar Transacciones en DB (CRÍTICO)

### Problema Actual

En `server/services/vote-processor.ts` (líneas 28-35), se hacen operaciones separadas sin transacciones:

```typescript
await storage.createPollVote({ pollId, optionId, userId, broadcastId });
await storage.updatePollOptionVoteCount(optionId, 1);
```

**Riesgo:** Si la segunda operación falla, queda inconsistencia de datos (voto registrado pero contador no actualizado).

### Implementación Requerida

#### Paso 1: Modificar `server/storage.ts`

**1.1. Agregar método transaccional en la interfaz `IStorage` (alrededor de línea 130):**

```typescript
// Agregar después de createPollVote
createPollVoteWithCountUpdate(
  vote: InsertPollVote, 
  optionId: number
): Promise<PollVote>;
```

**1.2. Implementar método transaccional en `PostgreSQLStorage`:**

```typescript
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

**Nota:** Asegurar que los imports incluyan `sql` de `drizzle-orm`:
```typescript
import { eq, desc, and, gte, ne, isNull, sql, lte } from "drizzle-orm";
```

#### Paso 2: Modificar `server/services/vote-processor.ts`

**Reemplazar líneas 28-35:**

```typescript
// ANTES:
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

**Eliminar la llamada a `updatePollOptionVoteCount` ya que ahora está dentro de la transacción.**

---

## ⚠️ TAREA 2: Validación de `broadcastId` en Endpoints SDK

### Problema Actual

Los endpoints SDK no validan que el `broadcastId` exista antes de procesar requests:
- GET `/v1/engagement/polls?broadcastId=xxx`
- GET `/v1/engagement/contests?broadcastId=xxx`

Retornan array vacío `[]` si el broadcast no existe, causando confusión.

### Implementación Requerida

#### Modificar `server/routes.ts`

**2.1. GET `/v1/engagement/polls` (alrededor de línea 2579):**

```typescript
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
    // ... resto del código existente
```

**2.2. GET `/v1/engagement/contests` (alrededor de línea 2656):**

```typescript
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
    
    // ... resto del código existente
```

---

## 📄 TAREA 3: Paginación en Endpoints de Listado

### Problema Actual

Los endpoints retornan TODOS los resultados sin límite, causando problemas de performance.

### Implementación Requerida

#### Paso 1: Modificar `server/storage.ts`

**3.1. Actualizar interfaz `IStorage` (alrededor de línea 130):**

```typescript
// Modificar métodos existentes para aceptar opciones de paginación
getBroadcastPolls(
  broadcastId: string, 
  options?: { limit?: number; offset?: number }
): Promise<Array<Poll & { options: PollOptionRecord[] }>>;

getBroadcastContests(
  broadcastId: string,
  options?: { limit?: number; offset?: number }
): Promise<Contest[]>;

// Agregar métodos de conteo
getBroadcastPollsCount(broadcastId: string): Promise<number>;
getBroadcastContestsCount(broadcastId: string): Promise<number>;
```

**3.2. Implementar métodos con paginación en `PostgreSQLStorage`:**

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

**3.3. GET `/v1/engagement/polls` con paginación:**

```typescript
app.get('/v1/engagement/polls', async (req, res) => {
  try {
    const broadcastId = req.query.broadcastId as string;
    if (!broadcastId) {
      return res.status(400).json({ message: 'broadcastId query parameter is required' });
    }
    
    // Validar broadcast existe (de TAREA 2)
    const broadcast = await storage.getBroadcast(broadcastId);
    if (!broadcast) {
      return res.status(404).json({ message: 'Broadcast not found', broadcastId });
    }
    
    // ✅ NUEVO: Paginación
    const limit = Math.min(parseInt(req.query.limit as string) || 50, 100); // Max 100, default 50
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
        hasMore: offset + limit < total
      }
    });
  } catch (error: any) {
    console.error('Error getting polls:', error);
    res.status(500).json({ message: 'Error getting polls' });
  }
});
```

**3.4. GET `/v1/engagement/contests` con paginación:**

```typescript
app.get('/v1/engagement/contests', async (req, res) => {
  try {
    const broadcastId = req.query.broadcastId as string;
    if (!broadcastId) {
      return res.status(400).json({ message: 'broadcastId query parameter is required' });
    }
    
    // Validar broadcast existe (de TAREA 2)
    const broadcast = await storage.getBroadcast(broadcastId);
    if (!broadcast) {
      return res.status(404).json({ message: 'Broadcast not found', broadcastId });
    }
    
    // ✅ NUEVO: Paginación
    const limit = Math.min(parseInt(req.query.limit as string) || 50, 100); // Max 100, default 50
    const offset = parseInt(req.query.offset as string) || 0;

    const contestsList = await storage.getBroadcastContests(broadcastId, { limit, offset });
    const filteredContests = contestsList.filter(contest => contest.isActive);
    
    // ✅ NUEVO: Retornar con metadata de paginación
    const total = await storage.getBroadcastContestsCount(broadcastId);
    
    res.json({
      contests: filteredContests,
      pagination: {
        limit,
        offset,
        total,
        hasMore: offset + limit < total
      }
    });
  } catch (error: any) {
    console.error('Error getting contests:', error);
    res.status(500).json({ message: 'Error getting contests' });
  }
});
```

---

## ✅ Checklist de Verificación

Después de implementar, verificar:

- [ ] Las transacciones funcionan correctamente (voto + actualización de contadores en una sola operación atómica)
- [ ] Los endpoints SDK retornan 404 cuando el broadcastId no existe
- [ ] La paginación funciona con `limit` y `offset` query parameters
- [ ] Los endpoints retornan metadata de paginación (`total`, `hasMore`)
- [ ] No hay errores de TypeScript
- [ ] Los tests existentes siguen pasando (si existen)

---

## 📝 Notas Importantes

1. **Transacciones:** Asegurar que `db.transaction()` está disponible en Drizzle ORM (debería estar disponible por defecto)
2. **Backward Compatibility:** Los parámetros de paginación son opcionales, así que los clientes existentes seguirán funcionando
3. **Límites:** El límite máximo es 100 para evitar sobrecarga
4. **Orden:** Mantener el orden existente (`desc(createdAt)`)

---

## 🚀 Orden de Implementación Recomendado

1. **Primero:** TAREA 1 (Transacciones) - Crítico para consistencia
2. **Segundo:** TAREA 2 (Validación broadcastId) - Mejora UX
3. **Tercero:** TAREA 3 (Paginación) - Mejora performance

---

**¡Gracias por implementar estas mejoras críticas!** 🎉
