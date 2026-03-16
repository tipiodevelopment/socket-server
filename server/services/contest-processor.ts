import { ContestParticipationJobData, JobResult } from '../queue/types';
import { storage } from '../storage';

export async function processContestParticipationSync(
  data: ContestParticipationJobData
): Promise<JobResult> {
  const { contestId, userId, broadcastId, answers } = data;

  const contest = await storage.getContest(contestId);
  if (!contest) {
    return { success: false, error: 'Contest not found' };
  }
  if (!contest.isActive) {
    return { success: false, error: 'Contest is not active' };
  }

  const hasParticipated = await storage.hasUserParticipated(contestId, userId);
  if (hasParticipated) {
    return { success: false, error: 'User has already participated in this contest' };
  }

  const participation = await storage.createContestParticipationAtomic({
    contestId,
    userId,
    broadcastId,
    answers: answers || null,
  });

  return { success: true, data: participation };
}

export async function processContestParticipation(
  data: ContestParticipationJobData
): Promise<JobResult> {
  return await processContestParticipationSync(data);
}
