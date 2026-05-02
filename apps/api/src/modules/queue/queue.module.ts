import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { ConfigService } from '@nestjs/config';

export const QUEUE_NAMES = {
  MATCHING: 'matching',
  REPORTS: 'reports',
  NOTIFICATIONS: 'notifications',
  CAPAG_SYNC: 'capag-sync',
  BIDDING_INGEST: 'bidding-ingest',
  ANALYSIS: 'analysis',
} as const;

@Module({
  imports: [
    BullModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => ({
        connection: {
          host: configService.get<string>('REDIS_HOST', 'localhost'),
          port: configService.get<number>('REDIS_PORT', 6379),
          password: configService.get<string>('REDIS_PASSWORD') || undefined,
        },
      }),
    }),
    BullModule.registerQueue(
      { name: QUEUE_NAMES.MATCHING },
      { name: QUEUE_NAMES.REPORTS },
      { name: QUEUE_NAMES.NOTIFICATIONS },
      { name: QUEUE_NAMES.CAPAG_SYNC },
      { name: QUEUE_NAMES.BIDDING_INGEST },
      { name: QUEUE_NAMES.ANALYSIS },
    ),
  ],
  exports: [BullModule],
})
export class QueueModule {}
