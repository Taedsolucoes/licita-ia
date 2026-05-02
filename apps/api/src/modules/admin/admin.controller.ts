import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Param,
  Body,
  Query,
  UseGuards,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { AdminService } from './admin.service';
import {
  CreateTenantDto,
  UpdateTenantDto,
  CreateUserDto,
  UpdateUserDto,
  CreateKeywordDto,
  UpdateKeywordDto,
  CreateRegionDto,
} from './dto/admin.dto';

@Controller('admin')
@UseGuards(AuthGuard('jwt'), RolesGuard)
@Roles('taed_admin', 'taed_operator')
export class AdminController {
  constructor(private adminService: AdminService) {}

  // ─── Tenants ─────────────────────────────────────────────────────────────

  @Get('tenants')
  listTenants(
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    return this.adminService.listTenants(
      page ? parseInt(page, 10) : 1,
      limit ? parseInt(limit, 10) : 20,
    );
  }

  @Post('tenants')
  @Roles('taed_admin')
  createTenant(@Body() dto: CreateTenantDto) {
    return this.adminService.createTenant(dto);
  }

  @Get('tenants/:id')
  getTenant(@Param('id') id: string) {
    return this.adminService.getTenant(id);
  }

  @Patch('tenants/:id')
  @Roles('taed_admin')
  updateTenant(@Param('id') id: string, @Body() dto: UpdateTenantDto) {
    return this.adminService.updateTenant(id, dto);
  }

  // ─── Users ───────────────────────────────────────────────────────────────

  @Get('tenants/:id/users')
  listTenantUsers(@Param('id') id: string) {
    return this.adminService.listTenantUsers(id);
  }

  @Post('tenants/:id/users')
  createTenantUser(@Param('id') id: string, @Body() dto: CreateUserDto) {
    return this.adminService.createTenantUser(id, dto);
  }

  @Patch('users/:userId')
  updateUser(@Param('userId') userId: string, @Body() dto: UpdateUserDto) {
    return this.adminService.updateUser(userId, dto);
  }

  // ─── Keywords ─────────────────────────────────────────────────────────────

  @Get('tenants/:id/keywords')
  listKeywords(@Param('id') id: string) {
    return this.adminService.listKeywords(id);
  }

  @Post('tenants/:id/keywords')
  createKeyword(@Param('id') id: string, @Body() dto: CreateKeywordDto) {
    return this.adminService.createKeyword(id, dto);
  }

  @Patch('keywords/:keywordId')
  updateKeyword(@Param('keywordId') keywordId: string, @Body() dto: UpdateKeywordDto) {
    return this.adminService.updateKeyword(keywordId, dto);
  }

  @Delete('keywords/:keywordId')
  deleteKeyword(@Param('keywordId') keywordId: string) {
    return this.adminService.deleteKeyword(keywordId);
  }

  // ─── Regions ─────────────────────────────────────────────────────────────

  @Get('tenants/:id/regions')
  listRegions(@Param('id') id: string) {
    return this.adminService.listRegions(id);
  }

  @Post('tenants/:id/regions')
  createRegion(@Param('id') id: string, @Body() dto: CreateRegionDto) {
    return this.adminService.createRegion(id, dto);
  }

  @Delete('regions/:regionId')
  deleteRegion(@Param('regionId') regionId: string) {
    return this.adminService.deleteRegion(regionId);
  }

  // ─── Biddings (all) ──────────────────────────────────────────────────────

  @Get('biddings')
  listAllBiddings(
    @Query('page') page?: string,
    @Query('limit') limit?: string,
    @Query('status') status?: string,
    @Query('uf') uf?: string,
    @Query('dateFrom') dateFrom?: string,
    @Query('dateTo') dateTo?: string,
  ) {
    return this.adminService.listAllBiddings(
      page ? parseInt(page, 10) : 1,
      limit ? parseInt(limit, 10) : 20,
      { status, uf, dateFrom, dateTo },
    );
  }

  // ─── Dashboard ───────────────────────────────────────────────────────────

  @Get('dashboard/overview')
  getDashboardOverview() {
    return this.adminService.getDashboardOverview();
  }

  @Get('dashboard/participations')
  getDashboardParticipations(
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    return this.adminService.getDashboardParticipations(
      page ? parseInt(page, 10) : 1,
      limit ? parseInt(limit, 10) : 20,
    );
  }
}
