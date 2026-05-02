import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { OpportunitiesController } from './opportunities.controller';
import { OpportunitiesService } from './opportunities.service';
import { ParticipationService } from '../participation/participation.service';
import { QUEUE_NAMES } from '../queue/queue.module';

@Module({
  imports: [
    BullModule.registerQueue({ name: QUEUE_NAMES.NOTIFICATIONS }),
  ],
  controllers: [OpportunitiesController],
  providers: [OpportunitiesService, ParticipationService],
  exports: [OpportunitiesService],
})
export class OpportunitiesModule {}
