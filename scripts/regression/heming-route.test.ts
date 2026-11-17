import assert from 'node:assert/strict';
import * as nodeModule from 'node:module';
import { generateChart } from '../../lib/ziwei/algorithm';

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

const encoder = new TextEncoder();
const originalFetch = globalThis.fetch;
const originalSetTimeout = globalThis.setTimeout;
const savedEnv = {
  AI_PROVIDER: process.env.AI_PROVIDER,
  MOCK_API_KEY: process.env.MOCK_API_KEY,
  MOCK_BASE_URL: process.env.MOCK_BASE_URL,
  MOCK_MODEL: process.env.MOCK_MODEL,
};

const chartA = generateChart({ year: 1990, month: 5, day: 15, hour: 4, gender: 'male', name: '张甲' });
const chartB = generateChart({ year: 1992, month: 8, day: 20, hour: 6, gender: 'female', name: '李乙' });
const request = (body: unknown, signal?: AbortSignal) =>
  new Request('http://localhost/api/heming', {
    method: 'POST',
    body: JSON.stringify(body),
    signal,
  });

async function main() {
  const { POST } = await import('../../app/api/heming/route');
  Object.assign(process.env, {
    AI_PROVIDER: 'mock',
    MOCK_API_KEY: 'test-only-not-a-real-key',
    MOCK_BASE_URL: 'http://mock.invalid/v1',
    MOCK_MODEL: 'deepseek-mock',
  });

  let called = 0;
  let captured: { messages: { role: string; content: string }[]; thinking: { type: string } };
  let capturedSignal: AbortSignal;
  let cancelled = false;

  globalThis.fetch = async (_input, init) => {
    called++;
    captured = JSON.parse(String(init?.body));
    capturedSignal = init?.signal as AbortSignal;
    return new Response(new ReadableStream({
      start(controller) {
        controller.enqueue(encoder.encode('data: {"choices":[{"delta":{"role":"assistant"}}]}\n\n'));
        controller.enqueue(encoder.encode('data: {"choices":[{"delta":{"content":"**【合盘定调】**\\n合盘测试通过"}}]}\n\ndata: [DONE]\n\n'));
      },
      cancel() { cancelled = true; },
    }));
  };

  for (const invalid of [
    {},
    { chartA },
    { chartB },
    { chartA, chartB: { ...chartB, birthInfo: {} } },
    { chartA: { ...chartA, palaces: [] }, chartB },
    { chartA, chartB, question: 123 },
  ]) {
    assert.equal((await POST(request(invalid))).status, 400);
  }
  assert.equal(called, 0, 'invalid heming payloads must not consume upstream tokens');

  // 1) Default overview analysis (no question)
  const resDefault = await POST(request({ chartA, chartB }));
  assert.equal(resDefault.status, 200);
  assert.match(resDefault.headers.get('Content-Type') ?? '', /text\/event-stream/);
  assert.equal(
    await resDefault.text(),
    'data: {"delta":{"text":"**【合盘定调】**\\n合盘测试通过"}}\n\ndata: [DONE]\n\n',
  );
  assert.ok(cancelled);
  assert.ok(capturedSignal!.aborted, 'completion must release upstream fetch');
  assert.equal(captured!.thinking.type, 'disabled');
  assert.equal(captured!.messages.length, 2);

  const sysPrompt = captured!.messages[0].content;
  const userPrompt = captured!.messages[1].content;
  assert.match(sysPrompt, /【甲方（A）命盘】/);
  assert.match(sysPrompt, /【乙方（B）命盘】/);
  assert.match(sysPrompt, /【双盘关键互参/);
  assert.match(sysPrompt, /甲方生年干.*飞入乙方/);
  assert.match(sysPrompt, /乙方生年干.*飞入甲方/);
  assert.match(sysPrompt, /没有提供可核查的倪师逐字原文/);
  assert.ok(!sysPrompt.includes('undefined'));
  assert.match(userPrompt, /\*\*【合盘定调】\*\*/);

  // 2) Follow-up question
  const resFollowUp = await POST(request({ chartA, chartB, question: '适合合伙创业吗？' }));
  assert.equal(resFollowUp.status, 200);
  await resFollowUp.text();
  assert.match(captured!.messages[1].content, /适合合伙创业吗？/);

  // 3) Timeout simulation
  let expire: () => void = () => { throw new Error('deadline was not installed'); };
  globalThis.setTimeout = ((callback: () => void, ms?: number) => {
    assert.equal(ms, 55_000);
    expire = callback;
    return originalSetTimeout(() => {}, 60_000);
  }) as typeof setTimeout;
  globalThis.fetch = async (_input, init) => new Response(new ReadableStream({
    start(controller) {
      init?.signal?.addEventListener('abort', () => controller.error(new Error('aborted')), { once: true });
    },
  }));
  const slow = await POST(request({ chartA, chartB }));
  expire();
  await assert.rejects(slow.text(), /回答中断/);
  globalThis.setTimeout = originalSetTimeout;

  console.log('Heming route: dual-chart validation, cross-reference prompt, SSE contract, and timeout passed');
}

main().catch(error => {
  console.error(error);
  process.exitCode = 1;
}).finally(() => {
  globalThis.fetch = originalFetch;
  globalThis.setTimeout = originalSetTimeout;
  for (const [name, value] of Object.entries(savedEnv)) {
    if (value === undefined) delete process.env[name];
    else process.env[name] = value;
  }
});
