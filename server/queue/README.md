# Sistema de Cola de Mensajería

Este directorio contiene la estructura preparada para implementar un sistema de cola de mensajería usando Redis y BullMQ.

## Estado Actual

- ✅ Estructura de archivos creada
- ✅ Tipos TypeScript definidos (`types.ts`)
- ✅ Abstracciones de colas preparadas (`queues.ts`)
- ✅ Workers definidos con código comentado (`workers.ts`)
- ✅ Servicios de procesamiento extraídos (`../services/vote-processor.ts`, `../services/contest-processor.ts`)
- ✅ Rate limiting middleware preparado (`../middleware/rate-limiter.ts`)
- ❌ Redis/BullMQ no instalado aún
- ❌ Workers no activos

## Para Implementar en el Futuro

### 1. Instalar dependencias

```bash
npm install bullmq ioredis
```

### 2. Configurar Redis

Agregar variables de entorno:

```
REDIS_HOST=localhost
REDIS_PORT=6379
REDIS_PASSWORD=
REDIS_URL=redis://localhost:6379
QUEUE_ENABLED=true
QUEUE_CONCURRENCY=10
QUEUE_MAX_JOBS_PER_SECOND=100
```

### 3. Activar las colas

1. Descomentar el código en `queues.ts`
2. Descomentar el código en `workers.ts`
3. Modificar los endpoints en `server/routes.ts` para usar `voteQueue.add()` en vez de `processPollVoteSync()`
4. Descomentar el rate limiter en los endpoints de engagement

### 4. Verificar

- Los servicios en `server/services/` ya contienen toda la lógica de procesamiento
- Los workers solo necesitan llamar a esos servicios
- El rate limiter en `server/middleware/rate-limiter.ts` necesita Redis para funcionar

## Arquitectura Objetivo

```
Cliente → Endpoint → Rate Limiter → Cola → Worker → Servicio → DB + WebSocket
```

vs Arquitectura actual:

```
Cliente → Endpoint → Servicio (síncrono) → DB + WebSocket
```

## Colas Definidas

| Cola | Descripción | Concurrencia |
|------|-------------|-------------|
| `vote-queue` | Procesa votos de polls | 10 |
| `contest-participation-queue` | Procesa participaciones en contests | 10 |
| `broadcast-status-queue` | Transiciones de estado de broadcasts | 5 |
