import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../infrastructure/prisma/prisma.service';
import { CreateTagDto, UpdateTagDto } from './dto/tag.dto';

@Injectable()
export class TagsService {
  constructor(private readonly prisma: PrismaService) {}

  findAll(tenantId: string) {
    return this.prisma.tag.findMany({
      where: { tenantId },
      orderBy: { name: 'asc' },
    });
  }

  create(tenantId: string, dto: CreateTagDto) {
    return this.prisma.tag.create({
      data: {
        tenantId,
        name: dto.name.trim(),
        color: dto.color || '#14b8a6',
      },
    });
  }

  async update(tenantId: string, id: string, dto: UpdateTagDto) {
    const existing = await this.prisma.tag.findFirst({
      where: { id, tenantId },
    });
    if (!existing) {
      throw new NotFoundException({
        code: 'TAG_NOT_FOUND',
        message: 'Tag not found',
      });
    }
    return this.prisma.tag.update({
      where: { id },
      data: {
        name: dto.name?.trim(),
        color: dto.color,
      },
    });
  }

  async remove(tenantId: string, id: string) {
    const existing = await this.prisma.tag.findFirst({
      where: { id, tenantId },
    });
    if (!existing) {
      throw new NotFoundException({
        code: 'TAG_NOT_FOUND',
        message: 'Tag not found',
      });
    }
    await this.prisma.tag.delete({ where: { id } });
    return { deleted: true };
  }
}
