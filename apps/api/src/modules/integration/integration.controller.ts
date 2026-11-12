import {
  Controller,
  Post,
  Get,
  UseGuards,
  HttpCode,
  HttpStatus,
  Query,
  Param,
  NotFoundException,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { IntegrationService, PncpSyncOptions } from './integration.service';
import { PncpSyncDto } from './dto/pncp-sync.dto';
import { QUEUE_NAMES } from '../queue/queue.module';

@Controller('internal/integrations')
@UseGuards(AuthGuard('jwt'), RolesGuard)
export class IntegrationController {
  constructor(
    private readonly integrationService: IntegrationService,
    @InjectQueue(QUEUE_NAMES.BIDDING_INGEST) private readonly ingestionQueue: Queue,
  ) {}

  @Post('alertalicitacao/sync')
  @Roles('taed_admin', 'taed_operator')
  @HttpCode(HttpStatus.OK)
  async syncAlertaLicitacao() {
    return this.integrationService.syncBiddings('manual');
  }

  @Get('alertalicitacao/health')
  @Roles('taed_admin', 'taed_operator')
  async healthCheck() {
    return this.integrationService.healthCheck();
  }

  /**
   * Queue a bounded PNCP date-window query. The queue keeps long-running
   * pagination and optional item hydration outside the HTTP request lifecycle.
   */
  @Post('pncp/sync')
  @Roles('taed_admin', 'taed_operator')
  @HttpCode(HttpStatus.ACCEPTED)
  async syncPncp(@Query() query: PncpSyncDto) {
    const job = await this.ingestionQueue.add('sync-pncp', query as PncpSyncOptions, {
      attempts: 3,
      backoff: { type: 'exponential', delay: 5_000 },
      removeOnComplete: 100,
      removeOnFail: 100,
    });
    return { jobId: job.id, status: 'queued' };
  }

  @Get('pncp/sync/:jobId')
  @Roles('taed_admin', 'taed_operator')
  async pncpSyncStatus(@Param('jobId') jobId: string) {
    const job = await this.ingestionQueue.getJob(jobId);
    if (!job) throw new NotFoundException(`PNCP ingestion job ${jobId} was not found.`);
    return {
      jobId: job.id,
      state: await job.getState(),
      progress: job.progress,
      result: job.returnvalue ?? null,
      failureReason: job.failedReason || null,
      attemptsMade: job.attemptsMade,
    };
  }

  @Get('pncp/health')
  @Roles('taed_admin', 'taed_operator')
  async pncpHealthCheck() {
    return this.integrationService.pncpHealthCheck();
  }

  @Post('compras-gov/sync')
  @Roles('taed_admin', 'taed_operator')
  @HttpCode(HttpStatus.ACCEPTED)
  async syncComprasGov(@Query() query: PncpSyncDto) {
    const job = await this.ingestionQueue.add('sync-compras-gov', query as PncpSyncOptions, {
      attempts: 3,
      backoff: { type: 'exponential', delay: 5_000 },
      removeOnComplete: 100,
      removeOnFail: 100,
    });
    return { jobId: job.id, status: 'queued' };
  }

  @Get('compras-gov/health')
  @Roles('taed_admin', 'taed_operator')
  async comprasGovHealthCheck() {
    return this.integrationService.comprasGovHealthCheck();
  }

  @Post('petronect/public/open/sync')
  @Roles('taed_admin', 'taed_operator')
  @HttpCode(HttpStatus.ACCEPTED)
  async syncPetronectOpen() {
    const job = await this.ingestionQueue.add('sync-petronect-open', {}, { attempts: 3, backoff: { type: 'exponential', delay: 5_000 }, removeOnComplete: 100, removeOnFail: 100 });
    return { jobId: job.id, status: 'queued' };
  }

  @Post('petronect/public/closed/sync')
  @Roles('taed_admin', 'taed_operator')
  @HttpCode(HttpStatus.ACCEPTED)
  async syncPetronectClosed() {
    const job = await this.ingestionQueue.add('sync-petronect-closed', {}, { attempts: 3, backoff: { type: 'exponential', delay: 5_000 }, removeOnComplete: 100, removeOnFail: 100 });
    return { jobId: job.id, status: 'queued' };
  }

  @Get('petronect/health')
  @Roles('taed_admin', 'taed_operator')
  async petronectHealthCheck() {
    return this.integrationService.petronectHealthCheck();
  }
}
