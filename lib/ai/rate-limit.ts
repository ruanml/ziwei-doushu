/**
 * lib/ai/rate-limit.ts —— AI 解读接口限流与每日总量熔断
 *
 * 三层防护（均可通过环境变量覆盖）：
 *   1. 单 IP 每分钟限频：AI_RATE_LIMIT_IP_PER_MIN（默认 5）
 *   2. 单 IP 每日限额：  AI_RATE_LIMIT_IP_PER_DAY（默认 20，按北京时间自然日重置）
 *   3. 全站每日总熔断：  AI_RATE_LIMIT_GLOBAL_PER_DAY（默认 200，按北京时间自然日重置）
 *
 * 存储后端：
 *   - 若配置了 REDIS_URL，优先使用 Redis 原子 Lua 脚本跨实例共享计数；
 *   - 未配置 REDIS_URL 或 Redis 故障时，自动回退到进程内内存限流器。
 */

import { getSharedRedisUrl, withRedisRetry } from './redis';

export interface RateLimitResult {
  allowed: boolean;
  status?: 429;
  error?: string;
  retryAfterSeconds?: number;
  reason?: 'ip_minute' | 'ip_day' | 'global_day';
}

export interface RateLimitConfig {
  enabled: boolean;
  ipPerMin: number;
  ipPerDay: number;
  globalPerDay: number;
}

function parsePositiveInt(val: string | undefined, fallback: number): number {
  if (!val) return fallback;
  const n = Number.parseInt(val.trim(), 10);
  return Number.isFinite(n) && n > 0 ? n : fallback;
}

export function resolveRateLimitConfig(): RateLimitConfig {
  const rawEnabled = (process.env.AI_RATE_LIMIT_ENABLED ?? 'true').trim().toLowerCase();
  const enabled = rawEnabled !== 'false' && rawEnabled !== '0' && rawEnabled !== 'off';
  return {
    enabled,
    ipPerMin: parsePositiveInt(process.env.AI_RATE_LIMIT_IP_PER_MIN, 5),
    ipPerDay: parsePositiveInt(process.env.AI_RATE_LIMIT_IP_PER_DAY, 20),
    globalPerDay: parsePositiveInt(process.env.AI_RATE_LIMIT_GLOBAL_PER_DAY, 200),
  };
}

/** 提取客户端真实 IP（优先取 Vercel 注入的边缘转发头） */
export function getClientIp(req: Request): string {
  const candidates = [
    req.headers.get('x-vercel-forwarded-for'),
    req.headers.get('cf-connecting-ip'),
    req.headers.get('x-real-ip'),
    req.headers.get('x-forwarded-for'),
  ];
  for (const raw of candidates) {
    if (!raw) continue;
    const first = raw.split(',')[0]?.trim();
    if (first) return first.slice(0, 64);
  }
  return '127.0.0.1';
}

/** 按东八区（UTC+8）计算当前自然日标识与距离次日 0 点的剩余秒数 */
function getUtc8DayWindow(nowMs: number): { dayKey: string; ttlSeconds: number; minBucket: number; minTtlSeconds: number } {
  const utc8Ms = nowMs + 8 * 3600_000;
  const utc8Date = new Date(utc8Ms);
  const y = utc8Date.getUTCFullYear();
  const m = String(utc8Date.getUTCMonth() + 1).padStart(2, '0');
  const d = String(utc8Date.getUTCDate()).padStart(2, '0');
  const dayKey = `${y}-${m}-${d}`;

  const nextMidnightUtc8Ms = Date.UTC(y, utc8Date.getUTCMonth(), utc8Date.getUTCDate() + 1, 0, 0, 0);
  const ttlSeconds = Math.max(1, Math.ceil((nextMidnightUtc8Ms - utc8Ms) / 1000));

  const minBucket = Math.floor(nowMs / 60_000);
  const nextMinMs = (minBucket + 1) * 60_000;
  const minTtlSeconds = Math.max(1, Math.ceil((nextMinMs - nowMs) / 1000));

  return { dayKey, ttlSeconds, minBucket, minTtlSeconds };
}

// ─── 内存限流存储（未配置 REDIS_URL 或 Redis 异常时使用）───
interface MemEntry {
  count: number;
  expiresAt: number;
}

const globalForRateLimit = globalThis as unknown as {
  __ziweiRateLimitMap?: Map<string, MemEntry>;
};

function getMemStore(): Map<string, MemEntry> {
  if (!globalForRateLimit.__ziweiRateLimitMap) {
    globalForRateLimit.__ziweiRateLimitMap = new Map<string, MemEntry>();
  }
  return globalForRateLimit.__ziweiRateLimitMap;
}

function getMemCount(store: Map<string, MemEntry>, key: string, nowMs: number): number {
  const entry = store.get(key);
  if (!entry) return 0;
  if (entry.expiresAt <= nowMs) {
    store.delete(key);
    return 0;
  }
  return entry.count;
}

function incrMemCount(store: Map<string, MemEntry>, key: string, nowMs: number, ttlSeconds: number): number {
  const current = getMemCount(store, key, nowMs);
  const existing = store.get(key);
  const next = current + 1;
  store.set(key, {
    count: next,
    expiresAt: existing ? existing.expiresAt : nowMs + ttlSeconds * 1000,
  });
  return next;
}

function pruneMemStore(store: Map<string, MemEntry>, nowMs: number) {
  if (store.size < 500) return;
  for (const [k, v] of store.entries()) {
    if (v.expiresAt <= nowMs) store.delete(k);
  }
}

// ─── Redis 原子检查与递增脚本 ───
// 返回：0 = 放行；1 = 触发单 IP 每分钟上限；2 = 触发单 IP 每日上限；3 = 触发全站每日熔断
const REDIS_LUA_SCRIPT = `
local c_min = tonumber(redis.call('GET', KEYS[1]) or '0')
if c_min >= tonumber(ARGV[1]) then
  local ttl = redis.call('TTL', KEYS[1])
  if ttl < 1 then ttl = tonumber(ARGV[4]) end
  return {1, ttl}
end

local c_day = tonumber(redis.call('GET', KEYS[2]) or '0')
if c_day >= tonumber(ARGV[2]) then
  local ttl = redis.call('TTL', KEYS[2])
  if ttl < 1 then ttl = tonumber(ARGV[5]) end
  return {2, ttl}
end

local c_global = tonumber(redis.call('GET', KEYS[3]) or '0')
if c_global >= tonumber(ARGV[3]) then
  local ttl = redis.call('TTL', KEYS[3])
  if ttl < 1 then ttl = tonumber(ARGV[5]) end
  return {3, ttl}
end

local n_min = redis.call('INCR', KEYS[1])
if n_min == 1 then redis.call('EXPIRE', KEYS[1], tonumber(ARGV[4])) end

local n_day = redis.call('INCR', KEYS[2])
if n_day == 1 then redis.call('EXPIRE', KEYS[2], tonumber(ARGV[5])) end

local n_global = redis.call('INCR', KEYS[3])
if n_global == 1 then redis.call('EXPIRE', KEYS[3], tonumber(ARGV[5])) end

return {0, 0}
`;

// ─── Redis 检查逻辑（连接管理已抽至 lib/ai/redis.ts）───

function buildBlockedResponse(reason: 'ip_minute' | 'ip_day' | 'global_day', retryAfterSeconds: number, cfg: RateLimitConfig): RateLimitResult {
  if (reason === 'ip_minute') {
    return {
      allowed: false,
      status: 429,
      reason,
      retryAfterSeconds,
      error: `请求过于频繁，请稍后再试（每分钟最多 ${cfg.ipPerMin} 次）`,
    };
  }
  if (reason === 'ip_day') {
    return {
      allowed: false,
      status: 429,
      reason,
      retryAfterSeconds,
      error: `今日您的免费解读次数已达上限（每日 ${cfg.ipPerDay} 次），请明日再试`,
    };
  }
  return {
    allowed: false,
    status: 429,
    reason,
    retryAfterSeconds,
    error: '今日全站免费 AI 解读额度已用尽，请明日再试',
  };
}

function checkMemoryRateLimit(ip: string, cfg: RateLimitConfig, nowMs: number): RateLimitResult {
  const store = getMemStore();
  pruneMemStore(store, nowMs);
  const { dayKey, ttlSeconds, minBucket, minTtlSeconds } = getUtc8DayWindow(nowMs);

  const minKey = `rl:ip:min:${minBucket}:${ip}`;
  const dayIpKey = `rl:ip:day:${dayKey}:${ip}`;
  const globalKey = `rl:global:day:${dayKey}`;

  if (getMemCount(store, minKey, nowMs) >= cfg.ipPerMin) {
    return buildBlockedResponse('ip_minute', minTtlSeconds, cfg);
  }
  if (getMemCount(store, dayIpKey, nowMs) >= cfg.ipPerDay) {
    return buildBlockedResponse('ip_day', ttlSeconds, cfg);
  }
  if (getMemCount(store, globalKey, nowMs) >= cfg.globalPerDay) {
    return buildBlockedResponse('global_day', ttlSeconds, cfg);
  }

  incrMemCount(store, minKey, nowMs, minTtlSeconds);
  incrMemCount(store, dayIpKey, nowMs, ttlSeconds);
  incrMemCount(store, globalKey, nowMs, ttlSeconds);
  return { allowed: true };
}

export async function checkAiRateLimit(req: Request, nowMs = Date.now()): Promise<RateLimitResult> {
  const cfg = resolveRateLimitConfig();
  if (!cfg.enabled) return { allowed: true };

  const ip = getClientIp(req);
  const redisUrl = getSharedRedisUrl();

  if (redisUrl) {
    const { dayKey, ttlSeconds, minBucket, minTtlSeconds } = getUtc8DayWindow(nowMs);
    const minKey = `ziwei:rl:ip:min:${minBucket}:${ip}`;
    const dayIpKey = `ziwei:rl:ip:day:${dayKey}:${ip}`;
    const globalKey = `ziwei:rl:global:day:${dayKey}`;

    try {
      const res = (await withRedisRetry(client =>
        client.eval(
          REDIS_LUA_SCRIPT,
          3,
          minKey,
          dayIpKey,
          globalKey,
          String(cfg.ipPerMin),
          String(cfg.ipPerDay),
          String(cfg.globalPerDay),
          String(minTtlSeconds),
          String(ttlSeconds),
        ),
      )) as [number, number] | null;

      const [code, ttl] = Array.isArray(res) ? res : [0, 0];
      if (code === 1) return buildBlockedResponse('ip_minute', Math.max(1, Number(ttl) || minTtlSeconds), cfg);
      if (code === 2) return buildBlockedResponse('ip_day', Math.max(1, Number(ttl) || ttlSeconds), cfg);
      if (code === 3) return buildBlockedResponse('global_day', Math.max(1, Number(ttl) || ttlSeconds), cfg);
      return { allowed: true };
    } catch (e) {
      const host = (() => { try { return new URL(redisUrl).host; } catch { return 'unknown'; } })();
      console.warn(`[rate-limit] Redis unavailable (host=${host}), falling back to in-memory limiter:`, e instanceof Error ? e.message : e);
    }
  }

  return checkMemoryRateLimit(ip, cfg, nowMs);
}

/** 仅供回归测试清理内存限流状态 */
export function resetRateLimitStoreForTests(): void {
  globalForRateLimit.__ziweiRateLimitMap?.clear();
}
