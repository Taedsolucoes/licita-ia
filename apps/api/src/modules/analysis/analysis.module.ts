import { Module } from '@nestjs/common';
import { MulterModule } from '@nestjs/platform-express';
import { QueueModule } from '../queue/queue.module';
import { CapagModule } from '../capag/capag.module';
import { ReportsModule } from '../reports/reports.module';
import { AnalysisService } from './analysis.service';
import { AnalysisProcessor } from './analysis.processor';
import { AnalysisController } from './analysis.controller';

@Module({
  imports: [
    QueueModule,
    CapagModule,
    ReportsModule,
    MulterModule.register({ storage: undefined }), // use memory storage (default)
  ],
  providers: [AnalysisService, AnalysisProcessor],
  controllers: [AnalysisController],
  exports: [AnalysisService],
})
export class AnalysisModule {}
