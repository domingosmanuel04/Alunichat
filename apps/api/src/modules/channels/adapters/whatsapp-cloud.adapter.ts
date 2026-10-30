import { Logger } from '@nestjs/common';
import {
  ChannelAdapter,
  ChannelConnectResult,
  ChannelSendResult,
} from './channel-adapter.interface';

type CloudConfig = {
  accessToken?: string;
  phoneNumberId?: string;
  apiVersion?: string;
  graphBaseUrl?: string;
};

/**
 * WhatsApp Cloud API (Meta Graph).
 * Channel `config` or env: WHATSAPP_API_TOKEN, phoneNumberId, WHATSAPP_API_URL.
 * Without a token, connect/send fail clearly (no silent mock success).
 */
export class WhatsAppCloudAdapter implements ChannelAdapter {
  readonly provider = 'WHATSAPP_CLOUD';
  private readonly logger = new Logger(WhatsAppCloudAdapter.name);

  private resolveConfig(config: Record<string, unknown>): Required<
    Pick<CloudConfig, 'accessToken' | 'phoneNumberId'>
  > &
    CloudConfig {
    const accessToken = String(
      config.accessToken ||
        config.token ||
        process.env.WHATSAPP_API_TOKEN ||
        '',
    ).trim();
    const phoneNumberId = String(
      config.phoneNumberId || config.phone_number_id || '',
    ).trim();
    const apiVersion = String(
      config.apiVersion || process.env.WHATSAPP_API_VERSION || 'v21.0',
    ).replace(/^\//, '');
    const graphBaseUrl = String(
      config.graphBaseUrl ||
        process.env.WHATSAPP_API_URL ||
        'https://graph.facebook.com',
    ).replace(/\/$/, '');

    return { accessToken, phoneNumberId, apiVersion, graphBaseUrl };
  }

  private messagesUrl(cfg: ReturnType<WhatsAppCloudAdapter['resolveConfig']>) {
    return `${cfg.graphBaseUrl}/${cfg.apiVersion}/${cfg.phoneNumberId}/messages`;
  }

  async connect(
    channelId: string,
    config: Record<string, unknown>,
  ): Promise<ChannelConnectResult> {
    const cfg = this.resolveConfig(config);
    if (!cfg.accessToken || !cfg.phoneNumberId) {
      return {
        status: 'ERROR',
        message:
          'WhatsApp Cloud: defina accessToken e phoneNumberId no canal (ou WHATSAPP_API_TOKEN + phoneNumberId)',
      };
    }

    try {
      const url = `${cfg.graphBaseUrl}/${cfg.apiVersion}/${cfg.phoneNumberId}`;
      const res = await fetch(url, {
        headers: { Authorization: `Bearer ${cfg.accessToken}` },
      });
      if (!res.ok) {
        const text = await res.text();
        this.logger.warn(
          `[WA_CLOUD] connect failed channel=${channelId} status=${res.status} ${text.slice(0, 200)}`,
        );
        return {
          status: 'ERROR',
          message: `WhatsApp Cloud connect failed (${res.status})`,
        };
      }
      this.logger.log(
        `[WA_CLOUD] Connected channel=${channelId} phoneNumberId=${cfg.phoneNumberId}`,
      );
      return {
        status: 'CONNECTED',
        externalId: cfg.phoneNumberId,
        message: 'WhatsApp Cloud connected',
      };
    } catch (err) {
      this.logger.error(
        `[WA_CLOUD] connect error channel=${channelId}`,
        err instanceof Error ? err.stack : String(err),
      );
      return {
        status: 'ERROR',
        message: err instanceof Error ? err.message : 'Cloud connect error',
      };
    }
  }

  async sendMessage(
    channelId: string,
    to: string,
    body: string,
    config: Record<string, unknown>,
  ): Promise<ChannelSendResult> {
    const cfg = this.resolveConfig(config);
    if (!cfg.accessToken || !cfg.phoneNumberId) {
      return {
        externalId: '',
        status: 'FAILED',
        error: 'Missing WhatsApp Cloud credentials',
      };
    }

    const toDigits = to.replace(/\D/g, '');
    try {
      const res = await fetch(this.messagesUrl(cfg), {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${cfg.accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          messaging_product: 'whatsapp',
          recipient_type: 'individual',
          to: toDigits,
          type: 'text',
          text: { preview_url: false, body },
        }),
      });
      const json = (await res.json().catch(() => ({}))) as {
        messages?: Array<{ id?: string }>;
        error?: { message?: string };
      };
      if (!res.ok) {
        const errMsg = json.error?.message || `HTTP ${res.status}`;
        this.logger.warn(
          `[WA_CLOUD] send failed channel=${channelId} to=${toDigits} ${errMsg}`,
        );
        return { externalId: '', status: 'FAILED', error: errMsg };
      }
      const wamid = json.messages?.[0]?.id || `wamid.${Date.now()}`;
      return { externalId: wamid, status: 'SENT' };
    } catch (err) {
      const message = err instanceof Error ? err.message : 'send failed';
      this.logger.error(`[WA_CLOUD] send error channel=${channelId}`, message);
      return { externalId: '', status: 'FAILED', error: message };
    }
  }

  async disconnect(channelId: string): Promise<void> {
    this.logger.log(`[WA_CLOUD] Disconnect ${channelId} (stateless Cloud API)`);
  }
}
