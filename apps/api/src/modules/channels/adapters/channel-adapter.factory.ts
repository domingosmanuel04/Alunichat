import { Injectable } from '@nestjs/common';
import { ChannelAdapter } from './channel-adapter.interface';
import { MockWhatsAppAdapter } from './mock-whatsapp.adapter';
import { WhatsAppCloudAdapter } from './whatsapp-cloud.adapter';
import { EvolutionAdapter } from './evolution.adapter';
import { AlurichatNativeWhatsAppAdapter } from './alurichat-native.adapter';
import { InstagramAdapter } from './instagram.adapter';
import { MessengerAdapter } from './messenger.adapter';

@Injectable()
export class ChannelAdapterFactory {
  private readonly adapters: Map<string, ChannelAdapter> = new Map();

  constructor() {
    const native = new AlurichatNativeWhatsAppAdapter();
    const mock = new MockWhatsAppAdapter();
    const cloud = new WhatsAppCloudAdapter();
    const evolution = new EvolutionAdapter();
    const instagram = new InstagramAdapter();
    const messenger = new MessengerAdapter();
    this.adapters.set(native.provider, native);
    this.adapters.set(mock.provider, mock);
    this.adapters.set(cloud.provider, cloud);
    this.adapters.set(evolution.provider, evolution);
    this.adapters.set(instagram.provider, instagram);
    this.adapters.set(messenger.provider, messenger);
    // Aliases for Meta provider enums
    this.adapters.set('META_INSTAGRAM', instagram);
    this.adapters.set('META_MESSENGER', messenger);
  }

  get(provider: string): ChannelAdapter {
    return this.adapters.get(provider) ?? this.adapters.get('ALURICHAT')!;
  }
}
