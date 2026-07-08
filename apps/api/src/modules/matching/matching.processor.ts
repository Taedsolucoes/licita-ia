import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import { Job } from 'bullmq';
import { QUEUE_NAMES } from '../queue/queue.module';
import { MatchingService } from './matching.service';

interface MatchingJobData {
  biddingId: string;
}

@Processor(QUEUE_NAMES.MATCHING)
export class MatchingProcessor extends WorkerHost {
  private readonly logger = new Logger(MatchingProcessor.name);

  constructor(private matchingService: MatchingService) {
    super();
  }

  async process(job: Job<MatchingJobData>): Promise<void> {
    this.logger.log(`Processing matching job ${job.id} for bidding ${job.data.biddingId}`);
    await this.matchingService.matchBiddingForAllTenants(job.data.biddingId);
    this.logger.log(`Matching job ${job.id} completed`);
  }
}
