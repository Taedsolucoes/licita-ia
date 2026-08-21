import { InjectQueue } from '@nestjs/bullmq';
import { Injectable, Logger, OnApplicationBootstrap } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Queue } from 'bullmq';
import { IntegrationService } from './integration.service';
import { QUEUE_NAMES } from '../queue/queue.module';

const PUBLIC_SOURCE_SCHEDULER_ID = 'public-source-sync';
const PUBLIC_SOURCE_JOB_NAME = 'sync-public-sources';

/**
 * Registers the recurring official-source sync in BullMQ/Redis.
 * The queue scheduler, not an in-process timer, owns recurrence. This keeps
 * the cadence across API restarts and allows the worker to retry failures.
 */
@Injectable()
export class IntegrationScheduler implements OnApplicationBootstrap {
  private readonly logger = new Logger(IntegrationScheduler.name);
  private readonly intervalMs: number;
  private readonly syncEnabled: boolean;

  constructor(
    private readonly integrationService: IntegrationService,
    private readonly configService: ConfigService,
    @InjectQueue(QUEUE_NAMES.BIDDING_INGEST)
    private readonly biddingIngestQueue: Queue,
  ) {
    this.intervalMs = Math.max(
      60_000,
      this.configService.get<number>('SYNC_INTERVAL_MS', 30 * 60 * 1000),
    );
    this.syncEnabled = this.configService.get<string>('PUBLIC_SOURCES_SYNC_ENABLED', 'false') === 'true';
  }

  async onApplicationBootstrap(): Promise<void> {
    if (!this.syncEnabled) {
      try {
        const removed = await this.biddingIngestQueue.removeJobScheduler(PUBLIC_SOURCE_SCHEDULER_ID);
        this.logger.log(
          removed
            ? 'Automatic bidding sync disabled and persisted scheduler removed.'
            : 'Automatic bidding sync disabled; no persisted scheduler was found.',
        );
      } catch (error) {
        this.logger.warn(
          `Automatic bidding sync disabled, but persisted scheduler cleanup failed: ${error instanceof Error ? error.message : String(error)}`,
        );
      }
      return;
    }

    try {
      const nextJob = await this.biddingIngestQueue.upsertJobScheduler(
        PUBLIC_SOURCE_SCHEDULER_ID,
        { every: this.intervalMs },
        {
          name: PUBLIC_SOURCE_JOB_NAME,
          data: { runType: 'scheduled' },
          opts: {
            attempts: 3,
            backoff: { type: 'exponential', delay: 10_000 },
            removeOnComplete: { count: 100 },
            removeOnFail: { count: 100 },
          },
        },
      );

      this.logger.log(
        `Official-source scheduler registered: every=${this.intervalMs}ms nextJob=${nextJob.id ?? 'unknown'}`,
      );
    } catch (error) {
      this.logger.error(
        `Could not register official-source scheduler: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }

  /** Manual entrypoint retained for operational probes and unit tests. */
  async runNow(runType = 'manual'): Promise<void> {
    const result = await this.integrationService.syncBiddings(runType);
    this.logger.log(
      `Sync complete: read=${result.recordsRead} created=${result.recordsCreated} updated=${result.recordsUpdated} status=${result.status}`,
    );
    if (result.errors.length > 0) {
      this.logger.warn(`Sync had ${result.errors.length} error(s): ${result.errors[0]}`);
    }
  }
}
