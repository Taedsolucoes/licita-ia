import { Controller, Get, UseGuards } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { DashboardService } from './dashboard.service';

interface AuthUser {
  id: string;
  tenantId: string;
  role: string;
  email: string;
}

@Controller()
@UseGuards(AuthGuard('jwt'))
export class DashboardController {
  constructor(private dashboardService: DashboardService) {}

  @Get('dashboard/summary')
  getSummary(@CurrentUser() user: AuthUser): Promise<object> {
    return this.dashboardService.getSummary(user.tenantId);
  }

  @Get('documents')
  getDocuments(@CurrentUser() user: AuthUser): Promise<object[]> {
    return this.dashboardService.getDocuments(user.tenantId);
  }

  @Get('results')
  getResults(@CurrentUser() user: AuthUser): Promise<object[]> {
    return this.dashboardService.getResults(user.tenantId);
  }
}
