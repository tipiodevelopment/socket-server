# TASK-UI-07-FIX — Position mapping bug (fix rápido)

## El endpoint funciona ✅ — pero hay un bug en mapPosition()

**Síntoma**: Newcastle devuelve `formation: "3-0-3"` y 5 goalkeepers por equipo.

**Causa**: Los position_id del task original estaban mal. Verifiqué directamente contra Sportmonks API con el fixture 19662563 (Newcastle vs Barcelona). Los IDs reales son:

```
24 → goalkeeper
25 → defender
26 → midfielder
27 → forward
```

## Fix — cambiar mapPosition() en server/routes.ts

Busca la función `mapPosition` y reemplaza todo su contenido por:

```typescript
function mapPosition(positionId: number): string {
  switch (positionId) {
    case 24: return "goalkeeper";
    case 25: return "defender";
    case 26: return "midfielder";
    case 27: return "forward";
    default: return "forward";
  }
}
```

## Validación post-fix

```bash
curl "https://api-dev.vio.live/v1/sdk/broadcasts/newcastle-united-vs-fc-barcelona-2026-03-10/lineup?apiKey=viaplay_api_key_0c611e983b314ff8"
```

Resultado esperado:
```json
{
  "available": true,
  "home": {
    "teamName": "Newcastle United",
    "formation": "4-3-3",
    "players": [
      { "name": "Nick Pope", "jerseyNumber": 1, "position": "goalkeeper" },
      { "name": "Kieran Trippier", "position": "defender" },
      ...
    ]
  }
}
```

## Es un cambio de 5 líneas. Prioridad: alta — afecta todos los broadcasts.
