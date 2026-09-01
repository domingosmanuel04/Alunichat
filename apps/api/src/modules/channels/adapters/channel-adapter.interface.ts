export interface ChannelConnectResult {
  status: 'CONNECTED' | 'CONNECTING' | 'ERROR';
  externalId?: string;
  sessionData?: Record<string, unknown>;
  message?: string;
}

export interface ChannelSendResult {
  externalId: string;
  status: 'SENT' | 'QUEUED' | 'FAILED';
  error?: string;
}

export interface ChannelAdapter {
  readonly provider: string;
  connect(
    channelId: string,
    config: Record<string, unknown>,
  ): Promise<ChannelConnectResult>;
  sendMessage(
    channelId: string,
    to: string,
    body: string,
    config: Record<string, unknown>,
  ): Promise<ChannelSendResult>;
  disconnect(channelId: string): Promise<void>;
}
