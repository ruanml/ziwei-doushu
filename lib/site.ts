/**
 * 站点根地址。
 * 优先级：
 *   1. 显式配置的 NEXT_PUBLIC_SITE_URL
 *   2. Vercel 自动注入的生产主域名 VERCEL_PROJECT_PRODUCTION_URL（部署到线上即自动生效）
 *   3. 本机开发默认 http://localhost:3000
 */
const rawSiteUrl =
  process.env.NEXT_PUBLIC_SITE_URL ||
  (process.env.VERCEL_PROJECT_PRODUCTION_URL
    ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`
    : '') ||
  'http://localhost:3000';

export const SITE_URL = rawSiteUrl.replace(/\/+$/, '');

/** 只取域名部分，用于界面上展示（如分享卡底部） */
export const SITE_HOST = SITE_URL.replace(/^https?:\/\//, '');
