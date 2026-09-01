import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../infrastructure/prisma/prisma.service';
import { paginatedMeta, PaginationDto } from '../../common/dto/pagination.dto';
import {
  CreateQuickReplyDto,
  UpdateQuickReplyDto,
} from './dto/quick-reply.dto';

@Injectable()
export class QuickRepliesService {
  constructor(private readonly prisma: PrismaService) {}

  async findAll(tenantId: string, query: PaginationDto) {
    const page = query.page ?? 1;
    const pageSize = query.pageSize ?? 50;
    const where = {
      tenantId,
      ...(query.search
        ? {
            OR: [
              { title: { contains: query.search, mode: 'insensitive' as const } },
              { shortcut: { contains: query.search, mode: 'insensitive' as const } },
              { body: { contains: query.search, mode: 'insensitive' as const } },
            ],
          }
        : {}),
    };
    const [items, total] = await Promise.all([
      this.prisma.quickReply.findMany({
        where,
        skip: (page - 1) * pageSize,
        take: pageSize,
        orderBy: [{ category: 'asc' }, { shortcut: 'asc' }],
      }),
      this.prisma.quickReply.count({ where }),
    ]);
    return { data: items, meta: paginatedMeta(page, pageSize, total) };
  }

  async findOne(tenantId: string, id: string) {
    const item = await this.prisma.quickReply.findFirst({
      where: { id, tenantId },
    });
    if (!item) {
      throw new NotFoundException({
        code: 'QUICK_REPLY_NOT_FOUND',
        message: 'Quick reply not found',
      });
    }
    return item;
  }

  async create(tenantId: string, dto: CreateQuickReplyDto) {
    return this.prisma.quickReply.create({
      data: {
        tenantId,
        shortcut: dto.shortcut.replace(/^\//, ''),
        title: dto.title,
        body: dto.body,
        category: dto.category,
      },
    });
  }

  async update(tenantId: string, id: string, dto: UpdateQuickReplyDto) {
    await this.findOne(tenantId, id);
    return this.prisma.quickReply.update({
      where: { id },
      data: {
        shortcut: dto.shortcut?.replace(/^\//, ''),
        title: dto.title,
        body: dto.body,
        category: dto.category,
      },
    });
  }

  async remove(tenantId: string, id: string) {
    await this.findOne(tenantId, id);
    await this.prisma.quickReply.delete({ where: { id } });
    return { deleted: true };
  }
}
