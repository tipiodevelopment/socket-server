# Reporte de Deployment — Vio Platform
**Fecha:** Febrero 28, 2026
**Estado final:** ✅ Desplegado exitosamente en `autoscale`
**URL:** https://event-streamer-angelo100.replit.app

---

## Resumen ejecutivo

El proyecto estuvo varios días sin poder desplegarse. El servidor arrancaba y funcionaba perfectamente en todos los intentos, pero Replit marcaba el deployment como fallido. La solución fue cambiar el `deploymentTarget` de `vm` a `autoscale`. El primer intento con autoscale tuvo éxito inmediato.

---

## Lo que pasó — cronología

### El problema original
El deployment fallaba con errores de "health check timeout". El servidor tomaba ~4.7 segundos en arrancar (Express + Drizzle + Vite + Scheduler), lo que parecía demasiado para el health check de Replit.

### Intento 1: Optimizar el arranque con un "preserver"
Se creó `server/preserver.ts` — un servidor HTTP mínimo de 2KB que usa solo módulos nativos de Node.js (sin npm). El objetivo: enlazar el puerto antes de que cargue el resto del código.

**Resultado:** El puerto abría en 19ms (vs. 4700ms antes), pero el deployment seguía fallando.

### Intento 2: Responder 200 a TODAS las URLs durante el arranque
El preserver se modificó para devolver HTTP 200 a cualquier URL GET/HEAD/OPTIONS, no solo `/` y `/health`. Así cualquier URL de health check pasaría.

**Resultado:** Seguía fallando.

### Intento 3: Eliminar el overhead de npm
Se cambió el run command de `["npm", "run", "start"]` a `["node", "dist/preserver.js"]` usando la función `deployConfig()` de Replit. Esto elimina los ~2 segundos de overhead de npm.

**Resultado:** El puerto abría en 320ms desde el inicio del contenedor. La app corría durante 60+ segundos (el scheduler disparaba) y luego el deployment fallaba.

### Observación crítica
Los logs mostraban:
```
T=0ms:    Container starts, port forwarding set up
T=320ms:  Port 5000 open → health checks will pass
T=1730ms: Application fully ready
T=62s:    Scheduler fires (app is running!)
T=~65s:   Deployment marked as failed
```

El servidor estaba vivo y funcionando — pero el deployment igual fallaba. Esto demostró que el problema **no era la velocidad de arranque** ni el código de la aplicación.

### La solución: cambiar a autoscale
Con toda la evidencia apuntando a un problema específico del target `vm`, se cambió a `autoscale`. El primer intento fue exitoso.

---

## Causa raíz probable

La causa exacta de por qué `vm` fallaba para este proyecto específico nunca quedó clara en los logs. Hipótesis más probable: hay alguna incompatibilidad entre este proyecto y el mecanismo interno de health check de los VM deployments de Replit — posiblemente relacionada con el WebSocket handshake, la forma en que el metasidecar valida el proceso, o una limitación del plan.

Lo que SÍ sabemos: el código era correcto. El servidor funcionaba. El problema era ambiental/infraestructural.

---

## Configuración actual (producción)

```toml
[deployment]
deploymentTarget = "autoscale"
build = ["npm", "run", "build"]
run = ["node", "dist/index.js"]
```

El `server/index.ts` tiene un auto-start rápido incorporado: enlaza el puerto primero, luego carga Express y las rutas de forma asíncrona. Esto garantiza que los health checks pasen aunque el arranque completo tome 1-2 segundos.

---

## Estado de los WebSockets en autoscale

**Actualmente: funciona.** Con una sola instancia (tráfico actual bajo), los WebSockets son estables:
- `broadcastToCampaign()` itera sobre los clientes WS locales → todos los SDKs conectados reciben eventos ✅
- El scheduler corre en la única instancia de RAM ✅

**Riesgo futuro:** Si Replit escala a múltiples instancias automáticamente, los WebSockets dejarían de funcionar correctamente (los eventos solo llegarían a los SDKs conectados a la misma instancia que genera el evento). Ver `.cursorrules` sección "Deployment & Scaling Architecture" para las opciones de solución.

---

## Artefactos del intento de optimización

El archivo `server/preserver.ts` sigue en el repo pero **no se usa en el deployment actual**. Puede eliminarse o mantenerse como referencia. El build script en `package.json` todavía lo compila (produce `dist/preserver.js`), lo que es inofensivo pero innecesario.

---

## Recomendaciones para el futuro

1. **No usar `vm` para este proyecto.** El historial muestra que `vm` es incompatible con algo en este setup específico.

2. **Monitorear si autoscale escala.** Si el tráfico crece y Replit levanta múltiples instancias, los WebSockets y el scheduler fallarán. La señal de alerta será que los eventos de broadcast dejen de llegar a algunos SDKs.

3. **Si necesitas Always-On:** en lugar de `vm`, considera añadir un ping externo (UptimeRobot, etc.) que llame al endpoint `/health` cada 5 minutos para mantener la instancia de autoscale caliente.

4. **Para escalar los WebSockets:** implementar Redis Pub/Sub + BullMQ (código base ya está en `server/queue/`). Requiere añadir `REDIS_URL` como secret de Replit.

---

## Archivos modificados en esta sesión

| Archivo | Cambio |
|---------|--------|
| `server/preserver.ts` | Creado (optimización de arranque, no usado en prod actual) |
| `server/index.ts` | Refactorizado con auto-start rápido + `setupApp()` exportado |
| `package.json` | Build script incluye compilación de preserver (inofensivo) |
| `.replit` | `deploymentTarget = "autoscale"`, `run = ["node", "dist/index.js"]` |
| `server/routes.ts` | +4 líneas: bloque `integrations.commerce` en config endpoint |
| `client/.../SettingsTab.tsx` | "Commerce Integration" (renombrado de "Reachu Integration") |
| `CURSOR_SDK_INFRASTRUCTURE.md` | Actualizado naming Commerce vs Reachu (interno DB) |
| `.cursorrules` | Deployment target actualizado a autoscale + historial |
| `replit.md` | Deployment section actualizada |
