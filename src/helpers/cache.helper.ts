import crypto from "crypto";
import redisConnection from "../config/redis";

// ============================================================
// Cache Key Builder
// ============================================================
const buildCacheKey = (prefix: string, params: Record<string, unknown>): string => {
  const normalized = JSON.stringify(params, Object.keys(params).sort());
  const hash = crypto.createHash("md5").update(normalized).digest("hex");
  return `${prefix}:${hash}`;
};

// ============================================================
// Cache-Aside with Stampede Protection (SET NX EX Lock)
// ============================================================
const withCache = async <T>(
  key: string,
  fetchFn: () => Promise<T>,
  options: { ttl?: number } = {}
): Promise<T> => {
  const { ttl = 60 } = options;

  // 1. Check cache
  try {
    const cached = await redisConnection.get(key);
    if (cached) return JSON.parse(cached) as T;
  } catch {
    // Redis down — degrade to origin
  }

  // 2. Try to acquire lock (only 1 process rebuilds cache)
  const lockKey = `lock:${key}`;
  const lockAcquired = await redisConnection.set(lockKey, "1", "EX", 5, "NX").catch(() => null);

  if (lockAcquired) {
    // 3a. We won the lock — fetch from DB and populate cache
    try {
      const data = await fetchFn();
      redisConnection.setex(key, ttl, JSON.stringify(data)).catch(() => {});
      return data;
    } finally {
      await redisConnection.del(lockKey).catch(() => {});
    }
  }

  // 3b. Another process is rebuilding — wait, then retry from cache
  await new Promise((r) => setTimeout(r, 50 + Math.random() * 100));

  try {
    const retryCached = await redisConnection.get(key);
    if (retryCached) return JSON.parse(retryCached) as T;
  } catch {
    // Redis down
  }

  // 4. Still no cache — fetch directly (no lock, just degrade)
  return fetchFn();
};

// ============================================================
// Cache Version (for bumping on schema/ranking changes)
// ============================================================
const getCacheVersion = async (): Promise<number> => {
  try {
    const v = await redisConnection.get("cache:version:search");
    return v ? parseInt(v, 10) : 0;
  } catch {
    return 0;
  }
};

// ============================================================
// Export
// ============================================================
export { buildCacheKey, withCache, getCacheVersion };
