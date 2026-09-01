import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../infrastructure/prisma/prisma.service';
import { paginatedMeta } from '../../common/dto/pagination.dto';

export interface AuditLogInput {
  tenantId?: string | null;
  actorUserId?: string | null;
  action: string;
  resource: string;
  resourceId?: string | null;
  before?: object | null;
  after?: object | null;
  ip?: string | null;
  userAgent?: string | null;
}

@Injectable()
export class AuditService {
  constructor(private readonly prisma: PrismaService) {}

  async log(input: AuditLogInput) {
    return this.prisma.auditLog.create({
      data: {
        tenantId: input.tenantId ?? null,
        actorUserId: input.actorUserId ?? null,
        action: input.action,
        resource: input.resource,
        resourceId: input.resourceId ?? null,
        before: input.before ?? undefined,
        after: input.after ?? undefined,
        ip: input.ip ?? null,
        userAgent: input.userAgent ?? null,
      },
    });
  }

  async findAll(
    tenantId: string,
    page = 1,
    pageSize = 20,
    resource?: string,
  ) {
    const where = {
      tenantId,
      ...(resource ? { resource } : {}),
    };
    const [items, total] = await Promise.all([
      this.prisma.auditLog.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      this.prisma.auditLog.count({ where }),
    ]);
    return { data: items, meta: paginatedMeta(page, pageSize, total) };
  }
}
