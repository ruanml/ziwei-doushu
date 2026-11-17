import { pageMetadata } from '@/lib/seo/metadata';

export const metadata = pageMetadata({
  path: '/chart',
  title: '紫微斗数排盘与 AI 解读 · 紫微命盘',
  description: '输入出生年月日时与出生地，支持真太阳时校正与夏令时提示，生成本命十二宫、十四主星与四化命盘，并提供 AI 解读。',
});

export default function ChartLayout({ children }: { children: React.ReactNode }) {
  return children;
}
