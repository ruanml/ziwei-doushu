/**
 * lib/ai/cache.ts —— 固定专题与单轮 AI 解读 Redis 缓存
 *
 * 作用：
 *   - 相同命盘 + 相同模型 + 相同单轮提问（或合盘默认/单轮提问）命中缓存时，
 *     直接以 SSE 流式返回，秒开且零 Token 消耗、不占用用户限流配额。
 *   - 支持环境变量：
 *       AI_CACHE_ENABLED=true        (默认开启，设为 false/0/off 关闭)
 *       AI_CACHE_TTL_SECONDS=604800  (默认缓存 7 天)
 */

import { createHash } from 'node:crypto';
import { withRedisRetry, getSharedRedisUrl } from './redis';

const DEFAULT_TTL_SECONDS = 7 * 24 * 3600;
const MIN_CACHEABLE_LENGTH = 20;

export function isAiCacheEnabled(): boolean {
  const raw = (process.env.AI_CACHE_ENABLED ?? 'true').trim().toLowerCase();
  return raw !== 'false' && raw !== '0' && raw !== 'off';
}

function getCacheTtlSeconds(): number {
  const raw = process.env.AI_CACHE_TTL_SECONDS?.trim();
  if (!raw) return DEFAULT_TTL_SECONDS;
  const n = Number.parseInt(raw, 10);
  return Number.isFinite(n) && n > 0 ? n : DEFAULT_TTL_SECONDS;
}

export function buildAiCacheKey(namespace: 'interpret' | 'heming', model: string, systemPrompt: string, userPrompt: string): string {
  const hash = createHash('sha256')
    .update(`${namespace}\n${model}\n${systemPrompt}\n${userPrompt}`)
    .digest('hex')
    .slice(0, 32);
  return `ziwei:cache:${namespace}:${hash}`;
}

export async function getCachedAiResponse(key: string): Promise<string | null> {
  if (!isAiCacheEnabled() || !getSharedRedisUrl()) return null;
  try {
    const val = await withRedisRetry(client => client.get(key));
    return typeof val === 'string' && val.length >= MIN_CACHEABLE_LENGTH ? val : null;
  } catch (e) {
    console.warn('[ai-cache] read failed:', e instanceof Error ? e.message : e);
    return null;
  }
}

export async function setCachedAiResponse(key: string, text: string): Promise<void> {
  if (!isAiCacheEnabled() || !getSharedRedisUrl()) return;
  if (text.trim().length < MIN_CACHEABLE_LENGTH) return;
  const ttl = getCacheTtlSeconds();
  try {
    await withRedisRetry(client => client.set(key, text, 'EX', ttl));
  } catch (e) {
    console.warn('[ai-cache] write failed:', e instanceof Error ? e.message : e);
  }
}

/** 将缓存文本包装为与前端契约一致的 SSE 响应流 */
export function createCachedSseResponse(text: string): Response {
  const encoder = new TextEncoder();
  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      // 按约 48 字分片推送，保留打字机平滑感同时瞬间完成
      const chunkSize = 48;
      for (let i = 0; i < text.length; i += chunkSize) {
        const piece = text.slice(i, i + chunkSize);
        controller.enqueue(encoder.encode(`data: ${JSON.stringify({ delta: { text: piece } })}\n\n`));
      }
      controller.enqueue(encoder.encode('data: [DONE]\n\n'));
      controller.close();
    },
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream; charset=utf-8',
      'Cache-Control': 'no-cache, no-transform',
      Connection: 'keep-alive',
      'X-AI-Cache': 'HIT',
    },
  });
}
