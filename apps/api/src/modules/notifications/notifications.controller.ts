import {
  Controller,
  Get,
  Patch,
  Put,
  Param,
  Body,
  Query,
  UseGuards,
  Post,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { NotificationsService } from './notifications.service';
import {
  RegisterDeviceDto,
  UnregisterDeviceDto,
  UpdateNotificationPreferencesDto,
} from './dto/notifications.dto';

interface AuthUser {
  id: string;
  tenantId: string;
  role: string;
  email: string;
}

@Controller()
@UseGuards(AuthGuard('jwt'))
export class NotificationsController {
  constructor(private notificationsService: NotificationsService) {}

  @Get('notifications')
  listNotifications(
    @CurrentUser() user: AuthUser,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    return this.notificationsService.listNotifications(
      user.id,
      page ? parseInt(page, 10) : 1,
      limit ? parseInt(limit, 10) : 20,
    );
  }

  @Patch('notifications/:id/read')
  markRead(@Param('id') id: string, @CurrentUser() user: AuthUser) {
    return this.notificationsService.markRead(id, user.id);
  }

  @Post('notifications/devices')
  registerDevice(@CurrentUser() user: AuthUser, @Body() dto: RegisterDeviceDto) {
    return this.notificationsService.registerDevice(user.id, dto);
  }

  @Post('notifications/devices/unregister')
  unregisterDevice(@CurrentUser() user: AuthUser, @Body() dto: UnregisterDeviceDto) {
    return this.notificationsService.unregisterDevice(user.id, dto.token);
  }

  @Get('notification-preferences')
  getPreferences(@CurrentUser() user: AuthUser) {
    return this.notificationsService.getPreferences(user.id, user.tenantId);
  }

  @Put('notification-preferences')
  upsertPreferences(
    @CurrentUser() user: AuthUser,
    @Body() dto: UpdateNotificationPreferencesDto,
  ) {
    return this.notificationsService.upsertPreferences(user.id, user.tenantId, dto);
  }
}
