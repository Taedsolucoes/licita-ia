import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { QueueModule } from '../queue/queue.module';
import { IntegrationController } from './integration.controller';
import { IntegrationService } from './integration.service';
import { IntegrationScheduler } from './integration.scheduler';
import { BiddingIngestionProcessor } from './bidding-ingestion.processor';
import { AlertaLicitacaoProvider } from './providers/alerta-licitacao.provider';
import { PncpProvider } from './providers/pncp.provider';
import { ComprasGovProvider } from './providers/compras-gov.provider';
import { PetronectProvider } from './providers/petronect.provider';
import { BIDDING_SOURCE_PROVIDER } from './providers/bidding-source.provider';

@Module({
  imports: [QueueModule, ConfigModule],
  controllers: [IntegrationController],
  providers: [
    IntegrationService,
    IntegrationScheduler,
    BiddingIngestionProcessor,
    AlertaLicitacaoProvider,
    PncpProvider,
    ComprasGovProvider,
    PetronectProvider,
    {
      provide: BIDDING_SOURCE_PROVIDER,
      useExisting: AlertaLicitacaoProvider,
    },
  ],
  exports: [IntegrationService],
})
export class IntegrationModule {}
