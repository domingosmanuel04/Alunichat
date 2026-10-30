import type { MetadataRoute } from 'next';
import { absoluteUrl } from '@/lib/site-url';

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: '*',
        allow: ['/', '/login', '/register', '/forgot-password', '/llms.txt', '/roots.txt', '/sitemap.xml'],
        disallow: [
          '/dashboard',
          '/inbox',
          '/platform/',
          '/settings/',
          '/whatsapp/',
          '/contacts',
          '/crm',
          '/kanban',
          '/team',
          '/tasks',
          '/tickets',
          '/campaigns',
          '/automations',
          '/ai-agents',
          '/analytics',
          '/channels',
          '/companies',
          '/calendar',
          '/knowledge',
          '/integrations/',
          '/changelog',
          '/portal/',
          '/api/',
        ],
      },
    ],
    sitemap: absoluteUrl('/sitemap.xml'),
    host: absoluteUrl('/'),
  };
}
