// lib/seoConfig.js  (new file)
// Public website address used by sitemap.xml, robots.txt, canonical links and structured data.
// Optional: set NEXT_PUBLIC_SITE_URL in Vercel to override the default below.

const FALLBACK = 'https://parikshiq.online';

export const SITE_URL = (process.env.NEXT_PUBLIC_SITE_URL || FALLBACK).replace(/\/+$/, '');
export const SITE_NAME = 'Parikshiq';
export const LOGO_URL = `${SITE_URL}/images/other_images/Parikshiq-name.png`;
