import { Body, Controller, Get, Put, UseGuards } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { AlertProfileService } from './alert-profile.service';
import { UpdateAlertProfileDto } from './alert-profile.dto';

interface AuthenticatedUser {
  tenantId: string;
}

@Controller('alert-profile')
@UseGuards(AuthGuard('jwt'))
export class AlertProfileController {
  constructor(private readonly alertProfileService: AlertProfileService) {}

  @Get()
  getProfile(@CurrentUser() user: AuthenticatedUser) {
    return this.alertProfileService.getProfile(user.tenantId);
  }

  @Put()
  updateProfile(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: UpdateAlertProfileDto,
  ) {
    return this.alertProfileService.updateProfile(user.tenantId, dto);
  }
}
