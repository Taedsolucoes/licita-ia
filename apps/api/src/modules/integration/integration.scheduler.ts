import { Injectable, Logger, OnApplicationBootstrap } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { IntegrationService } from './integration.service';

/**
 * Scheduler for bidding synchronization.
 * Disabled by default while the legacy Alerta Licitação provider is isolated.
 * Future official-source adapters must explicitly enable PUBLIC_SOURCES_SYNC_ENABLED.
 */
@Injectable()
export class IntegrationScheduler implements OnApplicationBootstrap {
  private readonly logger = new Logger(IntegrationScheduler.name);
  private readonly intervalMs: number;
  private readonly syncEnabled: boolean;
  private intervalHandle?: ReturnType<typeof setInterval>;

  constructor(
    private readonly integrationService: IntegrationService,
    private readonly configService: ConfigService,
  ) {
    // Default: 30 minutes. Override with SYNC_INTERVAL_MS env var.
    this.intervalMs = this.configService.get<number>('SYNC_INTERVAL_MS', 30 * 60 * 1000);
    this.syncEnabled = this.configService.get<string>('PUBLIC_SOURCES_SYNC_ENABLED', 'false') === 'true';
  }

  onApplicationBootstrap(): void {
    if (!this.syncEnabled) {
      this.logger.log(
        'Automatic bidding sync disabled. Enable PUBLIC_SOURCES_SYNC_ENABLED only after an official source adapter is registered.',
      );
      return;
    }

    this.logger.log(
      `Automatic public-source sync enabled. First run in 60s, then every ${this.intervalMs / 60_000} min.`,
    );

    // Initial sync after 60s to let the app finish bootstrapping
    const initialDelay = setTimeout(() => this.runSync('scheduled'), 60_000);
    // Keep reference clean for GC
    initialDelay.unref?.();

    // Repeating sync
    this.intervalHandle = setInterval(() => this.runSync('scheduled'), this.intervalMs);
    this.intervalHandle.unref?.();
  }

  private async runSync(runType: string): Promise<void> {
    this.logger.log(`Starting ${runType} bidding sync...`);
    try {
      const result = await this.integrationService.syncBiddings(runType);
      this.logger.log(
        `Sync complete: read=${result.recordsRead} created=${result.recordsCreated} updated=${result.recordsUpdated} status=${result.status}`,
      );
      if (result.errors.length > 0) {
        this.logger.warn(`Sync had ${result.errors.length} error(s): ${result.errors[0]}`);
      }
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error);
      this.logger.error(`Sync failed unexpectedly: ${msg}`);
    }
  }
}
