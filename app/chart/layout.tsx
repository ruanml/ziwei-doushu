import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: '紫微斗数排盘与 AI 解读 · 紫微命盘',
  description: '输入出生年月日时与出生地，支持真太阳时与夏令时自动校正，生成本命十二宫、十四主星、四化飞星命盘，并提供 AI 深度命理解读。',
  alternates: {
    canonical: '/chart',
  },
  openGraph: {
    title: '紫微斗数排盘与 AI 解读 · 紫微命盘',
    description: '支持真太阳时校正的在线紫微斗数排盘与 AI 命理解读工具。',
    url: '/chart',
  },
};

export default function ChartLayout({ children }: { children: React.ReactNode }) {
  return children;
}
