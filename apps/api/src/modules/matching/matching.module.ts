import { Module } from '@nestjs/common';
import { QueueModule } from '../queue/queue.module';
import { CapagModule } from '../capag/capag.module';
import { MatchingService } from './matching.service';
import { MatchingProcessor } from './matching.processor';

@Module({
  imports: [QueueModule, CapagModule],
  providers: [MatchingService, MatchingProcessor],
  exports: [MatchingService],
})
export class MatchingModule {}
