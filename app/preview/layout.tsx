import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: '命盘 UI 预览 · 紫微命盘',
  robots: {
    index: false,
    follow: false,
  },
};

export default function PreviewLayout({ children }: { children: React.ReactNode }) {
  return children;
}
