// app/robots.js  (new file)
// Served automatically at /robots.txt.
// Public pages are open to search engines and AI crawlers; private areas are blocked.
import { SITE_URL } from '@/lib/siteConfig';

const PRIVATE = ['/admin', '/api/', '/dashboard', '/exam', '/profile', '/training', '/qrchecker/'];

export default function robots() {
  return {
    rules: [
      { userAgent: '*', allow: '/', disallow: PRIVATE },
      // Explicitly welcome the main AI crawlers on the public pages.
      ...['GPTBot', 'OAI-SearchBot', 'ChatGPT-User', 'ClaudeBot', 'Claude-SearchBot', 'PerplexityBot', 'Google-Extended', 'Applebot-Extended', 'CCBot']
        .map((userAgent) => ({ userAgent, allow: ['/', '/llms.txt'], disallow: PRIVATE })),
    ],
    sitemap: `${SITE_URL}/sitemap.xml`,
    host: SITE_URL,
  };
}
