import {
  ConnectedSocket,
  MessageBody,
  OnGatewayConnection,
  OnGatewayDisconnect,
  SubscribeMessage,
  WebSocketGateway,
  WebSocketServer,
} from '@nestjs/websockets';
import { Logger } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { OnEvent } from '@nestjs/event-emitter';
import { Server, Socket } from 'socket.io';
import { requiredSecret } from '../../common/config/required-secret';
import { DomainEvents, MessageSentEvent } from '../../infrastructure/events/domain-events';
import { JwtPayload } from '../../common/decorators/current-user.decorator';

type PresenceEntry = {
  userId: string;
  name: string;
  socketId: string;
};

@WebSocketGateway({
  cors: {
    origin: (process.env.CORS_ORIGIN || 'http://localhost:3000')
      .split(',')
      .map((o) => o.trim()),
    credentials: true,
  },
  namespace: '/realtime',
})
export class RealtimeGateway
  implements OnGatewayConnection, OnGatewayDisconnect
{
  private readonly logger = new Logger(RealtimeGateway.name);
  /** conversationId → presence set */
  private readonly presence = new Map<string, Set<PresenceEntry>>();

  @WebSocketServer()
  server!: Server;

  constructor(
    private readonly jwt: JwtService,
    private readonly config: ConfigService,
  ) {}

  async handleConnection(client: Socket) {
    try {
      const token =
        (client.handshake.auth?.token as string) ||
        (client.handshake.headers.authorization || '').replace('Bearer ', '');
      if (!token) {
        client.disconnect();
        return;
      }
      const payload = await this.jwt.verifyAsync<JwtPayload>(token, {
        secret: requiredSecret(
          this.config,
          'JWT_SECRET',
          'change-me-jwt-secret-min-32-chars-long!!',
        ),
      });
      client.data.user = payload;
      client.data.name =
        (client.handshake.auth?.name as string) ||
        payload.email ||
        payload.sub;
      if (payload.tenantId) {
        await client.join(`tenant:${payload.tenantId}`);
      }
      this.logger.debug(`Client connected ${client.id} user=${payload.sub}`);
    } catch {
      client.disconnect();
    }
  }

  handleDisconnect(client: Socket) {
    this.logger.debug(`Client disconnected ${client.id}`);
    this.removeSocketFromAllRooms(client);
  }

  private emitPresence(conversationId: string) {
    const room = this.presence.get(conversationId);
    const users = room
      ? Array.from(room).map(({ userId, name, socketId }) => ({
          userId,
          name,
          socketId,
        }))
      : [];
    this.server
      .to(`conversation:${conversationId}`)
      .emit('presence:update', { conversationId, users });
  }

  private removeSocketFromAllRooms(client: Socket) {
    for (const [conversationId, set] of this.presence.entries()) {
      let changed = false;
      for (const entry of Array.from(set)) {
        if (entry.socketId === client.id) {
          set.delete(entry);
          changed = true;
        }
      }
      if (set.size === 0) this.presence.delete(conversationId);
      if (changed) this.emitPresence(conversationId);
    }
  }

  @SubscribeMessage('conversation:join')
  async joinConversation(
    @ConnectedSocket() client: Socket,
    @MessageBody() body: { conversationId: string },
  ) {
    if (!body?.conversationId) return { ok: false };
    const user = client.data.user as JwtPayload | undefined;
    if (!user?.sub) return { ok: false };

    await client.join(`conversation:${body.conversationId}`);

    let set = this.presence.get(body.conversationId);
    if (!set) {
      set = new Set();
      this.presence.set(body.conversationId, set);
    }
    // Drop prior socket entries for same user in this room
    for (const entry of Array.from(set)) {
      if (entry.userId === user.sub || entry.socketId === client.id) {
        set.delete(entry);
      }
    }
    set.add({
      userId: user.sub,
      name: (client.data.name as string) || user.email || user.sub,
      socketId: client.id,
    });
    this.emitPresence(body.conversationId);

    return { ok: true, room: `conversation:${body.conversationId}` };
  }

  @SubscribeMessage('conversation:leave')
  async leaveConversation(
    @ConnectedSocket() client: Socket,
    @MessageBody() body: { conversationId: string },
  ) {
    if (!body?.conversationId) return { ok: false };
    await client.leave(`conversation:${body.conversationId}`);

    const set = this.presence.get(body.conversationId);
    if (set) {
      for (const entry of Array.from(set)) {
        if (entry.socketId === client.id) set.delete(entry);
      }
      if (set.size === 0) this.presence.delete(body.conversationId);
      this.emitPresence(body.conversationId);
    }

    return { ok: true };
  }

  @SubscribeMessage('presence:typing')
  typing(
    @ConnectedSocket() client: Socket,
    @MessageBody() body: { conversationId: string; typing?: boolean },
  ) {
    if (!body?.conversationId) return { ok: false };
    const user = client.data.user as JwtPayload | undefined;
    if (!user?.sub) return { ok: false };

    this.server.to(`conversation:${body.conversationId}`).emit('presence:typing', {
      conversationId: body.conversationId,
      userId: user.sub,
      name: (client.data.name as string) || user.email || user.sub,
      typing: body.typing !== false,
    });
    return { ok: true };
  }

  @OnEvent(DomainEvents.MESSAGE_SENT)
  onMessageSent(event: MessageSentEvent) {
    this.server
      .to(`conversation:${event.conversationId}`)
      .emit('message:new', event);
    this.server
      .to(`tenant:${event.tenantId}`)
      .emit('conversation:updated', {
        conversationId: event.conversationId,
        lastMessageId: event.messageId,
      });
  }

  @OnEvent(DomainEvents.MESSAGE_RECEIVED)
  onMessageReceived(event: MessageSentEvent) {
    this.server
      .to(`conversation:${event.conversationId}`)
      .emit('message:new', event);
    this.server.to(`tenant:${event.tenantId}`).emit('conversation:updated', {
      conversationId: event.conversationId,
      lastMessageId: event.messageId,
      inbound: true,
    });
    this.server.to(`tenant:${event.tenantId}`).emit('notification:message', {
      conversationId: event.conversationId,
      messageId: event.messageId,
      body: event.body,
    });
  }
}
