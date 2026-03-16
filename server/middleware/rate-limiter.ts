import { Request, Response, NextFunction } from 'express';

interface RateLimitOptions {
  maxRequests: number;
  windowSeconds: number;
  keyGenerator?: (req: Request) => string;
}

class SimpleRateLimiter {
  private requests: Map<string, Array<number>>;

  constructor() {
    this.requests = new Map();
    setInterval(() => {
      const now = Date.now();
      const entries = Array.from(this.requests.entries());
      for (const [key, timestamps] of entries) {
        const filtered = timestamps.filter((ts: number) => now - ts < 120000);
        if (filtered.length === 0) {
          this.requests.delete(key);
        } else {
          this.requests.set(key, filtered);
        }
      }
    }, 10000);
  }

  async check(key: string, maxRequests: number, windowSeconds: number) {
    const now = Date.now();
    const windowStart = now - windowSeconds * 1000;

    if (!this.requests.has(key)) {
      this.requests.set(key, []);
    }

    const timestamps = this.requests.get(key)!;
    const validTimestamps = timestamps.filter(ts => ts > windowStart);
    this.requests.set(key, validTimestamps);

    const currentCount = validTimestamps.length;
    const allowed = currentCount < maxRequests;
    const remaining = Math.max(0, maxRequests - currentCount - (allowed ? 1 : 0));
    const resetAt = now + windowSeconds * 1000;

    if (allowed) {
      validTimestamps.push(now);
    }

    return { allowed, remaining, resetAt };
  }
}

class RedisRateLimiter {
  private redis: any;

  constructor(redis: any) {
    this.redis = redis;
  }

  async check(key: string, maxRequests: number, windowSeconds: number) {
    const now = Date.now();
    const windowStart = now - windowSeconds * 1000;

    try {
      const pipe = this.redis.pipeline();
      pipe.zremrangebyscore(key, 0, windowStart);
      pipe.zcard(key);
      pipe.zadd(key, now, `${now}-${Math.random()}`);
      pipe.expire(key, windowSeconds);
      const results = await pipe.exec();

      if (!results) {
        return { allowed: true, remaining: maxRequests, resetAt: now + windowSeconds * 1000 };
      }

      const currentCount = results[1][1] as number;
      const allowed = currentCount < maxRequests;
      const remaining = Math.max(0, maxRequests - currentCount - 1);
      const resetAt = now + windowSeconds * 1000;

      return { allowed, remaining, resetAt };
    } catch (error) {
      console.error('[RateLimiter] Redis error, allowing request:', error);
      return { allowed: true, remaining: maxRequests, resetAt: now + windowSeconds * 1000 };
    }
  }
}

let rateLimiterInstance: SimpleRateLimiter | RedisRateLimiter | null = null;

function getRateLimiter() {
  if (rateLimiterInstance) return rateLimiterInstance;

  const useRedis = process.env.REDIS_HOST || process.env.REDIS_URL;

  if (useRedis) {
    try {
      const Redis = require('ioredis');
      const redis = new Redis({
        host: process.env.REDIS_HOST || 'localhost',
        port: parseInt(process.env.REDIS_PORT || '6379'),
        password: process.env.REDIS_PASSWORD || undefined,
        ...(process.env.REDIS_URL ? { url: process.env.REDIS_URL } : {}),
      });
      console.log('[RateLimiter] Using Redis');
      rateLimiterInstance = new RedisRateLimiter(redis);
    } catch (error) {
      console.error('[RateLimiter] Redis failed, using Simple:', error);
      rateLimiterInstance = new SimpleRateLimiter();
    }
  } else {
    console.log('[RateLimiter] Using Simple in-memory');
    rateLimiterInstance = new SimpleRateLimiter();
  }

  return rateLimiterInstance;
}

export function createRateLimiter(options: RateLimitOptions) {
  const { maxRequests, windowSeconds, keyGenerator } = options;

  return async (req: Request, res: Response, next: NextFunction) => {
    const limiter = getRateLimiter();
    const key = keyGenerator ? keyGenerator(req) : `rate_limit:${req.ip}`;

    try {
      const limit = await limiter.check(key, maxRequests, windowSeconds);

      if (!limit.allowed) {
        return res.status(429).json({
          error: 'Rate limit exceeded',
          retryAfter: Math.ceil((limit.resetAt - Date.now()) / 1000),
          limit: maxRequests,
          window: windowSeconds,
        });
      }

      res.setHeader('X-RateLimit-Limit', maxRequests.toString());
      res.setHeader('X-RateLimit-Remaining', limit.remaining.toString());
      res.setHeader('X-RateLimit-Reset', limit.resetAt.toString());

      next();
    } catch (error) {
      console.error('[RateLimiter] Error, allowing request:', error);
      next();
    }
  };
}

export const rateLimitPresets = {
  voting: {
    maxRequests: 30,
    windowSeconds: 60,
    keyGenerator: (req: Request) => `rate_limit:vote:${req.body.userId || req.ip}`,
  },
  participation: {
    maxRequests: 10,
    windowSeconds: 60,
    keyGenerator: (req: Request) => `rate_limit:contest:${req.body.userId || req.ip}`,
  },
  sdkPublic: {
    maxRequests: 60,
    windowSeconds: 60,
    keyGenerator: (req: Request) => `rate_limit:sdk:${req.ip}`,
  },
  adminApi: {
    maxRequests: 100,
    windowSeconds: 60,
    keyGenerator: (req: Request) => `rate_limit:admin:${req.ip}`,
  },
};
