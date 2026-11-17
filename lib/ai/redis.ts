import Redis from 'ioredis';

const globalForRedis = globalThis as unknown as {
  __ziweiRedisClient?: Redis | null;
  __ziweiRedisUrl?: string;
};

export function normalizeRedisUrl(raw: string | undefined): string | null {
  if (!raw) return null;
  let url = raw.trim().replace(/^["']|["']$/g, '');
  const match = url.match(/rediss?:\/\/\S+/i);
  if (match) url = match[0];
  if (!/^rediss?:\/\//i.test(url)) return null;
  if (/^redis:\/\//i.test(url) && /\.upstash\.io/i.test(url)) {
    url = url.replace(/^redis:\/\//i, 'rediss://');
  }
  return url;
}

function createFreshRedisClient(url: string): Redis {
  const client = new Redis(url, {
    maxRetriesPerRequest: 1,
    connectTimeout: 4000,
    commandTimeout: 4000,
    enableReadyCheck: false,
    retryStrategy: () => null,
    lazyConnect: true,
  });
  client.on('error', (err) => {
    console.warn('[redis] client error:', err?.message || err);
  });
  return client;
}

export function getSharedRedisUrl(): string | null {
  return normalizeRedisUrl(process.env.REDIS_URL || process.env.KV_URL);
}

export function getRedisClient(forceRecreate = false): Redis | null {
  const url = getSharedRedisUrl();
  if (!url) return null;
  const existing = globalForRedis.__ziweiRedisClient;
  if (
    !forceRecreate &&
    existing &&
    globalForRedis.__ziweiRedisUrl === url &&
    existing.status !== 'end' &&
    existing.status !== 'close'
  ) {
    return existing;
  }
  if (existing) {
    try { existing.disconnect(); } catch { /* ignore */ }
  }
  try {
    const client = createFreshRedisClient(url);
    globalForRedis.__ziweiRedisClient = client;
    globalForRedis.__ziweiRedisUrl = url;
    return client;
  } catch (e) {
    console.warn('[redis] init failed:', e instanceof Error ? e.message : e);
    return null;
  }
}

/** 执行一次 Redis 操作；若遇 Serverless 休眠导致的半开/关闭连接，自动重建并重试一次 */
export async function withRedisRetry<T>(fn: (client: Redis) => Promise<T>): Promise<T | null> {
  let client = getRedisClient();
  if (!client) return null;

  const exec = async (c: Redis) => {
    if (c.status === 'wait') {
      await c.connect();
    }
    return fn(c);
  };

  try {
    return await exec(client);
  } catch (firstErr) {
    const msg = firstErr instanceof Error ? firstErr.message : '';
    if (/closed|ended|ECONNRESET/i.test(msg)) {
      client = getRedisClient(true);
      if (!client) throw firstErr;
      return await exec(client);
    }
    throw firstErr;
  }
}
