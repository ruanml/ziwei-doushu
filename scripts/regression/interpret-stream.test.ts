import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import ts from 'typescript';
import { createInterpretStream } from '../../lib/ai/interpret-stream';

const encoder = new TextEncoder();
const expected = 'data: {"delta":{"text":"你好🌟"}}\n\ndata: {"delta":{"text":"世界"}}\n\ndata: [DONE]\n\n';
let passed = 0;

function source(chunks: Uint8Array[], close = false) {
  let cancelled = false;
  const body = new ReadableStream<Uint8Array>({
    start(controller) {
      for (const chunk of chunks) controller.enqueue(chunk);
      if (close) controller.close();
    },
    cancel() { cancelled = true; },
  });
  return { body, cancelled: () => cancelled };
}

async function bounded<T>(promise: Promise<T>): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([promise, new Promise<never>((_, reject) => {
      timer = setTimeout(() => reject(new Error('SSE reader stalled')), 1000);
    })]);
  } finally { clearTimeout(timer); }
}

function variants(bytes: Uint8Array): Uint8Array[][] {
  return [
    [bytes],
    ...Array.from({ length: bytes.length - 1 }, (_, i) => [bytes.slice(0, i + 1), bytes.slice(i + 1)]),
    Array.from(bytes, byte => Uint8Array.of(byte)),
  ];
}

async function main() {
  for (const ending of ['\n', '\r\n']) {
    const bytes = encoder.encode([
      ': heartbeat', '',
      'data: {"choices":[{"delta":{"role":"assistant","content":""}}]}', '',
      'data: {"choices":[{"delta":{"reasoning_content":"private reasoning"}}]}', '',
      'data: {"choices":[{"delta":{"content":"你好🌟"}}]}', '',
      'data: {"choices":[{"delta":{"content":"世界"}}]}', '',
      'data: [DONE]', '', '',
    ].join(ending));
    for (const chunks of variants(bytes)) {
      // Deliberately never close upstream: [DONE] must suffice.
      const upstream = source(chunks);
      let closed = 0;
      const response = new Response(createInterpretStream(upstream.body, () => { closed++; }));
      assert.equal(await bounded(response.text()), expected);
      assert.ok(upstream.cancelled());
      assert.equal(closed, 1);
      passed++;
    }
  }

  // Upstream EOF compatibility, including an output-free role packet.
  const eof = source([encoder.encode('data: {"choices":[{"delta":{"role":"assistant"}}]}\n\n')], true);
  assert.equal(await bounded(new Response(createInterpretStream(eof.body)).text()), 'data: [DONE]\n\n');

  // Cancel while a read is pending; cleanup must run once and unblock the reader.
  const pending = source([]);
  let closed = 0;
  const reader = createInterpretStream(pending.body, () => { closed++; }).getReader();
  const read = reader.read();
  await bounded(reader.cancel());
  assert.deepEqual(await bounded(read), { done: true, value: undefined });
  assert.ok(pending.cancelled());
  assert.equal(closed, 1);

  for (const data of ['{bad json}', '{"error":{"message":"quota exhausted"}}',
    '{"choices":[{"delta":{},"finish_reason":"length"}]}']) {
    const upstream = source([encoder.encode(`data: ${data}\n\n`)]);
    await assert.rejects(bounded(new Response(createInterpretStream(upstream.body)).text()), /回答中断/);
    assert.ok(upstream.cancelled());
  }
  const broken = new ReadableStream<Uint8Array>({
    pull(controller) { controller.error(new Error('connection reset')); },
  });
  await assert.rejects(bounded(new Response(createInterpretStream(broken)).text()), /回答中断/);

  // Exercise both panels' actual consumer code against arbitrary byte boundaries.
  for (const path of ['components/ChatPanel.tsx', 'components/InsightPanel.tsx']) {
    const sourceText = readFileSync(path, 'utf8');
    const start = sourceText.indexOf('      const reader = res.body.getReader();');
    const marker = '      reader.cancel().catch(() => {});';
    const end = sourceText.indexOf(marker, start) + marker.length;
    assert.ok(start >= 0 && end > start);
    const run = new Function('res', 'setMessages', ts.transpileModule(
      `async function run() { ${sourceText.slice(start, end)} }\nrun();`,
      { compilerOptions: { target: ts.ScriptTarget.ES2022 } },
    ).outputText.replace(/run\(\);\s*$/, 'return run();'));
    for (const ending of ['\n', '\r\n']) {
      for (const chunks of variants(encoder.encode(expected.replaceAll('\n', ending)))) {
        const response = source(chunks);
        let messages: { role: string; content: string }[] = [];
        await bounded(run(response, (update: (prev: typeof messages) => typeof messages) => {
          messages = update(messages);
        }));
        assert.equal(messages.at(-1)?.content, '你好🌟世界', path);
        assert.ok(response.cancelled(), path);
        passed++;
      }
    }
  }
  console.log(`Interpret SSE: ${passed} byte-boundary cases passed; EOF, cancellation and failure cases passed`);
}

main().catch(error => { console.error(error); process.exitCode = 1; });
