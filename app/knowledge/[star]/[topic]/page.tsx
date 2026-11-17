/**
 * /knowledge/[star]/[topic] — SEO 落地页
 *
 * 14 主星 × 13 topic = 182 个独立 URL
 * 展示 STAR_DB 学习整理、适用范围与课程回看入口；未核实引文不展示。
 *
 * SEO 要点：
 *  - title 区分宫位与性格专题
 *  - description 用 dingdiao（一句话定调）
 *  - JSON-LD Article 结构化数据
 *  - 内链：同主星其他 12 专题 + 同专题其他 13 主星
 *  - generateStaticParams 静态生成，零运行时开销
 */

import Link from 'next/link';
import { notFound } from 'next/navigation';
import type { TopicKey } from '@/lib/ziwei/db-analysis';
import {
  ALL_STARS,
  ALL_TOPICS,
  getKnowledge,
  getAllKnowledgeRoutes,
  STAR_BRIEF_SEO,
  STAR_TO_SLUG,
  SLUG_TO_STAR,
} from '@/lib/seo/knowledge';
import { SITE_URL } from '@/lib/site';
import { pageMetadata } from '@/lib/seo/metadata';
import { KNOWLEDGE_UPDATED_AT, STAR_LECTURES } from '@/lib/seo/knowledge-sources';
import { READING_GUIDE } from '@/lib/seo/reading-guide';

// Only publish the star/topic pairs backed by actual content.
export const dynamicParams = false;

export async function generateStaticParams() {
  const routes = getAllKnowledgeRoutes();
  // URL 用拼音 slug 替代中文，避开 Vercel/CDN 中文路由边界问题
  return routes.map(r => ({ star: r.slug, topic: r.topic }));
}

export async function generateMetadata({ params }: { params: Promise<{ star: string; topic: string }> }) {
  const { star: slug, topic } = await params;
  const star = SLUG_TO_STAR[slug];
  if (!star) return {};
  const data = getKnowledge(star, topic as TopicKey);
  if (!data.exists) return {};

  const title = `${data.heading} · ${data.topicLabel} · 紫微命盘`;
  const description = data.parsed.dingdiao
    || `${data.heading}的传统命理学习笔记，说明适用条件与参考资料。`;

  return {
    ...pageMetadata({ title, description, type: 'article', path: `/knowledge/${slug}/${topic}` }),
    keywords: [
      '紫微斗数', '倪海厦', star, data.palaceName, data.topicLabel,
      `${star}${data.palaceName}`, `${star}入${data.palaceName}`,
      `紫微斗数 ${star}`, '倪海厦紫微斗数', '紫微斗数全集',
    ],
  };
}

export default async function KnowledgePage({ params }: { params: Promise<{ star: string; topic: string }> }) {
  const { star: slug, topic } = await params;
  const star = SLUG_TO_STAR[slug];
  if (!star) notFound();
  const data = getKnowledge(star, topic as TopicKey);
  if (!data.exists) notFound();
  const lecture = STAR_LECTURES[star];

  // 同主星其他 topic
  const otherTopicsForStar = ALL_TOPICS.filter(t => t !== topic && getKnowledge(star, t).exists);
  // 同 topic 其他主星
  const otherStarsForTopic = ALL_STARS.filter(s => s !== star && getKnowledge(s, topic as TopicKey).exists);

  // JSON-LD
  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'Article',
    headline: data.heading,
    description: data.parsed.dingdiao,
    author: { '@type': 'Organization', name: '紫微命盘', url: `${SITE_URL}/about` },
    publisher: {
      '@type': 'Organization',
      name: '紫微命盘',
      url: SITE_URL,
    },
    dateModified: KNOWLEDGE_UPDATED_AT,
    mainEntityOfPage: `${SITE_URL}/knowledge/${slug}/${topic}`,
    articleSection: '紫微斗数 · 倪海厦体系',
    keywords: [`紫微斗数`, star, data.palaceName, data.topicLabel].join(', '),
  };

  return (
    <div style={{ background: 'var(--bg-page)', minHeight: '100vh' }}>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />

      {/* 顶栏 */}
      <div className="px-6 py-4 flex items-center justify-between"
        style={{ borderBottom: '1px solid rgba(184,146,42,0.15)', background: 'var(--bg-page)' }}>
        <Link href="/" style={{ fontSize: '12px', color: 'var(--ac)', letterSpacing: '0.3em', textDecoration: 'none' }}>
          ← 首页
        </Link>
        <div style={{ fontSize: '12px', color: 'var(--tx-3)', letterSpacing: '0.2em' }}>
          倪师方法论 · 知识库
        </div>
        <Link href="/chart" style={{ fontSize: '12px', color: 'var(--ac)', letterSpacing: '0.2em', textDecoration: 'none' }}>
          起盘 →
        </Link>
      </div>

      <article className="max-w-3xl mx-auto px-6 py-12">
        {/* 面包屑 */}
        <nav style={{ fontSize: '11px', color: 'var(--tx-3)', letterSpacing: '0.1em', marginBottom: '16px' }}>
          <Link href="/" style={{ color: 'var(--tx-3)', textDecoration: 'none' }}>首页</Link>
          <span style={{ margin: '0 8px' }}>/</span>
          <Link href="/knowledge" style={{ color: 'var(--tx-3)', textDecoration: 'none' }}>知识库</Link>
          <span style={{ margin: '0 8px' }}>/</span>
          <span>{star}</span>
          <span style={{ margin: '0 8px' }}>·</span>
          <span style={{ color: 'var(--ac)' }}>{data.topicLabel}</span>
        </nav>

        {/* 标题区 */}
        <header style={{ marginBottom: '36px' }}>
          <div style={{ fontSize: '11px', color: 'var(--tx-3)', letterSpacing: '0.25em', marginBottom: '8px' }}>
            {data.topicLabel} · 倪海厦体系详解
          </div>
          <h1 style={{ fontSize: 'clamp(28px, 5vw, 44px)', fontWeight: 700, color: 'var(--tx-0)', letterSpacing: '0.1em', lineHeight: 1.2 }}>
            {data.heading}
          </h1>
          {STAR_BRIEF_SEO[star] && (
            <p style={{ fontSize: '13px', color: 'var(--tx-2)', marginTop: '14px', lineHeight: 1.8 }}>
              {STAR_BRIEF_SEO[star]}
            </p>
          )}
          <p className="text-xs mt-4" style={{ color: 'var(--tx-2)' }}>
            <Link href="/about">整理：紫微命盘 · 内容方法</Link>
            {' · 更新：'}<time dateTime={KNOWLEDGE_UPDATED_AT}>{KNOWLEDGE_UPDATED_AT}</time>
          </p>
        </header>

        <Section title="阅读范围" minimal>
          <p className="text-sm leading-loose">以下为传统命理学习整理，不是个人命盘结论，也不是倪师逐字原话。单颗星的概述需要结合完整组合阅读。</p>
        </Section>

        {/* 学习整理 */}
        {data.parsed.dingdiao && (
          <Section title="一句话定调" gradient>
            <p style={{ fontSize: '17px', color: 'var(--tx-0)', lineHeight: 1.9, fontWeight: 500, letterSpacing: '0.04em' }}>
              {data.parsed.dingdiao}
            </p>
          </Section>
        )}

        {data.parsed.lundian && (
          <Section title="核心论断">
            <div style={{ fontSize: '15px', color: 'var(--tx-0)', lineHeight: 2, letterSpacing: '0.02em', whiteSpace: 'pre-wrap' }}>
              {data.parsed.lundian}
            </div>
          </Section>
        )}

        {data.parsed.yiju && (
          <Section title="命盘依据">
            <div style={{ fontSize: '14px', color: 'var(--tx-0)', lineHeight: 2, letterSpacing: '0.02em', whiteSpace: 'pre-wrap' }}>
              {data.parsed.yiju}
            </div>
          </Section>
        )}

        <Section title="适用条件与核对方法">
          <p className="text-sm leading-loose">{READING_GUIDE[topic as TopicKey]}</p>
        </Section>

        <Section title="参考资料与回看入口" minimal>
          <p className="text-sm leading-loose">
            <a href={lecture.url} className="underline">《天纪》{star}星讲解 · {lecture.subject} · 视频 P{lecture.part} {lecture.time}</a>
          </p>
          <p className="text-xs leading-loose mt-2" style={{ color: 'var(--tx-2)' }}>
            此入口用于核对{star}星的基础讲解，不是本文所有宫位结论的逐条引证。
            具体断语仍需核对课程上下文与成立条件。<Link href="/about" className="underline">查看内容整理方法</Link>。
          </p>
        </Section>

        {/* CTA */}
        <div style={{
          margin: '40px 0 30px',
          padding: '24px',
          background: 'linear-gradient(135deg, rgba(212,169,72,0.15) 0%, rgba(184,146,42,0.06) 100%)',
          borderRadius: '14px',
          border: '1px solid rgba(184,146,42,0.3)',
          textAlign: 'center',
        }}>
          <div style={{ fontSize: '14px', color: 'var(--tx-0)', fontWeight: 600, letterSpacing: '0.1em', marginBottom: '6px' }}>
            想看你自己命盘的{data.topicLabel}？
          </div>
          <div style={{ fontSize: '12px', color: 'var(--tx-2)', marginBottom: '16px' }}>
            输入生辰起盘 · 倪师正宗解读 · AI 答疑伴学
          </div>
          <Link href="/chart" style={{
            display: 'inline-block',
            padding: '12px 28px',
            background: 'linear-gradient(135deg, #d4a948 0%, #b8922a 100%)',
            color: 'white',
            borderRadius: '999px',
            fontSize: '14px',
            fontWeight: 600,
            letterSpacing: '0.15em',
            textDecoration: 'none',
            boxShadow: '0 4px 12px rgba(184,146,42,0.3)',
          }}>
            立即起盘 →
          </Link>
        </div>

        {/* 内链：同主星其他 topic */}
        <Section title={`${star}星的其他专题`} minimal>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
            {otherTopicsForStar.map(t => {
              const d = getKnowledge(star, t);
              return (
                <Link
                  key={t}
                  href={`/knowledge/${slug}/${t}`}
                  style={{
                    fontSize: '12px',
                    padding: '6px 12px',
                    background: 'var(--bg-card)',
                    border: '1px solid rgba(184,146,42,0.25)',
                    borderRadius: '999px',
                    color: 'var(--tx-2)',
                    textDecoration: 'none',
                  }}
                >
                  {d.heading}
                </Link>
              );
            })}
          </div>
        </Section>

        {/* 内链：同 topic 其他主星 */}
        <Section title={`其他主星的${data.topicLabel}解读`} minimal>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
            {otherStarsForTopic.slice(0, 13).map(s => (
              <Link
                key={s}
                href={`/knowledge/${STAR_TO_SLUG[s]}/${topic}`}
                style={{
                  fontSize: '12px',
                  padding: '6px 12px',
                  background: 'var(--bg-card)',
                  border: '1px solid rgba(184,146,42,0.25)',
                  borderRadius: '999px',
                  color: 'var(--tx-2)',
                  textDecoration: 'none',
                }}
              >
                {getKnowledge(s, topic as TopicKey).heading}
              </Link>
            ))}
          </div>
        </Section>

        {/* 古籍库链接 */}
        <div style={{
          marginTop: '40px',
          padding: '16px 20px',
          background: 'rgba(184,146,42,0.04)',
          border: '1px dashed rgba(184,146,42,0.25)',
          borderRadius: '10px',
          textAlign: 'center',
        }}>
          <div style={{ fontSize: '11px', color: 'var(--ac-dim)', letterSpacing: '0.15em', marginBottom: '6px' }}>
            想读原典？
          </div>
          <Link href="/library" style={{ fontSize: '13px', color: 'var(--ac)', fontWeight: 500, letterSpacing: '0.1em', textDecoration: 'none' }}>
            📜 查阅古籍原典库 — 紫微斗数全集 / 全书 / 骨髓赋 →
          </Link>
        </div>
      </article>

      {/* 页脚 */}
      <footer style={{ borderTop: '1px solid rgba(184,146,42,0.15)', padding: '20px 24px', textAlign: 'center', fontSize: '11px', color: 'var(--tx-3)', letterSpacing: '0.1em' }}>
        <div style={{ marginBottom: '6px' }}>紫微研究 · 基于倪海厦正宗体系 · 仅供学习参考</div>
        <div style={{ opacity: 0.85 }}>本平台不构成任何医疗、投资、法律或重大决策建议</div>
      </footer>
    </div>
  );
}

function Section({ title, children, gradient, minimal }: { title: string; children: React.ReactNode; gradient?: boolean; minimal?: boolean }) {
  return (
    <section style={{ marginBottom: minimal ? '24px' : '32px' }}>
      <h2 style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: '8px',
        fontSize: '13px',
        color: 'var(--ac)',
        fontWeight: 600,
        letterSpacing: '0.2em',
        marginBottom: '12px',
      }}>
        <span style={{ width: '4px', height: '14px', background: 'var(--ac)', borderRadius: '2px' }} />
        {title}
      </h2>
      <div style={{
        background: gradient
          ? 'linear-gradient(135deg, rgba(212,169,72,0.12) 0%, rgba(184,146,42,0.04) 100%)'
          : 'white',
        border: '1px solid rgba(184,146,42,0.15)',
        borderRadius: '10px',
        padding: minimal ? '14px 18px' : '20px 22px',
      }}>
        {children}
      </div>
    </section>
  );
}
