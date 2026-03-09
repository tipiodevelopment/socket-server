# TASK: Sportmonks Cache Fix + Plan Audit

## Problema identificado
La cache de fixtures en `sportmonks_cache` tiene entradas contaminadas con datos de antes
del fix de filtrado (commit `10b1aed`). El filtro `f.league_id === leagueId` funciona
correctamente en el código pero la cache guardada pre-fix tiene 10 fixtures mezclados:
4 de CL (league_id:2) y **6 del Championship (league_id:9)** para el 10 de marzo.

Como el TTL es 2 días, esos datos incorrectos se sirven durante 48h desde que se cachearon.

## Fix 1 — Endpoint para invalidar cache de fixtures (URGENTE)
Crear endpoint admin para limpiar entradas de cache:

```
DELETE /api/admin/sportmonks/cache?leagueId=2&dateFrom=2026-03-10&dateTo=2026-03-10
DELETE /api/admin/sportmonks/cache?leagueId=2&dateFrom=2026-03-11&dateTo=2026-03-11
DELETE /api/admin/sportmonks/cache   (sin params = limpiar toda la cache sportmonks)
```

O simplemente hacer una migración que ejecute:
```sql
DELETE FROM sportmonks_cache WHERE cache_type = 'fixtures' AND date_from >= '2026-03-10';
```

## Fix 2 — El filtro actual es correcto pero frágil
En `server/routes.ts` línea ~3868:
```ts
const allFixtures = (json.data || []).filter((f: any) => f.league_id === leagueId);
```
Esto está bien. El problema es que la API de Sportmonks con `?leagues=2` devuelve
fixtures de otras ligas también (aparentemente un bug o comportamiento del trial).
El filtro server-side es la solución correcta — solo necesita cache limpia.

## Fix 3 — Reducir CACHE_TTL para fixtures futuros
Cambiar `CACHE_TTL_MS` de 2 días a **6 horas** para fixtures (partidos del día/siguiente).
Los datos de partidos futuros cambian menos, pero 2 días es demasiado para un sistema
donde el operador espera ver datos frescos al cambiar la fecha.

```ts
const FIXTURE_CACHE_TTL_MS = 6 * 60 * 60 * 1000; // 6 horas
const LEAGUE_CACHE_TTL_MS  = 2 * 24 * 60 * 60 * 1000; // 2 días (ligas no cambian)
```

## Fix 4 — Verificar que el plan de Sportmonks tiene acceso a CL
El endpoint `/v3/core/my/subscriptions` devuelve 0 subscriptions y `/v3/core/my/leagues`
devuelve 0 ligas. Sin embargo el plan SÍ tiene acceso (devuelve fixtures CL).
Revisar si el token es un trial de plan Standard o superior.

La URL de documentación del cliente: https://docs.sportmonks.com/v3/

## Acción inmediata
Ejecutar directamente en la DB de producción:
```sql
DELETE FROM sportmonks_cache WHERE cache_type = 'fixtures';
```
Esto fuerza que el próximo request regenere con el filtro correcto.

## Prioridad
ALTA — afecta el UX del match picker en el dashboard para todos los operadores.
