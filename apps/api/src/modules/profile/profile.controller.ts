import { Controller, Get, Put, Body, Param, Query, UseGuards } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { ProfileService } from './profile.service';
import { SaveCompanyProfileDto } from './dto/company-profile.dto';

interface AuthUser {
  tenantId: string;
}

@Controller('profile')
@UseGuards(AuthGuard('jwt'))
export class ProfileController {
  constructor(private readonly profileService: ProfileService) {}

  @Get('company')
  getCompanyProfile(@CurrentUser() user: AuthUser) {
    return this.profileService.getCompanyProfile(user.tenantId);
  }

  @Put('company')
  updateCompanyProfile(@CurrentUser() user: AuthUser, @Body() dto: SaveCompanyProfileDto) {
    return this.profileService.updateCompanyProfile(user.tenantId, dto);
  }

  @Get('cnpj/:cnpj')
  lookupCnpj(@Param('cnpj') cnpj: string) {
    return this.profileService.lookupCnpj(cnpj);
  }

  @Get('municipalities')
  findMunicipalities(@Query('uf') uf = '', @Query('q') query = '') {
    return this.profileService.findMunicipalities(uf, query);
  }
}
