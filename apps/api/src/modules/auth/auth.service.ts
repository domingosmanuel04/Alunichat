import {
  BadRequestException,
  ConflictException,
  Injectable,
  UnauthorizedException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcryptjs';
import { existsSync, mkdirSync, writeFileSync } from 'fs';
import { extname, join } from 'path';
import { ROLE_PERMISSIONS, TenantRole, PERMISSION_SCOPES } from '@alurichat/shared';
import { PrismaService } from '../../infrastructure/prisma/prisma.service';
import { RedisService } from '../../infrastructure/redis/redis.service';
import { AuditService } from '../audit/audit.service';
import { LoginDto } from './dto/login.dto';
import { RegisterDto } from './dto/register.dto';
import { JwtPayload } from '../../common/decorators/current-user.decorator';
import { MailService } from '../mail/mail.service';
import { randomBytes, createHmac } from 'crypto';

type MembershipWithTenant = Awaited<
  ReturnType<PrismaService['membership']['findUnique']>
> & {
  tenant?: {
    id: string;
    slug: string;
    name: string;
    status: string;
    logoUrl: string | null;
  };
};

type UploadedProofFile = {
  originalname: string;
  mimetype: string;
  size: number;
  buffer: Buffer;
};

const PROOF_MIME_EXT: Record<string, string> = {
  'image/png': '.png',
  'image/jpeg': '.jpg',
  'image/jpg': '.jpg',
  'image/webp': '.webp',
  'application/pdf': '.pdf',
};

function asSettings(value: unknown): Record<string, unknown> {
  if (value && typeof value === 'object' && !Array.isArray(value)) {
    return value as Record<string, unknown>;
  }
  return {};
}

function isAwaitingApproval(tenant: { status: string; settings: unknown }) {
  if (tenant.status !== 'BLOCKED') return false;
  const settings = asSettings(tenant.settings);
  const signup = asSettings(settings.signup);
  return signup.status === 'awaiting_approval';
}

function totpCode(secret: string, windowOffset = 0) {
  const window = Math.floor(Date.now() / 30000) + windowOffset;
  return createHmac('sha1', secret)
    .update(String(window))
    .digest('hex')
    .replace(/\D/g, '')
    .slice(0, 6)
    .padStart(6, '0');
}

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwt: JwtService,
    private readonly config: ConfigService,
    private readonly redis: RedisService,
    private readonly audit: AuditService,
    private readonly mail: MailService,
  ) {}

  async login(dto: LoginDto, ip?: string, userAgent?: string) {
    await this.verifyCaptcha(dto.captchaToken, dto.captchaAnswer);

    const user = await this.prisma.user.findUnique({
      where: { email: dto.email.toLowerCase() },
    });

    if (!user || !user.passwordHash) {
      throw new UnauthorizedException({
        code: 'INVALID_CREDENTIALS',
        message: 'Invalid email or password',
      });
    }

    const valid = await bcrypt.compare(dto.password, user.passwordHash);
    if (!valid) {
      throw new UnauthorizedException({
        code: 'INVALID_CREDENTIALS',
        message: 'Invalid email or password',
      });
    }

    if (user.mfaEnabled) {
      const secret = await this.redis.get(`mfa:secret:${user.id}`);
      if (!secret) {
        throw new UnauthorizedException({
          code: 'MFA_NOT_CONFIGURED',
          message: '2FA ativo mas sem segredo configurado. Contacte o suporte.',
        });
      }
      const code = (dto.mfaCode || '').trim();
      const ok =
        code &&
        (code === totpCode(secret, 0) ||
          code === totpCode(secret, -1) ||
          code === totpCode(secret, 1));
      if (!ok) {
        throw new UnauthorizedException({
          code: 'MFA_REQUIRED',
          message: 'Código 2FA inválido ou em falta',
        });
      }
    }

    if (user.status && user.status !== 'ACTIVE') {
      throw new ForbiddenException({
        code: 'USER_INACTIVE',
        message: 'User account is not active',
      });
    }

    let membership = null as Awaited<
      ReturnType<typeof this.prisma.membership.findFirst>
    >;

    if (dto.tenantSlug) {
      const tenant = await this.prisma.tenant.findUnique({
        where: { slug: dto.tenantSlug },
      });
      if (!tenant) {
        throw new UnauthorizedException({
          code: 'TENANT_NOT_FOUND',
          message: 'Tenant not found',
        });
      }
      if (tenant.status === 'SUSPENDED' || tenant.status === 'BLOCKED') {
        throw new ForbiddenException({
          code: isAwaitingApproval(tenant)
            ? 'PENDING_APPROVAL'
            : 'TENANT_SUSPENDED',
          message: isAwaitingApproval(tenant)
            ? 'Conta aguardando aprovação do comprovativo de pagamento pelo administrador'
            : 'Tenant is suspended',
        });
      }
      membership = await this.prisma.membership.findUnique({
        where: {
          tenantId_userId: { tenantId: tenant.id, userId: user.id },
        },
      });
      if (!membership && user.platformRole !== 'SUPER_ADMIN') {
        throw new ForbiddenException({
          code: 'NOT_A_MEMBER',
          message: 'You are not a member of this tenant',
        });
      }
    } else if (user.platformRole !== 'SUPER_ADMIN') {
      membership = await this.prisma.membership.findFirst({
        where: { userId: user.id, status: 'ACTIVE' },
        orderBy: { createdAt: 'asc' },
      });
      if (!membership) {
        throw new ForbiddenException({
          code: 'NO_TENANT',
          message: 'No tenant membership found',
        });
      }
      const tenant = await this.prisma.tenant.findUnique({
        where: { id: membership.tenantId },
      });
      if (tenant && (tenant.status === 'SUSPENDED' || tenant.status === 'BLOCKED')) {
        throw new ForbiddenException({
          code: isAwaitingApproval(tenant)
            ? 'PENDING_APPROVAL'
            : 'TENANT_SUSPENDED',
          message: isAwaitingApproval(tenant)
            ? 'Conta aguardando aprovação do comprovativo de pagamento pelo administrador'
            : 'Tenant is suspended',
        });
      }
    }

    const role = (membership?.role as TenantRole) || TenantRole.VIEWER;
    const permissions =
      membership?.permissions?.length
        ? membership.permissions
        : ROLE_PERMISSIONS[role] ?? [];

    const payload: JwtPayload = {
      sub: user.id,
      email: user.email,
      tenantId: membership?.tenantId || '',
      workspaceId: membership?.workspaceId || undefined,
      role: membership?.role ?? (user.platformRole === 'SUPER_ADMIN' ? 'PLATFORM' : 'VIEWER'),
      permissions: user.platformRole === 'SUPER_ADMIN'
        ? [...permissions, 'platform.admin']
        : [...permissions],
      platformRole: user.platformRole,
    };

    if (!payload.tenantId && user.platformRole !== 'SUPER_ADMIN') {
      throw new ForbiddenException({
        code: 'NO_TENANT',
        message: 'No tenant membership found. Informe o tenantSlug no login (ex.: demo).',
      });
    }

    const tokens = await this.issueTokens(payload);

    await this.prisma.user.update({
      where: { id: user.id },
      data: { lastLoginAt: new Date() },
    });

    await this.audit.log({
      tenantId: membership?.tenantId,
      actorUserId: user.id,
      action: 'auth.login',
      resource: 'user',
      resourceId: user.id,
      ip,
      userAgent,
    });

    return {
      ...tokens,
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        avatarUrl: user.avatarUrl,
        platformRole: user.platformRole,
        role: payload.role,
        permissions: payload.permissions,
        tenantId: payload.tenantId || null,
        workspaceId: payload.workspaceId || null,
      },
    };
  }

  async register(
    dto: RegisterDto,
    proof: UploadedProofFile | undefined,
    ip?: string,
    userAgent?: string,
  ) {
    await this.verifyCaptcha(dto.captchaToken, dto.captchaAnswer);

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

    const email = dto.email.toLowerCase().trim();
    const slug = dto.slug.toLowerCase().trim();

    const [existingUser, existingSlug] = await Promise.all([
      this.prisma.user.findUnique({ where: { email } }),
      this.prisma.tenant.findUnique({ where: { slug } }),
    ]);

    if (existingUser) {
      throw new ConflictException({
        code: 'EMAIL_TAKEN',
        message: 'Já existe uma conta com este e-mail',
      });
    }
    if (existingSlug) {
      throw new ConflictException({
        code: 'SLUG_TAKEN',
        message: 'Este identificador de empresa já está em uso',
      });
    }

    const planName = dto.planName as
      | 'FREE'
      | 'STARTER'
      | 'PRO'
      | 'BUSINESS'
      | 'ENTERPRISE';
    const plan = await this.prisma.plan.findUnique({ where: { name: planName } });
    if (!plan || !plan.active) {
      throw new BadRequestException({
        code: 'PLAN_NOT_FOUND',
        message: 'Plano inválido ou indisponível',
      });
    }

    const passwordHash = await bcrypt.hash(dto.password, 12);
    const now = new Date();
    const periodEnd = new Date(now);
    periodEnd.setMonth(periodEnd.getMonth() + 1);

    const referralMeta = await this.resolveReferralCode(dto.referralCode);

    const result = await this.prisma.$transaction(async (tx) => {
      const tenant = await tx.tenant.create({
        data: {
          slug,
          name: dto.companyName.trim(),
          status: 'BLOCKED',
          planId: plan.id,
          trialEndsAt: null,
          settings: {
            signup: {
              status: 'awaiting_approval',
              planName,
              phone: dto.phone?.trim() || null,
              submittedAt: now.toISOString(),
              ...(referralMeta
                ? {
                    referralCode: referralMeta.code,
                    referralSource: referralMeta.source,
                    referredByTenantId: referralMeta.tenantId || null,
                  }
                : {}),
            },
          },
          featureFlags: {},
        },
      });

      await tx.workspace.create({
        data: {
          tenantId: tenant.id,
          name: 'Default',
          slug: 'default',
          isDefault: true,
        },
      });

      await tx.subscription.create({
        data: {
          tenantId: tenant.id,
          planId: plan.id,
          status: 'PAUSED',
          currentPeriodStart: now,
          currentPeriodEnd: periodEnd,
          cancelAtPeriodEnd: false,
        },
      });

      const owner = await tx.user.create({
        data: {
          email,
          passwordHash,
          name: dto.ownerName.trim(),
          status: 'ACTIVE',
        },
      });

      await tx.membership.create({
        data: {
          tenantId: tenant.id,
          userId: owner.id,
          role: 'OWNER',
          permissions: [],
          status: 'ACTIVE',
        },
      });

      return { tenant, owner };
    });

    const dir = join(process.cwd(), 'uploads', 'payment-proofs');
    if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
    const filename = `${result.tenant.id}${ext}`;
    writeFileSync(join(dir, filename), proof.buffer);
    const paymentProofUrl = `/uploads/payment-proofs/${filename}?v=${Date.now()}`;

    const settings = asSettings(result.tenant.settings);
    const signup = asSettings(settings.signup);
    await this.prisma.tenant.update({
      where: { id: result.tenant.id },
      data: {
        settings: {
          ...settings,
          signup: {
            ...signup,
            paymentProofUrl,
            paymentProofName: proof.originalname,
            paymentProofMime: mime,
          },
        },
      },
    });

    await this.audit.log({
      tenantId: result.tenant.id,
      actorUserId: result.owner.id,
      action: 'auth.register',
      resource: 'tenant',
      resourceId: result.tenant.id,
      ip,
      userAgent,
      after: { planName, slug, email },
    });

    await this.mail.send({
      to: email,
      subject: 'Pedido recebido — ALURICHAT',
      text: `Olá ${dto.ownerName.trim()},\n\nRecebemos o registo da empresa "${dto.companyName.trim()}" (plano ${planName}). Assim que o comprovativo for aprovado, poderá entrar em ${(process.env.WEB_URL || 'http://localhost:3000')}/login com o identificador "${slug}".`,
    });

    return {
      message:
        'Pedido enviado. Após a aprovação do comprovativo pelo administrador, poderá entrar no painel.',
      tenantId: result.tenant.id,
      slug,
      planName,
      status: 'awaiting_approval',
    };
  }

  async refresh(refreshToken: string) {
    try {
      const decoded = await this.jwt.verifyAsync<JwtPayload & { typ?: string }>(
        refreshToken,
        {
          secret: this.config.get<string>(
            'JWT_REFRESH_SECRET',
            'change-me-jwt-refresh-secret-min-32!!',
          ),
        },
      );

      if (decoded.typ !== 'refresh') {
        throw new UnauthorizedException({
          code: 'INVALID_REFRESH',
          message: 'Invalid refresh token',
        });
      }

      const blacklistKey = `refresh:bl:${refreshToken.slice(-32)}`;
      const blacklisted = await this.redis.get(blacklistKey).catch(() => null);
      if (blacklisted) {
        throw new UnauthorizedException({
          code: 'TOKEN_REVOKED',
          message: 'Refresh token has been revoked',
        });
      }

      const user = await this.prisma.user.findUnique({
        where: { id: decoded.sub },
      });
      if (!user) {
        throw new UnauthorizedException({
          code: 'USER_NOT_FOUND',
          message: 'User not found',
        });
      }

      const payload: JwtPayload = {
        sub: decoded.sub,
        email: decoded.email,
        tenantId: decoded.tenantId,
        workspaceId: decoded.workspaceId,
        role: decoded.role,
        permissions: decoded.permissions ?? [],
        platformRole: decoded.platformRole,
      };

      return this.issueTokens(payload);
    } catch (err) {
      if (err instanceof UnauthorizedException) throw err;
      throw new UnauthorizedException({
        code: 'INVALID_REFRESH',
        message: 'Invalid or expired refresh token',
      });
    }
  }

  async logout(refreshToken?: string) {
    if (refreshToken) {
      const key = `refresh:bl:${refreshToken.slice(-32)}`;
      await this.redis.set(key, '1', 60 * 60 * 24 * 7).catch(() => undefined);
    }
    return { loggedOut: true };
  }

  async me(userId: string, tenantId?: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        email: true,
        name: true,
        avatarUrl: true,
        phone: true,
        platformRole: true,
        status: true,
        lastLoginAt: true,
        createdAt: true,
      },
    });
    if (!user) {
      throw new UnauthorizedException({
        code: 'USER_NOT_FOUND',
        message: 'User not found',
      });
    }

    let membership: MembershipWithTenant | null = null;
    if (tenantId) {
      membership = await this.prisma.membership.findUnique({
        where: { tenantId_userId: { tenantId, userId } },
        include: {
          tenant: {
            select: { id: true, slug: true, name: true, status: true, logoUrl: true },
          },
        },
      });
    }

    return { ...user, membership };
  }

  async forgotPassword(email: string) {
    const user = await this.prisma.user.findUnique({
      where: { email: email.toLowerCase().trim() },
    });
    // Always return ok to avoid email enumeration
    if (!user) {
      return {
        message: 'Se o e-mail existir, enviámos instruções para redefinir a senha.',
      };
    }

    const token = randomBytes(32).toString('hex');
    const key = `pwdreset:${token}`;
    await this.redis.set(key, user.id, 60 * 60);

    const webUrl = this.config.get<string>('WEB_URL', 'http://localhost:3000');
    const link = `${webUrl}/reset-password?token=${token}`;
    await this.mail.send({
      to: user.email,
      subject: 'Redefinir senha — ALURICHAT',
      text: `Olá${user.name ? ` ${user.name}` : ''},\n\nPara redefinir a senha, abra:\n${link}\n\nO link expira em 1 hora.`,
      html: `<p>Para redefinir a senha, <a href="${link}">clique aqui</a>.</p><p>O link expira em 1 hora.</p>`,
    });

    return {
      message: 'Se o e-mail existir, enviámos instruções para redefinir a senha.',
      ...(this.config.get('NODE_ENV') !== 'production' ? { devResetUrl: link } : {}),
    };
  }

  async resetPassword(token: string, password: string) {
    const key = `pwdreset:${token}`;
    const userId = await this.redis.get(key);
    if (!userId) {
      throw new BadRequestException({
        code: 'INVALID_RESET_TOKEN',
        message: 'Link inválido ou expirado',
      });
    }

    const passwordHash = await bcrypt.hash(password, 12);
    await this.prisma.user.update({
      where: { id: userId },
      data: { passwordHash },
    });
    await this.redis.del(key);

    return { message: 'Senha atualizada. Já pode entrar.' };
  }

  async enableMfa(userId: string) {
    const secret = randomBytes(20).toString('hex');
    await this.redis.set(`mfa:secret:${userId}`, secret, 60 * 60 * 24 * 365);
    await this.prisma.user.update({
      where: { id: userId },
      data: { mfaEnabled: true },
    });
    const code = totpCode(secret);
    return {
      enabled: true,
      secret,
      message:
        '2FA ativado. Guarde o segredo. O código muda a cada 30s (HMAC). Em desenvolvimento o código atual também é devolvido.',
      ...(this.config.get('NODE_ENV') !== 'production' ? { currentCode: code } : {}),
    };
  }

  async disableMfa(userId: string) {
    await this.redis.del(`mfa:secret:${userId}`).catch(() => undefined);
    await this.prisma.user.update({
      where: { id: userId },
      data: { mfaEnabled: false },
    });
    return { enabled: false };
  }

  async mfaStatus(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { mfaEnabled: true },
    });
    return { enabled: Boolean(user?.mfaEnabled) };
  }

  async createCaptcha() {
    const captchaToken = randomBytes(16).toString('hex');
    const a = 1 + Math.floor(Math.random() * 9);
    const b = 1 + Math.floor(Math.random() * 9);
    const useMath = Math.random() > 0.5;
    const answer = useMath ? String(a + b) : 'OK';
    const challenge = useMath
      ? `Quanto é ${a}+${b}?`
      : 'Digite OK';

    await this.redis.set(
      `captcha:${captchaToken}`,
      JSON.stringify({ answer }),
      60 * 10,
    );

    return { captchaToken, challenge };
  }

  private async verifyCaptcha(
    captchaToken?: string,
    captchaAnswer?: string,
  ) {
    const isProd = this.config.get('NODE_ENV') === 'production';

    if (!captchaToken) {
      if (!isProd) return;
      throw new BadRequestException({
        code: 'CAPTCHA_REQUIRED',
        message: 'Captcha obrigatório',
      });
    }

    if (!isProd && captchaToken === 'dev-ok') return;

    const raw = await this.redis.get(`captcha:${captchaToken}`);
    if (!raw) {
      throw new BadRequestException({
        code: 'CAPTCHA_INVALID',
        message: 'Captcha inválido ou expirado',
      });
    }

    let expected = 'OK';
    try {
      const parsed = JSON.parse(raw) as { answer?: string };
      expected = String(parsed.answer || 'OK');
    } catch {
      expected = raw;
    }

    if ((captchaAnswer || '').trim() !== expected) {
      throw new BadRequestException({
        code: 'CAPTCHA_WRONG',
        message: 'Resposta do captcha incorreta',
      });
    }

    await this.redis.del(`captcha:${captchaToken}`).catch(() => undefined);
  }

  private async resolveReferralCode(code?: string) {
    if (!code?.trim()) return null;
    const normalized = code.trim().toUpperCase();

    const coupon = await this.redis.get(`coupon:${normalized}`).catch(() => null);
    if (coupon) {
      return { code: normalized, source: 'coupon' as const, tenantId: null as string | null };
    }

    const tenants = await this.prisma.tenant.findMany({
      where: { status: { in: ['ACTIVE', 'TRIAL'] } },
      select: { id: true, settings: true },
      take: 500,
    });
    for (const t of tenants) {
      const settings = asSettings(t.settings);
      const ref = String(settings.referralCode || '').toUpperCase();
      if (ref && ref === normalized) {
        return {
          code: normalized,
          source: 'tenant' as const,
          tenantId: t.id,
        };
      }
    }

    return { code: normalized, source: 'unknown' as const, tenantId: null };
  }

  private async issueTokens(payload: JwtPayload) {
    const accessToken = await this.jwt.signAsync(payload, {
      secret: this.config.get<string>(
        'JWT_SECRET',
        'change-me-jwt-secret-min-32-chars-long!!',
      ),
      expiresIn: '15m',
    });

    const refreshToken = await this.jwt.signAsync(
      { ...payload, typ: 'refresh' },
      {
        secret: this.config.get<string>(
          'JWT_REFRESH_SECRET',
          'change-me-jwt-refresh-secret-min-32!!',
        ),
        expiresIn: '7d',
      },
    );

    return {
      accessToken,
      refreshToken,
      expiresIn: 900,
      tokenType: 'Bearer',
    };
  }

  /**
   * Issue tokens for platform admin impersonating into a target tenant.
   */
  async issueImpersonationTokens(
    actor: { id: string; email: string; platformRole?: string | null },
    tenant: { id: string },
  ) {
    const payload: JwtPayload = {
      sub: actor.id,
      email: actor.email,
      tenantId: tenant.id,
      role: 'PLATFORM',
      permissions: [...PERMISSION_SCOPES],
      platformRole: actor.platformRole ?? 'SUPER_ADMIN',
      impersonatorId: actor.id,
    };
    return this.issueTokens(payload);
  }
}
