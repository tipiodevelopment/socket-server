# TASK-UI-07 — Lineup endpoint + Dashboard section

## Decisiones de arquitectura (confirmadas 2026-03-10)

### ¿Cómo separar jugadores por equipo (home vs away)?

**NO usar `homeTeamId`/`awayTeamId` como columnas en `broadcasts`** — no es sport-agnostic (mañana puede ser F1).

**Solución: `metadata` JSONB** — cuando el usuario selecciona un fixture en el modal de crear/editar broadcast, guardar los IDs en el campo `metadata` que ya existe:

```json
// broadcasts.metadata (ya existe como JSONB)
{
  "homeTeamId": 83,
  "awayTeamId": 591
}
```

Al seleccionar el fixture, Sportmonks ya devuelve los participantes con sus IDs. Escribirlos en `metadata` en ese momento. Así el lineup endpoint los lee directamente sin llamadas extra ni dependencia del cache TTL.

**Ventaja a futuro:** F1 usaría `metadata.driverId`, `metadata.circuitId`, etc. El schema de `broadcasts` nunca cambia.

### Prioridad: hacer los 3 tasks hoy

Orden:
1. **UI-06** — Fix videoStartTime (simple, 30 min)
2. **UI-07** — Lineup endpoint (este task)
3. **UI-08** — WS trigger + dashboard toggle (mañana si no llega hoy — los partidos son a las 21:00 Oslo del Mar 11)

---

## Backend — `GET /api/broadcasts/:broadcastId/lineup`

### Lógica completa

1. Buscar el broadcast → obtener `sportmonks_fixture_id` y `metadata`
2. Si no hay `sportmonks_fixture_id` → `{ available: false, message: "No fixture linked to this broadcast" }`
3. Leer `homeTeamId` y `awayTeamId` de `broadcast.metadata`
4. Check cache `sportmonks_cache` (key `lineup_${fixtureId}`)
5. Si no hay cache → llamar Sportmonks:
   ```
   GET https://api.sportmonks.com/v3/football/fixtures/:fixtureId?include=lineups.player
   Authorization: Bearer hTAp0XE1x7CsBh1yi8g47OQh1dLhGPfygQTf08MnCbCY38dLFc73HuxxYBcJ
   ```
6. Filtrar `type_id === 11` (titulares XI inicial)
7. Agrupar por `team_id` usando `homeTeamId`/`awayTeamId` de `metadata`
8. Si no hay jugadores → `{ available: false, message: "Lineup not yet available" }`
9. Cachear en `sportmonks_cache` TTL 30 min
10. Devolver respuesta limpia

### Escribir homeTeamId/awayTeamId en metadata al vincular fixture

En el modal de crear/editar broadcast, cuando el usuario selecciona un fixture de Sportmonks, ya se rellena `homeTeamName`, `homeTeamLogo`, etc. Añadir en ese mismo PATCH:

```typescript
// Cuando se selecciona un fixture:
const participants = fixture.participants; // viene de Sportmonks
const homeParticipant = participants.find(p => p.meta?.location === 'home');
const awayParticipant = participants.find(p => p.meta?.location === 'away');

// Deep-merge en metadata (ya existe el mecanismo de deep-merge)
metadata.homeTeamId = homeParticipant?.id;
metadata.awayTeamId = awayParticipant?.id;
```

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

Si el lineup aún no está disponible:
```json
{ "available": false, "message": "Lineup not yet available" }
```

### Position mapping (position_id → string)

```typescript
function mapPosition(positionId: number): string {
  if ([24, 25].includes(positionId)) return "goalkeeper";
  if ([27, 28, 29, 30, 155, 156].includes(positionId)) return "defender";
  if ([31, 32, 33, 34, 157, 158, 159].includes(positionId)) return "midfielder";
  return "forward";
}
```

### Formation derivation

Sportmonks no devuelve formation en lineups. Derivar contando por posición:

```typescript
function deriveFormation(players: LineupPlayer[]): string {
  const defenders  = players.filter(p => p.position === 'defender').length;
  const midfielders = players.filter(p => p.position === 'midfielder').length;
  const forwards   = players.filter(p => p.position === 'forward').length;
  return `${defenders}-${midfielders}-${forwards}`; // e.g. "4-3-3"
}
```

### Caching

```typescript
const cacheKey = `lineup_${fixtureId}`;
const LINEUP_CACHE_TTL_MS = 30 * 60 * 1000; // 30 min
```

Usar tabla `sportmonks_cache` existente con `isCacheValidFor(cache, LINEUP_CACHE_TTL_MS)`.

---

## Endpoints

```
GET /api/broadcasts/:broadcastId/lineup    (admin — JWT Bearer)
GET /v1/sdk/broadcasts/:broadcastId/lineup (SDK — ?apiKey=...)
```

Mismo handler, distinta auth middleware.

---

## Dashboard — Sección "Alineaciones" en broadcast detail

Añadir debajo de `MatchDataCard`:

```
┌─────────────────────────────────────┐
│ 👥 Alineaciones              [↺ Refresh] │
│                                     │
│ FC Barcelona (4-3-3)                │
│  31. Ter Stegen  🧤                 │
│   3. A. Balde    🛡️                 │
│  ...                                │
│                                     │
│ PSG (4-2-3-1)                       │
│  ...                                │
│                                     │
│ [gris] "Alineación disponible ~60   │
│         min antes del partido"      │
└─────────────────────────────────────┘
```

- **Refresh** → invalida cache, re-fetch de Sportmonks
- Si `available: false` → mensaje gris, no error
- Solo titulares (type_id=11), no suplentes

---

## Archivos a tocar

- `server/routes.ts` — añadir los 2 endpoints (admin + SDK)
- `server/storage.ts` o `server/sportmonksService.ts` — lógica fetch + cache
- `shared/schema.ts` — no cambios de columnas, pero documentar que `metadata` almacena teamIds
- `client/src/components/broadcast-detail.tsx` — sección Alineaciones
- Modal de crear/editar broadcast — escribir `homeTeamId`/`awayTeamId` en metadata al seleccionar fixture

---

## Test

```bash
# Fixture real (Newcastle vs Barcelona, UCL Mar 10)
curl https://api-dev.vio.live/v1/sdk/broadcasts/newcastle-united-vs-fc-barcelona-2026-03-10/lineup?apiKey=viaplay_api_key_0c611e983b314ff8

# Broadcast sin fixture
curl https://api-dev.vio.live/api/broadcasts/elkjop-gaming-live-2026-03-09/lineup
# → { available: false, message: "No fixture linked to this broadcast" }
```
