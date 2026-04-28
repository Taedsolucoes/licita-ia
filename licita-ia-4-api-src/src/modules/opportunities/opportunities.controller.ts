import { Controller, Get, Post, Patch, Param, Body, Query, UseGuards } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { OpportunitiesService } from './opportunities.service';
import { OpportunityFiltersDto, UpdateOpportunityStatusDto } from './dto/opportunity.dto';
import { ParticipationService } from '../participation/participation.service';

interface AuthUser {
  id: string;
  tenantId: string;
  role: string;
  email: string;
}

@Controller('opportunities')
@UseGuards(AuthGuard('jwt'))
export class OpportunitiesController {
  constructor(
    private opportunitiesService: OpportunitiesService,
    private participationService: ParticipationService,
  ) {}

  @Get()
  async findAll(
    @CurrentUser() user: AuthUser,
    @Query() filters: OpportunityFiltersDto,
  ) {
    return this.opportunitiesService.findAll(user.tenantId, filters);
  }

  @Get(':id')
  async findOne(
    @Param('id') id: string,
    @CurrentUser() user: AuthUser,
  ) {
    return this.opportunitiesService.findById(id, user.tenantId);
  }

  @Patch(':id/status')
  async updateStatus(
    @Param('id') id: string,
    @CurrentUser() user: AuthUser,
    @Body() dto: UpdateOpportunityStatusDto,
  ) {
    return this.opportunitiesService.updateStatus(id, user.tenantId, dto);
  }

  @Post(':id/participate')
  async participate(
    @Param('id') id: string,
    @CurrentUser() user: AuthUser,
  ) {
    return this.participationService.participate(id, user.id, user.tenantId);
  }

  @Post(':id/decline')
  async decline(
    @Param('id') id: string,
    @CurrentUser() user: AuthUser,
  ) {
    return this.participationService.decline(id, user.tenantId);
  }
}
