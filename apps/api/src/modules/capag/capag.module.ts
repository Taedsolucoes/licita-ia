import { Module } from '@nestjs/common';
import { CapagService } from './capag.service';
import { CapagController, CapagInternalController } from './capag.controller';

@Module({
  controllers: [CapagController, CapagInternalController],
  providers: [CapagService],
  exports: [CapagService],
})
export class CapagModule {}
