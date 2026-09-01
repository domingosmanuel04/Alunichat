import { Logger } from '@nestjs/common';
import {
  ChannelAdapter,
  ChannelConnectResult,
  ChannelSendResult,
} from './channel-adapter.interface';

/** Mock Evolution API adapter. */
export class EvolutionAdapter implements ChannelAdapter {
  readonly provider = 'EVOLUTION';
  private readonly logger = new Logger(EvolutionAdapter.name);

  async connect(
    channelId: string,
    config: Record<string, unknown>,
  ): Promise<ChannelConnectResult> {
    this.logger.log(
      `[EVOLUTION] Connect ${channelId} instance=${config.instanceName}`,
    );
    return {
      status: 'CONNECTING',
      sessionData: { qrCode: 'data:image/png;base64,MOCK_QR_CODE' },
      message: 'Scan QR code (mock)',
    };
  }

  async sendMessage(
    channelId: string,
    to: string,
    body: string,
    _config: Record<string, unknown>,
  ): Promise<ChannelSendResult> {
    this.logger.log(`[EVOLUTION] Send ${channelId} -> ${to}: ${body.slice(0, 80)}`);
    return {
      externalId: `evo_${Date.now()}`,
      status: 'SENT',
    };
  }

  async disconnect(channelId: string): Promise<void> {
    this.logger.log(`[EVOLUTION] Disconnect ${channelId}`);
  }
}
