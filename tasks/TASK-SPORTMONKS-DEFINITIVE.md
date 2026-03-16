# TASK: Sportmonks — Implementación definitiva (ligas + fixtures con cache correcta)
## STATUS: COMPLETED ✅ (Mar-09-2026)

## Cambios realizados

| Archivo | Cambio |
|---------|--------|
| `server/routes.ts` | TTL diferenciado (6h fixtures / 2d leagues), quitado `?leagues=` de URL Sportmonks, filtro server-side antes de cachear |
| DB | `DELETE FROM sportmonks_cache WHERE cache_type='fixtures'` — limpiada cache contaminada (11 filas) |

## Verificación exitosa
- CL 2026-03-10: 4 fixtures correctos (Galatasaray-Liverpool, Newcastle-Barcelona, Atalanta-Bayern, Atlético-Tottenham)
- Championship 2026-03-10: 6 fixtures, cero contaminación de otras ligas
- Segunda llamada CL: 38ms vs 584ms → cache hit confirmado
