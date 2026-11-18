/**
 * SEO 知识页 — 数据 helper
 *
 * 14 主星 × 13 topic = 182 个独立 SEO URL
 * 未确认的专题可阅读原稿。校订状态独立于搜索收录。
 */

import { STAR_DB } from '@/lib/ziwei/db-analysis';
import type { TopicKey } from '@/lib/ziwei/db-analysis';
import { TOPIC_PALACE_NAME, TOPIC_LABEL } from '@/lib/ziwei/db-analysis';
import { KNOWLEDGE_REVIEWS, type KnowledgeReview } from './knowledge-review';
import originalDraft from '@/docs/knowledge-review/original-draft.json';

export const ALL_STARS = [
  '紫微', '天机', '太阳', '武曲', '天同', '廉贞', '天府',
  '太阴', '贪狼', '巨门', '天相', '天梁', '七杀', '破军',
];

// 主星名 ↔ 拼音 slug 映射（URL 用 slug，避免中文 URL 在 Vercel/CDN 上的边界问题）
export const STAR_TO_SLUG: Record<string, string> = {
  '紫微': 'ziwei',
  '天机': 'tianji',
  '太阳': 'taiyang',
  '武曲': 'wuqu',
  '天同': 'tiantong',
  '廉贞': 'lianzhen',
  '天府': 'tianfu',
  '太阴': 'taiyin',
  '贪狼': 'tanlang',
  '巨门': 'jumen',
  '天相': 'tianxiang',
  '天梁': 'tianliang',
  '七杀': 'qisha',
  '破军': 'pojun',
};

export const SLUG_TO_STAR: Record<string, string> = Object.fromEntries(
  Object.entries(STAR_TO_SLUG).map(([k, v]) => [v, k])
);

export const ALL_TOPICS: TopicKey[] = [
  'overview', 'personality', 'love', 'career', 'wealth', 'health',
  'family', 'children', 'move', 'friends', 'home', 'spirit', 'parents',
];

interface StarContent {
  mingGong: string;
  personality: string;
  xiongDi?: string;
  fuQi: string;
  ziNv?: string;
  caiBo: string;
  jiE: string;
  qianYi?: string;
  jiaoYou?: string;
  guanLu: string;
  tianZhai?: string;
  fuDe?: string;
  fuMu?: string;
}

const TOPIC_TO_FIELD: Record<TopicKey, keyof StarContent> = {
  overview:    'mingGong',
  personality: 'personality',
  love:        'fuQi',
  career:      'guanLu',
  wealth:      'caiBo',
  health:      'jiE',
  family:      'xiongDi' as keyof StarContent,
  children:    'ziNv' as keyof StarContent,
  move:        'qianYi' as keyof StarContent,
  friends:     'jiaoYou' as keyof StarContent,
  home:        'tianZhai' as keyof StarContent,
  spirit:      'fuDe' as keyof StarContent,
  parents:     'fuMu' as keyof StarContent,
};

interface ParsedContent {
  dingdiao: string;
  lundian: string;
  yiju: string;
  chuchu: string;
  raw: string;
  hasMarkers: boolean;
}

function parseStarContent(content: string): ParsedContent {
  const out: ParsedContent = { dingdiao: '', lundian: '', yiju: '', chuchu: '', raw: content, hasMarkers: false };
  if (!content) return out;
  if (!content.includes('**【一句话定调】**') && !content.includes('**【核心论断】**')) {
    out.lundian = content;
    return out;
  }
  out.hasMarkers = true;
  const re = /\*\*【([^】]+)】\*\*/g;
  const parts: { name: string; markerEnd: number; start: number }[] = [];
  let m: RegExpExecArray | null;
  while ((m = re.exec(content)) !== null) {
    parts.push({ name: m[1], start: m.index, markerEnd: m.index + m[0].length });
  }
  for (let i = 0; i < parts.length; i++) {
    const p = parts[i];
    const end = i + 1 < parts.length ? parts[i + 1].start : content.length;
    const text = content.slice(p.markerEnd, end).trim();
    if (p.name === '一句话定调') out.dingdiao = text;
    else if (p.name === '核心论断') out.lundian = text;
    else if (p.name === '命盘依据') out.yiju = text;
    else if (p.name === '经典出处') out.chuchu = text;
  }
  return out;
}

export interface KnowledgeData {
  star: string;
  topic: TopicKey;
  topicLabel: string;
  palaceName: string;
  heading: string;
  parsed: ParsedContent;
  exists: boolean;
  review?: KnowledgeReview;
  hasReviewedSources: boolean;
}

export function getKnowledge(star: string, topic: TopicKey): KnowledgeData {
  const profile = STAR_DB[star] as StarContent | undefined;
  const field = TOPIC_TO_FIELD[topic];
  const content = profile && field ? (profile[field] as string | undefined) ?? '' : '';
  const palaceName = TOPIC_PALACE_NAME[topic];
  const fullPalaceName = palaceName ? (palaceName.endsWith('宫') ? palaceName : `${palaceName}宫`) : '';
  const review = KNOWLEDGE_REVIEWS[`${star}/${topic}`];
  return {
    star,
    topic,
    topicLabel: TOPIC_LABEL[topic],
    palaceName: fullPalaceName,
    heading: review?.heading ?? (topic === 'personality' ? `${star}星的性格专题` : `${star}星入${fullPalaceName}`),
    parsed: parseStarContent(content),
    exists: ALL_STARS.includes(star) && ALL_TOPICS.includes(topic),
    review,
    hasReviewedSources: Boolean(review?.claims.length),
  };
}

export function getUnconfirmedDraft(star: string, topic: TopicKey) {
  const articles: Record<string, StarContent> = originalDraft.articles;
  const draft = parseStarContent(articles[star]?.[TOPIC_TO_FIELD[topic]] ?? '');
  return [
    { title: '原稿摘要', text: draft.dingdiao },
    { title: '原稿正文', text: draft.lundian },
  ].filter(section => section.text);
}

/** 生成所有 14×13 组合（用于 generateStaticParams） */
export function getAllKnowledgeRoutes(reviewedOnly = false) {
  const routes: { star: string; slug: string; topic: TopicKey }[] = [];
  for (const star of ALL_STARS) {
    for (const topic of ALL_TOPICS) {
      const data = getKnowledge(star, topic);
      if (data.exists && (!reviewedOnly || data.hasReviewedSources)) routes.push({ star, slug: STAR_TO_SLUG[star], topic });
    }
  }
  return routes;
}

/** Index cards use reviewed topic headings instead of unreferenced star claims. */
export const STAR_BRIEF_SEO: Record<string, string> = Object.fromEntries(
  ALL_STARS.map(star => [star, KNOWLEDGE_REVIEWS[`${star}/overview`]?.heading ?? `${star}星专题`]),
);
