/**
 * Servicio de procesamiento de participaciones en concursos
 *
 * Actualmente síncrono - llamado directamente desde los endpoints.
 * Preparado para ser invocado desde un worker de BullMQ en el futuro.
 *
 * Flujo actual:  Endpoint → processContestParticipationSync() → DB
 * Flujo futuro:  Endpoint → contestQueue.add() → Worker → processContestParticipation() → DB
 */

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

  const participation = await storage.createContestParticipation({
    contestId,
    userId,
    broadcastId,
    answers: answers || null,
  });

  return { success: true, data: participation };
}

/**
 * Versión para workers de BullMQ (futuro)
 * Por ahora redirige a la versión síncrona
 */
export async function processContestParticipation(
  data: ContestParticipationJobData
): Promise<JobResult> {
  return await processContestParticipationSync(data);
}
