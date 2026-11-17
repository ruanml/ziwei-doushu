import type { Metadata } from 'next';
import { SITE_URL } from '@/lib/site';

export function pageMetadata({
  title, description, path, type = 'website',
}: {
  title: string;
  description: string;
  path: string;
  type?: 'website' | 'article';
}): Metadata {
  const url = path === '/' ? SITE_URL : `${SITE_URL}${path}`;
  const image = {
    url: `${SITE_URL}/opengraph-image.png`,
    width: 1200,
    height: 630,
    alt: '紫微命盘 · 在线排盘与知识学习',
  };
  return {
    title,
    description,
    alternates: { canonical: url },
    openGraph: {
      title, description, url, type,
      siteName: '紫微命盘', locale: 'zh_CN', images: [image],
    },
    twitter: {
      card: 'summary_large_image', title, description, images: [image],
    },
  };
}
