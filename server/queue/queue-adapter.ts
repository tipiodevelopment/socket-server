export interface QueueAdapter {
  add(queueName: string, jobName: string, data: any, options?: { jobId?: string }): Promise<void>;
  process(queueName: string, processor: (job: { id: string; data: any; attemptsMade: number }) => Promise<any>): void;
  close(): Promise<void>;
}

class SimpleQueueAdapter implements QueueAdapter {
  private queues: Map<string, Array<{ id: string; data: any; attempts: number }>>;
  private processors: Map<string, (job: { id: string; data: any; attemptsMade: number }) => Promise<any>>;
  private processing: boolean;
  private intervalId: NodeJS.Timeout | null;
  private activeJobs: Set<string>;

  constructor() {
    this.queues = new Map();
    this.processors = new Map();
    this.processing = false;
    this.intervalId = null;
    this.activeJobs = new Set();
    this.startProcessing();
  }

  async add(queueName: string, jobName: string, data: any, options?: { jobId?: string }): Promise<void> {
    if (!this.queues.has(queueName)) {
      this.queues.set(queueName, []);
    }

    const jobId = options?.jobId || `${queueName}-${jobName}-${Date.now()}-${Math.random().toString(36).slice(2)}`;
    const queue = this.queues.get(queueName)!;

    const exists = queue.find(j => j.id === jobId);
    if (exists) {
      console.log(`[SimpleQueue] Job ${jobId} already exists, skipping`);
      return;
    }

    queue.push({ id: jobId, data, attempts: 0 });
    console.log(`[SimpleQueue] Added job ${jobId} to queue ${queueName} (size: ${queue.length})`);
  }

  process(queueName: string, processor: (job: { id: string; data: any; attemptsMade: number }) => Promise<any>): void {
    this.processors.set(queueName, processor);
    console.log(`[SimpleQueue] Registered processor for queue ${queueName}`);
  }

  private startProcessing(): void {
    if (this.processing) return;
    this.processing = true;

    this.intervalId = setInterval(async () => {
      for (const [queueName, queue] of Array.from(this.queues.entries())) {
        if (queue.length === 0) continue;
        const processor = this.processors.get(queueName);
        if (!processor) continue;

        const job = queue.shift()!;

        if (this.activeJobs.has(job.id)) {
          queue.unshift(job);
          continue;
        }

        this.activeJobs.add(job.id);
        try {
          await processor({ id: job.id, data: job.data, attemptsMade: job.attempts });
          console.log(`[SimpleQueue] Job ${job.id} completed`);
        } catch (error) {
          console.error(`[SimpleQueue] Job ${job.id} failed:`, error);
          job.attempts++;
          if (job.attempts < 3) {
            queue.push(job);
            console.log(`[SimpleQueue] Retrying job ${job.id} (attempt ${job.attempts + 1}/3)`);
          } else {
            console.error(`[SimpleQueue] Job ${job.id} failed after 3 attempts`);
          }
        } finally {
          this.activeJobs.delete(job.id);
        }
      }
    }, 100);
  }

  async close(): Promise<void> {
    this.processing = false;
    if (this.intervalId) clearInterval(this.intervalId);
    this.queues.clear();
    this.processors.clear();
  }
}

class BullMQAdapter implements QueueAdapter {
  private queues: Map<string, any>;
  private workers: Map<string, any>;
  private redisConnection: any;

  constructor(redisConnection: any) {
    this.queues = new Map();
    this.workers = new Map();
    this.redisConnection = redisConnection;
  }

  async add(queueName: string, jobName: string, data: any, options?: { jobId?: string }): Promise<void> {
    if (!this.queues.has(queueName)) {
      const { Queue } = require('bullmq');
      this.queues.set(queueName, new Queue(queueName, {
        connection: this.redisConnection,
        defaultJobOptions: {
          attempts: 3,
          backoff: { type: 'exponential', delay: 2000 },
        },
      }));
    }
    await this.queues.get(queueName)!.add(jobName, data, options);
  }

  process(queueName: string, processor: (job: { id: string; data: any; attemptsMade: number }) => Promise<any>): void {
    if (this.workers.has(queueName)) return;
    const { Worker } = require('bullmq');
    const worker = new Worker(queueName, processor, {
      connection: this.redisConnection,
      concurrency: parseInt(process.env.QUEUE_CONCURRENCY || '10'),
    });
    this.workers.set(queueName, worker);
  }

  async close(): Promise<void> {
    for (const worker of Array.from(this.workers.values())) await worker.close();
    for (const queue of Array.from(this.queues.values())) await queue.close();
  }
}

export function createQueueAdapter(): QueueAdapter {
  const useRedis = process.env.QUEUE_ENABLED === 'true' &&
                   (process.env.REDIS_HOST || process.env.REDIS_URL);

  if (useRedis) {
    try {
      const Redis = require('ioredis');
      const redisConnection = new Redis({
        host: process.env.REDIS_HOST || 'localhost',
        port: parseInt(process.env.REDIS_PORT || '6379'),
        password: process.env.REDIS_PASSWORD || undefined,
        ...(process.env.REDIS_URL ? { url: process.env.REDIS_URL } : {}),
      });
      console.log('[Queue] Using BullMQ adapter with Redis');
      return new BullMQAdapter(redisConnection);
    } catch (error) {
      console.error('[Queue] Redis failed, falling back to Simple adapter:', error);
      return new SimpleQueueAdapter();
    }
  } else {
    console.log('[Queue] Using Simple in-memory adapter');
    return new SimpleQueueAdapter();
  }
}

let queueAdapterInstance: QueueAdapter | null = null;

export function getQueueAdapter(): QueueAdapter {
  if (!queueAdapterInstance) {
    queueAdapterInstance = createQueueAdapter();
  }
  return queueAdapterInstance;
}
