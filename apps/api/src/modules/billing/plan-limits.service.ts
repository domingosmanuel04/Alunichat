import {
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { PrismaService } from '../../infrastructure/prisma/prisma.service';

@Injectable()
export class PlanLimitsService {
  constructor(private readonly prisma: PrismaService) {}

  private async getLimits(tenantId: string) {
    const tenant = await this.prisma.tenant.findUnique({
      where: { id: tenantId },
      include: { plan: true, subscription: { include: { plan: true } } },
    });
    if (!tenant) return { channels: null as number | null, users: null as number | null };
    const plan = tenant.subscription?.plan || tenant.plan;
    const limits =
      plan?.limits && typeof plan.limits === 'object' && !Array.isArray(plan.limits)
        ? (plan.limits as Record<string, number>)
        : {};
    return {
      channels: typeof limits.channels === 'number' ? limits.channels : null,
      users: typeof limits.users === 'number' ? limits.users : null,
    };
  }

  async assertCanCreateChannel(tenantId: string) {
    const limits = await this.getLimits(tenantId);
    if (limits.channels == null || limits.channels < 0) return;
    const used = await this.prisma.channel.count({
      where: { tenantId, type: 'WHATSAPP' },
    });
    if (used >= limits.channels) {
      throw new ForbiddenException({
        code: 'PLAN_CHANNEL_LIMIT',
        message: `Limite do plano atingido: ${limits.channels} instâncias WhatsApp`,
      });
    }
  }

  async assertCanInviteUser(tenantId: string) {
    const limits = await this.getLimits(tenantId);
    if (limits.users == null || limits.users < 0) return;
    const used = await this.prisma.membership.count({
      where: { tenantId, status: 'ACTIVE' },
    });
    if (used >= limits.users) {
      throw new ForbiddenException({
        code: 'PLAN_USER_LIMIT',
        message: `Limite do plano atingido: ${limits.users} utilizadores`,
      });
    }
  }
}
