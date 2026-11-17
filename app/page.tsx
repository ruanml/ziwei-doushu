import HomePage from '@/components/HomePage';
import { pageMetadata } from '@/lib/seo/metadata';

export const metadata = pageMetadata({
  path: '/',
  title: '紫微命盘 · 倪海厦正宗紫微斗数',
  description: '基于倪海厦《天纪》体系的紫微斗数在线排盘，支持命盘格局、AI 解读、双人合盘与星曜知识学习。',
});

export default function Page() {
  return <HomePage />;
}
