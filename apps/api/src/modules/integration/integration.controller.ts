import {
  Controller,
  Post,
  Get,
  Query,
  UseGuards,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { IntegrationService } from './integration.service';

@Controller('internal/integrations')
@UseGuards(AuthGuard('jwt'), RolesGuard)
export class IntegrationController {
  constructor(private integrationService: IntegrationService) {}

  @Post('sources/pncp/sync')
  @Roles('taed_admin', 'taed_operator')
  @HttpCode(HttpStatus.OK)
  async syncPncp() {
    return this.integrationService.syncBiddings('manual');
  }

  @Get('sources/pncp/health')
  @Roles('taed_admin', 'taed_operator')
  async healthCheckPncp() {
    return this.integrationService.healthCheck();
  }

  @Get('sources/health')
  @Roles('taed_admin', 'taed_operator')
  async healthCheckSources() {
    return this.integrationService.healthCheck();
  }

  @Get('sources/sync-runs')
  @Roles('taed_admin', 'taed_operator')
  async listSyncRuns(@Query('limit') limit?: string) {
    const parsedLimit = limit === undefined ? 50 : Number(limit);
    return this.integrationService.listSyncRuns(Number.isFinite(parsedLimit) ? parsedLimit : 50);
  }
}
