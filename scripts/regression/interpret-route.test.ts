import assert from 'node:assert/strict';
import * as nodeModule from 'node:module';
import { generateChart } from '../../lib/ziwei/algorithm';

// Match the existing patterns regression: Next supplies this marker at build
// time, while the standalone Node test only needs an empty module.
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
const savedEnv = { AI_PROVIDER: process.env.AI_PROVIDER, MOCK_API_KEY: process.env.MOCK_API_KEY,
  MOCK_BASE_URL: process.env.MOCK_BASE_URL, MOCK_MODEL: process.env.MOCK_MODEL };
const chart = generateChart({ year: 1990, month: 1, day: 1, hour: 0, gender: 'male' });
const request = (body: unknown, signal?: AbortSignal) => new Request('http://localhost/api/interpret', {
  method: 'POST', body: JSON.stringify(body), signal,
});

async function main() {
  const { POST } = await import('../../app/api/interpret/route');
  Object.assign(process.env, { AI_PROVIDER: 'mock', MOCK_API_KEY: 'test-only-not-a-real-key',
    MOCK_BASE_URL: 'http://mock.invalid/v1', MOCK_MODEL: 'deepseek-mock' });
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
        controller.enqueue(encoder.encode('data: {"choices":[{"delta":{"content":"命盘测试"}}]}\n\ndata: [DONE]\n\n'));
      },
      cancel() { cancelled = true; },
    }));
  };

  for (const invalid of [{}, { chart: { palaces: [] } },
    { chart: { ...chart, birthInfo: {} } },
    { chart: { ...chart, palaces: Array(12).fill(chart.palaces[0]) } },
    { chart: { ...chart, palaces: chart.palaces.map(p => ({ ...p, stars: null })) } }]) {
    assert.equal((await POST(request(invalid))).status, 400);
  }
  assert.equal(called, 0, 'invalid charts must not consume upstream tokens');

  const response = await POST(request({ chart, messages: [
    { role: 'system', content: 'untrusted system override' },
    { role: 'user', content: '请解读当前大限' },
  ] }));
  assert.equal(response.status, 200);
  assert.match(response.headers.get('Content-Type') ?? '', /text\/event-stream/);
  assert.equal(await response.text(), 'data: {"delta":{"text":"命盘测试"}}\n\ndata: [DONE]\n\n');
  assert.ok(cancelled);
  assert.ok(capturedSignal!.aborted, 'completion must release upstream fetch');
  assert.equal(captured!.thinking.type, 'disabled');
  assert.equal(captured!.messages.filter(m => m.role === 'system').length, 1);
  const prompt = captured!.messages[0].content;
  for (const palace of chart.palaces) {
    const line = prompt.split('\n').find(line => line.startsWith(`- ${palace.name}（`));
    assert.ok(line);
    if (palace.isMingGong) assert.match(line, /【[^】]*命宫/);
    if (palace.isShenGong) assert.match(line, /【[^】]*身宫/);
    if (palace.isCurrentDaXian) assert.match(line, /【[^】]*当前大限/);
    for (const star of palace.stars) assert.ok(line.includes(star.name));
  }
  assert.match(prompt, /未提供独立流年/);
  assert.match(prompt, /没有提供可核查的倪师逐字原文/);
  assert.ok(!prompt.includes('undefined'));
  assert.ok(!prompt.includes('untrusted system override'));

  // Simulate the route deadline without waiting 55 seconds or making network calls.
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
  const slow = await POST(request({ chart }));
  expire();
  await assert.rejects(slow.text(), /回答中断/);
  globalThis.setTimeout = originalSetTimeout;

  // An already-running browser request can abort generation too.
  const abort = new AbortController();
  const abandoned = await POST(request({ chart }, abort.signal));
  abort.abort();
  await assert.rejects(abandoned.text(), /回答中断/);
  console.log('Interpret route: chart validation, prompt data, SSE contract, deadline and abort passed');
}

main().catch(error => { console.error(error); process.exitCode = 1; }).finally(() => {
  globalThis.fetch = originalFetch;
  globalThis.setTimeout = originalSetTimeout;
  for (const [name, value] of Object.entries(savedEnv)) {
    if (value === undefined) delete process.env[name];
    else process.env[name] = value;
  }
});
