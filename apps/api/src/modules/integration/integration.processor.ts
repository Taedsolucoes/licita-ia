import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import { Job } from 'bullmq';
import { QUEUE_NAMES } from '../queue/queue.module';
import { IntegrationService } from './integration.service';

interface IntegrationJobData {
  runType?: string;
}

@Processor(QUEUE_NAMES.BIDDING_INGEST)
export class IntegrationProcessor extends WorkerHost {
  private readonly logger = new Logger(IntegrationProcessor.name);

  constructor(private readonly integrationService: IntegrationService) {
    super();
  }

  async process(job: Job<IntegrationJobData>): Promise<void> {
    const runType = job.data.runType ?? 'scheduled';
    this.logger.log(`Processing official-source sync job ${job.id} runType=${runType}`);

    const result = await this.integrationService.syncBiddings(runType);
    if (result.status === 'failed') {
      throw new Error(result.errors.join('; ') || 'Official-source sync failed');
    }

    this.logger.log(
      `Official-source sync job ${job.id} completed: read=${result.recordsRead} created=${result.recordsCreated} updated=${result.recordsUpdated} status=${result.status}`,
    );
  }
}
