# TASK-BACKEND-REVIEW — Fixes post-auditoría de backend engineer (2026-03-10)

## Estado: ✅ COMPLETADO (2026-03-10 sesión 5)

---

## Bug 1 — fetchLineup usa fetch directo ✅ RESUELTO

**Fix aplicado:** `fetchLineup` refactorizada en dos funciones:
- `fetchLineupData(fixtureId, homeTeamId, awayTeamId, broadcast)` — pura, retorna datos, usa `sportmonksFetch()`
- `fetchLineup(broadcastId, res)` — wrapper que lee broadcast, llama a fetchLineupData, envía respuesta

`sportmonksFetch` maneja el token desde la constante pre-calculada, lanza error con status text en !ok, consistente con el resto de endpoints Sportmonks.

---

## Bug 2 — Cache stampede en lineup ✅ RESUELTO

**Fix aplicado:** `lineupInFlight = new Map<string, Promise<any>>()` dentro de `registerRoutes`.
- Si hay cache miss y una request ya está en vuelo para ese `cacheKey`, las demás retornan la misma Promise
- El Map se limpia en el bloque `finally` de la promise (tanto en éxito como en error)
- Implementado dentro de `fetchLineupData`

---

## Bug 3 — fixtureResultCache sin límite de tamaño ✅ RESUELTO

**Fix aplicado (3 líneas):** Antes de cada `fixtureResultCache.set()`:
```typescript
if (fixtureResultCache.size > 200) {
  fixtureResultCache.delete(fixtureResultCache.keys().next().value!);
}
```
LRU simple: elimina el entry más antiguo (primer key en el Map) cuando supera 200 entries.

---

## Optimización scheduler — N+1 queries (PENDIENTE — próxima semana)

`processScheduledPolls` y `processScheduledContests` hacen 1 query por broadcast live.
Mejora futura: JOIN para traer todos los polls/contests con `scheduledStartTime IS NOT NULL` en una sola query.
