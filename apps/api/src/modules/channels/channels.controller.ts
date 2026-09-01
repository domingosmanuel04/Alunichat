import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ApiBearerAuth, ApiBody, ApiConsumes, ApiOperation, ApiTags } from '@nestjs/swagger';
import { ChannelsService } from './channels.service';
import {
  CheckWhatsAppNumberDto,
  ConnectChannelDto,
  CreateChannelDto,
  ScheduleWhatsAppMessageDto,
  SendWhatsAppMediaDto,
  SendWhatsAppTextDto,
  UpdateChannelDto,
} from './dto/channel.dto';
import { TenantId } from '../../common/decorators/tenant.decorator';
import {
  CurrentUser,
  JwtPayload,
} from '../../common/decorators/current-user.decorator';
import { RequirePermissions } from '../../common/decorators/permissions.decorator';

type UploadedMediaFile = {
  buffer: Buffer;
  mimetype?: string;
  originalname?: string;
  size?: number;
};
@ApiTags('channels')
@ApiBearerAuth()
@Controller('channels')
export class ChannelsController {
  constructor(private readonly channels: ChannelsService) {}

  @Get()
  @RequirePermissions('channels.manage')
  @ApiOperation({ summary: 'List channels' })
  findAll(@TenantId() tenantId: string) {
    return this.channels.findAll(tenantId);
  }

  @Get('scheduled-messages')
  @RequirePermissions('channels.manage')
  @ApiOperation({ summary: 'List scheduled WhatsApp messages' })
  listScheduled(
    @TenantId() tenantId: string,
    @Query('channelId') channelId?: string,
    @Query('status') status?: string,
  ) {
    return this.channels.listScheduledMessages(tenantId, { channelId, status });
  }

  @Delete('scheduled-messages/:messageId')
  @RequirePermissions('channels.manage')
  @ApiOperation({ summary: 'Cancel a pending scheduled WhatsApp message' })
  cancelScheduled(
    @TenantId() tenantId: string,
    @Param('messageId') messageId: string,
    @CurrentUser() user: JwtPayload,
  ) {
    return this.channels.cancelScheduledMessage(tenantId, messageId, user.sub);
  }

  @Get(':id')
  @RequirePermissions('channels.manage')
  findOne(@TenantId() tenantId: string, @Param('id') id: string) {
    return this.channels.findOne(tenantId, id);
  }

  @Get(':id/health')
  @RequirePermissions('channels.manage')
  @ApiOperation({ summary: 'Channel health / uptime hints' })
  getHealth(@TenantId() tenantId: string, @Param('id') id: string) {
    return this.channels.getHealth(tenantId, id);
  }

  @Post()
  @RequirePermissions('channels.manage')
  create(
    @TenantId() tenantId: string,
    @Body() dto: CreateChannelDto,
    @CurrentUser() user: JwtPayload,
  ) {
    return this.channels.create(tenantId, dto, user.sub);
  }

  @Patch(':id')
  @RequirePermissions('channels.manage')
  update(
    @TenantId() tenantId: string,
    @Param('id') id: string,
    @Body() dto: UpdateChannelDto,
    @CurrentUser() user: JwtPayload,
  ) {
    return this.channels.update(tenantId, id, dto, user.sub);
  }

  @Delete(':id')
  @RequirePermissions('channels.manage')
  remove(
    @TenantId() tenantId: string,
    @Param('id') id: string,
    @CurrentUser() user: JwtPayload,
  ) {
    return this.channels.remove(tenantId, id, user.sub);
  }

  @Post(':id/connect')
  @RequirePermissions('channels.manage')
  @ApiOperation({ summary: 'Connect channel via adapter / QR' })
  connect(
    @TenantId() tenantId: string,
    @Param('id') id: string,
    @Body() dto: ConnectChannelDto,
    @CurrentUser() user: JwtPayload,
  ) {
    return this.channels.connect(tenantId, id, dto, user.sub);
  }

  @Get(':id/session')
  @RequirePermissions('channels.manage')
  @ApiOperation({ summary: 'Get WhatsApp session/QR status' })
  getSession(@TenantId() tenantId: string, @Param('id') id: string) {
    return this.channels.getSession(tenantId, id);
  }

  @Post(':id/disconnect')
  @RequirePermissions('channels.manage')
  @ApiOperation({ summary: 'Disconnect channel instance' })
  disconnect(
    @TenantId() tenantId: string,
    @Param('id') id: string,
    @CurrentUser() user: JwtPayload,
  ) {
    return this.channels.disconnect(tenantId, id, user.sub);
  }

  @Post(':id/messages/text')
  @RequirePermissions('channels.manage')
  @ApiOperation({ summary: 'Send WhatsApp text message (playground)' })
  sendText(
    @TenantId() tenantId: string,
    @Param('id') id: string,
    @Body() dto: SendWhatsAppTextDto,
    @CurrentUser() user: JwtPayload,
  ) {
    return this.channels.sendText(tenantId, id, dto, user.sub);
  }

  @Post(':id/messages/schedule')
  @RequirePermissions('channels.manage')
  @ApiOperation({ summary: 'Schedule a WhatsApp message (text or media URL)' })
  scheduleMessage(
    @TenantId() tenantId: string,
    @Param('id') id: string,
    @Body() dto: ScheduleWhatsAppMessageDto,
    @CurrentUser() user: JwtPayload,
  ) {
    return this.channels.scheduleMessage(tenantId, id, dto, user.sub);
  }

  @Post(':id/messages/schedule/upload')
  @RequirePermissions('channels.manage')
  @ApiOperation({ summary: 'Schedule a WhatsApp media message with file upload' })
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      required: ['file', 'to', 'scheduledAt', 'messageType'],
      properties: {
        file: { type: 'string', format: 'binary' },
        to: { type: 'string' },
        scheduledAt: { type: 'string' },
        messageType: {
          type: 'string',
          enum: ['image', 'audio', 'document'],
        },
        message: { type: 'string' },
        caption: { type: 'string' },
        fileName: { type: 'string' },
        ptt: { type: 'string' },
      },
    },
  })
  @UseInterceptors(
    FileInterceptor('file', {
      limits: { fileSize: 16 * 1024 * 1024 },
    }),
  )
  scheduleMessageUpload(
    @TenantId() tenantId: string,
    @Param('id') id: string,
    @UploadedFile() file: UploadedMediaFile,
    @Body()
    body: {
      to: string;
      scheduledAt: string;
      messageType?: 'image' | 'audio' | 'document';
      message?: string;
      caption?: string;
      fileName?: string;
      ptt?: string;
    },
    @CurrentUser() user: JwtPayload,
  ) {
    return this.channels.scheduleMessage(
      tenantId,
      id,
      {
        to: body.to,
        scheduledAt: body.scheduledAt,
        messageType: body.messageType || 'image',
        message: body.message || body.caption,
        caption: body.caption || body.message,
        fileName: body.fileName,
        ptt: body.ptt,
      },
      user.sub,
      file,
    );
  }

  @Post(':id/messages/media')
  @RequirePermissions('channels.manage')
  @ApiOperation({ summary: 'Send WhatsApp media message (playground)' })
  sendMedia(
    @TenantId() tenantId: string,
    @Param('id') id: string,
    @Body() dto: SendWhatsAppMediaDto,
    @CurrentUser() user: JwtPayload,
  ) {
    return this.channels.sendMedia(tenantId, id, dto, user.sub);
  }

  @Post(':id/messages/media/upload')
  @RequirePermissions('channels.manage')
  @ApiOperation({ summary: 'Upload and send WhatsApp media (playground)' })
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      required: ['file', 'to', 'mediaType'],
      properties: {
        file: { type: 'string', format: 'binary' },
        to: { type: 'string' },
        mediaType: { type: 'string', enum: ['image', 'audio', 'document'] },
        caption: { type: 'string' },
        fileName: { type: 'string' },
        ptt: { type: 'string', description: 'true for voice note' },
      },
    },
  })
  @UseInterceptors(
    FileInterceptor('file', {
      limits: { fileSize: 16 * 1024 * 1024 },
    }),
  )
  sendMediaUpload(
    @TenantId() tenantId: string,
    @Param('id') id: string,
    @UploadedFile() file: UploadedMediaFile,
    @Body()
    body: {
      to: string;
      caption?: string;
      mediaType?: 'image' | 'audio' | 'document';
      fileName?: string;
      ptt?: string;
    },
    @CurrentUser() user: JwtPayload,
  ) {
    return this.channels.sendMediaUpload(
      tenantId,
      id,
      file,
      body,
      user.sub,
    );
  }

  @Post(':id/check-number')
  @RequirePermissions('channels.manage')
  @ApiOperation({ summary: 'Check if number exists on WhatsApp' })
  checkNumber(
    @TenantId() tenantId: string,
    @Param('id') id: string,
    @Body() dto: CheckWhatsAppNumberDto,
  ) {
    return this.channels.checkNumber(tenantId, id, dto);
  }

  @Post(':id/sync-chats')
  @RequirePermissions('channels.manage')
  @ApiOperation({ summary: 'Sync WhatsApp chats and groups into conversations' })
  syncChats(
    @TenantId() tenantId: string,
    @Param('id') id: string,
    @CurrentUser() user: JwtPayload,
  ) {
    return this.channels.syncChats(tenantId, id, user.sub);
  }
}
