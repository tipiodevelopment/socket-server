import { adapter } from './queues';
import { processPollVote } from '../services/vote-processor';
import { processContestParticipation } from '../services/contest-processor';

export function initializeWorkers() {
  console.log('[Workers] Initializing...');

  adapter.process('vote-processing', async (job) => {
    console.log(`[Worker] Processing vote ${job.id}`);
    const result = await processPollVote(job.data);
    if (!result.success) throw new Error(result.error);
    return result;
  });

  adapter.process('contest-participation', async (job) => {
    console.log(`[Worker] Processing contest participation ${job.id}`);
    const result = await processContestParticipation(job.data);
    if (!result.success) throw new Error(result.error);
    return result;
  });

  console.log('[Workers] Initialized');
}
