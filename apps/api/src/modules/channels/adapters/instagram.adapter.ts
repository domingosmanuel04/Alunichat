import { Logger } from '@nestjs/common';
import {
  ChannelAdapter,
  ChannelConnectResult,
  ChannelSendResult,
} from './channel-adapter.interface';

export class InstagramAdapter implements ChannelAdapter {
  readonly provider = 'INSTAGRAM';
  private readonly logger = new Logger(InstagramAdapter.name);

  async connect(
    channelId: string,
    _config: Record<string, unknown>,
  ): Promise<ChannelConnectResult> {
    this.logger.log(`[INSTAGRAM] Connecting channel ${channelId}`);
    return {
      status: 'CONNECTED',
      externalId: `ig_${channelId}`,
      message: 'Instagram channel connected (mock)',
    };
  }

  async sendMessage(
    channelId: string,
    to: string,
    body: string,
    _config: Record<string, unknown>,
  ): Promise<ChannelSendResult> {
    this.logger.log(`[INSTAGRAM] Send to ${to} via ${channelId}: ${body}`);
    return {
      externalId: `ig_msg_${Date.now()}`,
      status: 'SENT',
    };
  }

  async disconnect(channelId: string): Promise<void> {
    this.logger.log(`[INSTAGRAM] Disconnect channel ${channelId}`);
  }
}
