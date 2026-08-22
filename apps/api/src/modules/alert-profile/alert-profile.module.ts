import { Module } from '@nestjs/common';
import { AlertProfileController } from './alert-profile.controller';
import { AlertProfileService } from './alert-profile.service';

@Module({
  controllers: [AlertProfileController],
  providers: [AlertProfileService],
  exports: [AlertProfileService],
})
export class AlertProfileModule {}
