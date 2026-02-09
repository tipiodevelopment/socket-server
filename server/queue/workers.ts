/**
 * Workers para procesar jobs de las colas
 * TODO: Implementar cuando se agregue Redis/BullMQ
 *
 * Instrucciones futuras:
 * 1. Descomentar las importaciones y workers
 * 2. Los workers llaman a los servicios en server/services/
 * 3. Los servicios ya contienen la lógica de procesamiento
 */

// import { Worker } from 'bullmq';
// import { processPollVote } from '../services/vote-processor';
// import { processContestParticipation } from '../services/contest-processor';
// import { VoteJobData, ContestParticipationJobData, DEFAULT_QUEUE_CONFIG } from './types';
// import Redis from 'ioredis';
//
// const redisConnection = new Redis({
//   host: DEFAULT_QUEUE_CONFIG.host,
//   port: DEFAULT_QUEUE_CONFIG.port,
//   password: DEFAULT_QUEUE_CONFIG.password,
//   maxRetriesPerRequest: null,
// });
//
// export const voteWorker = new Worker<VoteJobData>(
//   'vote-queue',
//   async (job) => {
//     console.log(`[Worker] Processing vote job ${job.id}`);
//     const result = await processPollVote(job.data);
//     if (!result.success) {
//       throw new Error(result.error);
//     }
//     return result;
//   },
//   {
//     connection: redisConnection,
//     concurrency: DEFAULT_QUEUE_CONFIG.concurrency,
//     limiter: {
//       max: DEFAULT_QUEUE_CONFIG.maxJobsPerSecond,
//       duration: 1000,
//     },
//   }
// );
//
// export const contestParticipationWorker = new Worker<ContestParticipationJobData>(
//   'contest-participation-queue',
//   async (job) => {
//     console.log(`[Worker] Processing contest participation job ${job.id}`);
//     const result = await processContestParticipation(job.data);
//     if (!result.success) {
//       throw new Error(result.error);
//     }
//     return result;
//   },
//   {
//     connection: redisConnection,
//     concurrency: DEFAULT_QUEUE_CONFIG.concurrency,
//     limiter: {
//       max: DEFAULT_QUEUE_CONFIG.maxJobsPerSecond,
//       duration: 1000,
//     },
//   }
// );
//
// voteWorker.on('completed', (job) => {
//   console.log(`[Worker] Vote job ${job.id} completed`);
// });
//
// voteWorker.on('failed', (job, error) => {
//   console.error(`[Worker] Vote job ${job?.id} failed:`, error.message);
// });
//
// contestParticipationWorker.on('completed', (job) => {
//   console.log(`[Worker] Contest participation job ${job.id} completed`);
// });
//
// contestParticipationWorker.on('failed', (job, error) => {
//   console.error(`[Worker] Contest participation job ${job?.id} failed:`, error.message);
// });

export const voteWorker = null;
export const contestParticipationWorker = null;
