import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../infrastructure/prisma/prisma.service';
import {
  CreateDocumentDto,
  CreateKnowledgeBaseDto,
  UpdateKnowledgeBaseDto,
} from './dto/knowledge.dto';

@Injectable()
export class KnowledgeService {
  constructor(private readonly prisma: PrismaService) {}

  async findAll(tenantId: string) {
    return this.prisma.knowledgeBase.findMany({
      where: { tenantId },
      include: { _count: { select: { documents: true } } },
      orderBy: { name: 'asc' },
    });
  }

  async findOne(tenantId: string, id: string) {
    const kb = await this.prisma.knowledgeBase.findFirst({
      where: { id, tenantId },
      include: { documents: { orderBy: { createdAt: 'desc' } } },
    });
    if (!kb) {
      throw new NotFoundException({
        code: 'KNOWLEDGE_BASE_NOT_FOUND',
        message: 'Knowledge base not found',
      });
    }
    return kb;
  }

  async create(tenantId: string, dto: CreateKnowledgeBaseDto) {
    return this.prisma.knowledgeBase.create({
      data: {
        tenantId,
        name: dto.name,
        description: dto.description,
      },
    });
  }

  async update(tenantId: string, id: string, dto: UpdateKnowledgeBaseDto) {
    await this.findOne(tenantId, id);
    return this.prisma.knowledgeBase.update({
      where: { id },
      data: { name: dto.name, description: dto.description },
    });
  }

  async addDocument(tenantId: string, kbId: string, dto: CreateDocumentDto) {
    await this.findOne(tenantId, kbId);
    const doc = await this.prisma.knowledgeDocument.create({
      data: {
        tenantId,
        knowledgeBaseId: kbId,
        title: dto.title,
        sourceType: dto.sourceType,
        sourceUrl: dto.sourceUrl,
        status: 'READY',
        metadata: (dto.metadata as object) ?? {},
      },
    });
    if (dto.content) {
      const chunkSize = 800;
      const chunks: string[] = [];
      for (let i = 0; i < dto.content.length; i += chunkSize) {
        chunks.push(dto.content.slice(i, i + chunkSize));
      }
      await this.prisma.knowledgeChunk.createMany({
        data: chunks.map((content, chunkIndex) => ({
          tenantId,
          documentId: doc.id,
          content,
          chunkIndex,
          metadata: {},
        })),
      });
    }
    return this.prisma.knowledgeDocument.findUnique({
      where: { id: doc.id },
      include: { chunks: true },
    });
  }

  async remove(tenantId: string, id: string) {
    await this.findOne(tenantId, id);
    await this.prisma.knowledgeBase.delete({ where: { id } });
    return { deleted: true };
  }
}
