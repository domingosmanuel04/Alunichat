import type { MetadataRoute } from 'next';
import { absoluteUrl } from '@/lib/site-url';

/** Public, indexable routes only — authenticated app areas stay out of the sitemap. */
const PUBLIC_ROUTES: Array<{ path: string; changeFrequency: MetadataRoute.Sitemap[number]['changeFrequency']; priority: number }> = [
  { path: '/', changeFrequency: 'weekly', priority: 1 },
  { path: '/login', changeFrequency: 'monthly', priority: 0.6 },
  { path: '/register', changeFrequency: 'monthly', priority: 0.8 },
  { path: '/forgot-password', changeFrequency: 'yearly', priority: 0.3 },
];

export default function sitemap(): MetadataRoute.Sitemap {
  const lastModified = new Date();

  return PUBLIC_ROUTES.map(({ path, changeFrequency, priority }) => ({
    url: absoluteUrl(path),
    lastModified,
    changeFrequency,
    priority,
  }));
}
