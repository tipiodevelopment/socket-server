# TASK-CACHE-CLEAR-LINEUP — Limpiar cache lineup (urgente)

## Problema
El fix de `mapPosition()` está en el código pero el cache guarda el dato antiguo con posiciones incorrectas.
TTL = 30 min — hay que borrarlo manualmente ahora.

## Acción — ejecutar en Neon DB console

```sql
DELETE FROM sportmonks_cache 
WHERE cache_key LIKE 'lineup_%';
```

Esto borra todos los lineups cacheados. Al hacer el siguiente GET, se re-fetcheará de Sportmonks con el mapeo correcto.

## Verificación después del DELETE

```bash
curl "https://api-dev.vio.live/v1/sdk/broadcasts/newcastle-united-vs-fc-barcelona-2026-03-10/lineup?apiKey=viaplay_api_key_0c611e983b314ff8"
```

Resultado esperado:
- `formation: "4-3-3"` (no "3-0-3")
- `positions: { goalkeeper: 1, defender: 4, midfielder: 3, forward: 3 }`
- Nick Pope → goalkeeper ✓
- Trippier → defender ✓

## Urgente — hacerlo ahora

---

## Update 18:30 — Solo Newcastle sigue con cache antiguo

Atalanta, Atlético y Galatasaray ya muestran formaciones correctas.
Newcastle vs Barcelona (fixture_id: **19662563**) sigue cacheado.

Ejecutar en Neon DB:

```sql
DELETE FROM sportmonks_cache 
WHERE cache_key = 'lineup_19662563';
```

O más seguro — borrar todos los lineup:

```sql
DELETE FROM sportmonks_cache 
WHERE cache_key LIKE 'lineup_%';
```
