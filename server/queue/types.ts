/**
 * Tipos para el sistema de cola de mensajería (futuro)
 * TODO: Implementar cuando se agregue Redis/BullMQ
 */

export interface VoteJobData {
  pollId: number;
  optionId: number;
  userId: string;
  broadcastId: string;
  timestamp: string;
}

export interface ContestParticipationJobData {
  contestId: number;
  userId: string;
  broadcastId: string;
  answers?: Record<string, any>;
  timestamp: string;
}

export interface BroadcastStatusJobData {
  broadcastId: string;
  newStatus: 'upcoming' | 'live' | 'ended';
  timestamp: string;
}

export interface ComponentScheduleJobData {
  campaignId: number;
  componentId: string;
  action: 'activate' | 'deactivate';
  timestamp: string;
}

export interface JobResult {
  success: boolean;
  error?: string;
  data?: any;
}

export interface QueueConfig {
  host: string;
  port: number;
  password?: string;
  maxRetries: number;
  backoffDelay: number;
  concurrency: number;
  maxJobsPerSecond: number;
}

export const DEFAULT_QUEUE_CONFIG: QueueConfig = {
  host: process.env.REDIS_HOST || 'localhost',
  port: parseInt(process.env.REDIS_PORT || '6379'),
  password: process.env.REDIS_PASSWORD,
  maxRetries: 3,
  backoffDelay: 2000,
  concurrency: 10,
  maxJobsPerSecond: 100,
};
