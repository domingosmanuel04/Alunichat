import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../../infrastructure/prisma/prisma.service';
import { CreateWorkflowDto, UpdateWorkflowDto } from './dto/workflow.dto';

@Injectable()
export class WorkflowsService {
  constructor(private readonly prisma: PrismaService) {}

  async findAll(tenantId: string) {
    return this.prisma.workflow.findMany({
      where: { tenantId },
      include: {
        versions: { orderBy: { version: 'desc' }, take: 1 },
      },
      orderBy: { updatedAt: 'desc' },
    });
  }

  async findOne(tenantId: string, id: string) {
    const workflow = await this.prisma.workflow.findFirst({
      where: { id, tenantId },
      include: { versions: { orderBy: { version: 'desc' } } },
    });
    if (!workflow) {
      throw new NotFoundException({
        code: 'WORKFLOW_NOT_FOUND',
        message: 'Workflow not found',
      });
    }
    return workflow;
  }

  async create(tenantId: string, dto: CreateWorkflowDto) {
    return this.prisma.$transaction(async (tx) => {
      const workflow = await tx.workflow.create({
        data: {
          tenantId,
          name: dto.name,
          description: dto.description,
          status: 'DRAFT',
          triggerType: dto.triggerType,
          triggerConfig: (dto.triggerConfig as object) ?? {},
        },
      });
      await tx.workflowVersion.create({
        data: {
          workflowId: workflow.id,
          tenantId,
          version: 1,
          definition: (dto.definition as object) ?? { nodes: [], edges: [] },
        },
      });
      return tx.workflow.findUnique({
        where: { id: workflow.id },
        include: { versions: true },
      });
    });
  }

  async update(tenantId: string, id: string, dto: UpdateWorkflowDto) {
    await this.findOne(tenantId, id);

    return this.prisma.$transaction(async (tx) => {
      await tx.workflow.update({
        where: { id },
        data: {
          name: dto.name,
          description: dto.description,
          triggerType: dto.triggerType,
          triggerConfig: dto.triggerConfig as object | undefined,
        },
      });

      if (dto.definition) {
        const latest = await tx.workflowVersion.findFirst({
          where: { workflowId: id, tenantId },
          orderBy: { version: 'desc' },
        });
        if (latest) {
          await tx.workflowVersion.update({
            where: { id: latest.id },
            data: { definition: dto.definition as object },
          });
        } else {
          await tx.workflowVersion.create({
            data: {
              workflowId: id,
              tenantId,
              version: 1,
              definition: dto.definition as object,
            },
          });
        }
      }

      return tx.workflow.findFirst({
        where: { id, tenantId },
        include: {
          versions: { orderBy: { version: 'desc' }, take: 1 },
        },
      });
    });
  }

  async publish(tenantId: string, id: string) {
    const workflow = await this.findOne(tenantId, id);
    if (workflow.status === 'ARCHIVED') {
      throw new BadRequestException({
        code: 'WORKFLOW_ARCHIVED',
        message: 'Cannot publish archived workflow',
      });
    }

    const latest = workflow.versions[0];
    const nextVersion = (latest?.version ?? 0) + 1;

    return this.prisma.$transaction(async (tx) => {
      const version = await tx.workflowVersion.create({
        data: {
          workflowId: id,
          tenantId,
          version: nextVersion,
          definition: (latest?.definition as object) ?? { nodes: [], edges: [] },
          publishedAt: new Date(),
        },
      });
      const updated = await tx.workflow.update({
        where: { id },
        data: { status: 'PUBLISHED' },
        include: { versions: { orderBy: { version: 'desc' }, take: 3 } },
      });
      return { workflow: updated, publishedVersion: version };
    });
  }

  async remove(tenantId: string, id: string) {
    await this.findOne(tenantId, id);
    await this.prisma.workflow.delete({ where: { id } });
    return { deleted: true };
  }
}
