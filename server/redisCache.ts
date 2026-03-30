import { createClient } from "redis";

type BasicRedisClient = ReturnType<typeof createClient>;

let redisClient: BasicRedisClient | null = null;
let redisConnectPromise: Promise<BasicRedisClient | null> | null = null;
let lastRedisErrorAt = 0;

function logRedisError(error: unknown) {
  const now = Date.now();
  if (now - lastRedisErrorAt < 30_000) return;
  lastRedisErrorAt = now;
  const message = error instanceof Error ? error.message : String(error);
  console.warn(`[redis-cache] ${message}`);
}

function getRedisUrl() {
  return String(process.env.REDIS_URL || "").trim();
}

export function isRedisEnabled() {
  return getRedisUrl().length > 0;
}

export async function getRedisClient(): Promise<BasicRedisClient | null> {
  if (!isRedisEnabled()) return null;
  if (redisClient?.isOpen) return redisClient;
  if (redisConnectPromise) return redisConnectPromise;

  const client = createClient({
    url: getRedisUrl(),
    socket: {
      reconnectStrategy(retries) {
        return Math.min(1000 * 2 ** Math.min(retries, 4), 15_000);
      },
    },
  });

  client.on("error", (error) => {
    logRedisError(error);
  });

  redisConnectPromise = client
    .connect()
    .then(() => {
      redisClient = client;
      return client;
    })
    .catch((error) => {
      logRedisError(error);
      redisConnectPromise = null;
      return null;
    });

  return redisConnectPromise;
}

export async function getSharedCacheJson<T>(key: string): Promise<T | null> {
  const client = await getRedisClient();
  if (!client) return null;

  try {
    const value = await client.get(key);
    if (!value) return null;
    return JSON.parse(value) as T;
  } catch (error) {
    logRedisError(error);
    return null;
  }
}

export async function setSharedCacheJson<T>(key: string, value: T, ttlSeconds: number): Promise<void> {
  const client = await getRedisClient();
  if (!client) return;

  try {
    await client.set(key, JSON.stringify(value), {
      EX: Math.max(1, Math.round(ttlSeconds)),
    });
  } catch (error) {
    logRedisError(error);
  }
}

export async function deleteSharedCacheKey(key: string): Promise<void> {
  const client = await getRedisClient();
  if (!client) return;

  try {
    await client.del(key);
  } catch (error) {
    logRedisError(error);
  }
}
