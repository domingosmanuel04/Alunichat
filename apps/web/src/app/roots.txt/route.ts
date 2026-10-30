import { absoluteUrl } from '@/lib/site-url';

export const dynamic = 'force-static';

/**
 * roots.txt — índice das raízes públicas e ficheiros de descoberta do site.
 * Complementa llms.txt (contexto para LLMs) e sitemap.xml (URLs indexáveis).
 */
export function GET() {
  const lines = [
    '# ALURICHAT — roots',
    '# Canonical public entry points and machine-readable discovery files.',
    `# Generated for ${absoluteUrl('/')}`,
    '',
    '# Site roots',
    absoluteUrl('/'),
    absoluteUrl('/login'),
    absoluteUrl('/register'),
    absoluteUrl('/forgot-password'),
    '',
    '# Discovery',
    absoluteUrl('/llms.txt'),
    absoluteUrl('/sitemap.xml'),
    absoluteUrl('/robots.txt'),
    absoluteUrl('/roots.txt'),
    '',
    '# Commercial contact',
    'https://wa.me/244945400126',
    '',
  ];

  return new Response(lines.join('\n'), {
    headers: {
      'Content-Type': 'text/plain; charset=utf-8',
      'Cache-Control': 'public, max-age=3600, s-maxage=3600',
    },
  });
}
