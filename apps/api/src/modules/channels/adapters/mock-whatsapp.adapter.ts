import { Logger } from '@nestjs/common';
import {
  ChannelAdapter,
  ChannelConnectResult,
  ChannelSendResult,
} from './channel-adapter.interface';

export class MockWhatsAppAdapter implements ChannelAdapter {
  readonly provider = 'MOCK';
  private readonly logger = new Logger(MockWhatsAppAdapter.name);

  async connect(
    channelId: string,
    _config: Record<string, unknown>,
  ): Promise<ChannelConnectResult> {
    this.logger.log(`[MOCK] Connecting channel ${channelId}`);
    return {
      status: 'CONNECTED',
      externalId: `mock_${channelId}`,
      message: 'Mock WhatsApp channel connected',
    };
  }

  async sendMessage(
    channelId: string,
    to: string,
    body: string,
    _config: Record<string, unknown>,
  ): Promise<ChannelSendResult> {
    this.logger.log(`[MOCK] Send to ${to} via ${channelId}: ${body}`);
    return {
      externalId: `mock_msg_${Date.now()}`,
      status: 'SENT',
    };
  }

  async disconnect(channelId: string): Promise<void> {
    this.logger.log(`[MOCK] Disconnect channel ${channelId}`);
  }
}
