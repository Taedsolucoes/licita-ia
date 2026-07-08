import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { PrismaModule } from './modules/prisma/prisma.module';
import { RedisModule } from './modules/redis/redis.module';
import { QueueModule } from './modules/queue/queue.module';
import { AuthModule } from './modules/auth/auth.module';
import { HealthModule } from './modules/health/health.module';
import { IntegrationModule } from './modules/integration/integration.module';
import { MatchingModule } from './modules/matching/matching.module';
import { BiddingsModule } from './modules/biddings/biddings.module';
import { OpportunitiesModule } from './modules/opportunities/opportunities.module';
import { AdminModule } from './modules/admin/admin.module';
import { ParticipationModule } from './modules/participation/participation.module';
import { ReportsModule } from './modules/reports/reports.module';
import { CapagModule } from './modules/capag/capag.module';
import { NotificationsModule } from './modules/notifications/notifications.module';
import { AnalysisModule } from './modules/analysis/analysis.module';
import { DashboardModule } from './modules/dashboard/dashboard.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: '.env',
    }),
    PrismaModule,
    RedisModule,
    QueueModule,
    AuthModule,
    HealthModule,
    IntegrationModule,
    MatchingModule,
    BiddingsModule,
    OpportunitiesModule,
    AdminModule,
    ParticipationModule,
    ReportsModule,
    CapagModule,
    NotificationsModule,
    AnalysisModule,
    DashboardModule,
  ],
})
export class AppModule {}
