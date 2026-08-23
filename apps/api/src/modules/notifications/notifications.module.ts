import { Module } from '@nestjs/common';
import { QueueModule } from '../queue/queue.module';
import { AuthModule } from '../auth/auth.module';
import { WhatsAppService } from './whatsapp.service';
import { PushService } from './push.service';
import { NotificationsService } from './notifications.service';
import { NotificationsProcessor } from './notifications.processor';
import { NotificationsController } from './notifications.controller';

@Module({
  imports: [QueueModule, AuthModule],
  providers: [WhatsAppService, PushService, NotificationsService, NotificationsProcessor],
  controllers: [NotificationsController],
  exports: [NotificationsService],
})
export class NotificationsModule {}
