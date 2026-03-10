# TASK-BACKEND-REVIEW — Fixes post-auditoría de backend engineer (2026-03-10)

## Bug 1 — fetchLineup usa fetch directo en vez de sportmonksFetch (ALTA)

**Problema**: El resto de endpoints Sportmonks usan `sportmonksFetch()` con token configurado.
`fetchLineup` usa `fetch(url, { headers: { Authorization: process.env.SPORTMONKS_API_TOKEN || '' } })` directo.
Si la env var falla → header vacío → Sportmonks 401 → cliente recibe 502 sin contexto de error.

**Fix en server/routes.ts** — reemplazar en `fetchLineup`:
```typescript
// Antes:
const smRes = await fetch(url, { headers: { Authorization: process.env.SPORTMONKS_API_TOKEN || '' } });
if (!smRes.ok) {
  return res.status(502).json({ message: 'Failed to fetch lineup from Sportmonks' });
}
const json = await smRes.json();

// Después — usar sportmonksFetch:
const json = await sportmonksFetch(`/fixtures/${fixtureId}?include=lineups.player`);
```

`sportmonksFetch` ya maneja el token, lanza error si !ok, y es consistente con el resto.

---

## Bug 2 — Cache stampede en lineup (MEDIA)

**Problema**: Si N dispositivos piden `/lineup` simultáneamente con cache miss, salen N calls a Sportmonks en paralelo.

**Fix**: añadir in-flight map para deduplicar requests concurrentes:
```typescript
const lineupInFlight = new Map<string, Promise<any>>();

async function fetchLineupData(fixtureId: number): Promise<any> {
  const cacheKey = `lineup_${fixtureId}`;
  const cached = await storage.getSportmonksCache(cacheKey);
  if (isCacheValidFor(cached, LINEUP_CACHE_TTL_MS)) return cached!.data;

  if (lineupInFlight.has(cacheKey)) return lineupInFlight.get(cacheKey)!;

  const promise = (async () => {
    const json = await sportmonksFetch(`/fixtures/${fixtureId}?include=lineups.player`);
    // ... procesar y cachear
    lineupInFlight.delete(cacheKey);
    return result;
  })();

  lineupInFlight.set(cacheKey, promise);
  return promise;
}
```

---

## Bug 3 — fixtureResultCache sin límite de tamaño (BAJA)

**Problema**: `const fixtureResultCache = new Map()` crece indefinidamente.

**Fix simple**: limitar a 200 entries con LRU manual:
```typescript
if (fixtureResultCache.size > 200) {
  const firstKey = fixtureResultCache.keys().next().value;
  fixtureResultCache.delete(firstKey);
}
fixtureResultCache.set(fixtureId, { data, fetchedAt: Date.now(), status });
```

---

## Optimización scheduler — queries DB (BAJA, no urgente)

Actualmente `processScheduledPolls` hace `getBroadcastPolls()` por CADA broadcast live.
Con 8 broadcasts = 8 queries para leer polls. Lo mismo para contests.

**Mejora futura**: una sola query que traiga todos los polls con `scheduledStartTime IS NOT NULL`
y su `broadcastId` en un JOIN. No urgente para mañana.

---

## Prioridad
- Bug 1 (sportmonksFetch): hacer hoy — puede causar 502s silenciosos en prod
- Bug 2 (stampede): hacer cuando haya tiempo
- Bug 3 + scheduler: próxima semana
