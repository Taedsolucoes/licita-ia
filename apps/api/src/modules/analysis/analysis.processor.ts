import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import { Job } from 'bullmq';
import { QUEUE_NAMES } from '../queue/queue.module';
import { AnalysisService } from './analysis.service';

interface AnalysisJobData {
  biddingId: string;
}

@Processor(QUEUE_NAMES.ANALYSIS)
export class AnalysisProcessor extends WorkerHost {
  private readonly logger = new Logger(AnalysisProcessor.name);

  constructor(private analysisService: AnalysisService) {
    super();
  }

  async process(job: Job<AnalysisJobData>): Promise<void> {
    const { biddingId } = job.data;
    this.logger.log(`Processing analysis job ${job.id} for bidding ${biddingId}`);
    await this.analysisService.analyzeEdital(biddingId);
    this.logger.log(`Analysis job ${job.id} completed for bidding ${biddingId}`);
  }
}
