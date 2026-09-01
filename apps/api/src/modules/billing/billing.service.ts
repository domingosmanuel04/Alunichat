import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { existsSync, mkdirSync, writeFileSync } from 'fs';
import { extname, join } from 'path';
import { PrismaService } from '../../infrastructure/prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { MailService } from '../mail/mail.service';

const PROOF_MIME_EXT: Record<string, string> = {
  'image/png': '.png',
  'image/jpeg': '.jpg',
  'image/jpg': '.jpg',
  'image/webp': '.webp',
  'application/pdf': '.pdf',
};

function asSettings(value: unknown): Record<string, unknown> {
  if (value && typeof value === 'object' && !Array.isArray(value)) {
    return { ...(value as Record<string, unknown>) };
  }
  return {};
}

type UploadedProof = {
  originalname: string;
  mimetype: string;
  size: number;
  buffer: Buffer;
};

@Injectable()
export class BillingService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly mail: MailService,
  ) {}

  async listPlans() {
    return this.prisma.plan.findMany({
      where: { active: true },
      orderBy: { priceMonthly: 'asc' },
    });
  }

  async getSubscription(tenantId: string) {
    const subscription = await this.prisma.subscription.findUnique({
      where: { tenantId },
      include: { plan: true },
    });
    if (!subscription) {
      throw new NotFoundException({
        code: 'SUBSCRIPTION_NOT_FOUND',
        message: 'No subscription for this tenant',
      });
    }

    const [usage, channelsUsed, usersUsed, tenant] = await Promise.all([
      this.getUsage(tenantId),
      this.prisma.channel.count({
        where: { tenantId, type: 'WHATSAPP' },
      }),
      this.prisma.membership.count({
        where: { tenantId, status: 'ACTIVE' },
      }),
      this.prisma.tenant.findUnique({ where: { id: tenantId } }),
    ]);

    const limits =
      subscription.plan.limits &&
      typeof subscription.plan.limits === 'object' &&
      !Array.isArray(subscription.plan.limits)
        ? (subscription.plan.limits as Record<string, number>)
        : {};

    const settings = asSettings(tenant?.settings);
    const planChange = asSettings(settings.planChange);
    const paymentProofs = Array.isArray(settings.paymentProofs)
      ? settings.paymentProofs
      : [];

    return {
      subscription,
      usage: {
        ...usage,
        live: {
          channels: channelsUsed,
          users: usersUsed,
          channelsLimit: limits.channels ?? null,
          usersLimit: limits.users ?? null,
        },
      },
      planChange:
        planChange.status === 'awaiting_approval'
          ? planChange
          : planChange.status
            ? planChange
            : null,
      paymentProofs,
    };
  }

  async getUsage(tenantId: string) {
    const now = new Date();
    const records = await this.prisma.usageRecord.findMany({
      where: {
        tenantId,
        periodStart: { lte: now },
        periodEnd: { gte: now },
      },
      orderBy: { metric: 'asc' },
    });

    const byMetric = Object.fromEntries(
      records.map((r) => [
        r.metric,
        {
          quantity: r.quantity,
          periodStart: r.periodStart,
          periodEnd: r.periodEnd,
        },
      ]),
    );

    return { period: now.toISOString(), records, byMetric };
  }

  async requestPlanChange(
    tenantId: string,
    actorUserId: string,
    planName: string,
    proof?: UploadedProof,
  ) {
    if (!proof?.buffer?.length) {
      throw new BadRequestException({
        code: 'PAYMENT_PROOF_REQUIRED',
        message: 'Envie o comprovativo de pagamento',
      });
    }

    const mime = (proof.mimetype || '').toLowerCase();
    const ext =
      PROOF_MIME_EXT[mime] ||
      (['.png', '.jpg', '.jpeg', '.webp', '.pdf'].includes(
        extname(proof.originalname || '').toLowerCase(),
      )
        ? extname(proof.originalname).toLowerCase().replace('.jpeg', '.jpg')
        : null);

    if (!ext) {
      throw new BadRequestException({
        code: 'INVALID_PROOF_TYPE',
        message: 'Comprovativo deve ser PNG, JPG, WEBP ou PDF',
      });
    }
    if (proof.size > 5 * 1024 * 1024) {
      throw new BadRequestException({
        code: 'PROOF_TOO_LARGE',
        message: 'O comprovativo deve ter no máximo 5 MB',
      });
    }

    const tenant = await this.prisma.tenant.findUnique({
      where: { id: tenantId },
      include: { plan: true, subscription: { include: { plan: true } } },
    });
    if (!tenant) {
      throw new NotFoundException({
        code: 'TENANT_NOT_FOUND',
        message: 'Tenant not found',
      });
    }

    const settings = asSettings(tenant.settings);
    const existing = asSettings(settings.planChange);
    if (existing.status === 'awaiting_approval') {
      throw new BadRequestException({
        code: 'PLAN_CHANGE_PENDING',
        message: 'Já existe um pedido de mudança de plano pendente',
      });
    }

    const plan = await this.prisma.plan.findUnique({
      where: { name: planName as 'FREE' | 'STARTER' | 'PRO' | 'BUSINESS' | 'ENTERPRISE' },
    });
    if (!plan || !plan.active) {
      throw new BadRequestException({
        code: 'PLAN_NOT_FOUND',
        message: 'Plano inválido ou indisponível',
      });
    }

    const currentPlan =
      tenant.subscription?.plan?.name || tenant.plan?.name || 'FREE';
    if (plan.name === currentPlan) {
      throw new BadRequestException({
        code: 'SAME_PLAN',
        message: 'Já está neste plano',
      });
    }

    const dir = join(process.cwd(), 'uploads', 'payment-proofs');
    if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
    const filename = `plan-change-${tenantId}-${Date.now()}${ext}`;
    writeFileSync(join(dir, filename), proof.buffer);
    const paymentProofUrl = `/uploads/payment-proofs/${filename}`;

    const now = new Date().toISOString();
    const history = Array.isArray(settings.paymentProofs)
      ? [...(settings.paymentProofs as unknown[])]
      : [];
    history.unshift({
      kind: 'plan_change',
      planName: plan.name,
      previousPlanName: currentPlan,
      paymentProofUrl,
      paymentProofName: proof.originalname,
      submittedAt: now,
      status: 'awaiting_approval',
    });

    const planChange = {
      status: 'awaiting_approval',
      requestedPlanName: plan.name,
      requestedPlanId: plan.id,
      currentPlanName: currentPlan,
      paymentProofUrl,
      paymentProofName: proof.originalname,
      paymentProofMime: mime,
      submittedAt: now,
      submittedBy: actorUserId,
    };

    await this.prisma.tenant.update({
      where: { id: tenantId },
      data: {
        settings: {
          ...settings,
          planChange,
          paymentProofs: JSON.parse(JSON.stringify(history.slice(0, 50))),
        },
      },
    });

    await this.audit.log({
      tenantId,
      actorUserId,
      action: 'billing.plan_change_request',
      resource: 'tenant',
      resourceId: tenantId,
      after: { from: currentPlan, to: plan.name },
    });

    const owner = await this.prisma.membership.findFirst({
      where: { tenantId, role: 'OWNER' },
      include: { user: { select: { email: true, name: true } } },
    });
    if (owner?.user?.email) {
      await this.mail.send({
        to: owner.user.email,
        subject: 'Pedido de mudança de plano — ALURICHAT',
        text: `Recebemos o pedido para mudar de ${currentPlan} para ${plan.name}. Aguarde aprovação do administrador.`,
      });
    }

    return { message: 'Pedido enviado para aprovação', planChange };
  }

  async getInvoiceHtml(tenantId: string) {
    const tenant = await this.prisma.tenant.findUnique({
      where: { id: tenantId },
      include: {
        plan: true,
        subscription: { include: { plan: true } },
      },
    });
    if (!tenant) {
      throw new NotFoundException({
        code: 'TENANT_NOT_FOUND',
        message: 'Tenant not found',
      });
    }

    const plan = tenant.subscription?.plan || tenant.plan;
    const periodStart =
      tenant.subscription?.currentPeriodStart || new Date();
    const periodEnd =
      tenant.subscription?.currentPeriodEnd ||
      new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
    const price = Number(plan?.priceMonthly ?? 0);
    const currency = 'AOA';
    const fmt = (d: Date) => d.toISOString().slice(0, 10);

    const html = `<!DOCTYPE html>
<html lang="pt">
<head>
  <meta charset="utf-8"/>
  <title>Fatura ALURICHAT — ${tenant.name}</title>
  <style>
    body{font-family:Georgia,serif;color:#1a1a1a;max-width:640px;margin:40px auto;padding:0 16px}
    h1{font-size:1.5rem;margin:0 0 4px}
    .muted{color:#666;font-size:.9rem}
    table{width:100%;border-collapse:collapse;margin-top:24px}
    th,td{text-align:left;padding:10px 0;border-bottom:1px solid #e5e5e5}
    .total{font-weight:700;font-size:1.1rem}
  </style>
</head>
<body>
  <h1>ALURICHAT</h1>
  <p class="muted">Fatura do período atual</p>
  <p><strong>Cliente:</strong> ${escapeHtml(tenant.name)} (${escapeHtml(tenant.slug)})</p>
  <p><strong>Plano:</strong> ${escapeHtml(plan?.displayName || plan?.name || '—')}</p>
  <p><strong>Período:</strong> ${fmt(periodStart)} → ${fmt(periodEnd)}</p>
  <table>
    <thead><tr><th>Descrição</th><th>Valor</th></tr></thead>
    <tbody>
      <tr><td>Subscrição ${escapeHtml(plan?.name || '')} (mensal)</td><td>${price.toFixed(2)} ${currency}</td></tr>
      <tr class="total"><td>Total</td><td>${price.toFixed(2)} ${currency}</td></tr>
    </tbody>
  </table>
  <p class="muted" style="margin-top:32px">Gerado em ${new Date().toISOString()}</p>
</body>
</html>`;

    return {
      html,
      tenantId,
      planName: plan?.name,
      priceMonthly: price,
      periodStart,
      periodEnd,
    };
  }

  async listInvoices(tenantId: string) {
    const tenant = await this.prisma.tenant.findUnique({
      where: { id: tenantId },
      include: { subscription: { include: { plan: true } }, plan: true },
    });
    if (!tenant) {
      throw new NotFoundException({
        code: 'TENANT_NOT_FOUND',
        message: 'Tenant not found',
      });
    }

    const settings = asSettings(tenant.settings);
    const paymentProofs = Array.isArray(settings.paymentProofs)
      ? (settings.paymentProofs as Record<string, unknown>[])
      : [];

    const periods: Array<Record<string, unknown>> = [];
    if (tenant.subscription) {
      periods.push({
        kind: 'subscription_period',
        planName:
          tenant.subscription.plan?.name || tenant.plan?.name || null,
        status: tenant.subscription.status,
        periodStart: tenant.subscription.currentPeriodStart,
        periodEnd: tenant.subscription.currentPeriodEnd,
        priceMonthly: Number(
          tenant.subscription.plan?.priceMonthly ??
            tenant.plan?.priceMonthly ??
            0,
        ),
      });
    }

    return {
      periods,
      paymentProofs,
      items: [
        ...periods,
        ...paymentProofs.map((p) => ({
          kind: 'payment_proof',
          ...p,
        })),
      ],
    };
  }
}

function escapeHtml(value: string) {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}
