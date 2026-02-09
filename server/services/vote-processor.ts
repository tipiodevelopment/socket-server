import { VoteJobData, JobResult } from '../queue/types';
import { storage } from '../storage';

let broadcastFn: ((campaignId: number, message: string) => void) | null = null;

export function setVoteBroadcastFunction(fn: (campaignId: number, message: string) => void) {
  broadcastFn = fn;
}

export async function processPollVoteSync(
  data: VoteJobData
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

  await storage.updatePollOptionVoteCount(optionId, 1);

  const results = await storage.getPollResults(pollId);

  if (broadcastFn && poll.broadcastId) {
    const broadcast = await storage.getBroadcast(poll.broadcastId);
    if (broadcast?.campaignId && results) {
      const totalVotes = results.poll.totalVotes;
      const optionsWithPercentages = results.options.map((opt: any) => ({
        ...opt,
        percentage: totalVotes > 0 ? Math.round((opt.voteCount / totalVotes) * 10000) / 100 : 0
      }));
      broadcastFn(broadcast.campaignId, JSON.stringify({
        type: 'poll_results_updated',
        broadcastId: poll.broadcastId,
        pollId,
        results: { ...results.poll, options: optionsWithPercentages },
      }));
    }
  }

  return { success: true, data: results };
}

export async function processPollVote(data: VoteJobData): Promise<JobResult> {
  return await processPollVoteSync(data);
}
