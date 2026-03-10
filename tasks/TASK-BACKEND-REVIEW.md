# TASK-BACKEND-REVIEW — Fixes post-auditoría de backend engineer

## Estado: ✅ COMPLETADO (2026-03-10 sesión 6)

---

## Bug 1 — fetchLineup usa fetch directo ✅ RESUELTO

`fetchLineup` refactorizada en `fetchLineupData` (pura, retorna datos) + `fetchLineup` (wrapper req/res).
Usa `sportmonksFetch` — token desde constante pre-calculada, error con status text en !ok.

---

## Bug 2 — Cache stampede en lineup ✅ RESUELTO

`lineupInFlight = new Map<string, Promise<any>>()` en `registerRoutes`.
N requests con cache miss para mismo fixture = 1 sola llamada a Sportmonks.
Map se limpia en `finally` del promise (éxito y error).

---

## Bug 3 — fixtureResultCache sin límite ✅ RESUELTO

Antes de cada `fixtureResultCache.set()`:
```typescript
if (fixtureResultCache.size > 200) {
  fixtureResultCache.delete(fixtureResultCache.keys().next().value!);
}
```

---

## Optimización scheduler N+1 ✅ RESUELTO

`processScheduledPolls` y `processScheduledContests` ahora usan 1 query JOIN en lugar de 1 + N.

Nuevos métodos en `IStorage` + `DatabaseStorage`:
- `getScheduledPollsForLiveBroadcasts()` → JOIN polls × broadcasts WHERE status='live' AND scheduledStartTime IS NOT NULL
- `getScheduledContestsForLiveBroadcasts()` → igual para contests

Resultado: por tick del scheduler, de `1 + N_broadcasts` queries a exactamente 2 queries (1 por polls, 1 por contests).
