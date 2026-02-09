/**
 * Configuración de colas de mensajería
 * TODO: Implementar cuando se agregue Redis/BullMQ
 *
 * Instrucciones futuras:
 * 1. Instalar: npm install bullmq ioredis
 * 2. Configurar conexión Redis en variables de entorno
 * 3. Descomentar y configurar las colas abajo
 */

// import { Queue } from 'bullmq';
// import Redis from 'ioredis';
// import { DEFAULT_QUEUE_CONFIG } from './types';
//
// const redisConnection = new Redis({
//   host: DEFAULT_QUEUE_CONFIG.host,
//   port: DEFAULT_QUEUE_CONFIG.port,
//   password: DEFAULT_QUEUE_CONFIG.password,
//   maxRetriesPerRequest: null,
// });
//
// export const voteQueue = new Queue('vote-queue', {
//   connection: redisConnection,
//   defaultJobOptions: {
//     attempts: DEFAULT_QUEUE_CONFIG.maxRetries,
//     backoff: {
//       type: 'exponential',
//       delay: DEFAULT_QUEUE_CONFIG.backoffDelay,
//     },
//     removeOnComplete: { age: 3600 },
//     removeOnFail: { age: 86400 },
//   },
// });
//
// export const contestParticipationQueue = new Queue('contest-participation-queue', {
//   connection: redisConnection,
//   defaultJobOptions: {
//     attempts: DEFAULT_QUEUE_CONFIG.maxRetries,
//     backoff: {
//       type: 'exponential',
//       delay: DEFAULT_QUEUE_CONFIG.backoffDelay,
//     },
//     removeOnComplete: { age: 3600 },
//     removeOnFail: { age: 86400 },
//   },
// });
//
// export const broadcastStatusQueue = new Queue('broadcast-status-queue', {
//   connection: redisConnection,
//   defaultJobOptions: {
//     attempts: 5,
//     backoff: {
//       type: 'exponential',
//       delay: 1000,
//     },
//   },
// });

export const voteQueue = null;
export const contestParticipationQueue = null;
export const broadcastStatusQueue = null;

export function isQueueEnabled(): boolean {
  return process.env.QUEUE_ENABLED === 'true';
}
