import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import * as bcrypt from 'bcryptjs';
import { ROLE_PERMISSIONS, TenantRole } from '@alurichat/shared';
import { PrismaService } from '../../infrastructure/prisma/prisma.service';
import { InviteUserDto, UpdateMembershipDto } from './dto/user.dto';
import { PlanLimitsService } from '../billing/plan-limits.service';

@Injectable()
export class UsersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly planLimits: PlanLimitsService,
  ) {}

  async findMemberships(tenantId: string) {
    return this.prisma.membership.findMany({
      where: { tenantId },
      include: {
        user: {
          select: {
            id: true,
            email: true,
            name: true,
            avatarUrl: true,
            phone: true,
            status: true,
            lastLoginAt: true,
          },
        },
      },
      orderBy: { createdAt: 'asc' },
    });
  }

  async invite(tenantId: string, dto: InviteUserDto) {
    await this.planLimits.assertCanInviteUser(tenantId);
    const existingMembership = await this.prisma.membership.findFirst({
      where: {
        tenantId,
        user: { email: dto.email.toLowerCase() },
      },
    });
    if (existingMembership) {
      throw new ConflictException({
        code: 'ALREADY_MEMBER',
        message: 'User is already a member of this tenant',
      });
    }

    const passwordHash = await bcrypt.hash(
      dto.password || `Temp${Math.random().toString(36).slice(2, 10)}!`,
      12,
    );

    const user = await this.prisma.user.upsert({
      where: { email: dto.email.toLowerCase() },
      create: {
        email: dto.email.toLowerCase(),
        name: dto.name,
        passwordHash,
        status: 'ACTIVE',
      },
      update: { name: dto.name },
    });

    const permissions =
      dto.permissions ?? ROLE_PERMISSIONS[dto.role as TenantRole] ?? [];

    return this.prisma.membership.create({
      data: {
        tenantId,
        userId: user.id,
        role: dto.role,
        permissions,
        status: 'ACTIVE',
      },
      include: {
        user: {
          select: { id: true, email: true, name: true, avatarUrl: true },
        },
      },
    });
  }

  async updateMembership(
    tenantId: string,
    membershipId: string,
    dto: UpdateMembershipDto,
  ) {
    const membership = await this.prisma.membership.findFirst({
      where: { id: membershipId, tenantId },
    });
    if (!membership) {
      throw new NotFoundException({
        code: 'MEMBERSHIP_NOT_FOUND',
        message: 'Membership not found',
      });
    }
    return this.prisma.membership.update({
      where: { id: membershipId },
      data: {
        role: dto.role,
        permissions: dto.permissions,
        status: dto.status as 'ACTIVE' | 'INVITED' | 'SUSPENDED' | 'REMOVED' | undefined,
      },
      include: {
        user: {
          select: { id: true, email: true, name: true },
        },
      },
    });
  }

  async removeMembership(tenantId: string, membershipId: string) {
    const membership = await this.prisma.membership.findFirst({
      where: { id: membershipId, tenantId },
    });
    if (!membership) {
      throw new NotFoundException({
        code: 'MEMBERSHIP_NOT_FOUND',
        message: 'Membership not found',
      });
    }
    await this.prisma.membership.delete({ where: { id: membershipId } });
    return { deleted: true };
  }
}
