import { Logger } from '@nestjs/common';
import {
  ChannelAdapter,
  ChannelConnectResult,
  ChannelSendResult,
} from './channel-adapter.interface';

/** Mock of WhatsApp Cloud API — logs instead of calling Meta. */
export class WhatsAppCloudAdapter implements ChannelAdapter {
  readonly provider = 'WHATSAPP_CLOUD';
  private readonly logger = new Logger(WhatsAppCloudAdapter.name);

  async connect(
    channelId: string,
    config: Record<string, unknown>,
  ): Promise<ChannelConnectResult> {
    this.logger.log(
      `[WA_CLOUD] Connect ${channelId} phoneNumberId=${config.phoneNumberId}`,
    );
    return {
      status: 'CONNECTED',
      externalId: String(config.phoneNumberId ?? channelId),
      message: 'WhatsApp Cloud (mock) connected',
    };
  }

  async sendMessage(
    channelId: string,
    to: string,
    body: string,
    config: Record<string, unknown>,
  ): Promise<ChannelSendResult> {
    this.logger.log(
      `[WA_CLOUD] POST messages channel=${channelId} to=${to} body=${body.slice(0, 80)} phoneNumberId=${config.phoneNumberId}`,
    );
    return {
      externalId: `wamid.mock.${Date.now()}`,
      status: 'SENT',
    };
  }

  async disconnect(channelId: string): Promise<void> {
    this.logger.log(`[WA_CLOUD] Disconnect ${channelId}`);
  }
}
