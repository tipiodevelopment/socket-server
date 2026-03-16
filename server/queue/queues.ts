import { getQueueAdapter } from './queue-adapter';

const adapter = getQueueAdapter();

export const voteQueue = {
  add: async (jobName: string, data: any, options?: { jobId?: string }) => {
    await adapter.add('vote-processing', jobName, data, options);
  },
};

export const contestParticipationQueue = {
  add: async (jobName: string, data: any, options?: { jobId?: string }) => {
    await adapter.add('contest-participation', jobName, data, options);
  },
};

export const broadcastStatusQueue = {
  add: async (jobName: string, data: any, options?: { jobId?: string }) => {
    await adapter.add('broadcast-status', jobName, data, options);
  },
};

export function isQueueEnabled(): boolean {
  return process.env.USE_QUEUE === 'true';
}

export { adapter };
