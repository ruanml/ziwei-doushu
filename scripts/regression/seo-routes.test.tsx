import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import * as React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import type { Metadata } from 'next';
import sitemap from '../../app/sitemap';
import robots from '../../app/robots';
import { metadata as home } from '../../app/page';
import { metadata as chart } from '../../app/chart/layout';
import { metadata as heming } from '../../app/heming/layout';
import { metadata as knowledge } from '../../app/knowledge/page';
import { metadata as library } from '../../app/library/page';
import { metadata as terms } from '../../app/terms/page';
import { metadata as privacy } from '../../app/privacy/page';
import { metadata as about } from '../../app/about/page';
import { metadata as search } from '../../app/library/search/page';
import { metadata as preview } from '../../app/preview/layout';
import { generateMetadata as bookMetadata } from '../../app/library/[book]/page';
import ChapterPage, { generateMetadata as chapterMetadata } from '../../app/library/[book]/[chapter]/page';
import KnowledgePage, { generateMetadata as knowledgeMetadata } from '../../app/knowledge/[star]/[topic]/page';
import { ALL_BOOKS, getChapterByRoute } from '../../lib/classics';
import { getAllKnowledgeRoutes, getKnowledge } from '../../lib/seo/knowledge';
import { KNOWLEDGE_UPDATED_AT, STAR_LECTURES } from '../../lib/seo/knowledge-sources';
import { SITE_URL } from '../../lib/site';

Object.assign(globalThis, { React });

async function main() {
  const pages = new Map<string, Metadata>([
    ['/', home], ['/chart', chart], ['/heming', heming], ['/knowledge', knowledge],
    ['/library', library], ['/terms', terms], ['/privacy', privacy], ['/about', about],
  ]);
  for (const book of ALL_BOOKS) {
    pages.set(`/library/${book.slug}`, await bookMetadata({ params: Promise.resolve({ book: book.slug }) }));
    for (let i = 0; i < book.chapters.length; i++) {
      const params = { book: book.slug, chapter: String(i) };
      pages.set(`/library/${book.slug}/${i}`, await chapterMetadata({ params: Promise.resolve(params) }));
      assert.equal(getChapterByRoute(book.slug, String(i))?.chapter, book.chapters[i]);
    }
  }
  const headings = new Set<string>();
  for (const route of getAllKnowledgeRoutes()) {
    const params = { star: route.slug, topic: route.topic };
    const data = getKnowledge(route.star, route.topic);
    assert.ok(!data.heading.includes('宫宫'));
    assert.ok(!headings.has(data.heading), `duplicate heading: ${data.heading}`);
    headings.add(data.heading);
    pages.set(`/knowledge/${route.slug}/${route.topic}`, await knowledgeMetadata({ params: Promise.resolve(params) }));
    const html = renderToStaticMarkup(await KnowledgePage({ params: Promise.resolve(params) }));
    assert.ok(html.includes(data.heading));
    assert.ok(html.includes('适用条件与核对方法'));
    assert.ok(!html.includes('经典出处'), 'unverified quotations must not be presented as verified sources');
    assert.ok(!html.includes('datePublished'), 'do not invent first-publication dates');
    assert.ok(html.includes(`"dateModified":"${KNOWLEDGE_UPDATED_AT}"`));
    assert.ok(html.includes('href="/about"'));
  }

  const expected = new Set(sitemap().map(item => item.url));
  assert.equal(pages.size, expected.size);
  for (const [path, metadata] of pages) {
    const url = path === '/' ? SITE_URL : `${SITE_URL}${path}`;
    assert.ok(expected.has(url), `not in sitemap: ${url}`);
    assert.equal(metadata.alternates?.canonical, url, path);
    assert.equal(metadata.openGraph?.url, url, path);
    assert.equal(metadata.twitter?.title, metadata.title, path);
    assert.ok(metadata.openGraph?.images, `missing share image: ${path}`);
    assert.ok(metadata.twitter?.images, `missing Twitter image: ${path}`);
  }

  for (const value of ['0junk', '00', '01', '0.5', '-1', '1e0', '+0', ' 0', '', '99999999999999999', '999']) {
    assert.equal(getChapterByRoute('quanshu', value), null, value);
    const params = Promise.resolve({ book: 'quanshu', chapter: value });
    assert.deepEqual(await chapterMetadata({ params }), {});
    await assert.rejects(ChapterPage({ params }), /404/);
  }
  assert.equal(getChapterByRoute('nonexistent', '0'), null);
  assert.deepEqual(search.robots, { index: false, follow: true });
  assert.deepEqual(preview.robots, { index: false, follow: false });
  assert.ok(!JSON.stringify(robots().rules).includes('/preview'));
  assert.ok(!JSON.stringify(robots().rules).includes('/library/search'));
  assert.ok(!expected.has(`${SITE_URL}/preview`));
  assert.ok(!expected.has(`${SITE_URL}/library/search`));

  // Source locations must match the supplied index, not invented timestamps.
  const entries = readFileSync('docs/tianji-ziwei/entries.jsonl', 'utf8').trim().split('\n').map(line => JSON.parse(line));
  for (const [star, ref] of Object.entries(STAR_LECTURES)) {
    const url = new URL(ref.url);
    const [h, m, s] = ref.time.split(':').map(Number);
    assert.equal(url.searchParams.get('t'), String(h * 3600 + m * 60 + s));
    assert.ok(entries.some(e => e.book === '01-stars' && e.h2.startsWith(star)
      && e.part === ref.part && e.t_hms === ref.time && e.h3 === ref.subject
      && url.pathname === `/video/${e.bvid}`));
  }
  console.log(`SEO: ${pages.size} sitemap/canonical/share metadata pairs, ${headings.size} unique article headings, invalid routes, noindex and 14 source locations passed`);
}

main().catch(error => { console.error(error); process.exitCode = 1; });
