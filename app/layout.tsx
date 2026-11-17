import type { Metadata } from 'next';
import './globals.css';
import { ThemeProvider } from '@/components/ThemeProvider';
import { Analytics } from '@vercel/analytics/next';
import { SpeedInsights } from '@vercel/speed-insights/next';
import { SITE_URL } from '@/lib/site';

export const metadata: Metadata = {
  title: '紫微命盘 · 倪海厦正宗紫微斗数',
  description: '基于倪海厦正宗紫微斗数体系，AI深度解读您的命盘格局、大限流年、感情事业财富健康全方位解析',
  keywords: '紫微斗数, 倪海厦, 紫微斗数全集, 紫微斗数全书, 骨髓赋, 命盘, 命理, 14主星, 12宫位',
  metadataBase: new URL(SITE_URL),
  alternates: {
    canonical: '/',
  },
  openGraph: {
    title: '紫微命盘 · 倪海厦正宗紫微斗数',
    description: '基于倪海厦正宗紫微斗数体系，AI深度解读您的命盘格局、大限流年、感情事业财富健康全方位解析',
    url: SITE_URL,
    siteName: '紫微命盘',
    locale: 'zh_CN',
    type: 'website',
  },
  twitter: {
    card: 'summary',
    title: '紫微命盘 · 倪海厦正宗紫微斗数',
    description: '基于倪海厦《天纪》紫微斗数体系，在线排盘与 AI 深度命理解读、双人合盘分析。',
  },
  // 站长平台验证（在环境变量中配置对应 verification code 后生效）
  verification: {
    google: process.env.NEXT_PUBLIC_GOOGLE_VERIFICATION || undefined,
    other: {
      ...(process.env.NEXT_PUBLIC_BING_VERIFICATION ? { 'msvalidate.01': process.env.NEXT_PUBLIC_BING_VERIFICATION } : {}),
      ...(process.env.NEXT_PUBLIC_BAIDU_VERIFICATION ? { 'baidu-site-verification': process.env.NEXT_PUBLIC_BAIDU_VERIFICATION } : {}),
      ...(process.env.NEXT_PUBLIC_360_VERIFICATION ? { '360-site-verification': process.env.NEXT_PUBLIC_360_VERIFICATION } : {}),
    },
  },
};

const SITE_JSON_LD = {
  '@context': 'https://schema.org',
  '@type': 'WebApplication',
  name: '紫微命盘',
  url: SITE_URL,
  applicationCategory: 'LifestyleApplication',
  operatingSystem: 'All',
  inLanguage: 'zh-CN',
  description: '基于倪海厦《天纪》正宗紫微斗数体系，支持真太阳时排盘、十四主星格局识别、AI 深度命理解读与双人合盘。',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="zh-CN" suppressHydrationWarning>
      <head>
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(SITE_JSON_LD) }}
        />
        <script dangerouslySetInnerHTML={{ __html: `(function(){try{var t=localStorage.getItem('ziwei-theme');if(t==='light'||t==='dark')document.documentElement.setAttribute('data-theme',t);else document.documentElement.setAttribute('data-theme','light');}catch(e){}})();` }} />
      </head>
      <body className="min-h-screen">
        <ThemeProvider>
          {children}
        </ThemeProvider>
        <Analytics />
        <SpeedInsights />
      </body>
    </html>
  );
}
