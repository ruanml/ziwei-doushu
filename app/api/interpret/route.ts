/**
* app/api/interpret/route.ts —— AI 解读接口（自实现 v1）
*
* 前端契约（components/InsightPanel.tsx / components/ChatPanel.tsx 已定死）：
* 请求：POST { chart: ZiweiChart, messages: { role, content}[]}
* 响应：SSE 流，逐行 data: {"delta":{"text":"…"}}，以 data: [DONE] 结束
*
* 配置（沿用.env.example 的约定，只填在 Vercel 环境变量里，不要进仓库）：
* AI_PROVIDER=deepseek # 或 gemini / openai / 任意自定义名
* DEEPSEEK_API_KEY=sk-... # 变量名 = <PROVIDER 大写>_API_KEY
* # 可选覆盖：<PROVIDER>_BASE_URL、<PROVIDER>_MODEL
* # 例（Gemini）：AI_PROVIDER=gemini + GEMINI_API_KEY（AI Studio 申请）
* # 例（自定义 OpenAI 兼容服务）：AI_PROVIDER=mimo + MIMO_API_KEY + MIMO_BASE_URL + MIMO_MODEL
*
* 注意：deepseek-chat / deepseek-reasoner 旧模型名已于 2026-07-24 退役，
* DeepSeek 当前默认用 deepseek-flash（V4.1 Flash）；要更强可设 DEEPSEEK_MODEL=deepseek-v4-pro。
*/

import type { ZiweiChart, Palace} from '@/lib/ziwei/types';
import { BRANCHES, STEMS} from '@/lib/ziwei/constants';
import { detectPatterns} from '@/lib/ziwei/patterns';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 60;

// ─── 供应商预设（均可被 <PROVIDER>_BASE_URL / <PROVIDER>_MODEL 覆盖）───
const PRESETS: Record<string, { baseUrl: string; model: string}> = {
deepseek: { baseUrl: 'https://api.deepseek.com', model: 'deepseek-flash'},
gemini: { baseUrl: 'https://generativelanguage.googleapis.com/v1beta/openai', model: 'gemini-3.8-flash'},
openai: { baseUrl: 'https://api.openai.com/v1', model: 'gpt-6.1-terra'},
};

function resolveConfig() {
const provider = (process.env.AI_PROVIDER || 'deepseek').trim().toLowerCase();
const prefix = provider.toUpperCase().replace(/[^A-Z0-9]/g, '_');
const preset = PRESETS[provider]?? { baseUrl: '', model: ''};
const apiKey = process.env[`${prefix}_API_KEY`] || process.env.LLM_API_KEY || '';
const baseUrl = (process.env[`${prefix}_BASE_URL`] || process.env.LLM_BASE_URL || preset.baseUrl).replace(/\/+$/, '');
const model = process.env[`${prefix}_MODEL`] || process.env.LLM_MODEL || preset.model;
return { provider, prefix, apiKey, baseUrl, model};
}

// ─── 命盘序列化：把结构化命盘压成模型可读的文本上下文 ───
function starText(p: Palace): string {
const fmt = (s: Palace['stars'][number]) =>
`${s.name}${s.brightnessRaw? `(${s.brightnessRaw})`: ''}${s.siHua? `[化${s.siHua}]`: ''}`;
const major = p.stars.filter(s => s.type === 'major').map(fmt);
const minor = p.stars.filter(s => s.type!== 'major').map(fmt);
const parts: string[] = [];
if (major.length) parts.push(`主星 ${major.join('、')}`);
if (minor.length) parts.push(`辅煞 ${minor.join('、')}`);
if (p.isEmpty) parts.push(`空宫，借对宫${p.borrowedFromName?? ''}${p.borrowedStars?.length? `(${p.borrowedStars.join('、')})`: ''}`);
if (p.selfSihua?.length) parts.push(`宫干自化 ${p.selfSihua.map(m => `${m.starName}自化${m.siHua}`).join('、')}`);
return parts.join('；') || '无星曜';
}

function serializeChart(chart: ZiweiChart): string {
const b = chart.birthInfo;
const l = chart.lunarInfo;
const lines: string[] = [];
lines.push(
`命主：${b.name? `${b.name}，`: ''}${chart.yinYangGender?? (b.gender === 'male'? '男': '女')}；` +
`公历 ${b.year}年${b.month}月${b.day}日 ${BRANCHES[b.hour]}时生` +
`${b.province || b.city? `（出生地 ${b.province?? ''}${b.city?? ''}）`: ''}；` +
`农历 ${l.lunarYear}年${l.isLeapMonth? '闰': ''}${Math.abs(l.lunarMonth)}月${l.lunarDay}日；` +
`${l.fourPillars?.length? `四柱 ${l.fourPillars.join(' ')}；`: ''}` +
`${chart.wuxingJuName}；命宫在${BRANCHES[chart.mingGongBranch]}，身宫在${BRANCHES[chart.shenGongBranch]}；` +
`${chart.mingZhu? `命主星 ${chart.mingZhu}；`: ''}${chart.shenZhu? `身主星 ${chart.shenZhu}；`: ''}` +
`当前虚岁 ${chart.currentAge}。`
);
const curDx = chart.daXians?.[chart.currentDaXianIndex];
if (curDx) lines.push(`当前大限：${curDx.startAge}–${curDx.endAge} 岁，行运${curDx.palaceName}${curDx.stemName? `（宫干 ${curDx.stemName}）`: ''}。`);
lines.push('十二宫：');
for (const p of chart.palaces) {
const marks = [
p.isMingGong? '命宫': '',
p.isShenGong? '身宫': '',
p.isCurrentDaXian? '当前大限': '',
].filter(Boolean).join('/');
lines.push(
`- ${p.name}（${STEMS[p.stem]}${BRANCHES[p.branch]}）${marks? ``: ''}` +
`${p.daXianAge? ` 大限 ${p.daXianAge[0]}–${p.daXianAge[1]}岁；`: '；'}${starText(p)}`
);
}
try {
const patterns = detectPatterns(chart);
if (patterns.length) {
lines.push('已识别格局（引擎判定，可引用但不要照抄了事）：');
for (const pat of patterns) {
lines.push(`- ${pat.name}（${pat.level}）：${pat.description}${pat.source? ` 出处：${pat.source}`: ''}`);
}
}
} catch { /* 格局识别失败不阻断解读 */}
return lines.join('\n');
}

function buildSystemPrompt(chart: ZiweiChart): string {
return [
'你是一位精通紫微斗数的解读师，采用倪海厦《天纪》的论命体系与口径。',
'下面是命主已经排好的命盘数据（由排盘引擎生成，是本次解读唯一的事实依据）：',
'',
serializeChart(chart),
'',
'解读规则：',
'1. 只能依据上面给出的宫位、星曜、亮度、四化、自化与格局下断语；命盘里没有的星曜和组合不要虚构，数据不足以判断时要明说。',
'2. 用户消息里若给出了输出结构（如分节标题），严格按该结构输出；否则先给总论定调，再按所问主题展开，最后给可落地的建议。',
'3. 用与用户最后一句相同的语言回答（默认简体中文），命理术语保留中文原名；语气平实具体，避免空泛的吉凶套话和堆砌辞藻。',
'4. 谈健康只谈体质倾向与生活作息建议，不做疾病诊断、不预测寿元；谈财务不给具体投资标的；不鼓励任何形式的付费改运。',
'5. 引用古籍或格局出处时注明来源名称即可，不要伪造原文。',
].join('\n');
}

// ─── 主处理 ───
interface ChatMsg { role: 'user' | 'assistant' | 'system'; content: string}

export async function POST(req: Request) {
const cfg = resolveConfig();
if (!cfg.apiKey) {
console.error(`[interpret] missing API key: set ${cfg.prefix}_API_KEY (AI_PROVIDER=${cfg.provider})`);
return Response.json({ error: `服务端尚未配置 ${cfg.prefix}_API_KEY`}, { status: 500});
}
if (!cfg.baseUrl ||!cfg.model) {
console.error(`[interpret] incomplete config for provider=${cfg.provider}: need ${cfg.prefix}_BASE_URL and ${cfg.prefix}_MODEL`);
return Response.json({ error: `供应商 ${cfg.provider} 缺少 BASE_URL / MODEL 配置`}, { status: 500});
}

let chart: ZiweiChart;
let messages: ChatMsg[] = [];
try {
const body = await req.json();
chart = body.chart as ZiweiChart;
if (!chart ||!Array.isArray(chart.palaces)) throw new Error('bad chart');
if (Array.isArray(body.messages)) {
messages = body.messages
.filter((m: ChatMsg) => m && (m.role === 'user' || m.role === 'assistant') && typeof m.content === 'string')
.slice(-16)
.map((m: ChatMsg) => ({ role: m.role, content: m.content.slice(0, 4000)}));
}
} catch {
return Response.json({ error: '请求体不合法，需要 { chart, messages}'}, { status: 400});
}
if (!messages.length || messages[messages.length - 1].role!== 'user') {
messages = [...messages, { role: 'user', content: '请总览这张命盘：命格定调、性格、事业、财运、感情、健康逐项解读，并给出建议。'}];
}

const upstreamBody: Record<string, unknown> = {
model: cfg.model,
messages: [{ role: 'system', content: buildSystemPrompt(chart)},...messages],
stream: true,
temperature: 0.7,
max_tokens: 4000,
};
// DeepSeek V4 默认开思考模式：解读场景关掉它，首字更快、也不为思考 token 付费。
// 经聚合平台（TokenHub / 硅基流动等）调用 DeepSeek 模型时同样适用，故按模型名判断。
// 如想开启思考，设环境变量 DEEPSEEK_THINKING=enabled。
if ((cfg.provider === 'deepseek' || /deepseek/i.test(cfg.model)) && process.env.DEEPSEEK_THINKING!== 'enabled') {
upstreamBody.thinking = { type: 'disabled'};
}

let upstream: Response;
try {
upstream = await fetch(`${cfg.baseUrl}/chat/completions`, {
method: 'POST',
headers: {
'Content-Type': 'application/json',
Authorization: `Bearer ${cfg.apiKey}`,
},
body: JSON.stringify(upstreamBody),
});
} catch (e) {
console.error('[interpret] upstream fetch failed', e);
return Response.json({ error: '无法连接模型接口'}, { status: 502});
}
if (!upstream.ok ||!upstream.body) {
const detail = (await upstream.text().catch(() => '')).slice(0, 300);
console.error(`[interpret] upstream ${upstream.status}: ${detail}`);
return Response.json({ error: `模型接口返回 ${upstream.status}`}, { status: 502});
}

// 把 OpenAI 兼容的流（choices[0].delta.content）转成前端要的 {"delta":{"text"}} 格式
const encoder = new TextEncoder();
const decoder = new TextDecoder();
const reader = upstream.body.getReader();
let buffer = '';

let finished = false;
const stream = new ReadableStream<Uint8Array>({
async pull(controller) {
if (finished) return;
// 终局处理只做一次：发出 [DONE]、关闭下游流、并主动断开上游。
// 关键点：一旦上游发出 [DONE] 就立即收尾，绝不等上游 socket 自己关闭——
// 部分聚合网关发完 [DONE] 后会长时间不关连接，干等会让前端一直处于 loading 状态。
const finish = () => {
if (finished) return;
finished = true;
try { controller.enqueue(encoder.encode('data: [DONE]\n\n')); } catch { /* 流已关闭 */ }
try { controller.close(); } catch { /* 流已关闭 */ }
reader.cancel().catch(() => {});
};
try {
const { done, value} = await reader.read();
if (done) { finish(); return; }
buffer += decoder.decode(value, { stream: true});
const lines = buffer.split('\n');
buffer = lines.pop()?? '';
for (const line of lines) {
const t = line.trim();
if (!t.startsWith('data:')) continue;
const data = t.slice(5).trim();
if (!data) continue;
if (data === '[DONE]') { finish(); return; }
try {
const json = JSON.parse(data);
const text: string = json.choices?.[0]?.delta?.content?? '';
if (text) {
controller.enqueue(encoder.encode(`data: ${JSON.stringify({ delta: { text}})}\n\n`));
}
} catch { /* 半行/心跳，跳过 */}
}
} catch (e) {
console.error('[interpret] stream error', e);
finish();
}
},
cancel() { finished = true; reader.cancel().catch(() => {});},
});

return new Response(stream, {
headers: {
'Content-Type': 'text/event-stream; charset=utf-8',
'Cache-Control': 'no-cache, no-transform',
Connection: 'keep-alive',
},
});
}
