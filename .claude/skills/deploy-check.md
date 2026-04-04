---
name: deploy-check
description: Pre-deploy checklist — TypeScript, build, env vars, console.log, health endpoint
user-invocable: true
---

Ejecuta checklist completo antes de deploy a produccion.

## Pasos

1. **TypeScript check**: Ejecuta `npm run check` (tsc). Si hay errores de tipo, listalos todos.

2. **Build**: Ejecuta `npm run build`. Verifica que genera:
   - `dist/public/` (frontend bundle)
   - `dist/index.js` (backend bundle)
   - `dist/preserver.js` (fast startup)

3. **Env vars requeridas**: Verifica que `.env` tiene las variables criticas:
   - `DATABASE_URL` (obligatoria)
   - `SESSION_SECRET` (obligatoria)
   - `PORT`
   - Si hay features activas que requieren keys (SPORTMONKS_API_TOKEN, STRIPE_SECRET_KEY, etc.)

4. **Console.log sueltos**: Busca `console.log` en `server/` que no sean parte de logging estructurado. Ignora:
   - Lineas con emoji (✅, ℹ️, etc.) — son logs de startup intencionales
   - Lineas dentro de `[Scheduler]`, `[Queue]`, `[Utils]` — logging estructurado
   - Reporta console.log de debugging que deberian removerse

5. **Health endpoints**: Verifica que `/health` y `/_health` responden 200

6. **Secrets expuestos**: Busca strings que parezcan API keys, tokens o passwords hardcodeados en el codigo (no en .env)

7. **Dependencias**: Ejecuta `npm audit` y reporta vulnerabilidades criticas/altas

8. Genera reporte final:
   - PASS / FAIL por cada check
   - Bloqueantes para deploy (errores de tipo, build roto)
   - Warnings (console.log, vulnerabilidades no criticas)
   - Recomendacion: listo para deploy o necesita fixes
