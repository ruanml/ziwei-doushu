import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: '紫微双人合盘 · 婚姻感情与事业合伙分析 · 紫微命盘',
  description: '输入甲乙双方出生年月日时，依倪海厦《天纪》体系联参命宫、夫妻宫、福德宫及生年四化互飞，深入分析感情契合度与事业合伙关系。',
  alternates: {
    canonical: '/heming',
  },
  openGraph: {
    title: '紫微双人合盘 · 紫微命盘',
    description: '紫微斗数双人合盘分析，涵盖命宫、夫妻宫、福德宫联参与四化互飞推演。',
    url: '/heming',
  },
};

export default function HemingLayout({ children }: { children: React.ReactNode }) {
  return children;
}
