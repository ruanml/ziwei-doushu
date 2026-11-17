/** Convert an OpenAI-compatible stream to the existing interpret SSE contract. */
export function createInterpretStream(
  body: ReadableStream<Uint8Array>,
  onClose: () => void = () => {},
): ReadableStream<Uint8Array> {
  const reader = body.getReader();
  const encoder = new TextEncoder();
  const decoder = new TextDecoder();
  let buffer = '';
  let finished = false;

  const cleanup = () => {
    finished = true;
    void reader.cancel().catch(() => {});
    onClose();
  };

  return new ReadableStream<Uint8Array>({
    async pull(controller) {
      const finish = () => {
        controller.enqueue(encoder.encode('data: [DONE]\n\n'));
        controller.close();
        cleanup();
      };

      try {
        // A partial line, heartbeat, role or reasoning chunk produces no output.
        // Keep reading in this pull until we enqueue text or reach the end;
        // resolving an empty pull does not guarantee another pull will run.
        while (!finished) {
          const { done, value } = await reader.read();
          if (finished) return; // Downstream may have cancelled during the read.
          if (done) { finish(); return; }

          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split('\n');
          buffer = lines.pop() ?? '';
          let emitted = false;

          for (const line of lines) {
            const trimmed = line.trim();
            if (!trimmed.startsWith('data:')) continue;
            const data = trimmed.slice(5).trim();
            if (!data) continue;
            if (data === '[DONE]') { finish(); return; }

            // Lines are complete here. Bad JSON indicates an upstream error,
            // rather than a split packet that can safely be discarded.
            const json = JSON.parse(data);
            if (json.error) throw new Error('模型接口在生成过程中返回错误');
            if (json.choices?.[0]?.finish_reason === 'length') {
              throw new Error('模型回答达到输出长度限制');
            }
            const text = json.choices?.[0]?.delta?.content;
            if (typeof text === 'string' && text) {
              controller.enqueue(encoder.encode(`data: ${JSON.stringify({ delta: { text } })}\n\n`));
              emitted = true;
            }
          }
          if (emitted) return;
        }
      } catch {
        if (finished) return;
        // Do not turn failed/truncated generations into a successful [DONE].
        controller.error(new Error('模型回答中断，请重试'));
        cleanup();
      }
    },
    cancel() {
      if (!finished) cleanup();
    },
  });
}
