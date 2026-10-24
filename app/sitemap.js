// app/sitemap.js  (new file)
// Served automatically at /sitemap.xml. Lists only the PUBLIC pages.
// Student dashboard, exam, admin and API pages are private and are not listed.
import { SITE_URL } from '@/lib/siteConfig';

export default function sitemap() {
  const lastModified = new Date();
  return [
    { url: `${SITE_URL}/`, lastModified, changeFrequency: 'weekly', priority: 1 },
    { url: `${SITE_URL}/pricing`, lastModified, changeFrequency: 'monthly', priority: 0.9 },
    { url: `${SITE_URL}/purchase`, lastModified, changeFrequency: 'monthly', priority: 0.8 },
    { url: `${SITE_URL}/login`, lastModified, changeFrequency: 'yearly', priority: 0.3 },
  ];
}
