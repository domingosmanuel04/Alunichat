import {
  GoneException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { randomBytes } from 'crypto';
import { PrismaService } from '../../infrastructure/prisma/prisma.service';
import { RedisService } from '../../infrastructure/redis/redis.service';
import { MailService } from '../mail/mail.service';
import { AuditService } from '../audit/audit.service';

function asObj(value: unknown): Record<string, unknown> {
  if (value && typeof value === 'object' && !Array.isArray(value)) {
    return { ...(value as Record<string, unknown>) };
  }
  return {};
}

const CHANGELOG = [
  {
    version: '0.4.0',
    date: '2026-08-15',
    title: 'Operação avançada',
    items: [
      'Rascunho IA, SLA, macros, fila de falhas',
      'Portal do cliente, 2FA, métricas Prometheus',
      'Horário comercial, templates, CSV',
    ],
  },
  {
    version: '0.5.0',
    date: '2026-08-15',
    title: 'Próxima geração',
    items: [
      'Pesquisa em mensagens, presença, menções',
      'Catálogo, broadcast com opt-out, pagamentos stub',
      'Resumo IA, intenção, RAG, LGPD, changelog',
    ],
  },
];

@Injectable()
export class FutureService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly redis: RedisService,
    private readonly mail: MailService,
    private readonly audit: AuditService,
    private readonly config: ConfigService,
  ) {}

  changelog() {
    return { items: CHANGELOG, generatedAt: new Date().toISOString() };
  }

  // ─── Catalog ─────────────────────────────────────────────────────────────
  async listCatalog(tenantId: string) {
    const tenant = await this.prisma.tenant.findUnique({ where: { id: tenantId } });
    const settings = asObj(tenant?.settings);
    const catalog = Array.isArray(settings.catalog) ? settings.catalog : [];
    return { items: catalog };
  }

  async saveCatalog(tenantId: string, items: unknown[]) {
    const tenant = await this.prisma.tenant.findUnique({ where: { id: tenantId } });
    if (!tenant) throw new NotFoundException({ code: 'TENANT_NOT_FOUND' });
    const settings = asObj(tenant.settings);
    await this.prisma.tenant.update({
      where: { id: tenantId },
      data: {
        settings: {
          ...settings,
          catalog: JSON.parse(JSON.stringify(items.slice(0, 200))),
        },
      },
    });
    return { items: items.slice(0, 200) };
  }

  // ─── Saved filters ───────────────────────────────────────────────────────
  async listSavedFilters(tenantId: string, userId: string) {
    const raw = await this.redis.get(`filters:${tenantId}:${userId}`);
    return { items: raw ? JSON.parse(raw) : [] };
  }

  async saveFilter(
    tenantId: string,
    userId: string,
    filter: { id?: string; name: string; query: Record<string, unknown> },
  ) {
    const list = (await this.listSavedFilters(tenantId, userId)).items as {
      id: string;
      name: string;
      query: Record<string, unknown>;
    }[];
    const id = filter.id || randomBytes(6).toString('hex');
    const next = [
      { id, name: filter.name, query: filter.query },
      ...list.filter((f) => f.id !== id),
    ].slice(0, 30);
    await this.redis.set(
      `filters:${tenantId}:${userId}`,
      JSON.stringify(next),
      60 * 60 * 24 * 365,
    );
    return { items: next };
  }

  async deleteFilter(tenantId: string, userId: string, id: string) {
    const list = (await this.listSavedFilters(tenantId, userId)).items as {
      id: string;
    }[];
    const next = list.filter((f) => f.id !== id);
    await this.redis.set(
      `filters:${tenantId}:${userId}`,
      JSON.stringify(next),
      60 * 60 * 24 * 365,
    );
    return { items: next };
  }

  // ─── Payments: stub desligado — só comprovativo + aprovação platform ─────
  async createCheckout(
    _tenantId: string,
    _body: { planName?: string; provider?: string; amount?: number },
  ): Promise<never> {
    throw new GoneException({
      code: 'CHECKOUT_DISABLED',
      message:
        'Checkout online desativado. Peça mudança de plano em Definições → Plano e anexe o comprovativo de pagamento.',
    });
  }

  async confirmCheckout(_sessionId: string): Promise<never> {
    throw new GoneException({
      code: 'CHECKOUT_DISABLED',
      message:
        'Confirmação de checkout desativada. O plano é ativado após aprovação do comprovativo pelo Super Admin.',
    });
  }

  // ─── Add-ons ─────────────────────────────────────────────────────────────
  async getAddons(tenantId: string) {
    const tenant = await this.prisma.tenant.findUnique({ where: { id: tenantId } });
    const settings = asObj(tenant?.settings);
    return {
      available: [
        { key: 'extra_channel', label: 'Instância WhatsApp extra', priceMonthly: 15 },
        { key: 'extra_user', label: 'Utilizador extra', priceMonthly: 8 },
        { key: 'ai_pack', label: 'Pacote IA avançado', priceMonthly: 29 },
      ],
      active: Array.isArray(settings.addons) ? settings.addons : [],
    };
  }

  async setAddons(tenantId: string, addons: string[]) {
    const tenant = await this.prisma.tenant.findUnique({ where: { id: tenantId } });
    if (!tenant) throw new NotFoundException({ code: 'TENANT_NOT_FOUND' });
    const settings = asObj(tenant.settings);
    await this.prisma.tenant.update({
      where: { id: tenantId },
      data: {
        settings: {
          ...settings,
          addons: addons.slice(0, 20),
        },
      },
    });
    return this.getAddons(tenantId);
  }

  // ─── White-label ─────────────────────────────────────────────────────────
  async getWhiteLabel(tenantId: string) {
    const tenant = await this.prisma.tenant.findUnique({ where: { id: tenantId } });
    const settings = asObj(tenant?.settings);
    const wl = asObj(settings.whiteLabel);
    return {
      logoUrl: tenant?.logoUrl || null,
      primaryColor: tenant?.primaryColor || '#10b981',
      customDomain: tenant?.customDomain || null,
      appName: (wl.appName as string) || tenant?.name || 'ALURICHAT',
      hideAlurichatBranding: Boolean(wl.hideAlurichatBranding),
    };
  }

  async updateWhiteLabel(
    tenantId: string,
    body: {
      appName?: string;
      primaryColor?: string;
      customDomain?: string;
      hideAlurichatBranding?: boolean;
      logoUrl?: string;
    },
  ) {
    const tenant = await this.prisma.tenant.findUnique({ where: { id: tenantId } });
    if (!tenant) throw new NotFoundException({ code: 'TENANT_NOT_FOUND' });
    const settings = asObj(tenant.settings);
    const wl = asObj(settings.whiteLabel);
    await this.prisma.tenant.update({
      where: { id: tenantId },
      data: {
        primaryColor: body.primaryColor ?? tenant.primaryColor,
        customDomain: body.customDomain ?? tenant.customDomain,
        logoUrl: body.logoUrl ?? tenant.logoUrl,
        settings: {
          ...settings,
          whiteLabel: {
            ...wl,
            appName: body.appName ?? wl.appName,
            hideAlurichatBranding:
              body.hideAlurichatBranding ?? wl.hideAlurichatBranding,
          },
        } as object,
      },
    });
    return this.getWhiteLabel(tenantId);
  }

  // ─── Trial status ────────────────────────────────────────────────────────
  async trialStatus(tenantId: string) {
    const tenant = await this.prisma.tenant.findUnique({
      where: { id: tenantId },
      include: { plan: true, subscription: true },
    });
    if (!tenant) throw new NotFoundException({ code: 'TENANT_NOT_FOUND' });
    const ends = tenant.trialEndsAt;
    const now = Date.now();
    const msLeft = ends ? ends.getTime() - now : null;
    const expired = msLeft != null && msLeft <= 0;
    return {
      trialEndsAt: ends,
      daysLeft:
        msLeft == null ? null : Math.max(0, Math.ceil(msLeft / 86400000)),
      expired,
      softBlocked: expired && tenant.plan?.name === 'FREE',
      planName: tenant.plan?.name,
      status: tenant.status,
    };
  }

  // ─── Opt-out ─────────────────────────────────────────────────────────────
  async setMarketingOptOut(tenantId: string, contactId: string, optOut: boolean) {
    const contact = await this.prisma.contact.findFirst({
      where: { id: contactId, tenantId },
    });
    if (!contact) throw new NotFoundException({ code: 'CONTACT_NOT_FOUND' });
    const consents = asObj(contact.consents);
    await this.prisma.contact.update({
      where: { id: contactId },
      data: {
        consents: {
          ...consents,
          marketing: !optOut,
          marketingOptOutAt: optOut ? new Date().toISOString() : null,
        },
      },
    });
    return { contactId, marketingOptOut: optOut };
  }

  // ─── Quota alerts + Slack ────────────────────────────────────────────────
  async runQuotaAlerts() {
    const tenants = await this.prisma.tenant.findMany({
      where: { status: 'ACTIVE' },
      include: { plan: true, subscription: { include: { plan: true } } },
      take: 200,
    });
    const alerts: unknown[] = [];
    for (const t of tenants) {
      const plan = t.subscription?.plan || t.plan;
      const limits = asObj(plan?.limits);
      const channelLimit =
        typeof limits.channels === 'number' ? limits.channels : null;
      const userLimit = typeof limits.users === 'number' ? limits.users : null;
      const [channels, users] = await Promise.all([
        this.prisma.channel.count({ where: { tenantId: t.id, type: 'WHATSAPP' } }),
        this.prisma.membership.count({
          where: { tenantId: t.id, status: 'ACTIVE' },
        }),
      ]);
      const channelPct =
        channelLimit && channelLimit > 0 ? channels / channelLimit : 0;
      const userPct = userLimit && userLimit > 0 ? users / userLimit : 0;
      if (channelPct >= 0.8 || userPct >= 0.8) {
        const alert = {
          tenantId: t.id,
          slug: t.slug,
          channels,
          channelLimit,
          users,
          userLimit,
          channelPct,
          userPct,
        };
        alerts.push(alert);
        const owner = await this.prisma.membership.findFirst({
          where: { tenantId: t.id, role: 'OWNER' },
          include: { user: true },
        });
        if (owner?.user?.email) {
          await this.mail.send({
            to: owner.user.email,
            subject: 'Alerta de quota — ALURICHAT',
            text: `A empresa ${t.name} está a ${Math.round(Math.max(channelPct, userPct) * 100)}% do limite do plano.`,
          });
        }
        await this.notifySlack(
          `Quota alert: ${t.slug} channels=${channels}/${channelLimit} users=${users}/${userLimit}`,
        );
      }
    }
    return { alerts, checked: tenants.length };
  }

  async notifySlack(text: string) {
    const url = this.config.get<string>('SLACK_WEBHOOK_URL');
    if (!url) return { sent: false, reason: 'SLACK_WEBHOOK_URL not set' };
    try {
      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text }),
      });
      return { sent: res.ok, status: res.status };
    } catch (err) {
      return {
        sent: false,
        reason: err instanceof Error ? err.message : String(err),
      };
    }
  }

  // ─── Multi-region stub ───────────────────────────────────────────────────
  regions() {
    return {
      current: this.config.get('REGION', 'eu-west'),
      available: ['eu-west', 'eu-central', 'us-east', 'sa-east'],
      readReplicas: Boolean(this.config.get('DB_READ_REPLICA_URL')),
      note: 'Configuração preparada; failover multi-região activa-se com REGION + DB_READ_REPLICA_URL',
    };
  }
}
