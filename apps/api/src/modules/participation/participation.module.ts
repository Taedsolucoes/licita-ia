import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { ParticipationController } from './participation.controller';
import { ParticipationService } from './participation.service';
import { QUEUE_NAMES } from '../queue/queue.module';

@Module({
  imports: [
    BullModule.registerQueue({ name: QUEUE_NAMES.NOTIFICATIONS }),
  ],
  controllers: [ParticipationController],
  providers: [ParticipationService],
  exports: [ParticipationService],
})
export class ParticipationModule {}
