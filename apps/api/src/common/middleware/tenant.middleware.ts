import { Injectable, NestMiddleware } from '@nestjs/common';
import { NextFunction, Request, Response } from 'express';
import { PrismaService } from '../../infrastructure/prisma/prisma.service';

type TenantRequest = Request & {
  tenantId?: string;
  tenantSlug?: string;
};

@Injectable()
export class TenantMiddleware implements NestMiddleware {
  constructor(private readonly prisma: PrismaService) {}

  async use(req: TenantRequest, _res: Response, next: NextFunction) {
    const headerId = req.headers['x-tenant-id'];
    const headerSlug = req.headers['x-tenant-slug'];

    if (typeof headerId === 'string' && headerId.trim()) {
      req.tenantId = headerId.trim();
      return next();
    }

    if (typeof headerSlug === 'string' && headerSlug.trim()) {
      req.tenantSlug = headerSlug.trim();
      try {
        const tenant = await this.prisma.tenant.findUnique({
          where: { slug: headerSlug.trim() },
          select: { id: true },
        });
        if (tenant) {
          req.tenantId = tenant.id;
        }
      } catch {
        // DB may be unavailable during boot; JWT tenantId remains source of truth
      }
    }

    next();
  }
}
