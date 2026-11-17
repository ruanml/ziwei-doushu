import assert from 'node:assert/strict';
import * as nodeModule from 'node:module';
import { generateChart } from '../../lib/ziwei/algorithm';
import {
  checkAiRateLimit,
  getClientIp,
  resetRateLimitStoreForTests,
  resolveRateLimitConfig,
} from '../../lib/ai/rate-limit';

type HookResult = { url?: string; format?: string; source?: string; shortCircuit?: boolean };
const { registerHooks } = nodeModule as unknown as {
  registerHooks(hooks: {
    resolve(s: string, c: unknown, next: (s: string, c: unknown) => HookResult): HookResult;
    load(u: string, c: unknown, next: (u: string, c: unknown) => HookResult): HookResult;
  }): void;
};
const stub = 'data:text/javascript,';
registerHooks({
  resolve(s, c, next) { return s === 'server-only' ? { url: stub, shortCircuit: true } : next(s, c); },
  load(u, c, next) { return u === stub ? { format: 'commonjs', source: '', shortCircuit: true } : next(u, c); },
});

const savedEnv = {
  AI_PROVIDER: process.env.AI_PROVIDER,
  MOCK_API_KEY: process.env.MOCK_API_KEY,
  MOCK_BASE_URL: process.env.MOCK_BASE_URL,
  MOCK_MODEL: process.env.MOCK_MODEL,
  AI_RATE_LIMIT_ENABLED: process.env.AI_RATE_LIMIT_ENABLED,
  AI_RATE_LIMIT_IP_PER_MIN: process.env.AI_RATE_LIMIT_IP_PER_MIN,
  AI_RATE_LIMIT_IP_PER_DAY: process.env.AI_RATE_LIMIT_IP_PER_DAY,
  AI_RATE_LIMIT_GLOBAL_PER_DAY: process.env.AI_RATE_LIMIT_GLOBAL_PER_DAY,
  REDIS_URL: process.env.REDIS_URL,
};
const originalFetch = globalThis.fetch;

function makeReq(ip?: string, headerName = 'x-vercel-forwarded-for'): Request {
  const headers = new Headers();
  if (ip) headers.set(headerName, ip);
  return new Request('http://localhost/api/interpret', { method: 'POST', headers });
}

async function main() {
  delete process.env.REDIS_URL;
  delete process.env.AI_RATE_LIMIT_ENABLED;
  delete process.env.AI_RATE_LIMIT_IP_PER_MIN;
  delete process.env.AI_RATE_LIMIT_IP_PER_DAY;
  delete process.env.AI_RATE_LIMIT_GLOBAL_PER_DAY;
  resetRateLimitStoreForTests();

  // 1) Default config & IP extraction priority
  const defaultCfg = resolveRateLimitConfig();
  assert.deepEqual(defaultCfg, { enabled: true, ipPerMin: 5, ipPerDay: 20, globalPerDay: 200 });
  assert.equal(getClientIp(makeReq('203.0.113.10, 10.0.0.1', 'x-vercel-forwarded-for')), '203.0.113.10');
  assert.equal(getClientIp(makeReq('198.51.100.7', 'x-forwarded-for')), '198.51.100.7');
  assert.equal(getClientIp(makeReq()), '127.0.0.1');

  // 2) Single IP per-minute + per-day + global daily circuit breaker
  Object.assign(process.env, {
    AI_RATE_LIMIT_IP_PER_MIN: '2',
    AI_RATE_LIMIT_IP_PER_DAY: '4',
    AI_RATE_LIMIT_GLOBAL_PER_DAY: '5',
  });
  resetRateLimitStoreForTests();

  // 2026-11-17 12:00:00 UTC+8 = 2026-11-17T04:00:00Z
  const baseMs = Date.parse('2026-11-17T04:00:10Z');
  const ip1 = '203.0.113.1';
  const ip2 = '203.0.113.2';

  // Minute 0: ip1 uses 2/2 per-min quota (daily: 2/4, global: 2/5)
  assert.equal((await checkAiRateLimit(makeReq(ip1), baseMs)).allowed, true);
  assert.equal((await checkAiRateLimit(makeReq(ip1), baseMs + 1000)).allowed, true);
  const blockedMin = await checkAiRateLimit(makeReq(ip1), baseMs + 2000);
  assert.equal(blockedMin.allowed, false);
  assert.equal(blockedMin.reason, 'ip_minute');
  assert.equal(blockedMin.status, 429);
  assert.ok((blockedMin.retryAfterSeconds ?? 0) > 0);

  // Minute 1 (+60s): ip1 uses another 2/2 per-min quota -> reaches 4/4 daily quota (global: 4/5)
  const min1Ms = baseMs + 60_000;
  assert.equal((await checkAiRateLimit(makeReq(ip1), min1Ms)).allowed, true);
  assert.equal((await checkAiRateLimit(makeReq(ip1), min1Ms + 1000)).allowed, true);

  // Minute 2 (+120s): ip1 is now blocked by daily IP limit (4/4), must NOT consume the 5th global slot
  const min2Ms = baseMs + 120_000;
  const blockedDay = await checkAiRateLimit(makeReq(ip1), min2Ms);
  assert.equal(blockedDay.allowed, false);
  assert.equal(blockedDay.reason, 'ip_day');

  // ip2 still gets the 5th global slot, then hits global_day circuit breaker on the 6th!
  assert.equal((await checkAiRateLimit(makeReq(ip2), min2Ms)).allowed, true);
  const blockedGlobal = await checkAiRateLimit(makeReq(ip2), min2Ms + 1000);
  assert.equal(blockedGlobal.allowed, false);
  assert.equal(blockedGlobal.reason, 'global_day');

  // Next Beijing calendar day (+24h): all daily & global quotas reset
  const nextDayMs = baseMs + 24 * 3600_000;
  assert.equal((await checkAiRateLimit(makeReq(ip1), nextDayMs)).allowed, true);
  assert.equal((await checkAiRateLimit(makeReq(ip2), nextDayMs)).allowed, true);

  // 3) Route integration: 400 does not burn quota; 429 blocks upstream fetch
  Object.assign(process.env, {
    AI_PROVIDER: 'mock',
    MOCK_API_KEY: 'test-only-not-a-real-key',
    MOCK_BASE_URL: 'http://mock.invalid/v1',
    MOCK_MODEL: 'deepseek-mock',
    AI_RATE_LIMIT_IP_PER_MIN: '1',
    AI_RATE_LIMIT_IP_PER_DAY: '10',
    AI_RATE_LIMIT_GLOBAL_PER_DAY: '50',
  });
  resetRateLimitStoreForTests();

  const encoder = new TextEncoder();
  let upstreamCalls = 0;
  globalThis.fetch = async () => {
    upstreamCalls++;
    return new Response(new ReadableStream({
      start(controller) {
        controller.enqueue(encoder.encode('data: {"choices":[{"delta":{"content":"OK"}}]}\n\ndata: [DONE]\n\n'));
        controller.close();
      },
    }));
  };

  const { POST: postInterpret } = await import('../../app/api/interpret/route');
  const chart = generateChart({ year: 1990, month: 1, day: 1, hour: 0, gender: 'male' });

  // Invalid request returns 400 and does NOT consume the 1-per-minute quota
  const badRes = await postInterpret(new Request('http://localhost/api/interpret', {
    method: 'POST',
    headers: { 'x-vercel-forwarded-for': '192.0.2.99' },
    body: JSON.stringify({}),
  }));
  assert.equal(badRes.status, 400);

  // First valid request succeeds (consumes 1/1 per-min quota)
  const okRes = await postInterpret(new Request('http://localhost/api/interpret', {
    method: 'POST',
    headers: { 'x-vercel-forwarded-for': '192.0.2.99' },
    body: JSON.stringify({ chart }),
  }));
  assert.equal(okRes.status, 200);
  await okRes.text();
  assert.equal(upstreamCalls, 1);

  // Second valid request in the same minute returns 429 and does NOT call upstream
  const rateLimitedRes = await postInterpret(new Request('http://localhost/api/interpret', {
    method: 'POST',
    headers: { 'x-vercel-forwarded-for': '192.0.2.99' },
    body: JSON.stringify({ chart }),
  }));
  assert.equal(rateLimitedRes.status, 429);
  assert.ok(Number(rateLimitedRes.headers.get('Retry-After')) > 0);
  const errJson = await rateLimitedRes.json() as { error: string };
  assert.match(errJson.error, /请求过于频繁/);
  assert.equal(upstreamCalls, 1, 'rate-limited request must not invoke upstream LLM');

  resetRateLimitStoreForTests();
  console.log('AI rate-limit regression: IP extraction, 3-tier quotas, UTC+8 rollover, and route 429 passed');
}

main().catch(error => {
  console.error(error);
  process.exitCode = 1;
}).finally(() => {
  globalThis.fetch = originalFetch;
  resetRateLimitStoreForTests();
  for (const [name, value] of Object.entries(savedEnv)) {
    if (value === undefined) delete process.env[name];
    else process.env[name] = value;
  }
});
