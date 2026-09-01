import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import * as bcrypt from 'bcryptjs';
import { randomBytes } from 'crypto';
import { existsSync, mkdirSync, writeFileSync } from 'fs';
import { extname, join } from 'path';
import { PrismaService } from '../../infrastructure/prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { CreateTenantDto, UpdateTenantDto } from './dto/tenant.dto';

type UploadedLogoFile = {
  originalname: string;
  mimetype: string;
  size: number;
  buffer: Buffer;
};

const LOGO_MIME_EXT: Record<string, string> = {
  'image/png': '.png',
  'image/jpeg': '.jpg',
  'image/jpg': '.jpg',
  'image/webp': '.webp',
  'image/gif': '.gif',
};

function asSettings(value: unknown): Record<string, unknown> {
  if (value && typeof value === 'object' && !Array.isArray(value)) {
    return { ...(value as Record<string, unknown>) };
  }
  return {};
}

export type BusinessHoursDay = {
  dow: number;
  start: string;
  end: string;
};

export type BusinessHoursSettings = {
  timezone: string;
  days: BusinessHoursDay[];
  awayMessage: string;
  enabled: boolean;
};

export type WhatsAppTemplate = {
  id: string;
  name: string;
  body: string;
  category?: string;
  language?: string;
};

@Injectable()
export class TenantsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  async getCurrent(tenantId: string) {
    const tenant = await this.prisma.tenant.findUnique({
      where: { id: tenantId },
      include: { plan: true },
    });
    if (!tenant) {
      throw new NotFoundException({
        code: 'TENANT_NOT_FOUND',
        message: 'Tenant not found',
      });
    }
    return tenant;
  }

  async updateCurrent(
    tenantId: string,
    dto: UpdateTenantDto,
    actorUserId?: string,
  ) {
    const tenant = await this.prisma.tenant.update({
      where: { id: tenantId },
      data: {
        name: dto.name,
        logoUrl: dto.logoUrl,
        primaryColor: dto.primaryColor,
        settings: dto.settings as object | undefined,
        featureFlags: dto.featureFlags as object | undefined,
      },
      include: { plan: true },
    });
    await this.audit.log({
      tenantId,
      actorUserId,
      action: 'tenant.update',
      resource: 'tenant',
      resourceId: tenantId,
      after: dto as object,
    });
    return tenant;
  }

  async uploadLogo(
    tenantId: string,
    file: UploadedLogoFile | undefined,
    actorUserId?: string,
  ) {
    if (!file?.buffer?.length) {
      throw new BadRequestException({
        code: 'LOGO_REQUIRED',
        message: 'Selecione uma imagem',
      });
    }

    const mime = (file.mimetype || '').toLowerCase();
    const ext =
      LOGO_MIME_EXT[mime] ||
      (['.png', '.jpg', '.jpeg', '.webp', '.gif'].includes(
        extname(file.originalname || '').toLowerCase(),
      )
        ? extname(file.originalname).toLowerCase().replace('.jpeg', '.jpg')
        : null);

    if (!ext || !mime.startsWith('image/')) {
      throw new BadRequestException({
        code: 'INVALID_LOGO_TYPE',
        message: 'Use PNG, JPG, WEBP ou GIF',
      });
    }

    if (file.size > 2 * 1024 * 1024) {
      throw new BadRequestException({
        code: 'LOGO_TOO_LARGE',
        message: 'A imagem deve ter no máximo 2 MB',
      });
    }

    const dir = join(process.cwd(), 'uploads', 'logos');
    if (!existsSync(dir)) mkdirSync(dir, { recursive: true });

    const filename = `${tenantId}${ext}`;
    writeFileSync(join(dir, filename), file.buffer);

    const logoUrl = `/uploads/logos/${filename}?v=${Date.now()}`;
    const tenant = await this.prisma.tenant.update({
      where: { id: tenantId },
      data: { logoUrl },
      include: { plan: true },
    });

    await this.audit.log({
      tenantId,
      actorUserId,
      action: 'tenant.logo_upload',
      resource: 'tenant',
      resourceId: tenantId,
      after: { logoUrl },
    });

    return tenant;
  }

  async findAll() {
    return this.prisma.tenant.findMany({
      include: {
        plan: true,
        _count: { select: { memberships: true, contacts: true } },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async create(dto: CreateTenantDto, actorUserId?: string) {
    const existing = await this.prisma.tenant.findUnique({
      where: { slug: dto.slug },
    });
    if (existing) {
      throw new ConflictException({
        code: 'SLUG_TAKEN',
        message: 'Tenant slug already exists',
      });
    }

    const planName = (dto.planName || 'FREE') as
      | 'FREE'
      | 'STARTER'
      | 'PRO'
      | 'BUSINESS'
      | 'ENTERPRISE';
    const plan = await this.prisma.plan.findUnique({
      where: { name: planName },
    });
    if (!plan) {
      throw new BadRequestException({
        code: 'PLAN_NOT_FOUND',
        message: `Plan ${planName} not found. Seed plans first.`,
      });
    }

    const tenant = await this.prisma.$transaction(async (tx) => {
      const created = await tx.tenant.create({
        data: {
          slug: dto.slug,
          name: dto.name,
          status: 'TRIAL',
          planId: plan.id,
          trialEndsAt: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000),
          settings: {},
          featureFlags: {},
        },
      });

      await tx.workspace.create({
        data: {
          tenantId: created.id,
          name: 'Default',
          slug: 'default',
          isDefault: true,
        },
      });

      const now = new Date();
      const end = new Date(now);
      end.setMonth(end.getMonth() + 1);
      await tx.subscription.create({
        data: {
          tenantId: created.id,
          planId: plan.id,
          status: 'TRIALING',
          currentPeriodStart: now,
          currentPeriodEnd: end,
          cancelAtPeriodEnd: false,
        },
      });

      if (dto.ownerEmail && dto.ownerPassword) {
        const passwordHash = await bcrypt.hash(dto.ownerPassword, 12);
        const owner = await tx.user.upsert({
          where: { email: dto.ownerEmail.toLowerCase() },
          create: {
            email: dto.ownerEmail.toLowerCase(),
            passwordHash,
            name: dto.ownerName || dto.ownerEmail.split('@')[0],
            status: 'ACTIVE',
          },
          update: {},
        });
        await tx.membership.create({
          data: {
            tenantId: created.id,
            userId: owner.id,
            role: 'OWNER',
            permissions: [],
            status: 'ACTIVE',
          },
        });
      }

      return created;
    });

    await this.audit.log({
      tenantId: tenant.id,
      actorUserId,
      action: 'tenant.create',
      resource: 'tenant',
      resourceId: tenant.id,
      after: { slug: dto.slug, name: dto.name },
    });

    return tenant;
  }

  async suspend(id: string, reason?: string, actorUserId?: string) {
    const tenant = await this.prisma.tenant.update({
      where: { id },
      data: { status: 'SUSPENDED' },
    });
    await this.audit.log({
      tenantId: id,
      actorUserId,
      action: 'tenant.suspend',
      resource: 'tenant',
      resourceId: id,
      after: { reason },
    });
    return tenant;
  }

  async reactivate(id: string, actorUserId?: string) {
    const tenant = await this.prisma.tenant.update({
      where: { id },
      data: { status: 'ACTIVE' },
    });
    await this.audit.log({
      tenantId: id,
      actorUserId,
      action: 'tenant.reactivate',
      resource: 'tenant',
      resourceId: id,
    });
    return tenant;
  }

  async generateReferralCode(tenantId: string, actorUserId?: string) {
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
    const code = `REF-${tenant.slug.slice(0, 8).toUpperCase()}-${randomBytes(3)
      .toString('hex')
      .toUpperCase()}`;
    const updated = await this.prisma.tenant.update({
      where: { id: tenantId },
      data: {
        settings: {
          ...settings,
          referralCode: code,
        },
      },
    });
    await this.audit.log({
      tenantId,
      actorUserId,
      action: 'tenant.referral_code',
      resource: 'tenant',
      resourceId: tenantId,
      after: { referralCode: code },
    });
    return {
      referralCode: code,
      tenantId: updated.id,
      slug: updated.slug,
    };
  }

  async getBusinessHours(tenantId: string): Promise<BusinessHoursSettings> {
    const tenant = await this.getCurrent(tenantId);
    const settings = asSettings(tenant.settings);
    const bh = asSettings(settings.businessHours);
    return {
      timezone: String(bh.timezone || 'Africa/Luanda'),
      days: Array.isArray(bh.days)
        ? (bh.days as BusinessHoursDay[])
        : [
            { dow: 1, start: '09:00', end: '18:00' },
            { dow: 2, start: '09:00', end: '18:00' },
            { dow: 3, start: '09:00', end: '18:00' },
            { dow: 4, start: '09:00', end: '18:00' },
            { dow: 5, start: '09:00', end: '18:00' },
          ],
      awayMessage: String(
        bh.awayMessage ||
          'Estamos fora do horário de atendimento. Responderemos em breve.',
      ),
      enabled: Boolean(bh.enabled),
    };
  }

  async patchBusinessHours(
    tenantId: string,
    body: Partial<BusinessHoursSettings>,
    actorUserId?: string,
  ) {
    const tenant = await this.getCurrent(tenantId);
    const settings = asSettings(tenant.settings);
    const current = await this.getBusinessHours(tenantId);
    const next: BusinessHoursSettings = {
      timezone: body.timezone ?? current.timezone,
      days: body.days ?? current.days,
      awayMessage: body.awayMessage ?? current.awayMessage,
      enabled: body.enabled ?? current.enabled,
    };
    const updated = await this.prisma.tenant.update({
      where: { id: tenantId },
      data: {
        settings: {
          ...settings,
          businessHours: next,
        },
      },
    });
    await this.audit.log({
      tenantId,
      actorUserId,
      action: 'tenant.business_hours',
      resource: 'tenant',
      resourceId: tenantId,
      after: next as unknown as object,
    });
    return { businessHours: next, tenantId: updated.id };
  }

  async listWhatsAppTemplates(tenantId: string): Promise<WhatsAppTemplate[]> {
    const tenant = await this.getCurrent(tenantId);
    const settings = asSettings(tenant.settings);
    return Array.isArray(settings.whatsappTemplates)
      ? (settings.whatsappTemplates as WhatsAppTemplate[])
      : [];
  }

  async addWhatsAppTemplate(
    tenantId: string,
    body: { name: string; body: string; category?: string; language?: string },
    actorUserId?: string,
  ) {
    if (!body?.name?.trim() || !body?.body?.trim()) {
      throw new BadRequestException({
        code: 'TEMPLATE_INVALID',
        message: 'name e body são obrigatórios',
      });
    }
    const tenant = await this.getCurrent(tenantId);
    const settings = asSettings(tenant.settings);
    const list = Array.isArray(settings.whatsappTemplates)
      ? [...(settings.whatsappTemplates as WhatsAppTemplate[])]
      : [];
    const template: WhatsAppTemplate = {
      id: randomBytes(8).toString('hex'),
      name: body.name.trim(),
      body: body.body.trim(),
      category: body.category?.trim(),
      language: body.language?.trim() || 'pt',
    };
    list.push(template);
    await this.prisma.tenant.update({
      where: { id: tenantId },
      data: {
        settings: {
          ...settings,
          whatsappTemplates: JSON.parse(JSON.stringify(list)),
        },
      },
    });
    await this.audit.log({
      tenantId,
      actorUserId,
      action: 'tenant.whatsapp_template_add',
      resource: 'tenant',
      resourceId: tenantId,
      after: template as unknown as object,
    });
    return template;
  }

  async removeWhatsAppTemplate(
    tenantId: string,
    templateId: string,
    actorUserId?: string,
  ) {
    const tenant = await this.getCurrent(tenantId);
    const settings = asSettings(tenant.settings);
    const list = Array.isArray(settings.whatsappTemplates)
      ? (settings.whatsappTemplates as WhatsAppTemplate[])
      : [];
    const next = list.filter((t) => t.id !== templateId);
    if (next.length === list.length) {
      throw new NotFoundException({
        code: 'TEMPLATE_NOT_FOUND',
        message: 'Template not found',
      });
    }
    await this.prisma.tenant.update({
      where: { id: tenantId },
      data: {
        settings: {
          ...settings,
          whatsappTemplates: JSON.parse(JSON.stringify(next)),
        },
      },
    });
    await this.audit.log({
      tenantId,
      actorUserId,
      action: 'tenant.whatsapp_template_delete',
      resource: 'tenant',
      resourceId: tenantId,
      after: { templateId },
    });
    return { deleted: true, templateId };
  }
}
