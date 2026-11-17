import assert from 'node:assert/strict';
import { buildAiCacheKey, createCachedSseResponse } from '../../lib/ai/cache';
import { createInterpretStream } from '../../lib/ai/interpret-stream';

async function main() {
  // 1) Cache key determinism & isolation across namespace, model, systemPrompt, userPrompt
  const k1 = buildAiCacheKey('interpret', 'deepseek-flash', 'sysA', 'userA');
  const k2 = buildAiCacheKey('interpret', 'deepseek-flash', 'sysA', 'userA');
  const kDiffModel = buildAiCacheKey('interpret', 'deepseek-v4-pro', 'sysA', 'userA');
  const kDiffNs = buildAiCacheKey('heming', 'deepseek-flash', 'sysA', 'userA');
  const kDiffUser = buildAiCacheKey('interpret', 'deepseek-flash', 'sysA', 'userB');

  assert.equal(k1, k2);
  assert.match(k1, /^ziwei:cache:interpret:[a-f0-9]{32}$/);
  assert.notEqual(k1, kDiffModel);
  assert.notEqual(k1, kDiffNs);
  assert.notEqual(k1, kDiffUser);

  // 2) Cached SSE response follows exact frontend SSE contract & sets X-AI-Cache: HIT
  const sampleText = '**【命格定性】**\n太阳巨门在寅宫，主星光明与口才并济，格局清正。'.repeat(2);
  const res = createCachedSseResponse(sampleText);
  assert.equal(res.headers.get('X-AI-Cache'), 'HIT');
  assert.match(res.headers.get('Content-Type') ?? '', /text\/event-stream/);
  const rawSse = await res.text();
  assert.ok(rawSse.endsWith('data: [DONE]\n\n'));

  let reconstructed = '';
  for (const line of rawSse.split('\n')) {
    if (!line.startsWith('data: ')) continue;
    const payload = line.slice(6).trim();
    if (payload === '[DONE]') break;
    reconstructed += JSON.parse(payload).delta.text;
  }
  assert.equal(reconstructed, sampleText);

  // 3) createInterpretStream triggers onComplete only on clean [DONE], never on upstream error
  const encoder = new TextEncoder();
  let capturedComplete = '';
  const okStream = new ReadableStream<Uint8Array>({
    start(controller) {
      controller.enqueue(encoder.encode('data: {"choices":[{"delta":{"content":"第一段"}}]}\n\n'));
      controller.enqueue(encoder.encode('data: {"choices":[{"delta":{"content":"第二段"}}]}\n\ndata: [DONE]\n\n'));
      controller.close();
    },
  });
  await new Response(createInterpretStream(okStream, () => {}, (full) => { capturedComplete = full; })).text();
  assert.equal(capturedComplete, '第一段第二段');

  let errCompleteCalled = false;
  const errStream = new ReadableStream<Uint8Array>({
    start(controller) {
      controller.enqueue(encoder.encode('data: {"choices":[{"delta":{"content":"半截内容"}}]}\n\n'));
      controller.enqueue(encoder.encode('data: {"choices":[{"delta":{},"finish_reason":"length"}]}\n\n'));
    },
  });
  await assert.rejects(
    new Response(createInterpretStream(errStream, () => {}, () => { errCompleteCalled = true; })).text(),
    /回答中断/,
  );
  assert.equal(errCompleteCalled, false, 'truncated stream must not trigger cache write');

  console.log('AI cache regression: key isolation, cached SSE contract, and clean-completion callback passed');
}

main().catch(error => {
  console.error(error);
  process.exitCode = 1;
});
