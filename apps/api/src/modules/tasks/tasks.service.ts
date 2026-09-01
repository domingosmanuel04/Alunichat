import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../infrastructure/prisma/prisma.service';
import { paginatedMeta } from '../../common/dto/pagination.dto';
import { CreateTaskDto, TaskQueryDto, UpdateTaskDto } from './dto/task.dto';

@Injectable()
export class TasksService {
  constructor(private readonly prisma: PrismaService) {}

  async findAll(tenantId: string, query: TaskQueryDto) {
    const page = query.page ?? 1;
    const pageSize = query.pageSize ?? 20;
    const where = {
      tenantId,
      ...(query.status ? { status: query.status } : {}),
      ...(query.search
        ? { title: { contains: query.search, mode: 'insensitive' as const } }
        : {}),
    };
    const [items, total] = await Promise.all([
      this.prisma.task.findMany({
        where,
        skip: (page - 1) * pageSize,
        take: pageSize,
        orderBy: { updatedAt: 'desc' },
      }),
      this.prisma.task.count({ where }),
    ]);
    return { data: items, meta: paginatedMeta(page, pageSize, total) };
  }

  async findOne(tenantId: string, id: string) {
    const task = await this.prisma.task.findFirst({ where: { id, tenantId } });
    if (!task) {
      throw new NotFoundException({ code: 'TASK_NOT_FOUND', message: 'Task not found' });
    }
    return task;
  }

  async create(tenantId: string, dto: CreateTaskDto) {
    return this.prisma.task.create({
      data: {
        tenantId,
        title: dto.title,
        description: dto.description,
        status: dto.status ?? 'TODO',
        priority: (dto.priority as 'LOW' | 'NORMAL' | 'HIGH' | 'URGENT') ?? 'NORMAL',
        assigneeId: dto.assigneeId,
        dueAt: dto.dueAt ? new Date(dto.dueAt) : null,
        contactId: dto.contactId,
        dealId: dto.dealId,
        conversationId: dto.conversationId,
        checklist: (dto.checklist as object) ?? [],
        metadata: {},
      },
    });
  }

  async update(tenantId: string, id: string, dto: UpdateTaskDto) {
    await this.findOne(tenantId, id);
    return this.prisma.task.update({
      where: { id },
      data: {
        title: dto.title,
        description: dto.description,
        status: dto.status,
        priority: dto.priority as 'LOW' | 'NORMAL' | 'HIGH' | 'URGENT' | undefined,
        assigneeId: dto.assigneeId,
        dueAt: dto.dueAt ? new Date(dto.dueAt) : undefined,
        contactId: dto.contactId,
        dealId: dto.dealId,
        conversationId: dto.conversationId,
        checklist: dto.checklist as object | undefined,
      },
    });
  }

  async remove(tenantId: string, id: string) {
    await this.findOne(tenantId, id);
    await this.prisma.task.delete({ where: { id } });
    return { deleted: true };
  }
}
