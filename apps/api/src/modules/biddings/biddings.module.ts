import { Module } from '@nestjs/common';
import { BiddingsController } from './biddings.controller';
import { BiddingsService } from './biddings.service';

@Module({
  controllers: [BiddingsController],
  providers: [BiddingsService],
  exports: [BiddingsService],
})
export class BiddingsModule {}
