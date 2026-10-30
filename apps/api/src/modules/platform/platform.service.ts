import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import * as bcrypt from 'bcryptjs';
import { PrismaService } from '../../infrastructure/prisma/prisma.service';
import { RedisService } from '../../infrastructure/redis/redis.service';
import { AuditService } from '../audit/audit.service';
import { MailService } from '../mail/mail.service';
import { AuthService } from '../auth/auth.service';

function asSettings(value: unknown): Record<string, unknown> {
  if (value && typeof value === 'object' && !Array.isArray(value)) {
    return value as Record<string, unknown>;
  }
  return {};
}

@Injectable()
export class PlatformService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly redis: RedisService,
    private readonly audit: AuditService,
    private readonly mail: MailService,
    private readonly auth: AuthService,
  ) {}

  async overview() {
    const [
      tenantsTotal,
      tenantsActive,
      tenantsSuspended,
      usersTotal,
      conversationsTotal,
      messagesTotal,
      pendingSignups,
    ] = await Promise.all([
      this.prisma.tenant.count(),
      this.prisma.tenant.count({ where: { status: 'ACTIVE' } }),
      this.prisma.tenant.count({ where: { status: 'SUSPENDED' } }),
      this.prisma.user.count(),
      this.prisma.conversation.count(),
      this.prisma.message.count(),
      this.prisma.tenant.count({ where: { status: 'BLOCKED' } }),
    ]);

    const redisOk = await this.redis.ping().catch(() => false);
    const pendingPlanChanges = await this.listPendingPlanChanges();

    return {
      tenants: {
        total: tenantsTotal,
        active: tenantsActive,
        suspended: tenantsSuspended,
        pendingSignups,
        pendingPlanChanges: pendingPlanChanges.length,
      },
      usersTotal,
      conversationsTotal,
      messagesTotal,
      health: {
        database: true,
        redis: redisOk,
      },
      generatedAt: new Date().toISOString(),
    };
  }

  async listTenants() {
    return this.prisma.tenant.findMany({
      include: {
        plan: true,
        subscription: true,
        _count: {
          select: {
            memberships: true,
            contacts: true,
            conversations: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async listPendingSignups() {
    const tenants = await this.prisma.tenant.findMany({
      where: { status: 'BLOCKED' },
      include: {
        plan: true,
        subscription: true,
        memberships: {
          where: { role: 'OWNER' },
          include: {
            user: {
              select: { id: true, email: true, name: true },
            },
          },
          take: 1,
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    return tenants
      .map((t) => {
        const settings = asSettings(t.settings);
        const signup = asSettings(settings.signup);
        if (signup.status !== 'awaiting_approval') return null;
        const owner = t.memberships[0]?.user;
        return {
          id: t.id,
          name: t.name,
          slug: t.slug,
          status: t.status,
          createdAt: t.createdAt,
          plan: t.plan,
          owner,
          signup: {
            status: signup.status,
            planName: signup.planName || t.plan?.name,
            phone: signup.phone || null,
            submittedAt: signup.submittedAt || t.createdAt,
            paymentProofUrl: signup.paymentProofUrl || null,
            paymentProofName: signup.paymentProofName || null,
            paymentProofMime: signup.paymentProofMime || null,
          },
        };
      })
      .filter(Boolean);
  }

  async approveSignup(
    tenantId: string,
    actorUserId?: string,
    password?: string,
  ) {
    const plainPassword = (password || '').trim();
    if (plainPassword.length < 8) {
      throw new BadRequestException({
        code: 'PASSWORD_REQUIRED',
        message: 'Defina uma senha com pelo menos 8 caracteres para o utilizador',
      });
    }

    const tenant = await this.prisma.tenant.findUnique({
      where: { id: tenantId },
      include: { plan: true, subscription: true },
    });
    if (!tenant) {
      throw new NotFoundException({
        code: 'TENANT_NOT_FOUND',
        message: 'Tenant not found',
      });
    }

    const settings = asSettings(tenant.settings);
    const signup = asSettings(settings.signup);
    if (
      tenant.status !== 'BLOCKED' ||
      signup.status !== 'awaiting_approval'
    ) {
      throw new BadRequestException({
        code: 'NOT_PENDING_SIGNUP',
        message: 'Este pedido não está pendente de aprovação',
      });
    }

    const ownerMembership = await this.prisma.membership.findFirst({
      where: { tenantId, role: 'OWNER' },
      include: { user: { select: { id: true, email: true, name: true } } },
    });
    if (!ownerMembership?.user) {
      throw new BadRequestException({
        code: 'OWNER_NOT_FOUND',
        message: 'Pedido sem utilizador owner associado',
      });
    }

    const now = new Date();
    const periodEnd = new Date(now);
    periodEnd.setMonth(periodEnd.getMonth() + 1);
    const passwordHash = await bcrypt.hash(plainPassword, 12);

    const updated = await this.prisma.$transaction(async (tx) => {
      const next = await tx.tenant.update({
        where: { id: tenantId },
        data: {
          status: 'ACTIVE',
          settings: {
            ...settings,
            signup: {
              ...signup,
              status: 'approved',
              passwordPending: false,
              approvedAt: now.toISOString(),
              approvedBy: actorUserId || null,
            },
          },
        },
        include: { plan: true },
      });

      await tx.user.update({
        where: { id: ownerMembership.user.id },
        data: {
          passwordHash,
          status: 'ACTIVE',
        },
      });

      await tx.membership.update({
        where: { id: ownerMembership.id },
        data: { status: 'ACTIVE' },
      });

      if (tenant.subscription) {
        await tx.subscription.update({
          where: { tenantId },
          data: {
            status: 'ACTIVE',
            planId: tenant.planId,
            currentPeriodStart: now,
            currentPeriodEnd: periodEnd,
          },
        });
      }

      return next;
    });

    await this.audit.log({
      tenantId,
      actorUserId,
      action: 'platform.signup_approve',
      resource: 'tenant',
      resourceId: tenantId,
      after: { status: 'ACTIVE', planId: tenant.planId },
    });

    const webUrl = process.env.WEB_URL || 'http://localhost:3000';
    await this.mail.send({
      to: ownerMembership.user.email,
      subject: 'Conta aprovada — ALURICHAT',
      text: `Olá${ownerMembership.user.name ? ` ${ownerMembership.user.name}` : ''},\n\nA sua conta foi aprovada.\n\nAceda em: ${webUrl}/login\nE-mail: ${ownerMembership.user.email}\nSenha: ${plainPassword}\nEmpresa (tenant): ${updated.slug}\n\nRecomendamos alterar a senha após o primeiro acesso.`,
    });

    return updated;
  }

  async rejectSignup(
    tenantId: string,
    actorUserId?: string,
    reason?: string,
  ) {
    const tenant = await this.prisma.tenant.findUnique({
      where: { id: tenantId },
    });
    if (!tenant) {
      throw new NotFoundException({
        code: 'TENANT_NOT_FOUND',
        message: 'Tenant not found',
      });
    }

    const settings = asSettings(tenant.settings);
    const signup = asSettings(settings.signup);
    if (
      tenant.status !== 'BLOCKED' ||
      signup.status !== 'awaiting_approval'
    ) {
      throw new BadRequestException({
        code: 'NOT_PENDING_SIGNUP',
        message: 'Este pedido não está pendente de aprovação',
      });
    }

    const updated = await this.prisma.tenant.update({
      where: { id: tenantId },
      data: {
        status: 'CHURNED',
        settings: {
          ...settings,
          signup: {
            ...signup,
            status: 'rejected',
            rejectedAt: new Date().toISOString(),
            rejectedBy: actorUserId || null,
            rejectReason: reason || null,
          },
        },
      },
    });

    await this.audit.log({
      tenantId,
      actorUserId,
      action: 'platform.signup_reject',
      resource: 'tenant',
      resourceId: tenantId,
      after: { status: 'CHURNED', reason },
    });

    const owner = await this.prisma.membership.findFirst({
      where: { tenantId, role: 'OWNER' },
      include: { user: { select: { email: true, name: true } } },
    });
    if (owner?.user?.email) {
      await this.mail.send({
        to: owner.user.email,
        subject: 'Pedido rejeitado — ALURICHAT',
        text: `Olá${owner.user.name ? ` ${owner.user.name}` : ''},\n\nO pedido de registo da empresa "${tenant.name}" não foi aprovado.${reason ? `\nMotivo: ${reason}` : ''}\n\nSe precisar de ajuda, responda a este e-mail.`,
      });
    }

    return updated;
  }

  async listPendingPlanChanges() {
    const tenants = await this.prisma.tenant.findMany({
      where: { status: { in: ['ACTIVE', 'TRIAL', 'BLOCKED'] } },
      include: {
        plan: true,
        memberships: {
          where: { role: 'OWNER' },
          include: {
            user: { select: { id: true, email: true, name: true } },
          },
          take: 1,
        },
      },
      orderBy: { updatedAt: 'desc' },
    });

    return tenants
      .map((t) => {
        const settings = asSettings(t.settings);
        const planChange = asSettings(settings.planChange);
        if (planChange.status !== 'awaiting_approval') return null;
        return {
          id: t.id,
          name: t.name,
          slug: t.slug,
          plan: t.plan,
          owner: t.memberships[0]?.user || null,
          planChange,
        };
      })
      .filter(Boolean);
  }

  async approvePlanChange(tenantId: string, actorUserId?: string) {
    const tenant = await this.prisma.tenant.findUnique({
      where: { id: tenantId },
      include: { subscription: true },
    });
    if (!tenant) {
      throw new NotFoundException({
        code: 'TENANT_NOT_FOUND',
        message: 'Tenant not found',
      });
    }

    const settings = asSettings(tenant.settings);
    const planChange = asSettings(settings.planChange);
    if (planChange.status !== 'awaiting_approval') {
      throw new BadRequestException({
        code: 'NO_PENDING_PLAN_CHANGE',
        message: 'Não há pedido de mudança de plano pendente',
      });
    }

    const planId = String(planChange.requestedPlanId || '');
    const planName = String(planChange.requestedPlanName || '');
    const plan = planId
      ? await this.prisma.plan.findUnique({ where: { id: planId } })
      : await this.prisma.plan.findUnique({
          where: {
            name: planName as
              | 'FREE'
              | 'STARTER'
              | 'PRO'
              | 'BUSINESS'
              | 'ENTERPRISE',
          },
        });
    if (!plan) {
      throw new BadRequestException({
        code: 'PLAN_NOT_FOUND',
        message: 'Plano solicitado não encontrado',
      });
    }

    const now = new Date();
    const periodEnd = new Date(now);
    periodEnd.setMonth(periodEnd.getMonth() + 1);

    const updated = await this.prisma.$transaction(async (tx) => {
      const next = await tx.tenant.update({
        where: { id: tenantId },
        data: {
          planId: plan.id,
          settings: {
            ...settings,
            planChange: {
              ...planChange,
              status: 'approved',
              approvedAt: now.toISOString(),
              approvedBy: actorUserId || null,
            },
          },
        },
        include: { plan: true },
      });

      if (tenant.subscription) {
        await tx.subscription.update({
          where: { tenantId },
          data: {
            planId: plan.id,
            status: 'ACTIVE',
            currentPeriodStart: now,
            currentPeriodEnd: periodEnd,
          },
        });
      }

      return next;
    });

    await this.audit.log({
      tenantId,
      actorUserId,
      action: 'platform.plan_change_approve',
      resource: 'tenant',
      resourceId: tenantId,
      after: { planId: plan.id, planName: plan.name },
    });

    const owner = await this.prisma.membership.findFirst({
      where: { tenantId, role: 'OWNER' },
      include: { user: { select: { email: true, name: true } } },
    });
    if (owner?.user?.email) {
      await this.mail.send({
        to: owner.user.email,
        subject: 'Plano atualizado — ALURICHAT',
        text: `Olá${owner.user.name ? ` ${owner.user.name}` : ''},\n\nO plano da empresa "${updated.name}" foi alterado para ${plan.displayName || plan.name}.`,
      });
    }

    return updated;
  }

  async rejectPlanChange(
    tenantId: string,
    actorUserId?: string,
    reason?: string,
  ) {
    const tenant = await this.prisma.tenant.findUnique({
      where: { id: tenantId },
    });
    if (!tenant) {
      throw new NotFoundException({
        code: 'TENANT_NOT_FOUND',
        message: 'Tenant not found',
      });
    }

    const settings = asSettings(tenant.settings);
    const planChange = asSettings(settings.planChange);
    if (planChange.status !== 'awaiting_approval') {
      throw new BadRequestException({
        code: 'NO_PENDING_PLAN_CHANGE',
        message: 'Não há pedido de mudança de plano pendente',
      });
    }

    const updated = await this.prisma.tenant.update({
      where: { id: tenantId },
      data: {
        settings: {
          ...settings,
          planChange: {
            ...planChange,
            status: 'rejected',
            rejectedAt: new Date().toISOString(),
            rejectedBy: actorUserId || null,
            rejectReason: reason || null,
          },
        },
      },
    });

    await this.audit.log({
      tenantId,
      actorUserId,
      action: 'platform.plan_change_reject',
      resource: 'tenant',
      resourceId: tenantId,
      after: { reason },
    });

    return updated;
  }

  async changeTenantPlan(
    tenantId: string,
    planName: string,
    actorUserId?: string,
  ) {
    const plan = await this.prisma.plan.findUnique({
      where: {
        name: planName as
          | 'FREE'
          | 'STARTER'
          | 'PRO'
          | 'BUSINESS'
          | 'ENTERPRISE',
      },
    });
    if (!plan || !plan.active) {
      throw new BadRequestException({
        code: 'PLAN_NOT_FOUND',
        message: 'Plano inválido',
      });
    }

    const tenant = await this.prisma.tenant.findUnique({
      where: { id: tenantId },
      include: { subscription: true },
    });
    if (!tenant) {
      throw new NotFoundException({
        code: 'TENANT_NOT_FOUND',
        message: 'Tenant not found',
      });
    }

    const now = new Date();
    const periodEnd = new Date(now);
    periodEnd.setMonth(periodEnd.getMonth() + 1);

    const updated = await this.prisma.$transaction(async (tx) => {
      const next = await tx.tenant.update({
        where: { id: tenantId },
        data: { planId: plan.id },
        include: { plan: true },
      });
      if (tenant.subscription) {
        await tx.subscription.update({
          where: { tenantId },
          data: {
            planId: plan.id,
            status: 'ACTIVE',
            currentPeriodStart: now,
            currentPeriodEnd: periodEnd,
          },
        });
      }
      return next;
    });

    await this.audit.log({
      tenantId,
      actorUserId,
      action: 'platform.tenant_change_plan',
      resource: 'tenant',
      resourceId: tenantId,
      after: { planId: plan.id, planName: plan.name },
    });

    return updated;
  }

  async health() {
    let dbOk = false;
    try {
      await this.prisma.$queryRaw`SELECT 1`;
      dbOk = true;
    } catch {
      dbOk = false;
    }
    const redisOk = await this.redis.ping().catch(() => false);

    const since = new Date(Date.now() - 24 * 60 * 60 * 1000);
    const [webhookFailures, disconnectedChannels, pendingSignups, pendingPlanChanges] =
      await Promise.all([
        this.prisma.webhookDelivery
          .count({
            where: {
              createdAt: { gte: since },
              status: 'FAILED',
            },
          })
          .catch(() => 0),
        this.prisma.channel.count({
          where: { type: 'WHATSAPP', status: { in: ['DISCONNECTED', 'ERROR'] } },
        }),
        this.prisma.tenant.count({ where: { status: 'BLOCKED' } }),
        this.listPendingPlanChanges().then((r) => r.length),
      ]);

    return {
      status: dbOk ? 'ok' : 'degraded',
      checks: { database: dbOk, redis: redisOk },
      alerts: {
        webhookFailures24h: webhookFailures,
        disconnectedWhatsApp: disconnectedChannels,
        pendingSignups,
        pendingPlanChanges,
      },
      uptime: process.uptime(),
    };
  }

  async listAudit() {
    const rows = await this.prisma.auditLog.findMany({
      orderBy: { createdAt: 'desc' },
      take: 100,
      include: {
        tenant: { select: { id: true, name: true, slug: true } },
        actor: { select: { id: true, name: true, email: true } },
      },
    });
    return rows.map((r) => ({
      ...r,
      actorLabel: r.actor
        ? `${r.actor.name || r.actor.email} (${r.actor.email})`
        : 'Sistema',
      tenantLabel: r.tenant
        ? `${r.tenant.name} (${r.tenant.slug})`
        : '—',
    }));
  }

  async suspendTenant(id: string, actorUserId?: string) {
    const tenant = await this.prisma.tenant.update({
      where: { id },
      data: { status: 'SUSPENDED' },
    });
    await this.audit.log({
      tenantId: id,
      actorUserId,
      action: 'platform.tenant_suspend',
      resource: 'tenant',
      resourceId: id,
    });
    return tenant;
  }

  async reactivateTenant(id: string, actorUserId?: string) {
    const tenant = await this.prisma.tenant.update({
      where: { id },
      data: { status: 'ACTIVE' },
    });
    await this.audit.log({
      tenantId: id,
      actorUserId,
      action: 'platform.tenant_reactivate',
      resource: 'tenant',
      resourceId: id,
    });
    return tenant;
  }

  async listFeatureFlags() {
    return this.prisma.featureFlag.findMany({
      include: {
        tenants: {
          include: {
            tenant: { select: { id: true, slug: true, name: true } },
          },
        },
      },
      orderBy: { key: 'asc' },
    });
  }

  async upsertFeatureFlag(key: string, defaultEnabled = false, description?: string) {
    const normalized = key.trim().toLowerCase().replace(/\s+/g, '_');
    if (!normalized) {
      throw new BadRequestException({
        code: 'INVALID_FLAG_KEY',
        message: 'Feature flag key is required',
      });
    }
    return this.prisma.featureFlag.upsert({
      where: { key: normalized },
      create: {
        key: normalized,
        defaultEnabled,
        description: description || null,
      },
      update: {
        defaultEnabled,
        ...(description !== undefined ? { description } : {}),
      },
    });
  }

  async setTenantFeatureFlag(
    tenantId: string,
    key: string,
    enabled: boolean,
  ) {
    const flag = await this.prisma.featureFlag.findUnique({
      where: { key: key.trim().toLowerCase() },
    });
    if (!flag) {
      throw new NotFoundException({
        code: 'FEATURE_FLAG_NOT_FOUND',
        message: `Feature flag "${key}" not found. Upsert it first.`,
      });
    }
    const tenant = await this.prisma.tenant.findUnique({
      where: { id: tenantId },
      select: { id: true },
    });
    if (!tenant) {
      throw new NotFoundException({
        code: 'TENANT_NOT_FOUND',
        message: 'Tenant not found',
      });
    }
    return this.prisma.tenantFeatureFlag.upsert({
      where: {
        tenantId_featureFlagId: {
          tenantId,
          featureFlagId: flag.id,
        },
      },
      create: {
        tenantId,
        featureFlagId: flag.id,
        enabled,
      },
      update: { enabled },
      include: { featureFlag: true },
    });
  }

  /**
   * SUPER_ADMIN can already login with any tenantSlug (auth.service).
   * Impersonate audits the action and returns JWTs for the target tenant.
   */
  async impersonate(tenantId: string, actorUserId: string) {
    const tenant = await this.prisma.tenant.findUnique({
      where: { id: tenantId },
      select: {
        id: true,
        slug: true,
        name: true,
        status: true,
        logoUrl: true,
      },
    });
    if (!tenant) {
      throw new NotFoundException({
        code: 'TENANT_NOT_FOUND',
        message: 'Tenant not found',
      });
    }

    const actor = await this.prisma.user.findUnique({
      where: { id: actorUserId },
      select: { id: true, email: true, platformRole: true },
    });
    if (!actor) {
      throw new NotFoundException({
        code: 'USER_NOT_FOUND',
        message: 'Actor user not found',
      });
    }

    await this.audit.log({
      tenantId,
      actorUserId,
      action: 'platform.impersonate',
      resource: 'tenant',
      resourceId: tenantId,
      after: { slug: tenant.slug },
    });

    const tokens = await this.auth.issueImpersonationTokens(actor, tenant);

    return {
      ...tokens,
      tenant,
      impersonating: true as const,
    };
  }

  async listAlerts() {
    const since = new Date(Date.now() - 24 * 60 * 60 * 1000);

    const [
      pendingSignups,
      pendingPlanChanges,
      failedWebhooks24h,
      disconnectedChannels,
      tenantsWithPlans,
    ] = await Promise.all([
      this.listPendingSignups(),
      this.listPendingPlanChanges(),
      this.prisma.webhookDelivery
        .count({
          where: { createdAt: { gte: since }, status: 'FAILED' },
        })
        .catch(() => 0),
      this.prisma.channel.findMany({
        where: {
          type: 'WHATSAPP',
          status: { in: ['DISCONNECTED', 'ERROR'] },
        },
        select: {
          id: true,
          name: true,
          status: true,
          tenantId: true,
          tenant: { select: { slug: true, name: true } },
        },
        take: 50,
      }),
      this.prisma.tenant.findMany({
        where: { status: { in: ['ACTIVE', 'TRIAL'] } },
        include: {
          plan: true,
          channels: {
            where: { type: 'WHATSAPP' },
            select: { id: true },
          },
        },
        take: 200,
      }),
    ]);

    const nearPlanLimit = tenantsWithPlans
      .map((t) => {
        const limits =
          t.plan?.limits &&
          typeof t.plan.limits === 'object' &&
          !Array.isArray(t.plan.limits)
            ? (t.plan.limits as Record<string, number>)
            : {};
        const channelLimit = limits.channels;
        if (channelLimit == null || channelLimit <= 0) return null;
        const used = t.channels.length;
        if (used < channelLimit) return null;
        return {
          tenantId: t.id,
          slug: t.slug,
          name: t.name,
          channelsUsed: used,
          channelsLimit: channelLimit,
        };
      })
      .filter(Boolean);

    return {
      pendingSignups,
      pendingPlanChanges,
      failedWebhooks24h,
      disconnectedChannels,
      nearPlanLimit,
      generatedAt: new Date().toISOString(),
    };
  }
}
