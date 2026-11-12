import { Injectable, Logger } from '@nestjs/common';
import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Job } from 'bullmq';
import { QUEUE_NAMES } from '../queue/queue.module';
import { IntegrationService, PncpSyncOptions } from './integration.service';

@Injectable()
@Processor(QUEUE_NAMES.BIDDING_INGEST, { concurrency: 1 })
export class BiddingIngestionProcessor extends WorkerHost {
  private readonly logger = new Logger(BiddingIngestionProcessor.name);

  constructor(private readonly integrationService: IntegrationService) {
    super();
  }

  async process(job: Job<PncpSyncOptions>): Promise<unknown> {
    this.logger.log(`Running ${job.name} ingestion job ${job.id}.`);
    let result;
    switch (job.name) {
      case 'sync-pncp':
        result = await this.integrationService.syncPncpBiddings({ ...job.data, runType: 'queued' });
        break;
      case 'sync-compras-gov':
        result = await this.integrationService.syncComprasGovBiddings({ ...job.data, runType: 'queued' });
        break;
      case 'sync-petronect-open':
        result = await this.integrationService.syncPetronectOpportunities('open');
        break;
      case 'sync-petronect-closed':
        result = await this.integrationService.syncPetronectOpportunities('closed');
        break;
      default:
        throw new Error(`Unsupported ingestion job: ${job.name}`);
    }
    if (result.status === 'failed') {
      throw new Error(result.errors.join('; ') || `${job.name} sync failed.`);
    }
    return result;
  }
}
