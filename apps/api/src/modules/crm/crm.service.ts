import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { PrismaService } from '../../infrastructure/prisma/prisma.service';
import { DomainEvents } from '../../infrastructure/events/domain-events';
import {
  CreateCompanyDto,
  CreateDealDto,
  CreateLeadDto,
  CreatePipelineDto,
  CreateStageDto,
  MoveDealStageDto,
  UpdateDealDto,
} from './dto/crm.dto';

@Injectable()
export class CrmService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly events: EventEmitter2,
  ) {}

  // Companies
  async listCompanies(tenantId: string) {
    return this.prisma.company.findMany({
      where: { tenantId },
      orderBy: { name: 'asc' },
    });
  }

  async createCompany(tenantId: string, dto: CreateCompanyDto) {
    return this.prisma.company.create({
      data: {
        tenantId,
        name: dto.name,
        taxId: dto.taxId,
        industry: dto.industry,
        website: dto.website,
        metadata: {},
      },
    });
  }

  // Leads
  async listLeads(tenantId: string) {
    return this.prisma.lead.findMany({
      where: { tenantId },
      include: { contact: true },
      orderBy: { updatedAt: 'desc' },
    });
  }

  async createLead(tenantId: string, dto: CreateLeadDto) {
    return this.prisma.lead.create({
      data: {
        tenantId,
        contactId: dto.contactId,
        source: dto.source,
        stage: dto.stage,
        value: dto.value,
        score: dto.score ?? 0,
        status: 'NEW',
      },
      include: { contact: true },
    });
  }

  // Pipelines
  async listPipelines(tenantId: string) {
    return this.prisma.pipeline.findMany({
      where: { tenantId },
      include: { stages: { orderBy: { position: 'asc' } } },
      orderBy: { createdAt: 'asc' },
    });
  }

  async createPipeline(tenantId: string, dto: CreatePipelineDto) {
    return this.prisma.pipeline.create({
      data: {
        tenantId,
        name: dto.name,
        isDefault: dto.isDefault ?? false,
        type: (dto.type as 'SALES') || 'SALES',
      },
      include: { stages: true },
    });
  }

  async createStage(tenantId: string, pipelineId: string, dto: CreateStageDto) {
    const pipeline = await this.prisma.pipeline.findFirst({
      where: { id: pipelineId, tenantId },
    });
    if (!pipeline) {
      throw new NotFoundException({
        code: 'PIPELINE_NOT_FOUND',
        message: 'Pipeline not found',
      });
    }
    return this.prisma.pipelineStage.create({
      data: {
        tenantId,
        pipelineId,
        name: dto.name,
        position: dto.position,
        color: dto.color,
        probability: dto.probability,
        isWon: dto.isWon ?? false,
        isLost: dto.isLost ?? false,
      },
    });
  }

  // Deals
  async listDeals(tenantId: string, pipelineId?: string) {
    return this.prisma.deal.findMany({
      where: {
        tenantId,
        ...(pipelineId ? { pipelineId } : {}),
      },
      include: {
        stage: true,
        contact: true,
        company: true,
      },
      orderBy: { updatedAt: 'desc' },
    });
  }

  async createDeal(tenantId: string, dto: CreateDealDto, ownerId?: string) {
    return this.prisma.deal.create({
      data: {
        tenantId,
        pipelineId: dto.pipelineId,
        stageId: dto.stageId,
        title: dto.title,
        value: dto.value ?? 0,
        currency: dto.currency ?? 'BRL',
        contactId: dto.contactId,
        companyId: dto.companyId,
        probability: dto.probability ?? 0,
        ownerId: dto.ownerId ?? ownerId,
        source: dto.source,
        status: 'OPEN',
      },
      include: { stage: true, contact: true },
    });
  }

  async updateDeal(tenantId: string, id: string, dto: UpdateDealDto) {
    const deal = await this.prisma.deal.findFirst({ where: { id, tenantId } });
    if (!deal) {
      throw new NotFoundException({
        code: 'DEAL_NOT_FOUND',
        message: 'Deal not found',
      });
    }
    return this.prisma.deal.update({
      where: { id },
      data: {
        title: dto.title,
        value: dto.value,
        currency: dto.currency,
        contactId: dto.contactId,
        companyId: dto.companyId,
        probability: dto.probability,
        ownerId: dto.ownerId,
        source: dto.source,
        status: dto.status,
        lostReason: dto.lostReason,
        stageId: dto.stageId,
        pipelineId: dto.pipelineId,
      },
      include: { stage: true },
    });
  }

  async findDeal(tenantId: string, id: string) {
    const deal = await this.prisma.deal.findFirst({
      where: { id, tenantId },
      include: { stage: true, contact: true, company: true, pipeline: true },
    });
    if (!deal) {
      throw new NotFoundException({
        code: 'DEAL_NOT_FOUND',
        message: 'Deal not found',
      });
    }
    return deal;
  }

  async moveStage(tenantId: string, id: string, dto: MoveDealStageDto) {
    const deal = await this.prisma.deal.findFirst({ where: { id, tenantId } });
    if (!deal) {
      throw new NotFoundException({
        code: 'DEAL_NOT_FOUND',
        message: 'Deal not found',
      });
    }
    const stage = await this.prisma.pipelineStage.findFirst({
      where: { id: dto.stageId, tenantId, pipelineId: deal.pipelineId },
    });
    if (!stage) {
      throw new BadRequestException({
        code: 'INVALID_STAGE',
        message: 'Stage not found in deal pipeline',
      });
    }

    const updated = await this.prisma.deal.update({
      where: { id },
      data: {
        stageId: dto.stageId,
        probability: stage.probability ?? deal.probability,
        status: stage.isWon ? 'WON' : stage.isLost ? 'LOST' : deal.status,
      },
      include: { stage: true },
    });

    this.events.emit(DomainEvents.DEAL_STAGE_CHANGED, {
      tenantId,
      dealId: id,
      fromStageId: deal.stageId,
      toStageId: dto.stageId,
    });
    this.events.emit(DomainEvents.WEBHOOK_DISPATCH, {
      tenantId,
      event: 'deal.stage_changed',
      payload: {
        dealId: id,
        fromStageId: deal.stageId,
        toStageId: dto.stageId,
      },
    });

    return updated;
  }

  async removeDeal(tenantId: string, id: string) {
    await this.findDeal(tenantId, id);
    await this.prisma.deal.delete({ where: { id } });
    return { deleted: true };
  }
}
