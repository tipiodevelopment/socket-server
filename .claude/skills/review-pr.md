---
name: review-pr
description: Review completo de PR — tipos, legacy, WS events, keys, best practices VIO
user-invocable: true
---

Analiza los cambios del branch actual vs main y genera un code review completo.

## Pasos

1. Ejecuta `git diff main...HEAD` para ver todos los cambios del branch
2. Ejecuta `git log main..HEAD --oneline` para ver los commits

3. Para cada archivo modificado, revisa:

### shared/schema.ts (si cambio)
- Nuevas columnas tienen defaults o son nullable (para no romper datos existentes)
- Foreign keys tienen ON DELETE apropiado (CASCADE vs SET NULL)
- Indices en campos que se usaran en WHERE clauses

### server/routes.ts (si cambio)
- Nuevos endpoints tienen auth (`validateApiKey` o `requireBearerAuth`)
- Body validation con Zod
- Error handling con try/catch
- Endpoints `/v1/sdk/*` usan `validateApiKey`
- Rate limiting en endpoints de engagement

### server/storage.ts (si cambio)
- Queries usan transacciones para operaciones multi-tabla
- No hay N+1 queries (loops que hacen queries individuales)

### client/ (si cambio)
- Usa TanStack Query (no fetch directo)
- Mutations invalidan queries relacionadas
- No hay keys/URLs hardcodeadas

### General
- No rompe legacy (campaigns existentes siguen funcionando)
- WS events siguen formato `{ type, data, broadcastId }`
- No hay `console.log` de debugging
- No hay API keys, tokens o secrets hardcodeados
- Commits siguen convencion: `feat:`, `fix:`, `docs:`, `chore:`, `refactor:`
- No hay archivos innecesarios (node_modules, .env, dist/)

4. Genera reporte:
   - Resumen de cambios (que hace este PR)
   - Problemas criticos (bloquean merge)
   - Warnings (deberian arreglarse)
   - Sugerencias (nice to have)
   - Veredicto: APPROVE / REQUEST CHANGES / NEEDS DISCUSSION
