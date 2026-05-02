import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import { Job } from 'bullmq';
import { QUEUE_NAMES } from '../queue/queue.module';
import { ReportsService } from './reports.service';

interface ReportJobData {
  reportId: string;
  biddingId: string;
  tenantId: string;
  opportunityId?: string;
}

@Processor(QUEUE_NAMES.REPORTS)
export class ReportsProcessor extends WorkerHost {
  private readonly logger = new Logger(ReportsProcessor.name);

  constructor(private reportsService: ReportsService) {
    super();
  }

  async process(job: Job<ReportJobData>): Promise<void> {
    const { reportId, biddingId, tenantId, opportunityId } = job.data;

    this.logger.log(
      `Processing report job ${job.id}: reportId=${reportId} bidding=${biddingId} tenant=${tenantId}`,
    );

    await this.reportsService.generateReport(
      reportId,
      biddingId,
      tenantId,
      opportunityId,
    );

    this.logger.log(`Report job ${job.id} completed: reportId=${reportId}`);
  }
}
