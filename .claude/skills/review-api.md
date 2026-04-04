---
name: review-api
description: Audita endpoints del backend buscando problemas de seguridad, validacion y best practices
user-invocable: true
---

Audita los endpoints en `server/routes.ts` siguiendo las reglas de `VIO_BEST_PRACTICES.md`.

## Pasos

1. Lee `server/routes.ts` completo
2. Para cada endpoint, verifica:
   - **Auth**: Endpoints `/v1/sdk/*` y `/v1/engagement/*` deben tener `validateApiKey`. Endpoints `/v1/broadcasts/*` (admin) deben tener `requireBearerAuth`.
   - **Validacion**: Los body de POST/PUT/PATCH deben validarse con Zod schemas. Reporta endpoints sin validacion.
   - **Error handling**: Cada endpoint debe tener try/catch con respuesta de error apropiada (400, 404, 500). Reporta endpoints sin manejo de errores.
   - **Rate limiting**: Endpoints de engagement (vote, participate) deben tener rate limiting (30/min votes, 10/min contests). Reporta si falta.
   - **Keys hardcodeadas**: Busca strings que parezcan API keys, tokens o secrets hardcodeados. Deben venir de env vars.
3. Lee `server/middleware/rate-limiter.ts` y verifica que los presets estan aplicados correctamente
4. Genera un reporte con:
   - Total de endpoints auditados
   - Problemas encontrados (critico/medio/bajo)
   - Endpoints sin auth
   - Endpoints sin validacion Zod
   - Endpoints sin error handling
   - Recomendaciones especificas
