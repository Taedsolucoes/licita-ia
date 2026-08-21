import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { QueueModule } from '../queue/queue.module';
import { IntegrationController } from './integration.controller';
import { IntegrationService } from './integration.service';
import { IntegrationScheduler } from './integration.scheduler';

@Module({
  imports: [QueueModule, ConfigModule],
  controllers: [IntegrationController],
  providers: [
    IntegrationService,
    IntegrationScheduler,
  ],
  exports: [IntegrationService],
})
export class IntegrationModule {}
