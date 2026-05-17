import { Module } from '@nestjs/common';
import { MulterModule } from '@nestjs/platform-express';
import { CapagModule } from '../capag/capag.module';
import { ReportsModule } from '../reports/reports.module';
import { AnalysisService } from './analysis.service';
import { AnalysisController } from './analysis.controller';

@Module({
  imports: [
    CapagModule,
    ReportsModule,
    MulterModule.register({ storage: undefined }), // use memory storage (default)
  ],
  providers: [AnalysisService],
  controllers: [AnalysisController],
  exports: [AnalysisService],
})
export class AnalysisModule {}
