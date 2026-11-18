/** Rebuild the withdrawal ledger, never infer that a citation proves an old sentence. */
import { createHash } from 'node:crypto';
import { readFileSync, writeFileSync } from 'node:fs';
import draft from '../../docs/knowledge-review/original-draft.json';
import review from '../../docs/tianji-ziwei/review/knowledge-notes.json';

const topics: Record<string, string> = {
  mingGong: 'overview', personality: 'personality', xiongDi: 'family', fuQi: 'love',
  ziNv: 'children', caiBo: 'wealth', jiE: 'health', qianYi: 'move', jiaoYou: 'friends',
  guanLu: 'career', tianZhai: 'home', fuDe: 'spirit', fuMu: 'parents',
};
const pages = review.pages as Record<string, { correction: string }>;
function reason(star: string, topic: string, section: string, text: string) {
  if (section === '经典出处') return { kind: 'unverified-attribution', detail: '未核实这段完整措辞的底本、卷节和逐字一致性；不再作为直接古籍引文发布。' };
  if (text.includes('即使命宫') || text.includes('即使本命宫')) return { kind: 'placement-conflict', detail: '本命同一主星不能同时落在命宫与迁移宫；原句混淆实际落宫与借星。' };
  if (text.includes('廉贞天府（子午宫）')) return { kind: 'placement-conflict', detail: '《紫微斗数全书》卷二电子录文列廉贞天府在辰戌、廉贞天相在子午；整句其他婚姻结论亦未核实。' };
  if (topic === 'family' && text.includes('三方交友')) return { kind: 'palace-geometry', detail: '十二宫排列下，兄弟宫三合为疾厄、田宅，不是交友、田宅；撤下这句错误的依据。' };
  if (topic === 'children' && text.includes('三方田宅')) return { kind: 'palace-geometry', detail: '十二宫排列下，子女宫三合为仆役、父母，不是田宅、交友；撤下这句错误的依据。' };
  if (star === '天机' && text.includes('六岁')) return { kind: 'misattributed-condition', detail: '可定位的年龄差讨论是太阳落陷案例（entries.jsonl 第 1733 条），不能转作天机夫妻宫的一般建议。' };
  if (star === '廉贞' && text.includes('廉贞七杀') && topic === 'love') return { kind: 'source-conflict', detail: 'entries.jsonl 第 1392 条将廉贞七杀与廉贞贪狼、廉贞破军作区别；原稿混成同一婚姻结论。' };
  if (topic === 'health') return { kind: 'unsupported-health-inference', detail: '未定位足以支持本句完整内容的依据；传统星曜象征也不能支持现代疾病、病因、疗效或身体保护力结论，整句撤下。' };
  if (/倪师|倪海厦/.test(text)) return { kind: 'unverified-attribution', detail: '未核实本句全部限定条件和补充建议都出自该讲者；不能以一般课程链接替完整归因背书。' };
  if (/一律|必有|必然|即可|绝不|一生不缺|只要|永远|稳步高升|极顺|白头到老/.test(text)) return { kind: 'unsupported-guarantee', detail: '完整的确定性表述未获对应来源支持；不保留结果保证。' };
  return { kind: 'not-verified-as-written', detail: '未核实原句所有分句及适用条件；即使有相近星性，也不足以证明整句。原句撤下，新整理另列具体来源，不标作原句已证实。' };
}
const sentences: object[] = [];
for (const [star, profile] of Object.entries(draft.articles)) {
  for (const [field, content] of Object.entries(profile)) {
    const topic = topics[field];
    const blocks = [...content.matchAll(/\*\*【([^】]+)】\*\*\n([\s\S]*?)(?=\n\n\*\*【|$)/g)];
    for (const [, section, body] of blocks) {
      const parts = body.match(/[^。！？；\n]+[。！？；]?[」”]?/gu) ?? [];
      parts.forEach((text, index) => {
        const { kind, detail } = reason(star, topic, section, text);
        const key = `${star}/${topic}`;
        sentences.push({
          id: createHash('sha256').update(`${key}/${section}/${index}/${text}`).digest('hex').slice(0, 16),
          star, topic, section, index, text, action: 'withdrawn', reason: kind, detail,
          replacementPage: pages[key] ? key : null,
          pageCorrection: pages[key]?.correction ?? '本专题尚无足够的逐句依据；停止发布断语并设为 noindex。',
        });
      });
    }
  }
}
for (const [star, text] of Object.entries(draft.starBriefs)) {
  sentences.push({ id: createHash('sha256').update(`brief/${star}/${text}`).digest('hex').slice(0,16), star, topic: 'brief', section: '星曜简介', text, action: 'withdrawn', reason: 'not-verified-as-written', detail: '撤下旧简介中的无出处星性、化气及职业推演；入口改用已校订专题名称。', replacementPage: `${star}/overview` });
}
const ledger = {
  baselineCommit: draft.baselineCommit,
  reviewedAt: review.reviewedAt,
  corpusHash: createHash('sha256').update(readFileSync('docs/tianji-ziwei/entries.jsonl')).digest('hex'),
  method: '对原稿按句号、问叹号和分号拆分，逐单元保留原文及撤下原因。所有旧句均撤下；不将关键词命中或新段落的引用等同旧句全文验证。新发布句另在 knowledge-notes.json 中逐句列源。',
  articles: 182,
  publishedNotes: Object.keys(pages).length,
  withheldArticles: 182 - Object.keys(pages).length,
  statements: sentences,
};
writeFileSync('docs/knowledge-review/withdrawal-ledger.json', JSON.stringify(ledger, null, 2) + '\n');
console.log(`Archived ${sentences.length} original sentence/clause/brief units; ${ledger.publishedNotes} source-linked notes; ${ledger.withheldArticles} withheld articles`);
