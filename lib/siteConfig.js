// lib/siteConfig.js  (new file)
// One place for the public website address, used by sitemap.xml, robots.txt,
// canonical links and structured data.
// Set NEXT_PUBLIC_SITE_URL in Vercel (Settings -> Environment Variables), e.g.
//   NEXT_PUBLIC_SITE_URL=https://parikshiq.online
// If it is not set, the fallback below is used. The fallback is already your real domain.

const FALLBACK = 'https://parikshiq.online';

export const SITE_URL = (process.env.NEXT_PUBLIC_SITE_URL || FALLBACK).replace(/\/+$/, '');
export const SITE_NAME = 'Parikshiq';
export const LOGO_URL = `${SITE_URL}/images/other_images/Parikshiq-name.png`;
