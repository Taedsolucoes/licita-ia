import { Module } from '@nestjs/common';
import { QueueModule } from '../queue/queue.module';
import { IntegrationController } from './integration.controller';
import { IntegrationService } from './integration.service';
import { AlertaLicitacaoProvider } from './providers/alerta-licitacao.provider';
import { BIDDING_SOURCE_PROVIDER } from './providers/bidding-source.provider';

@Module({
  imports: [QueueModule],
  controllers: [IntegrationController],
  providers: [
    IntegrationService,
    AlertaLicitacaoProvider,
    {
      provide: BIDDING_SOURCE_PROVIDER,
      useExisting: AlertaLicitacaoProvider,
    },
  ],
  exports: [IntegrationService],
})
export class IntegrationModule {}
