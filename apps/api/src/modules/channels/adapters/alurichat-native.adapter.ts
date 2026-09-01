import { Logger } from '@nestjs/common';
import {
  ChannelAdapter,
  ChannelConnectResult,
  ChannelSendResult,
} from './channel-adapter.interface';

/**
 * Motor nativo Alurichat para instâncias WhatsApp.
 * Cria a sessão localmente; integrações externas (Cloud/Evolution) podem
 * ser vinculadas depois nas configurações da instância.
 */
export class AlurichatNativeWhatsAppAdapter implements ChannelAdapter {
  readonly provider = 'ALURICHAT';
  private readonly logger = new Logger(AlurichatNativeWhatsAppAdapter.name);

  async connect(
    channelId: string,
    config: Record<string, unknown>,
  ): Promise<ChannelConnectResult> {
    this.logger.log(`[ALURICHAT] Connecting native instance ${channelId}`);
    const phone =
      (typeof config.phoneNumber === 'string' && config.phoneNumber) ||
      `55${String(Date.now()).slice(-9)}`;

    return {
      status: 'CONNECTED',
      externalId: `aluri_${channelId}`,
      message: 'Instância nativa Alurichat conectada',
      sessionData: {
        engine: 'ALURICHAT',
        phoneNumber: phone,
        connectedAt: new Date().toISOString(),
        // Placeholder para futuro QR real (Evolution/Baileys/Cloud)
        qrCode: null,
      },
    };
  }

  async sendMessage(
    channelId: string,
    to: string,
    body: string,
    _config: Record<string, unknown>,
  ): Promise<ChannelSendResult> {
    this.logger.log(`[ALURICHAT] Send to ${to} via ${channelId}: ${body}`);
    return {
      externalId: `aluri_msg_${Date.now()}`,
      status: 'SENT',
    };
  }

  async disconnect(channelId: string): Promise<void> {
    this.logger.log(`[ALURICHAT] Disconnect native instance ${channelId}`);
  }
}
