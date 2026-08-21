import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { QueueModule } from '../queue/queue.module';
import { IntegrationController } from './integration.controller';
import { IntegrationService } from './integration.service';
import { IntegrationScheduler } from './integration.scheduler';
import { PncpConsultaProvider } from './providers/pncp-consulta.provider';
import { ComprasPublicasProvider } from './providers/compras-publicas.provider';
import { BIDDING_SOURCE_PROVIDERS } from './providers/bidding-source.provider';

@Module({
  imports: [QueueModule, ConfigModule],
  controllers: [IntegrationController],
  providers: [
    IntegrationService,
    IntegrationScheduler,
    PncpConsultaProvider,
    ComprasPublicasProvider,
    {
      provide: BIDDING_SOURCE_PROVIDERS,
      useFactory: (
        pncpProvider: PncpConsultaProvider,
        comprasProvider: ComprasPublicasProvider,
      ) => [pncpProvider, comprasProvider],
      inject: [PncpConsultaProvider, ComprasPublicasProvider],
    },
  ],
  exports: [IntegrationService],
})
export class IntegrationModule {}
