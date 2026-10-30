import { Injectable, NotFoundException } from '@nestjs/common';
import { createHash, randomBytes } from 'crypto';
import { PrismaService } from '../../infrastructure/prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { CreateApiKeyDto } from './dto/api-key.dto';
import { jsonArrayIncludes } from '../../common/utils/json-array';

@Injectable()
export class ApiKeysService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  private hashKey(raw: string): string {
    return createHash('sha256').update(raw).digest('hex');
  }

  async findAll(tenantId: string) {
    return this.prisma.apiKey.findMany({
      where: { tenantId },
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        name: true,
        keyPrefix: true,
        scopes: true,
        expiresAt: true,
        lastUsedAt: true,
        ipAllowlist: true,
        revokedAt: true,
        createdAt: true,
      },
    });
  }

  async create(tenantId: string, dto: CreateApiKeyDto, actorUserId?: string) {
    const raw = `alc_${randomBytes(24).toString('hex')}`;
    const keyPrefix = raw.slice(0, 12);
    const keyHash = this.hashKey(raw);

    const apiKey = await this.prisma.apiKey.create({
      data: {
        tenantId,
        name: dto.name,
        keyPrefix,
        keyHash,
        scopes: dto.scopes,
        expiresAt: dto.expiresAt ? new Date(dto.expiresAt) : null,
        ipAllowlist: dto.ipAllowlist ?? [],
      },
    });

    await this.audit.log({
      tenantId,
      actorUserId,
      action: 'api_key.create',
      resource: 'api_key',
      resourceId: apiKey.id,
      after: { name: dto.name, scopes: dto.scopes },
    });

    return {
      id: apiKey.id,
      name: apiKey.name,
      keyPrefix: apiKey.keyPrefix,
      scopes: apiKey.scopes,
      expiresAt: apiKey.expiresAt,
      createdAt: apiKey.createdAt,
      rawKey: raw,
      warning: 'Store this key securely. It will not be shown again.',
    };
  }

  async revoke(tenantId: string, id: string, actorUserId?: string) {
    const existing = await this.prisma.apiKey.findFirst({
      where: { id, tenantId },
    });
    if (!existing) {
      throw new NotFoundException({
        code: 'API_KEY_NOT_FOUND',
        message: 'API key not found',
      });
    }
    const revoked = await this.prisma.apiKey.update({
      where: { id },
      data: { revokedAt: new Date() },
      select: {
        id: true,
        name: true,
        keyPrefix: true,
        revokedAt: true,
      },
    });
    await this.audit.log({
      tenantId,
      actorUserId,
      action: 'api_key.revoke',
      resource: 'api_key',
      resourceId: id,
    });
    return revoked;
  }

  async validateRawKey(raw: string) {
    const keyHash = this.hashKey(raw);
    return this.prisma.apiKey.findFirst({
      where: {
        keyHash,
        revokedAt: null,
        OR: [{ expiresAt: null }, { expiresAt: { gt: new Date() } }],
      },
    });
  }

  async touchLastUsed(id: string) {
    await this.prisma.apiKey.update({
      where: { id },
      data: { lastUsedAt: new Date() },
    });
  }

  async revokeByChannelScope(
    tenantId: string,
    channelId: string,
    actorUserId?: string,
  ) {
    const keys = (
      await this.prisma.apiKey.findMany({
        where: {
          tenantId,
          revokedAt: null,
        },
        select: { id: true, scopes: true },
      })
    ).filter((key) => jsonArrayIncludes(key.scopes, `channel:${channelId}`));
    for (const key of keys) {
      await this.revoke(tenantId, key.id, actorUserId);
    }
  }
}
