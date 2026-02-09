/**
 * Rate Limiter middleware
 * TODO: Implementar backend Redis cuando se agregue la cola de mensajería
 *
 * Por ahora, todos los rate limiters son passthrough (siempre permiten).
 * Cuando se agregue Redis, descomentar la lógica de sliding window.
 */

import { Request, Response, NextFunction } from 'express';

interface RateLimitOptions {
  maxRequests: number;
  windowSeconds: number;
  keyGenerator?: (req: Request) => string;
}

export function createRateLimiter(options: RateLimitOptions) {
  const { maxRequests, windowSeconds, keyGenerator } = options;

  return async (req: Request, res: Response, next: NextFunction) => {
    // TODO: Implementar cuando se agregue Redis
    // const redis = getRedisConnection();
    // const key = keyGenerator ? keyGenerator(req) : `rate_limit:${req.ip}`;
    //
    // const allowed = await checkRateLimit(redis, key, maxRequests, windowSeconds);
    //
    // if (!allowed) {
    //   return res.status(429).json({
    //     error: 'Rate limit exceeded',
    //     retryAfter: windowSeconds,
    //   });
    // }
    //
    // res.setHeader('X-RateLimit-Limit', maxRequests);
    // res.setHeader('X-RateLimit-Window', windowSeconds);

    next();
  };
}

/**
 * Función helper para verificar rate limit (futuro)
 * Usa Redis Sorted Sets con sliding window
 */
async function checkRateLimit(
  redis: any,
  key: string,
  maxRequests: number,
  windowSeconds: number
): Promise<boolean> {
  // TODO: Implementar sliding window usando Redis Sorted Sets
  // const now = Date.now();
  // const windowStart = now - windowSeconds * 1000;
  //
  // const pipe = redis.pipeline();
  // pipe.zremrangebyscore(key, 0, windowStart);
  // pipe.zcard(key);
  // pipe.zadd(key, now, `${now}-${Math.random()}`);
  // pipe.expire(key, windowSeconds);
  // const results = await pipe.exec();
  //
  // const currentCount = results[1][1] as number;
  // return currentCount < maxRequests;

  return true;
}

export const voteRateLimiter = createRateLimiter({
  maxRequests: 10,
  windowSeconds: 60,
  keyGenerator: (req) => `rate_limit:vote:${req.body.userId || req.ip}`,
});

export const contestRateLimiter = createRateLimiter({
  maxRequests: 5,
  windowSeconds: 60,
  keyGenerator: (req) => `rate_limit:contest:${req.body.userId || req.ip}`,
});

export const sdkRateLimiter = createRateLimiter({
  maxRequests: 100,
  windowSeconds: 60,
  keyGenerator: (req) => `rate_limit:sdk:${(req as any).clientApp?.id || req.ip}`,
});
