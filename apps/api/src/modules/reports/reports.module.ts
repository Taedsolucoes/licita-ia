import { Module } from '@nestjs/common';
import { QueueModule } from '../queue/queue.module';
import { ReportsService } from './reports.service';
import { ReportsProcessor } from './reports.processor';
import { ReportsController } from './reports.controller';

@Module({
  imports: [QueueModule],
  providers: [ReportsService, ReportsProcessor],
  controllers: [ReportsController],
  exports: [ReportsService],
})
export class ReportsModule {}
