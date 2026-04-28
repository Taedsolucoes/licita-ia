import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import { Job } from 'bullmq';
import { QUEUE_NAMES } from '../queue/queue.module';
import {
  NotificationsService,
  OpportunityAlertJobData,
  ProposalSubmittedJobData,
} from './notifications.service';

type NotificationJobData = OpportunityAlertJobData | ProposalSubmittedJobData;

@Processor(QUEUE_NAMES.NOTIFICATIONS)
export class NotificationsProcessor extends WorkerHost {
  private readonly logger = new Logger(NotificationsProcessor.name);

  constructor(private notificationsService: NotificationsService) {
    super();
  }

  async process(job: Job<NotificationJobData>): Promise<void> {
    this.logger.log(`Processing notification job ${job.id} name=${job.name}`);

    if (job.name === 'opportunity-alert') {
      const data = job.data as OpportunityAlertJobData;
      await this.notificationsService.processNotification(data.opportunityId, data.tenantId);
    } else if (job.name === 'proposal-submitted') {
      const data = job.data as ProposalSubmittedJobData;
      await this.notificationsService.processProposalNotification(data);
    } else {
      this.logger.warn(`Unknown notification job name: ${job.name}`);
    }

    this.logger.log(`Notification job ${job.id} completed`);
  }
}
