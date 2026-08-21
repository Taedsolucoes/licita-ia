import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { QueueModule } from '../queue/queue.module';
import { IntegrationController } from './integration.controller';
import { IntegrationService } from './integration.service';
import { IntegrationScheduler } from './integration.scheduler';
import { PncpConsultaProvider } from './providers/pncp-consulta.provider';
import { BIDDING_SOURCE_PROVIDER } from './providers/bidding-source.provider';

@Module({
  imports: [QueueModule, ConfigModule],
  controllers: [IntegrationController],
  providers: [
    IntegrationService,
    IntegrationScheduler,
    PncpConsultaProvider,
    {
      provide: BIDDING_SOURCE_PROVIDER,
      useExisting: PncpConsultaProvider,
    },
  ],
  exports: [IntegrationService],
})
export class IntegrationModule {}
