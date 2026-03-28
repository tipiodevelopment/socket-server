import "./env";
import Redis from "ioredis";

const CACHE_ENABLED = (process.env.CACHE_ENABLED || "false").toLowerCase() === "true";
const CACHE_HOST = process.env.CACHE_HOST || "localhost";
const CACHE_PORT = Number(process.env.CACHE_PORT || 6379);
const CACHE_USER = process.env.CACHE_USER || "";
const CACHE_PASSWORD = process.env.CACHE_PASSWORD || "";
const SENTINEL_HOSTS = Number(process.env.SENTINEL_HOSTS || 2);
const REDIS_MASTER_NAME = process.env.REDIS_MASTER_NAME || "mymaster";
const PRESENCE_TTL_SECONDS = Number(process.env.WS_PRESENCE_TTL_SECONDS || 90);
const PRESENCE_KEY_PREFIX = "ws:presence:user";

const getSentinelHosts = () => {
  const hosts: Array<{ host: string; port: number }> = [];
  for (let i = 0; i < SENTINEL_HOSTS; i += 1) {
    hosts.push({
      host: `redis-sentinel-${i}.redis-sentinel.default.svc.cluster.local`,
      port: 26379,
    });
  }
  return hosts;
};

const getRedisConfig = () => {
  if (CACHE_HOST === "localhost" || CACHE_HOST === "127.0.0.1") {
    return {
      host: CACHE_HOST,
      port: CACHE_PORT,
    };
  }

  if (CACHE_HOST && CACHE_HOST !== "redis") {
    return {
      host: CACHE_HOST,
      port: CACHE_PORT,
    };
  }

  return {
    sentinels: getSentinelHosts(),
    name: REDIS_MASTER_NAME,
  };
};

const redisConfig = getRedisConfig();

if (!CACHE_ENABLED) {
  console.log("[Redis] disabled: CACHE_ENABLED is not true (load .env via import \"./env\" in routes, or export vars in the shell)");
} else {
  const mode = "sentinels" in redisConfig ? "sentinel" : "direct";
  const safeLog =
    mode === "direct"
      ? { mode, host: (redisConfig as { host: string }).host, port: (redisConfig as { port: number }).port }
      : { mode, masterName: REDIS_MASTER_NAME, sentinelCount: SENTINEL_HOSTS };
  console.log("[Redis] client starting:", JSON.stringify(safeLog));
}

const redis = CACHE_ENABLED
  ? new Redis({
      ...redisConfig,
      username: CACHE_USER || undefined,
      password: CACHE_PASSWORD || undefined,
      db: 0,
      retryStrategy: (times: number) => Math.min(times * 50, 2000),
      lazyConnect: false,
      enableReadyCheck: true,
      maxRetriesPerRequest: null,
    })
  : null;

if (redis) {
  redis.on("connect", () => {
    console.log("[Redis] socket open (handshake / Sentinel)");
  });
  redis.on("ready", () => {
    console.log("[Redis] connected");
  });
  redis.on("error", (err: Error) => {
    console.error("[Redis] connection error:", err.message);
  });
  redis.on("close", () => {
    console.warn("[Redis] connection closed");
  });
}

export function isRedisEnabled(): boolean {
  return CACHE_ENABLED && Boolean(redis);
}

function buildPresenceKey(userId: string, connectionId: string): string {
  return `${PRESENCE_KEY_PREFIX}:${userId}:${connectionId}`;
}

export async function setUserPresence(userId: string, connectionId: string): Promise<void> {
  if (!redis || !userId || !connectionId) return;
  const key = buildPresenceKey(userId, connectionId);
  await redis.set(key, "1", "EX", PRESENCE_TTL_SECONDS);
}

export async function refreshUserPresence(userId: string, connectionId: string): Promise<void> {
  if (!redis || !userId || !connectionId) return;
  const key = buildPresenceKey(userId, connectionId);
  await redis.expire(key, PRESENCE_TTL_SECONDS);
}

export async function clearUserPresence(userId: string, connectionId: string): Promise<void> {
  if (!redis || !userId || !connectionId) return;
  const key = buildPresenceKey(userId, connectionId);
  await redis.del(key);
}

export async function isUserConnectedAcrossCluster(userId: string): Promise<boolean> {
  if (!redis || !userId) return false;
  const pattern = `${PRESENCE_KEY_PREFIX}:${userId}:*`;
  let cursor = "0";
  do {
    const result = await redis.scan(cursor, "MATCH", pattern, "COUNT", 100);
    cursor = result[0];
    const keys = result[1] || [];
    if (keys.length > 0) return true;
  } while (cursor !== "0");
  return false;
}

// ── Pub/Sub for cross-node messaging ────────────────────────────────────────

const redisSub = CACHE_ENABLED
  ? new Redis({
      ...redisConfig,
      username: CACHE_USER || undefined,
      password: CACHE_PASSWORD || undefined,
      db: 0,
      retryStrategy: (times: number) => Math.min(times * 50, 2000),
      lazyConnect: false,
      enableReadyCheck: true,
      maxRetriesPerRequest: null,
    })
  : null;

if (redisSub) {
  redisSub.on("error", (err: Error) => {
    console.error("[RedisSub] connection error:", err.message);
  });
}

/**
 * Publishes an event to a Redis channel for all cluster nodes to see.
 */
export async function publishEvent(channel: string, message: any): Promise<void> {
  if (!redis) return;
  try {
    const payload = typeof message === "string" ? message : JSON.stringify(message);
    await redis.publish(channel, payload);
  } catch (error) {
    console.error(`[Redis] Failed to publish to channel ${channel}:`, error);
  }
}

/**
 * Subscribes to a Redis channel and calls the callback when a message is received.
 */
export function subscribeToEvents(channel: string, callback: (message: string) => void): void {
  if (!redisSub) return;
  redisSub.subscribe(channel, (err) => {
    if (err) {
      console.error(`[RedisSub] Failed to subscribe to channel ${channel}:`, err.message);
    } else {
      console.log(`[RedisSub] Subscribed to channel ${channel}`);
    }
  });

  redisSub.on("message", (chan, message) => {
    if (chan === channel) {
      callback(message);
    }
  });
}

