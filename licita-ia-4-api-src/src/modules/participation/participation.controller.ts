import {
  Controller,
  Get,
  Post,
  Put,
  Param,
  Body,
  Query,
  UseGuards,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { ParticipationService } from './participation.service';
import { UpdateParticipationItemsDto } from './dto/participation.dto';

interface AuthUser {
  id: string;
  tenantId: string;
  role: string;
  email: string;
}

@Controller('participations')
@UseGuards(AuthGuard('jwt'))
export class ParticipationController {
  constructor(private participationService: ParticipationService) {}

  @Get()
  listParticipations(
    @CurrentUser() user: AuthUser,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    const isAdmin = ['taed_admin', 'taed_operator'].includes(user.role);
    return this.participationService.listParticipations(
      user.tenantId,
      isAdmin,
      page ? parseInt(page, 10) : 1,
      limit ? parseInt(limit, 10) : 20,
    );
  }

  @Get(':id')
  getById(@Param('id') id: string, @CurrentUser() user: AuthUser) {
    const isAdmin = ['taed_admin', 'taed_operator'].includes(user.role);
    return this.participationService.getById(id, user.tenantId, isAdmin);
  }

  @Put(':id/items')
  updateItems(
    @Param('id') id: string,
    @CurrentUser() user: AuthUser,
    @Body() dto: UpdateParticipationItemsDto,
  ) {
    return this.participationService.updateItems(id, user.tenantId, dto);
  }

  @Post(':id/submit')
  submit(@Param('id') id: string, @CurrentUser() user: AuthUser) {
    return this.participationService.submit(id, user.tenantId);
  }
}
