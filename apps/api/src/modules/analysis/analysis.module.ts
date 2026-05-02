import { Module } from '@nestjs/common';
import { QueueModule } from '../queue/queue.module';
import { AnalysisService } from './analysis.service';
import { AnalysisProcessor } from './analysis.processor';
import { AnalysisController } from './analysis.controller';

@Module({
  imports: [QueueModule],
  providers: [AnalysisService, AnalysisProcessor],
  controllers: [AnalysisController],
  exports: [AnalysisService],
})
export class AnalysisModule {}
