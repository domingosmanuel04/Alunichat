import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../infrastructure/prisma/prisma.service';
import { CreateCampaignDto, UpdateCampaignDto } from './dto/campaign.dto';

@Injectable()
export class CampaignsService {
  constructor(private readonly prisma: PrismaService) {}

  async findAll(tenantId: string) {
    return this.prisma.campaign.findMany({
      where: { tenantId },
      orderBy: { updatedAt: 'desc' },
      include: { _count: { select: { recipients: true } } },
    });
  }

  async findOne(tenantId: string, id: string) {
    const campaign = await this.prisma.campaign.findFirst({
      where: { id, tenantId },
      include: { recipients: { take: 50, include: { contact: true } } },
    });
    if (!campaign) {
      throw new NotFoundException({
        code: 'CAMPAIGN_NOT_FOUND',
        message: 'Campaign not found',
      });
    }
    return campaign;
  }

  async create(tenantId: string, dto: CreateCampaignDto) {
    return this.prisma.campaign.create({
      data: {
        tenantId,
        name: dto.name,
        type: (dto.type as 'BROADCAST') || 'BROADCAST',
        status: 'DRAFT',
        channelType: dto.channelType,
        audienceFilter: (dto.audienceFilter as object) ?? {},
        templateId: dto.templateId,
        scheduledAt: dto.scheduledAt ? new Date(dto.scheduledAt) : null,
        stats: {},
      },
    });
  }

  async update(tenantId: string, id: string, dto: UpdateCampaignDto) {
    await this.findOne(tenantId, id);
    return this.prisma.campaign.update({
      where: { id },
      data: {
        name: dto.name,
        type: dto.type as never,
        status: dto.status,
        channelType: dto.channelType,
        audienceFilter: dto.audienceFilter as object | undefined,
        templateId: dto.templateId,
        scheduledAt: dto.scheduledAt ? new Date(dto.scheduledAt) : undefined,
      },
    });
  }

  async remove(tenantId: string, id: string) {
    await this.findOne(tenantId, id);
    await this.prisma.campaign.delete({ where: { id } });
    return { deleted: true };
  }

  async launch(tenantId: string, id: string) {
    const campaign = await this.findOne(tenantId, id);
    const audience =
      campaign.audienceFilter &&
      typeof campaign.audienceFilter === 'object' &&
      !Array.isArray(campaign.audienceFilter)
        ? (campaign.audienceFilter as Record<string, unknown>)
        : {};

    const contactWhere: Record<string, unknown> = { tenantId };
    if (typeof audience.temperature === 'string') {
      contactWhere.temperature = audience.temperature;
    }
    if (typeof audience.source === 'string') {
      contactWhere.source = audience.source;
    }
    if (typeof audience.ownerId === 'string') {
      contactWhere.ownerId = audience.ownerId;
    }
    if (Array.isArray(audience.contactIds) && audience.contactIds.length) {
      contactWhere.id = { in: audience.contactIds as string[] };
    }

    const contacts = await this.prisma.contact.findMany({
      where: contactWhere,
      select: { id: true, consents: true, name: true },
    });

    await this.prisma.campaign.update({
      where: { id },
      data: { status: 'RUNNING', startedAt: new Date() },
    });

    let sent = 0;
    let skipped = 0;

    for (const contact of contacts) {
      const consents =
        contact.consents &&
        typeof contact.consents === 'object' &&
        !Array.isArray(contact.consents)
          ? (contact.consents as Record<string, unknown>)
          : {};
      const marketingOptOut = consents.marketing === false;

      if (marketingOptOut) {
        skipped += 1;
        await this.prisma.campaignRecipient.create({
          data: {
            campaignId: id,
            tenantId,
            contactId: contact.id,
            // Schema has no SKIPPED — UNSUBSCRIBED = marketing opt-out
            status: 'UNSUBSCRIBED',
            error: 'marketing_opt_out',
          },
        });
        continue;
      }

      sent += 1;
      await this.prisma.campaignRecipient.create({
        data: {
          campaignId: id,
          tenantId,
          contactId: contact.id,
          status: 'SENT',
          sentAt: new Date(),
        },
      });
    }

    const total = contacts.length;
    const stats = { sent, skipped, total };

    const updated = await this.prisma.campaign.update({
      where: { id },
      data: {
        status: 'COMPLETED',
        completedAt: new Date(),
        stats,
      },
      include: { _count: { select: { recipients: true } } },
    });

    return { ...updated, stats };
  }
}
