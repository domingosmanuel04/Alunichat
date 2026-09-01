import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import * as fs from 'fs';
import * as path from 'path';
import { PrismaService } from '../../infrastructure/prisma/prisma.service';
import { EncryptionService } from '../../infrastructure/encryption/encryption.service';
import { ChannelAdapterFactory } from './adapters/channel-adapter.factory';
import {
  CheckWhatsAppNumberDto,
  ConnectChannelDto,
  CreateChannelDto,
  ScheduleWhatsAppMessageDto,
  SendWhatsAppMediaDto,
  SendWhatsAppTextDto,
  UpdateChannelDto,
} from './dto/channel.dto';
import { AuditService } from '../audit/audit.service';
import { WhatsAppSessionManager } from './whatsapp-session.manager';
import { ApiKeysService } from '../api-keys/api-keys.service';
import { PlanLimitsService } from '../billing/plan-limits.service';

type ScheduleMediaFile = {
  buffer: Buffer;
  mimetype?: string;
  originalname?: string;
  size?: number;
};

type MessageKind = 'text' | 'image' | 'audio' | 'document';

const KIND_TO_PRISMA: Record<MessageKind, 'TEXT' | 'IMAGE' | 'AUDIO' | 'DOCUMENT'> = {
  text: 'TEXT',
  image: 'IMAGE',
  audio: 'AUDIO',
  document: 'DOCUMENT',
};

@Injectable()
export class ChannelsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly encryption: EncryptionService,
    private readonly adapters: ChannelAdapterFactory,
    private readonly audit: AuditService,
    private readonly waSessions: WhatsAppSessionManager,
    private readonly apiKeys: ApiKeysService,
    private readonly planLimits: PlanLimitsService,
  ) {}

  private async assertTenant(tenantId: string) {
    if (!tenantId?.trim()) {
      throw new BadRequestException({
        code: 'TENANT_REQUIRED',
        message: 'Contexto de tenant ausente. Faça login com o slug da empresa (ex.: demo).',
      });
    }
    const tenant = await this.prisma.tenant.findUnique({
      where: { id: tenantId },
      select: { id: true, status: true },
    });
    if (!tenant) {
      throw new BadRequestException({
        code: 'TENANT_NOT_FOUND',
        message:
          'Tenant do token não existe mais. Saia e entre novamente com o tenant correto (ex.: demo).',
      });
    }
    if (tenant.status === 'SUSPENDED' || tenant.status === 'BLOCKED') {
      throw new BadRequestException({
        code: 'TENANT_SUSPENDED',
        message: 'Tenant suspenso ou bloqueado',
      });
    }
    return tenant;
  }

  async findAll(tenantId: string) {
    await this.assertTenant(tenantId);
    return this.prisma.channel.findMany({
      where: { tenantId },
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        name: true,
        type: true,
        provider: true,
        status: true,
        phoneNumber: true,
        externalId: true,
        config: true,
        qualityRating: true,
        createdAt: true,
        updatedAt: true,
      },
    });
  }

  async findOne(tenantId: string, id: string) {
    await this.assertTenant(tenantId);
    const channel = await this.prisma.channel.findFirst({
      where: { id, tenantId },
    });
    if (!channel) {
      throw new NotFoundException({
        code: 'CHANNEL_NOT_FOUND',
        message: 'Channel not found',
      });
    }
    const { credentialsEncrypted, ...safe } = channel;
    return { ...safe, hasCredentials: Boolean(credentialsEncrypted) };
  }

  async getHealth(tenantId: string, id: string) {
    const channel = await this.findOne(tenantId, id);
    const config =
      channel.config &&
      typeof channel.config === 'object' &&
      !Array.isArray(channel.config)
        ? (channel.config as Record<string, unknown>)
        : {};

    const connectedAt =
      typeof config.connectedAt === 'string'
        ? config.connectedAt
        : typeof config.lastConnectedAt === 'string'
          ? config.lastConnectedAt
          : null;
    const reconnects =
      typeof config.reconnects === 'number'
        ? config.reconnects
        : typeof config.reconnectCount === 'number'
          ? config.reconnectCount
          : 0;

    let uptimeSeconds: number | null = null;
    if (connectedAt && channel.status === 'CONNECTED') {
      const ts = Date.parse(connectedAt);
      if (!Number.isNaN(ts)) {
        uptimeSeconds = Math.max(0, Math.floor((Date.now() - ts) / 1000));
      }
    }

    return {
      status: channel.status,
      channelId: channel.id,
      name: channel.name,
      provider: channel.provider,
      uptimeHints: {
        connectedAt,
        uptimeSeconds,
      },
      reconnects,
      updatedAt: channel.updatedAt,
    };
  }

  async create(tenantId: string, dto: CreateChannelDto, actorUserId?: string) {
    await this.assertTenant(tenantId);
    if (dto.type === 'WHATSAPP') {
      await this.planLimits.assertCanCreateChannel(tenantId);
    }

    let workspaceId = dto.workspaceId ?? null;
    if (workspaceId) {
      const workspace = await this.prisma.workspace.findFirst({
        where: { id: workspaceId, tenantId },
        select: { id: true },
      });
      if (!workspace) {
        throw new BadRequestException({
          code: 'WORKSPACE_NOT_FOUND',
          message: 'Workspace inválido para este tenant',
        });
      }
    } else {
      const defaultWorkspace = await this.prisma.workspace.findFirst({
        where: { tenantId, isDefault: true },
        select: { id: true },
      });
      workspaceId = defaultWorkspace?.id ?? null;
    }

    const credentialsEncrypted = dto.credentials
      ? this.encryption.encrypt(JSON.stringify(dto.credentials))
      : null;

    const channel = await this.prisma.channel.create({
      data: {
        tenantId,
        name: dto.name,
        type: dto.type,
        provider: dto.provider,
        status: 'DISCONNECTED',
        phoneNumber: dto.phoneNumber,
        workspaceId,
        config: (dto.config as object) ?? {},
        credentialsEncrypted,
      },
    });

    await this.audit.log({
      tenantId,
      actorUserId,
      action: 'channel.create',
      resource: 'channel',
      resourceId: channel.id,
      after: { name: channel.name, provider: channel.provider },
    });

    const created = await this.findOne(tenantId, channel.id);

    // WhatsApp instances get a dedicated Bearer API key automatically
    if (String(dto.type).toUpperCase() === 'WHATSAPP') {
      try {
        const apiKey = await this.apiKeys.create(
          tenantId,
          {
            name: `Instância: ${channel.name}`,
            scopes: ['*', `channel:${channel.id}`],
          },
          actorUserId?.startsWith('apikey:') ? undefined : actorUserId,
        );
        return {
          ...created,
          apiKey: {
            id: apiKey.id,
            keyPrefix: apiKey.keyPrefix,
            rawKey: apiKey.rawKey,
            authorization: `Bearer ${apiKey.rawKey}`,
            warning: apiKey.warning,
          },
        };
      } catch {
        // Channel already created — return without key rather than failing the whole create
        return created;
      }
    }

    return created;
  }

  async update(
    tenantId: string,
    id: string,
    dto: UpdateChannelDto,
    actorUserId?: string,
  ) {
    await this.findOne(tenantId, id);
    const data: Record<string, unknown> = {
      name: dto.name,
      type: dto.type,
      provider: dto.provider,
      phoneNumber: dto.phoneNumber,
      workspaceId: dto.workspaceId,
      config: dto.config as object | undefined,
    };
    if (dto.credentials) {
      data.credentialsEncrypted = this.encryption.encrypt(
        JSON.stringify(dto.credentials),
      );
    }
    await this.prisma.channel.update({ where: { id }, data });
    await this.audit.log({
      tenantId,
      actorUserId,
      action: 'channel.update',
      resource: 'channel',
      resourceId: id,
    });
    return this.findOne(tenantId, id);
  }

  async remove(tenantId: string, id: string, actorUserId?: string) {
    await this.findOne(tenantId, id);
    await this.apiKeys.revokeByChannelScope(tenantId, id, actorUserId);
    await this.prisma.channel.delete({ where: { id } });
    await this.audit.log({
      tenantId,
      actorUserId,
      action: 'channel.delete',
      resource: 'channel',
      resourceId: id,
    });
    return { deleted: true };
  }

  async connect(
    tenantId: string,
    id: string,
    dto: ConnectChannelDto,
    actorUserId?: string,
  ) {
    const channel = await this.prisma.channel.findFirst({
      where: { id, tenantId },
    });
    if (!channel) {
      throw new NotFoundException({
        code: 'CHANNEL_NOT_FOUND',
        message: 'Channel not found',
      });
    }

    // Native Alurichat WhatsApp: real QR via Baileys
    if (channel.provider === 'ALURICHAT' || channel.provider === 'MOCK') {
      const session = await this.waSessions.startSession(tenantId, id);
      await this.audit.log({
        tenantId,
        actorUserId,
        action: 'channel.connect',
        resource: 'channel',
        resourceId: id,
        after: { status: session.status, engine: 'baileys' },
      });
      const fresh = await this.findOne(tenantId, id);
      return {
        ...fresh,
        status: session.status,
        qrCode: session.qrCode,
        phoneNumber: session.phoneNumber ?? fresh.phoneNumber,
        connectResult: {
          status: session.status,
          sessionData: { qrCode: session.qrCode, engine: 'baileys' },
          message:
            session.status === 'CONNECTED'
              ? 'WhatsApp conectado'
              : 'Escaneie o QR Code com o WhatsApp do celular',
        },
      };
    }

    const adapter = this.adapters.get(channel.provider);
    const config = {
      ...((channel.config as Record<string, unknown>) || {}),
      ...(dto.config || {}),
    };

    await this.prisma.channel.update({
      where: { id },
      data: { status: 'CONNECTING' },
    });

    const result = await adapter.connect(id, config);

    const updated = await this.prisma.channel.update({
      where: { id },
      data: {
        status: result.status === 'CONNECTED' ? 'CONNECTED' : result.status === 'CONNECTING' ? 'CONNECTING' : 'ERROR',
        externalId: result.externalId ?? channel.externalId,
        phoneNumber:
          (result.sessionData?.phoneNumber as string | undefined) ??
          channel.phoneNumber,
        config: {
          ...((channel.config as Record<string, unknown>) || {}),
          ...(result.sessionData || {}),
        } as object,
      },
    });

    if (result.sessionData) {
      await this.prisma.channelSession.create({
        data: {
          tenantId,
          channelId: id,
          status: result.status === 'ERROR' ? 'ERROR' : 'ACTIVE',
          qrCode: result.sessionData.qrCode as string | undefined,
          sessionData: result.sessionData as object,
        },
      });
    }

    await this.audit.log({
      tenantId,
      actorUserId,
      action: 'channel.connect',
      resource: 'channel',
      resourceId: id,
      after: { status: updated.status },
    });

    return {
      ...updated,
      qrCode: (result.sessionData?.qrCode as string | undefined) ?? null,
      connectResult: result,
      hasCredentials: Boolean(channel.credentialsEncrypted),
    };
  }

  async getSession(tenantId: string, id: string) {
    await this.findOne(tenantId, id);
    const live = this.waSessions.getState(id);
    if (live) return live;

    const channel = await this.prisma.channel.findFirst({
      where: { id, tenantId },
    });
    const latestSession = await this.prisma.channelSession.findFirst({
      where: { channelId: id, tenantId },
      orderBy: { createdAt: 'desc' },
    });

    return {
      channelId: id,
      tenantId,
      status: (channel?.status as 'CONNECTING' | 'CONNECTED' | 'DISCONNECTED' | 'ERROR') || 'DISCONNECTED',
      qrCode: latestSession?.qrCode ?? null,
      phoneNumber: channel?.phoneNumber ?? null,
      error: null,
      updatedAt: new Date().toISOString(),
    };
  }

  async disconnect(tenantId: string, id: string, actorUserId?: string) {
    const channel = await this.prisma.channel.findFirst({
      where: { id, tenantId },
    });
    if (!channel) {
      throw new NotFoundException({
        code: 'CHANNEL_NOT_FOUND',
        message: 'Channel not found',
      });
    }

    if (channel.provider === 'ALURICHAT' || channel.provider === 'MOCK') {
      await this.waSessions.stopSession(tenantId, id, true);
    } else {
      const adapter = this.adapters.get(channel.provider);
      await adapter.disconnect(id);
      await this.prisma.channel.update({
        where: { id },
        data: { status: 'DISCONNECTED' },
      });
      await this.prisma.channelSession.updateMany({
        where: { channelId: id, tenantId, status: 'ACTIVE' },
        data: { status: 'DISCONNECTED' },
      });
    }

    await this.audit.log({
      tenantId,
      actorUserId,
      action: 'channel.disconnect',
      resource: 'channel',
      resourceId: id,
      after: { status: 'DISCONNECTED' },
    });

    return this.findOne(tenantId, id);
  }

  private async assertNativeChannel(tenantId: string, id: string) {
    const channel = await this.findOne(tenantId, id);
    if (channel.provider !== 'ALURICHAT' && channel.provider !== 'MOCK') {
      throw new BadRequestException({
        code: 'CHANNEL_NOT_NATIVE',
        message: 'Playground disponível apenas para instâncias nativas Alurichat',
      });
    }
    return channel;
  }

  async sendText(
    tenantId: string,
    id: string,
    dto: SendWhatsAppTextDto,
    actorUserId?: string,
  ) {
    await this.assertNativeChannel(tenantId, id);
    try {
      const result = await this.waSessions.sendText(
        tenantId,
        id,
        dto.to,
        dto.message,
      );
      await this.audit.log({
        tenantId,
        actorUserId,
        action: 'channel.send_text',
        resource: 'channel',
        resourceId: id,
        after: { to: dto.to, externalId: result.externalId },
      });
      return result;
    } catch (err) {
      throw new BadRequestException({
        code: 'SEND_FAILED',
        message: err instanceof Error ? err.message : 'Falha ao enviar mensagem',
      });
    }
  }

  async sendMedia(
    tenantId: string,
    id: string,
    dto: SendWhatsAppMediaDto,
    actorUserId?: string,
  ) {
    await this.assertNativeChannel(tenantId, id);
    if (!dto.url?.trim()) {
      throw new BadRequestException({
        code: 'MEDIA_REQUIRED',
        message: 'Informe a URL do arquivo ou faça upload',
      });
    }
    try {
      const result = await this.waSessions.sendMedia(tenantId, id, dto.to, {
        url: dto.url,
        caption: dto.caption,
        mediaType: dto.mediaType,
        fileName: dto.fileName,
      });
      await this.audit.log({
        tenantId,
        actorUserId,
        action: 'channel.send_media',
        resource: 'channel',
        resourceId: id,
        after: {
          to: dto.to,
          mediaType: result.mediaType,
          externalId: result.externalId,
        },
      });
      return result;
    } catch (err) {
      throw new BadRequestException({
        code: 'SEND_FAILED',
        message: err instanceof Error ? err.message : 'Falha ao enviar mídia',
      });
    }
  }

  async sendMediaUpload(
    tenantId: string,
    id: string,
    file: {
      buffer: Buffer;
      mimetype?: string;
      originalname?: string;
      size?: number;
    },
    fields: {
      to: string;
      caption?: string;
      mediaType?: 'image' | 'audio' | 'document';
      fileName?: string;
      ptt?: boolean | string;
    },
    actorUserId?: string,
  ) {
    await this.assertNativeChannel(tenantId, id);
    if (!file?.buffer?.length) {
      throw new BadRequestException({
        code: 'FILE_REQUIRED',
        message: 'Arquivo obrigatório',
      });
    }
    if (!fields.to?.trim()) {
      throw new BadRequestException({
        code: 'TO_REQUIRED',
        message: 'Número do WhatsApp obrigatório',
      });
    }
    const mediaType = fields.mediaType || 'image';
    const ptt =
      fields.ptt === true || fields.ptt === 'true' || fields.ptt === '1';
    try {
      const result = await this.waSessions.sendMedia(tenantId, id, fields.to, {
        buffer: file.buffer,
        mimetype: file.mimetype,
        caption: fields.caption,
        mediaType,
        fileName: fields.fileName || file.originalname || 'arquivo',
        ptt,
      });
      await this.audit.log({
        tenantId,
        actorUserId,
        action: 'channel.send_media_upload',
        resource: 'channel',
        resourceId: id,
        after: {
          to: fields.to,
          mediaType: result.mediaType,
          externalId: result.externalId,
          bytes: file.size,
        },
      });
      return result;
    } catch (err) {
      throw new BadRequestException({
        code: 'SEND_FAILED',
        message: err instanceof Error ? err.message : 'Falha ao enviar mídia',
      });
    }
  }

  async checkNumber(
    tenantId: string,
    id: string,
    dto: CheckWhatsAppNumberDto,
  ) {
    await this.assertNativeChannel(tenantId, id);
    try {
      return await this.waSessions.checkNumber(tenantId, id, dto.number);
    } catch (err) {
      throw new BadRequestException({
        code: 'CHECK_FAILED',
        message: err instanceof Error ? err.message : 'Falha ao verificar número',
      });
    }
  }

  async syncChats(tenantId: string, id: string, actorUserId?: string) {
    await this.assertNativeChannel(tenantId, id);
    try {
      const result = await this.waSessions.syncChats(tenantId, id);
      await this.audit.log({
        tenantId,
        actorUserId,
        action: 'channel.sync_chats',
        resource: 'channel',
        resourceId: id,
        after: result,
      });
      return result;
    } catch (err) {
      throw new BadRequestException({
        code: 'SYNC_FAILED',
        message:
          err instanceof Error ? err.message : 'Falha ao sincronizar conversas',
      });
    }
  }

  async scheduleMessage(
    tenantId: string,
    id: string,
    dto: ScheduleWhatsAppMessageDto,
    actorUserId?: string,
    file?: ScheduleMediaFile,
  ) {
    await this.assertNativeChannel(tenantId, id);

    const when = new Date(dto.scheduledAt);
    if (Number.isNaN(when.getTime())) {
      throw new BadRequestException({
        code: 'INVALID_SCHEDULE',
        message: 'Data/hora inválida',
      });
    }
    if (when.getTime() <= Date.now() + 5_000) {
      throw new BadRequestException({
        code: 'SCHEDULE_IN_PAST',
        message: 'Escolha uma data/hora pelo menos 5 segundos no futuro',
      });
    }

    const digits = dto.to.replace(/\D/g, '');
    if (digits.length < 8) {
      throw new BadRequestException({
        code: 'INVALID_NUMBER',
        message: 'Número inválido',
      });
    }

    const kind = (dto.messageType || 'text') as MessageKind;
    if (!['text', 'image', 'audio', 'document'].includes(kind)) {
      throw new BadRequestException({
        code: 'INVALID_TYPE',
        message: 'Tipo de mensagem inválido',
      });
    }

    const caption = (dto.caption || dto.message || '').trim();
    const mediaUrl = dto.mediaUrl?.trim() || '';
    const hasFile = Boolean(file?.buffer?.length);

    if (kind === 'text') {
      if (!caption) {
        throw new BadRequestException({
          code: 'MESSAGE_REQUIRED',
          message: 'Digite a mensagem de texto',
        });
      }
    } else if (!hasFile && !mediaUrl) {
      throw new BadRequestException({
        code: 'MEDIA_REQUIRED',
        message: 'Envie um arquivo ou informe a URL da mídia',
      });
    }

    const jid = `${digits}@s.whatsapp.net`;
    const previewBody =
      kind === 'text'
        ? caption
        : caption ||
          `[${kind === 'image' ? 'Imagem' : kind === 'audio' ? 'Áudio' : 'Documento'}]`;

    const conversation = await this.waSessions.ensureChatConversation(
      tenantId,
      id,
      {
        jid,
        name: digits,
        isGroup: false,
        preview: `⏱ ${previewBody.slice(0, 80)}`,
        fetchAvatar: false,
      },
    );

    const message = await this.prisma.message.create({
      data: {
        tenantId,
        conversationId: conversation.id,
        direction: 'OUTBOUND',
        type: KIND_TO_PRISMA[kind],
        status: 'PENDING',
        body: caption || previewBody,
        senderUserId: actorUserId || null,
        isPrivate: false,
        payload: {
          scheduledAt: when.toISOString(),
          channelId: id,
          to: digits,
          messageType: kind,
          source: 'agendamentos',
          mediaUrl: mediaUrl || null,
          fileName: dto.fileName || file?.originalname || null,
          mimetype: dto.mimetype || file?.mimetype || null,
          ptt:
            dto.ptt === true ||
            dto.ptt === 'true' ||
            dto.ptt === '1' ||
            false,
        },
      },
    });

    let mediaPath: string | null = null;
    if (hasFile && file) {
      mediaPath = this.persistScheduledMedia(
        tenantId,
        message.id,
        file.buffer,
        file.originalname || dto.fileName || `${kind}.bin`,
      );
      const prev = (message.payload || {}) as Record<string, unknown>;
      const fileName =
        file.originalname ||
        dto.fileName ||
        (typeof prev.fileName === 'string' ? prev.fileName : null);
      const mimetype =
        file.mimetype ||
        dto.mimetype ||
        (typeof prev.mimetype === 'string' ? prev.mimetype : null);
      await this.prisma.message.update({
        where: { id: message.id },
        data: {
          payload: {
            ...prev,
            mediaPath,
            fileName,
            mimetype,
          } as object,
        },
      });
    }

    await this.prisma.conversation.update({
      where: { id: conversation.id },
      data: {
        lastMessageAt: new Date(),
        lastMessagePreview: `⏱ ${previewBody.slice(0, 200)}`,
      },
    });

    await this.audit.log({
      tenantId,
      actorUserId,
      action: 'channel.schedule_message',
      resource: 'message',
      resourceId: message.id,
      after: {
        channelId: id,
        to: digits,
        scheduledAt: when.toISOString(),
        messageType: kind,
      },
    });

    return {
      id: message.id,
      status: message.status,
      body: caption || previewBody,
      scheduledAt: when.toISOString(),
      to: digits,
      channelId: id,
      conversationId: conversation.id,
      messageType: kind,
      createdAt: message.createdAt,
      hasMedia: Boolean(mediaPath || mediaUrl),
    };
  }

  private scheduledMediaRoot() {
    return path.resolve(__dirname, '..', '..', '..', 'data', 'scheduled-media');
  }

  private persistScheduledMedia(
    tenantId: string,
    messageId: string,
    buffer: Buffer,
    fileName: string,
  ) {
    const safe = fileName.replace(/[^a-zA-Z0-9._-]/g, '_').slice(0, 120) || 'file.bin';
    const dir = path.join(this.scheduledMediaRoot(), tenantId, messageId);
    fs.mkdirSync(dir, { recursive: true });
    const full = path.join(dir, safe);
    fs.writeFileSync(full, buffer);
    return full;
  }

  private removeScheduledMedia(mediaPath: unknown) {
    if (typeof mediaPath !== 'string' || !mediaPath) return;
    try {
      if (fs.existsSync(mediaPath)) fs.unlinkSync(mediaPath);
      const dir = path.dirname(mediaPath);
      if (fs.existsSync(dir) && fs.readdirSync(dir).length === 0) {
        fs.rmdirSync(dir);
      }
    } catch {
      // ignore
    }
  }

  async listScheduledMessages(
    tenantId: string,
    opts?: { channelId?: string; status?: string },
  ) {
    const statusFilter = opts?.status?.toUpperCase();
    const messages = await this.prisma.message.findMany({
      where: {
        tenantId,
        direction: 'OUTBOUND',
        isPrivate: false,
        ...(statusFilter
          ? { status: statusFilter as 'PENDING' | 'SENT' | 'FAILED' }
          : { status: { in: ['PENDING', 'SENT', 'FAILED'] } }),
        ...(opts?.channelId
          ? { conversation: { channelId: opts.channelId } }
          : { conversation: { channel: { type: 'WHATSAPP' } } }),
      },
      orderBy: { createdAt: 'desc' },
      take: 200,
      include: {
        conversation: {
          include: {
            contact: true,
            channel: { select: { id: true, name: true, status: true } },
          },
        },
      },
    });

    const items = messages
      .map((msg) => {
        const payload = (msg.payload || {}) as Record<string, unknown>;
        const scheduledAt =
          typeof payload.scheduledAt === 'string' ? payload.scheduledAt : null;
        if (!scheduledAt) return null;
        const contact = msg.conversation?.contact;
        const channel = msg.conversation?.channel;
        const to =
          (typeof payload.to === 'string' && payload.to) ||
          contact?.phone?.replace(/@.*/, '') ||
          null;
        return {
          id: msg.id,
          body: msg.body,
          status: msg.status,
          scheduledAt,
          to,
          contactName: contact?.name || to,
          channelId: channel?.id || (payload.channelId as string) || null,
          channelName: channel?.name || null,
          conversationId: msg.conversationId,
          failedReason: msg.failedReason,
          sentAt: msg.sentAt,
          createdAt: msg.createdAt,
          messageType:
            (typeof payload.messageType === 'string' && payload.messageType) ||
            'text',
        };
      })
      .filter(Boolean)
      .sort((a, b) => {
        const ta = new Date(a!.scheduledAt).getTime();
        const tb = new Date(b!.scheduledAt).getTime();
        return ta - tb;
      });

    return { data: items, meta: { total: items.length } };
  }

  async cancelScheduledMessage(
    tenantId: string,
    messageId: string,
    actorUserId?: string,
  ) {
    const message = await this.prisma.message.findFirst({
      where: { id: messageId, tenantId, direction: 'OUTBOUND' },
    });
    if (!message) {
      throw new NotFoundException({
        code: 'MESSAGE_NOT_FOUND',
        message: 'Agendamento não encontrado',
      });
    }
    const payload = (message.payload || {}) as Record<string, unknown>;
    if (typeof payload.scheduledAt !== 'string') {
      throw new BadRequestException({
        code: 'NOT_SCHEDULED',
        message: 'Mensagem não é um agendamento',
      });
    }
    if (message.status !== 'PENDING') {
      throw new BadRequestException({
        code: 'NOT_PENDING',
        message: 'Só é possível cancelar agendamentos pendentes',
      });
    }

    const updated = await this.prisma.message.update({
      where: { id: messageId },
      data: {
        status: 'FAILED',
        failedReason: 'CANCELLED',
        payload: { ...payload, cancelledAt: new Date().toISOString() },
      },
    });

    this.removeScheduledMedia(payload.mediaPath);

    await this.audit.log({
      tenantId,
      actorUserId,
      action: 'channel.cancel_scheduled_message',
      resource: 'message',
      resourceId: messageId,
    });

    return {
      id: updated.id,
      status: 'CANCELLED',
      scheduledAt: payload.scheduledAt,
    };
  }
}
