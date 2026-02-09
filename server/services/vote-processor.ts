/**
 * Servicio de procesamiento de votos
 *
 * Actualmente síncrono - llamado directamente desde los endpoints.
 * Preparado para ser invocado desde un worker de BullMQ en el futuro.
 *
 * Flujo actual:  Endpoint → processPollVoteSync() → DB + WebSocket
 * Flujo futuro:  Endpoint → voteQueue.add() → Worker → processPollVote() → DB + WebSocket
 */

import { VoteJobData, JobResult } from '../queue/types';
import { storage } from '../storage';

export async function processPollVoteSync(
  data: VoteJobData,
  broadcastToCampaign?: (campaignId: number, message: string) => void
): Promise<JobResult> {
  const { pollId, optionId, userId, broadcastId } = data;

  const poll = await storage.getPoll(pollId);
  if (!poll) {
    return { success: false, error: 'Poll not found' };
  }
  if (!poll.isActive) {
    return { success: false, error: 'Poll is not active' };
  }

  const hasVoted = await storage.hasUserVoted(pollId, userId);
  if (hasVoted) {
    return { success: false, error: 'User has already voted on this poll' };
  }

  await storage.createPollVote({
    pollId,
    optionId,
    userId,
    broadcastId,
  });

  const results = await storage.getPollResults(pollId);

  if (broadcastToCampaign && poll.broadcastId) {
    const broadcast = await storage.getBroadcast(poll.broadcastId);
    if (broadcast?.campaignId) {
      broadcastToCampaign(broadcast.campaignId, JSON.stringify({
        type: 'poll_results_updated',
        broadcastId: poll.broadcastId,
        pollId,
        results,
      }));
    }
  }

  return { success: true, data: results };
}

/**
 * Versión para workers de BullMQ (futuro)
 * Por ahora redirige a la versión síncrona
 */
export async function processPollVote(data: VoteJobData): Promise<JobResult> {
  return await processPollVoteSync(data);
}
