import {
  Controller,
  Get,
  Post,
  Param,
  ParseUUIDPipe,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { AnalysisService } from './analysis.service';
import { QUEUE_NAMES } from '../queue/queue.module';

@Controller('analysis')
export class AnalysisController {
  constructor(
    private analysisService: AnalysisService,
    @InjectQueue(QUEUE_NAMES.ANALYSIS) private analysisQueue: Queue,
  ) {}

  @Get('biddings/:biddingId')
  async getAnalysis(@Param('biddingId', ParseUUIDPipe) biddingId: string) {
    return this.analysisService.getAnalysisByBiddingId(biddingId);
  }

  @Post('biddings/:biddingId/generate')
  @HttpCode(HttpStatus.ACCEPTED)
  async generateAnalysis(@Param('biddingId', ParseUUIDPipe) biddingId: string) {
    const job = await this.analysisQueue.add(
      'analyze-edital',
      { biddingId },
      { attempts: 3, backoff: { type: 'exponential', delay: 10000 } },
    );
    return { jobId: job.id, biddingId, status: 'queued' };
  }
}
