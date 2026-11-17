/**
 * app/api/heming/route.ts —— 紫微斗数双人合盘 AI 解读接口
 *
 * 前端契约（app/heming/page.tsx 已定死）：
 *   请求：POST { chartA: ZiweiChart, chartB: ZiweiChart, question?: string }
 *   响应：SSE 流，逐行 data: {"delta":{"text":"…"}}，以 data: [DONE] 结束
 *
 * 环境变量与 /api/interpret 完全共用：
 *   AI_PROVIDER + <PROVIDER>_API_KEY / <PROVIDER>_BASE_URL / <PROVIDER>_MODEL
 */

import type { ZiweiChart, Palace, SiHua } from '@/lib/ziwei/types';
import { BRANCHES, STEMS } from '@/lib/ziwei/constants';
import { detectPatterns } from '@/lib/ziwei/patterns';
import { getSiHuaByStem } from '@/lib/ziwei/sihua';
import { createInterpretStream } from '@/lib/ai/interpret-stream';
import { checkAiRateLimit } from '@/lib/ai/rate-limit';
import {
  buildAiCacheKey,
  createCachedSseResponse,
  getCachedAiResponse,
  setCachedAiResponse,
} from '@/lib/ai/cache';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 60;

// ─── 供应商预设（与 /api/interpret 保持一致）───
const PRESETS: Record<string, { baseUrl: string; model: string }> = {
  deepseek: { baseUrl: 'https://api.deepseek.com', model: 'deepseek-flash' },
  gemini: { baseUrl: 'https://generativelanguage.googleapis.com/v1beta/openai', model: 'gemini-3.8-flash' },
  openai: { baseUrl: 'https://api.openai.com/v1', model: 'gpt-6.1-terra' },
};

function resolveConfig() {
  const provider = (process.env.AI_PROVIDER || 'deepseek').trim().toLowerCase();
  const prefix = provider.toUpperCase().replace(/[^A-Z0-9]/g, '_');
  const preset = PRESETS[provider] ?? { baseUrl: '', model: '' };
  const apiKey = process.env[`${prefix}_API_KEY`] || process.env.LLM_API_KEY || '';
  const baseUrl = (process.env[`${prefix}_BASE_URL`] || process.env.LLM_BASE_URL || preset.baseUrl).replace(/\/+$/, '');
  const model = process.env[`${prefix}_MODEL`] || process.env.LLM_MODEL || preset.model;
  return { provider, prefix, apiKey, baseUrl, model };
}

function isValidChart(chart: ZiweiChart | undefined | null): chart is ZiweiChart {
  return Boolean(
    chart &&
    chart.birthInfo &&
    chart.lunarInfo &&
    Number.isInteger(chart.birthInfo.year) &&
    Number.isInteger(chart.birthInfo.month) && chart.birthInfo.month >= 1 && chart.birthInfo.month <= 12 &&
    Number.isInteger(chart.birthInfo.day) && chart.birthInfo.day >= 1 && chart.birthInfo.day <= 31 &&
    Number.isInteger(chart.birthInfo.hour) && chart.birthInfo.hour >= 0 && chart.birthInfo.hour <= 11 &&
    ['male', 'female'].includes(chart.birthInfo.gender) &&
    Number.isInteger(chart.lunarInfo.lunarYear) &&
    Number.isInteger(chart.lunarInfo.lunarMonth) &&
    Number.isInteger(chart.lunarInfo.lunarDay) &&
    Number.isInteger(chart.lunarInfo.yearStem) && chart.lunarInfo.yearStem >= 0 && chart.lunarInfo.yearStem <= 9 &&
    Number.isInteger(chart.mingGongBranch) && chart.mingGongBranch >= 0 && chart.mingGongBranch <= 11 &&
    Number.isInteger(chart.shenGongBranch) && chart.shenGongBranch >= 0 && chart.shenGongBranch <= 11 &&
    Number.isFinite(chart.currentAge) && typeof chart.wuxingJuName === 'string' &&
    Array.isArray(chart.daXians) && Number.isInteger(chart.currentDaXianIndex) &&
    Array.isArray(chart.palaces) && chart.palaces.length === 12 &&
    new Set(chart.palaces.map(p => p.branch)).size === 12 &&
    !chart.palaces.some(p =>
      !Number.isInteger(p.branch) || p.branch < 0 || p.branch > 11 ||
      !Number.isInteger(p.stem) || p.stem < 0 || p.stem > 9 ||
      typeof p.name !== 'string' || !Array.isArray(p.stars) ||
      p.stars.some(s => !s || typeof s.name !== 'string' || typeof s.type !== 'string'),
    ),
  );
}

// ─── 单盘与双盘互参序列化 ───
function starText(p: Palace): string {
  const fmt = (s: Palace['stars'][number]) =>
    `${s.name}${s.brightnessRaw ? `(${s.brightnessRaw})` : ''}${s.siHua ? `[化${s.siHua}]` : ''}`;
  const major = p.stars.filter(s => s.type === 'major').map(fmt);
  const minor = p.stars.filter(s => s.type !== 'major').map(fmt);
  const parts: string[] = [];
  if (major.length) parts.push(`主星 ${major.join('、')}`);
  if (minor.length) parts.push(`辅煞 ${minor.join('、')}`);
  if (p.isEmpty) parts.push(`空宫，借对宫${p.borrowedFromName ?? ''}${p.borrowedStars?.length ? `(${p.borrowedStars.join('、')})` : ''}`);
  if (p.selfSihua?.length) parts.push(`宫干自化 ${p.selfSihua.map(m => `${m.starName}自化${m.siHua}`).join('、')}`);
  return parts.join('；') || '无星曜';
}

function serializeChart(chart: ZiweiChart, label: string): string {
  const b = chart.birthInfo;
  const l = chart.lunarInfo;
  const lines: string[] = [];
  lines.push(
    `${label}：${b.name ? `${b.name}，` : ''}${chart.yinYangGender ?? (b.gender === 'male' ? '男' : '女')}；` +
    `排盘用公历 ${b.year}年${b.month}月${b.day}日 ${BRANCHES[b.hour]}时（已按排盘配置处理时间）` +
    `${b.province || b.city ? `（出生地 ${b.province ?? ''}${b.city ?? ''}）` : ''}；` +
    `农历 ${l.lunarYear}年${l.isLeapMonth ? '闰' : ''}${Math.abs(l.lunarMonth)}月${l.lunarDay}日（生年干：${STEMS[l.yearStem]}）；` +
    `${l.fourPillars?.length ? `四柱 ${l.fourPillars.join(' ')}；` : ''}` +
    `${chart.wuxingJuName}；命宫在${BRANCHES[chart.mingGongBranch]}，身宫在${BRANCHES[chart.shenGongBranch]}；` +
    `${chart.mingZhu ? `命主星 ${chart.mingZhu}；` : ''}${chart.shenZhu ? `身主星 ${chart.shenZhu}；` : ''}` +
    `当前虚岁 ${chart.currentAge}。`,
  );
  const curDx = chart.daXians?.[chart.currentDaXianIndex];
  if (curDx) {
    lines.push(`当前大限：${curDx.startAge}–${curDx.endAge} 岁，行运${curDx.palaceName}${curDx.stemName ? `（宫干 ${curDx.stemName}）` : ''}。`);
  } else {
    lines.push('当前年龄没有匹配的大限数据，请勿自行编造当前大限。');
  }
  lines.push('十二宫：');
  for (const p of chart.palaces) {
    const marks = [
      p.isMingGong ? '命宫' : '',
      p.isShenGong ? '身宫' : '',
      p.isCurrentDaXian ? '当前大限' : '',
    ].filter(Boolean).join('/');
    lines.push(
      `- ${p.name}（${STEMS[p.stem]}${BRANCHES[p.branch]}）${marks ? `【${marks}】` : ''}` +
      `${p.daXianAge ? ` 大限 ${p.daXianAge[0]}–${p.daXianAge[1]}岁；` : '；'}${starText(p)}`,
    );
  }
  try {
    const patterns = detectPatterns(chart);
    if (patterns.length) {
      lines.push('已识别格局（引擎判定）：');
      for (const pat of patterns) {
        lines.push(`- ${pat.name}（${pat.level}）：${pat.description}${pat.source ? ` 出处：${pat.source}` : ''}`);
      }
    }
  } catch { /* 格局识别失败不阻断合盘 */ }
  return lines.join('\n');
}

function getEffectiveMajorStars(chart: ZiweiChart, palaceName: string): { stars: string[]; borrowed: boolean } {
  const palace = chart.palaces.find(p => p.name === palaceName);
  if (!palace) return { stars: [], borrowed: false };
  const ownMajor = palace.stars.filter(s => s.type === 'major').map(s => s.name);
  if (ownMajor.length > 0) return { stars: ownMajor, borrowed: false };
  if (palace.borrowedStars?.length) return { stars: palace.borrowedStars, borrowed: true };
  if (typeof palace.oppositeBranch === 'number') {
    const opp = chart.palaces.find(p => p.branch === palace.oppositeBranch);
    const oppMajor = opp?.stars.filter(s => s.type === 'major').map(s => s.name) ?? [];
    if (oppMajor.length > 0) return { stars: oppMajor, borrowed: true };
  }
  return { stars: [], borrowed: false };
}

function describeCrossFly(stemIndex: number, stemLabel: string, targetChart: ZiweiChart, targetLabel: string): string {
  const transforms = getSiHuaByStem(stemIndex);
  const parts: string[] = [];
  for (const sh of ['禄', '权', '科', '忌'] as SiHua[]) {
    const starName = transforms[sh];
    if (!starName) continue;
    const hitPalace = targetChart.palaces.find(p => p.stars.some(s => s.name === starName));
    if (hitPalace) {
      parts.push(`化${sh}（${starName}）入${targetLabel}【${hitPalace.name}】`);
    }
  }
  return `${stemLabel}（${STEMS[stemIndex]}干）飞入${targetLabel}：${parts.join('，') || '无对应落宫'}`;
}

function serializeCrossReference(chartA: ZiweiChart, chartB: ZiweiChart): string {
  const lines: string[] = [];
  const mingA = getEffectiveMajorStars(chartA, '命宫');
  const fuqiA = getEffectiveMajorStars(chartA, '夫妻宫');
  const fudeA = getEffectiveMajorStars(chartA, '福德宫');
  const mingB = getEffectiveMajorStars(chartB, '命宫');
  const fuqiB = getEffectiveMajorStars(chartB, '夫妻宫');
  const fudeB = getEffectiveMajorStars(chartB, '福德宫');

  const fmtMajor = (m: { stars: string[]; borrowed: boolean }) =>
    m.stars.length ? `${m.stars.join('、')}${m.borrowed ? '（空宫借对宫）' : ''}` : '无主星';

  lines.push('【双盘关键互参（由排盘引擎精确计算，请直接作为判断依据）】');
  lines.push(`- 甲方核心三宫主星：命宫[${fmtMajor(mingA)}]、夫妻宫[${fmtMajor(fuqiA)}]、福德宫[${fmtMajor(fudeA)}]`);
  lines.push(`- 乙方核心三宫主星：命宫[${fmtMajor(mingB)}]、夫妻宫[${fmtMajor(fuqiB)}]、福德宫[${fmtMajor(fudeB)}]`);

  const aFuqiHitsBMing = fuqiA.stars.filter(s => mingB.stars.includes(s));
  const bFuqiHitsAMing = fuqiB.stars.filter(s => mingA.stars.includes(s));
  lines.push(
    `- 夫妻宫与对方命宫主星对应：` +
    `甲方夫妻宫与乙方命宫${aFuqiHitsBMing.length ? `重合【${aFuqiHitsBMing.join('、')}】` : '无直接主星重合'}；` +
    `乙方夫妻宫与甲方命宫${bFuqiHitsAMing.length ? `重合【${bFuqiHitsAMing.join('、')}】` : '无直接主星重合'}。`,
  );

  lines.push(`- ${describeCrossFly(chartA.lunarInfo.yearStem, '甲方生年干', chartB, '乙方')}`);
  lines.push(`- ${describeCrossFly(chartB.lunarInfo.yearStem, '乙方生年干', chartA, '甲方')}`);

  const mingPalaceA = chartA.palaces.find(p => p.isMingGong);
  const mingPalaceB = chartB.palaces.find(p => p.isMingGong);
  if (mingPalaceA) lines.push(`- ${describeCrossFly(mingPalaceA.stem, '甲方命宫干', chartB, '乙方')}`);
  if (mingPalaceB) lines.push(`- ${describeCrossFly(mingPalaceB.stem, '乙方命宫干', chartA, '甲方')}`);

  return lines.join('\n');
}

function buildSystemPrompt(chartA: ZiweiChart, chartB: ZiweiChart): string {
  return [
    '你是一位精通紫微斗数的合盘解读师，采用倪海厦《天纪》的论命体系与口径（如看婚姻必看命宫、夫妻宫、福德宫三宫联参，重四化飞化互参与大限同步）。',
    '下面是甲方（A）与乙方（B）已经排好的命盘数据及引擎计算的双盘互参数据（是本次合盘分析唯一的事实依据）：',
    '',
    '【甲方（A）命盘】',
    serializeChart(chartA, '甲方（A）'),
    '',
    '【乙方（B）命盘】',
    serializeChart(chartB, '乙方（B）'),
    '',
    serializeCrossReference(chartA, chartB),
    '',
    '合盘解读规则：',
    '1. 只能依据上面给出的双方宫位、星曜、亮度、四化、自化、格局与双盘互参数据下断语；命盘里没有的星曜和组合不要虚构，数据不足以判断时要明说。',
    '2. 分析婚姻感情时，必须同时结合双方的【命宫】【夫妻宫】【福德宫】以及太阳、太阴状态；分析事业合伙时，重点结合双方【命宫】【官禄宫】【兄弟宫/交友宫】【财帛宫】。',
    '3. 每个分节标题必须独立成行，严格使用 **【标题】** 格式（前端按此语法渲染金色小标题），正文可使用 **加粗** 强调重点，不要使用 # 号标题。',
    '4. 每项主要判断先指出双方具体宫位、星曜或飞化依据，再解释互动模式与建议；传统命理解释不等于已发生的事实，不作确定性事件或生离死别恐吓式断言。',
    '5. 本次没有提供可核查的倪师逐字原文。即使用户要求引用原话，也不要编写引号、集数或时间码；只能说明这是概括性解释。',
    '6. 区分本命与大限。当前仅提供双方本命盘与当前大限信息，未提供独立流年、流月命盘；问到具体哪一年结婚或应期时，先说明数据范围，再根据本命与当前大限给出方向性分析。',
    '7. 谈健康只谈体质倾向与作息建议，不做疾病诊断、不预测寿元；谈财务不给具体投资标的；不鼓励任何形式的付费改运。',
    '8. 综合合盘分析以约 650–950 个汉字为目标，针对具体追问以约 400–650 字为目标，语气平实具体，避免空泛套话。',
  ].join('\n');
}

const DEFAULT_HEMING_PROMPT = `请对甲方（A）与乙方（B）进行紫微斗数合盘深度分析，严格按以下分节标题输出：

**【合盘定调】**
概括双方命格属性、整体匹配度与缘分核心特征（互补型、同频型还是需要磨合型）。

**【命格与福德互参】**
结合双方命宫、身宫与福德宫星曜，分析两人的性格底色、价值观以及深层相处能否长久稳定。

**【夫妻宫与飞化互参】**
结合双方夫妻宫星曜配置、主星对应关系，以及生年四化/命宫四化飞入对方命盘的落宫，解析双向互动中的助力与摩擦点。

**【当前大限同步性】**
对比双方当前大限行运节奏，判断当下阶段两人的运势步调是否一致、共同面临的课题是什么。

**【相处与经营建议】**
针对双方命盘最容易产生矛盾的环节与各自的优势，给出具体、可落地的相处或合作建议。`;

function buildUserPrompt(question?: string): string {
  const q = typeof question === 'string' ? question.trim().slice(0, 1000) : '';
  if (!q) return DEFAULT_HEMING_PROMPT;
  return [
    `请针对甲方（A）与乙方（B）的合盘，重点回答以下问题：「${q}」`,
    '',
    '请直接围绕该问题分 3–4 个小节展开，每个小节标题独立成行并使用 **【标题】** 格式（例如 **【核心结论】**、**【双盘宫位与飞化依据】**、**【潜在风险与磨合点】**、**【具体建议】**），有理有据地给出分析。',
  ].join('\n');
}

// ─── 主处理 ───
export async function POST(req: Request) {
  const cfg = resolveConfig();
  if (!cfg.apiKey) {
    console.error(`[heming] missing API key: set ${cfg.prefix}_API_KEY (AI_PROVIDER=${cfg.provider})`);
    return Response.json({ error: `服务端尚未配置 ${cfg.prefix}_API_KEY` }, { status: 500 });
  }
  if (!cfg.baseUrl || !cfg.model) {
    console.error(`[heming] incomplete config for provider=${cfg.provider}: need ${cfg.prefix}_BASE_URL and ${cfg.prefix}_MODEL`);
    return Response.json({ error: `供应商 ${cfg.provider} 缺少 BASE_URL / MODEL 配置` }, { status: 500 });
  }

  let systemPrompt: string;
  let userPrompt: string;
  try {
    const body = await req.json();
    const chartA = body?.chartA as ZiweiChart;
    const chartB = body?.chartB as ZiweiChart;
    if (!isValidChart(chartA) || !isValidChart(chartB)) {
      throw new Error('bad charts');
    }
    if (body?.question !== undefined && typeof body.question !== 'string') {
      throw new Error('bad question');
    }
    systemPrompt = buildSystemPrompt(chartA, chartB);
    userPrompt = buildUserPrompt(body?.question);
  } catch {
    return Response.json({ error: '请求体不合法，需要有效的 { chartA, chartB }' }, { status: 400 });
  }

  const cacheKey = buildAiCacheKey('heming', cfg.model, systemPrompt, userPrompt);
  const cached = await getCachedAiResponse(cacheKey);
  if (cached) {
    return createCachedSseResponse(cached);
  }

  const rl = await checkAiRateLimit(req);
  if (!rl.allowed) {
    return Response.json(
      { error: rl.error ?? '请求过于频繁，请稍后再试' },
      {
        status: 429,
        headers: rl.retryAfterSeconds ? { 'Retry-After': String(rl.retryAfterSeconds) } : undefined,
      },
    );
  }

  const upstreamBody: Record<string, unknown> = {
    model: cfg.model,
    messages: [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userPrompt },
    ],
    stream: true,
    temperature: 0.7,
    max_tokens: 4000,
  };
  if ((cfg.provider === 'deepseek' || /deepseek/i.test(cfg.model)) && process.env.DEEPSEEK_THINKING !== 'enabled') {
    upstreamBody.thinking = { type: 'disabled' };
  }

  let upstream: Response;
  const upstreamAbort = new AbortController();
  let timedOut = false;
  const timeout = setTimeout(() => { timedOut = true; upstreamAbort.abort(); }, 55_000);
  const cancelUpstream = () => upstreamAbort.abort();
  req.signal.addEventListener('abort', cancelUpstream, { once: true });
  if (req.signal.aborted) cancelUpstream();
  const cleanup = () => {
    clearTimeout(timeout);
    req.signal.removeEventListener('abort', cancelUpstream);
    upstreamAbort.abort();
  };

  try {
    upstream = await fetch(`${cfg.baseUrl}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${cfg.apiKey}`,
      },
      body: JSON.stringify(upstreamBody),
      signal: upstreamAbort.signal,
    });
  } catch (e) {
    cleanup();
    console.error('[heming] upstream fetch failed', e);
    return Response.json({ error: timedOut ? '模型响应超时，请重试' : '无法连接模型接口' }, { status: timedOut ? 504 : 502 });
  }
  if (!upstream.ok || !upstream.body) {
    const detail = (await upstream.text().catch(() => '')).slice(0, 300);
    cleanup();
    console.error(`[heming] upstream ${upstream.status}: ${detail}`);
    return Response.json({ error: `模型接口返回 ${upstream.status}` }, { status: 502 });
  }

  const stream = createInterpretStream(
    upstream.body,
    cleanup,
    (fullText) => { void setCachedAiResponse(cacheKey, fullText); },
  );

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream; charset=utf-8',
      'Cache-Control': 'no-cache, no-transform',
      Connection: 'keep-alive',
    },
  });
}
