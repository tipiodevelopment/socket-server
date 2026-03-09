# TASK: Sportmonks — Implementación definitiva (ligas + fixtures con cache correcta)

## Objetivo
El match picker del dashboard debe:
1. Mostrar la lista real de competiciones disponibles en nuestro plan Sportmonks
2. Al seleccionar liga + fecha, traer los partidos correctos (solo esa liga)
3. Guardar los resultados en cache — si ya están, no volver a llamar a Sportmonks

---

## Parte 1 — Ligas: endpoint `/api/sportmonks/leagues`

### Estado actual
Funciona pero usa `/leagues?per_page=150` que devuelve TODAS las ligas del plan.
El dropdown en el front muestra 4 opciones hardcodeadas (CL, Europa, PL, La Liga).

### Fix
Eliminar las opciones hardcodeadas del front. En su lugar, cargar el endpoint real:

```
GET /api/sportmonks/leagues
```

Que ya existe. Solo cambiar el front para que llame al endpoint y muestre la lista dinámica.

**Cache de ligas:** ya funciona con TTL 2 días. No tocar.

---

## Parte 2 — Fixtures: endpoint `/api/sportmonks/fixtures`

### Problema actual
1. La API de Sportmonks con `?leagues=2` devuelve fixtures de OTRAS ligas también
   (bug conocido del plan — mezcla CL con Championship)
2. La cache guarda los datos contaminados y los sirve durante 2 días
3. El filtro `f.league_id === leagueId` en el servidor es correcto pero llega tarde
   (ya está en el código desde commit `10b1aed`)

### Fix definitivo

**Step 1 — Limpiar cache existente (migración)**

Ejecutar en la DB de producción:
```sql
DELETE FROM sportmonks_cache WHERE cache_type = 'fixtures';
```

**Step 2 — Lógica de cache correcta en el servidor**

```ts
// GET /api/sportmonks/fixtures?leagueId=&dateFrom=YYYY-MM-DD&dateTo=YYYY-MM-DD
app.get('/api/sportmonks/fixtures', async (req, res) => {
  const leagueId = parseInt(req.query.leagueId as string);
  const dateFrom = req.query.dateFrom as string;
  const dateTo = req.query.dateTo as string;

  if (!leagueId || !dateFrom || !dateTo) {
    return res.status(400).json({ message: 'leagueId, dateFrom, and dateTo are required' });
  }

  // 1. Revisar cache PRIMERO — si existe y es válida, devolver sin llamar a Sportmonks
  const cached = await storage.getSportmonksCache('fixtures', leagueId, dateFrom, dateTo);
  if (isCacheValid(cached)) {
    return res.json(cached!.data);  // ← ya filtrado correctamente, servir directo
  }

  // 2. No hay cache válida → llamar a Sportmonks
  const path = `/fixtures/between/${dateFrom}/${dateTo}?per_page=150&include=participants`;
  // IMPORTANTE: NO usar ?leagues=leagueId — no filtra bien en la API
  // Filtrar server-side por league_id después de recibir todos los fixtures del día
  const json = await sportmonksFetch(path);

  // 3. Filtrar estrictamente por league_id (nunca confiar en el param de la URL)
  const fixtures = (json.data || [])
    .filter((f: any) => f.league_id === leagueId)
    .map((f: any) => {
      const participants = f.participants || [];
      const home = participants.find((p: any) => p.meta?.location === 'home');
      const away = participants.find((p: any) => p.meta?.location === 'away');
      return {
        id: f.id,
        name: f.name,
        startingAt: f.starting_at,
        leagueId: f.league_id,
        homeTeam: home ? { id: home.id, name: home.name, logoUrl: home.image_path || null } : null,
        awayTeam: away ? { id: away.id, name: away.name, logoUrl: away.image_path || null } : null,
      };
    });

  // 4. Guardar en cache SOLO los fixtures ya filtrados (datos limpios)
  await storage.upsertSportmonksCache('fixtures', fixtures, leagueId, dateFrom, dateTo);

  res.json(fixtures);
});
```

**Cambios clave:**
- Quitar `?leagues=${leagueId}` de la URL a Sportmonks (no funciona bien)
- Traer todos los fixtures del día con `per_page=150`
- Filtrar por `f.league_id === leagueId` ANTES de guardar en cache
- Guardar en cache solo los fixtures limpios — no los contaminados

**Step 3 — TTL diferenciado**

```ts
const FIXTURE_CACHE_TTL_MS = 6 * 60 * 60 * 1000;       // 6 horas para fixtures
const LEAGUE_CACHE_TTL_MS  = 2 * 24 * 60 * 60 * 1000;  // 2 días para ligas
```

Usar `FIXTURE_CACHE_TTL_MS` en la validación del endpoint de fixtures,
y `LEAGUE_CACHE_TTL_MS` en el de leagues.

---

## Parte 3 — Front: dropdown de ligas dinámico

En `client/src/pages/broadcasts.tsx`, el combobox de liga debe cargarse desde el endpoint:

```ts
const { data: leagues = [] } = useQuery({
  queryKey: ['/api/sportmonks/leagues'],
  queryFn: async () => {
    const res = await fetch('/api/sportmonks/leagues');
    if (!res.ok) return [];
    return res.json();
  },
});
```

Y renderizar las opciones dinámicamente en lugar de tenerlas hardcodeadas.
Mostrar `{league.name} · {league.countryName}` como label.

---

## Resumen de cambios

| Archivo | Cambio |
|---------|--------|
| `server/routes.ts` | Quitar `?leagues=` de URL Sportmonks, filtrar server-side antes de cachear, TTL diferenciado |
| `client/src/pages/broadcasts.tsx` | Dropdown de ligas dinámico desde `/api/sportmonks/leagues` |
| DB (migración) | `DELETE FROM sportmonks_cache WHERE cache_type = 'fixtures'` |

---

## Prioridad
ALTA — afecta directamente el flujo de creación de broadcasts para operadores.

## Verificación
Después de deplegar:
1. Seleccionar "Champions League" + fecha 2026-03-10 → debe mostrar SOLO Newcastle vs Barcelona, Atalanta vs Bayern, Atlético vs Tottenham
2. Seleccionar "Championship" + misma fecha → debe mostrar los partidos de Championship (no mezclados)
3. Segunda llamada con misma liga+fecha → debe servir desde cache sin llamar a Sportmonks (verificar en logs)
