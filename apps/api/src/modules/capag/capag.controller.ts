import {
  Controller,
  Get,
  NotFoundException,
  Param,
  Post,
  UseGuards,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { CapagService } from './capag.service';

@Controller('capag')
@UseGuards(AuthGuard('jwt'))
export class CapagController {
  constructor(private capagService: CapagService) {}

  @Get('municipalities/:ibgeCode')
  async getByMunicipality(@Param('ibgeCode') ibgeCode: string) {
    const result = await this.capagService.getCapagByMunicipality(ibgeCode);
    if (!result) {
      throw new NotFoundException(`CAPAG not found for IBGE code ${ibgeCode}`);
    }
    return result;
  }

  @Get('uf/:uf')
  async getByUf(@Param('uf') uf: string) {
    return this.capagService.getCapagByUf(uf);
  }
}

@Controller('internal/integrations/capag')
@UseGuards(AuthGuard('jwt'), RolesGuard)
export class CapagInternalController {
  constructor(private capagService: CapagService) {}

  @Post('sync')
  @Roles('taed_admin', 'taed_operator')
  @HttpCode(HttpStatus.OK)
  async syncCapag() {
    return this.capagService.syncCapagData();
  }
}
