import { Injectable } from '@nestjs/common';
import { execFile } from 'child_process';
import { promisify } from 'util';
import { existsSync, mkdirSync } from 'fs';
import { join } from 'path';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../../infrastructure/prisma/prisma.service';
import { RedisService } from '../../infrastructure/redis/redis.service';

const execFileAsync = promisify(execFile);

@Injectable()
export class OpsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly redis: RedisService,
    private readonly config: ConfigService,
  ) {}

  async prometheusMetrics() {
    const [
      tenants,
      messages,
      conversations,
      failedMessages,
      disconnectedChannels,
    ] = await Promise.all([
      this.prisma.tenant.count(),
      this.prisma.message.count(),
      this.prisma.conversation.count(),
      this.prisma.message.count({ where: { status: 'FAILED' } }),
      this.prisma.channel.count({
        where: { type: 'WHATSAPP', status: { in: ['DISCONNECTED', 'ERROR'] } },
      }),
    ]);
    const redisOk = (await this.redis.ping().catch(() => false)) ? 1 : 0;
    const lines = [
      '# HELP alurichat_tenants_total Total tenants',
      '# TYPE alurichat_tenants_total gauge',
      `alurichat_tenants_total ${tenants}`,
      '# HELP alurichat_messages_total Total messages',
      '# TYPE alurichat_messages_total gauge',
      `alurichat_messages_total ${messages}`,
      '# HELP alurichat_conversations_total Total conversations',
      '# TYPE alurichat_conversations_total gauge',
      `alurichat_conversations_total ${conversations}`,
      '# HELP alurichat_messages_failed Total failed messages',
      '# TYPE alurichat_messages_failed gauge',
      `alurichat_messages_failed ${failedMessages}`,
      '# HELP alurichat_whatsapp_disconnected Disconnected WhatsApp channels',
      '# TYPE alurichat_whatsapp_disconnected gauge',
      `alurichat_whatsapp_disconnected ${disconnectedChannels}`,
      '# HELP alurichat_redis_up Redis availability',
      '# TYPE alurichat_redis_up gauge',
      `alurichat_redis_up ${redisOk}`,
      '# HELP alurichat_process_uptime_seconds Process uptime',
      '# TYPE alurichat_process_uptime_seconds gauge',
      `alurichat_process_uptime_seconds ${process.uptime()}`,
    ];
    return lines.join('\n') + '\n';
  }

  async runBackup() {
    const dir = join(process.cwd(), 'backups');
    if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
    const stamp = new Date().toISOString().replace(/[:.]/g, '-');
    const file = join(dir, `alurichat-${stamp}.sql`);
    const databaseUrl =
      this.config.get<string>('DATABASE_URL') ||
      'postgresql://alurichat:alurichat@localhost:5437/alurichat';

    try {
      await execFileAsync(
        'pg_dump',
        ['--no-owner', '--no-acl', '--dbname', databaseUrl, '-f', file],
        { timeout: 120_000 },
      );
      return { ok: true, file, provider: 'pg_dump' as const };
    } catch (err) {
      // Fallback: JSON export of critical tables (no pg_dump)
      const [tenants, plans, subscriptions] = await Promise.all([
        this.prisma.tenant.findMany({ take: 500 }),
        this.prisma.plan.findMany(),
        this.prisma.subscription.findMany({ take: 500 }),
      ]);
      const jsonFile = join(dir, `alurichat-${stamp}.json`);
      const { writeFileSync } = await import('fs');
      writeFileSync(
        jsonFile,
        JSON.stringify(
          {
            generatedAt: new Date().toISOString(),
            tenants,
            plans,
            subscriptions,
            note: 'Fallback JSON backup (pg_dump unavailable)',
            error: err instanceof Error ? err.message : String(err),
          },
          null,
          2,
        ),
      );
      return { ok: true, file: jsonFile, provider: 'json_fallback' as const };
    }
  }
}
