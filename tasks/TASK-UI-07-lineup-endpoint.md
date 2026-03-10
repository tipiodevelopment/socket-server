# TASK-UI-07 — Lineup endpoint + Dashboard section

## Objetivo

Exponer las alineaciones reales desde Sportmonks via API y mostrarlas en el dashboard.

## Backend — `GET /api/broadcasts/:broadcastId/lineup`

### Lógica

1. Buscar el broadcast por `broadcastId` → obtener `sportmonks_fixture_id`
2. Si no hay `sportmonks_fixture_id` → 404 `{ message: "No fixture linked to this broadcast" }`
3. Llamar a Sportmonks:
   ```
   GET https://api.sportmonks.com/v3/football/fixtures/:fixtureId?include=lineups.player
   api_token: hTAp0XE1x7CsBh1yi8g47OQh1dLhGPfygQTf08MnCbCY38dLFc73HuxxYBcJ
   ```
4. Filtrar `type_id === 11` (titulares XI inicial)
5. Separar por `team_id` (home vs away — usar `homeTeamId`/`awayTeamId` del broadcast)
6. Cachear resultado en `sportmonks_cache` con key `lineup_:fixtureId`, TTL 30 min
7. Devolver respuesta limpia

### Response format

```json
{
  "fixtureId": 19568482,
  "available": true,
  "home": {
    "teamId": 83,
    "teamName": "FC Barcelona",
    "teamLogo": "https://cdn.sportmonks.com/images/soccer/teams/19/83.png",
    "formation": "4-3-3",
    "players": [
      { "id": 37316480, "name": "A. Balde", "jerseyNumber": 3, "position": "defender" }
    ]
  },
  "away": {
    "teamId": 591,
    "teamName": "PSG",
    "teamLogo": "https://cdn.sportmonks.com/images/soccer/teams/15/591.png",
    "formation": "4-2-3-1",
    "players": [...]
  }
}
```

Si el lineup aún no está disponible en Sportmonks (antes del partido):
```json
{ "available": false, "message": "Lineup not yet available" }
```

### Position mapping (de position_id a string)

```typescript
function mapPosition(positionId: number): string {
  if ([24, 25].includes(positionId)) return "goalkeeper";
  if ([27, 28, 29, 30, 155, 156].includes(positionId)) return "defender";
  if ([31, 32, 33, 34, 157, 158, 159].includes(positionId)) return "midfielder";
  return "forward";
}
```

### Formation

Sportmonks no devuelve formation directamente en lineups. Derivarla contando jugadores por posición:
- 4 defenders + 3 mid + 3 fwd = "4-3-3"
- 4 defenders + 2 mid + 3 fwd + 1 att = "4-2-3-1"
- etc.

O devolver `null` si no se puede calcular.

### Caching

Usar la tabla `sportmonks_cache` existente:
```typescript
const cacheKey = `lineup_${fixtureId}`;
// TTL: 30 min (1800000 ms) — lineups pueden cambiar hasta ~15min antes del partido
```

## Dashboard — Sección "Alineaciones" en broadcast detail

Añadir debajo de `MatchDataCard`, encima de "Active Engagement":

```
┌─────────────────────────────────┐
│ 👥 Alineaciones         [Refresh]│
│                                  │
│ FC Barcelona (4-3-3)             │
│  1. Ter Stegen  🧤               │
│  3. A. Balde    🛡️               │
│  ...                             │
│                                  │
│ PSG (4-2-3-1)                    │
│  ...                             │
│                                  │
│ "Lineup not yet available"       │
│ (si Sportmonks aún no tiene datos)│
└─────────────────────────────────┘
```

- Botón **Refresh** → re-fetch desde Sportmonks (invalida cache)
- Si `available: false` → mostrar mensaje gris "Alineación disponible ~60 min antes del partido"
- Mostrar solo titulares (type_id = 11), no suplentes

## SDK endpoint (para referencia)

El SDK Swift hará:
```
GET /v1/sdk/broadcasts/:broadcastId/lineup
```
Crear también la versión SDK (sin auth admin, con api-key) que devuelva el mismo formato.

## Archivos a tocar

- `server/routes.ts` — añadir GET `/api/broadcasts/:broadcastId/lineup` y `/v1/sdk/broadcasts/:broadcastId/lineup`
- `server/storage.ts` — reutilizar `sportmonks_cache` para el lineup
- `client/src/components/broadcast-detail.tsx` — añadir sección Alineaciones

## Test

```bash
# Con fixture real (Barcelona-PSG, CL oct 2025)
curl https://api-dev.vio.live/api/broadcasts/barcelona-psg-2026-03-03/lineup

# Con broadcast sin fixture
curl https://api-dev.vio.live/api/broadcasts/elkjop-gaming-live-2026-03-09/lineup
# → 404: No fixture linked
```
