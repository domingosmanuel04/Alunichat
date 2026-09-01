import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { BullModule } from '@nestjs/bullmq';

export const WEBHOOK_QUEUE = 'webhooks';
export const NOTIFICATION_QUEUE = 'notifications';
export const AI_QUEUE = 'ai';
export const MAIL_QUEUE = 'mail';

@Module({
  imports: [
    BullModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        connection: {
          url: config.get<string>('REDIS_URL', 'redis://localhost:6379'),
        },
      }),
    }),
    BullModule.registerQueue(
      { name: WEBHOOK_QUEUE },
      { name: NOTIFICATION_QUEUE },
      { name: AI_QUEUE },
      { name: MAIL_QUEUE },
    ),
  ],
  exports: [BullModule],
})
export class QueuesModule {}
