import { Logger } from '@nestjs/common';
import {
  ChannelAdapter,
  ChannelConnectResult,
  ChannelSendResult,
} from './channel-adapter.interface';

export class MessengerAdapter implements ChannelAdapter {
  readonly provider = 'MESSENGER';
  private readonly logger = new Logger(MessengerAdapter.name);

  async connect(
    channelId: string,
    _config: Record<string, unknown>,
  ): Promise<ChannelConnectResult> {
    this.logger.log(`[MESSENGER] Connecting channel ${channelId}`);
    return {
      status: 'CONNECTED',
      externalId: `fb_${channelId}`,
      message: 'Messenger channel connected (mock)',
    };
  }

  async sendMessage(
    channelId: string,
    to: string,
    body: string,
    _config: Record<string, unknown>,
  ): Promise<ChannelSendResult> {
    this.logger.log(`[MESSENGER] Send to ${to} via ${channelId}: ${body}`);
    return {
      externalId: `fb_msg_${Date.now()}`,
      status: 'SENT',
    };
  }

  async disconnect(channelId: string): Promise<void> {
    this.logger.log(`[MESSENGER] Disconnect channel ${channelId}`);
  }
}
