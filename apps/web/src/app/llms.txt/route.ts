import { absoluteUrl } from '@/lib/site-url';

export const dynamic = 'force-static';

export function GET() {
  const home = absoluteUrl('/');
  const login = absoluteUrl('/login');
  const register = absoluteUrl('/register');
  const sitemap = absoluteUrl('/sitemap.xml');
  const roots = absoluteUrl('/roots.txt');
  const robots = absoluteUrl('/robots.txt');
  const whatsapp = 'https://wa.me/244945400126';

  const body = `# ALURICHAT

> Atendimento inteligente. Vendas automatizadas. Operação sob controlo. Plataforma SaaS multi-tenant de atendimento omnichannel (WhatsApp), CRM, Kanban, automações, agentes de IA, campanhas, agendamentos e analytics.

ALURICHAT (também referido como Alurichat) é um produto da Makiratec para empresas que querem centralizar conversas WhatsApp, equipa e automações numa operação única. O onboarding público cria um pedido de conta; o acesso ao workspace é liberado após aprovação.

Idioma principal do site e da interface: português (pt-BR / pt-AO). Contacto comercial WhatsApp: +244 945 400 126.

## Páginas principais

- [Início](${home}): Landing page — recursos, benefícios, FAQ e CTA
- [Criar conta](${register}): Pedido de registo (aprovação manual)
- [Entrar](${login}): Login no workspace

## Descoberta técnica

- [roots.txt](${roots}): Índice das raízes públicas e ficheiros de descoberta
- [Sitemap](${sitemap}): URLs indexáveis para motores de busca
- [robots.txt](${robots}): Regras de rastreio (áreas autenticadas bloqueadas)

## Contacto

- [WhatsApp comercial](${whatsapp}): Começar conversa / suporte comercial

## Optional

- Áreas autenticadas (\`/dashboard\`, \`/inbox\`, \`/whatsapp\`, \`/platform\`, etc.) não são conteúdo público e não devem ser citadas como documentação do produto
`;

  return new Response(body, {
    headers: {
      'Content-Type': 'text/plain; charset=utf-8',
      'Cache-Control': 'public, max-age=3600, s-maxage=3600',
    },
  });
}
