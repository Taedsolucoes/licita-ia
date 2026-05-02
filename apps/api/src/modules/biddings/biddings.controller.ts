import { Controller, Get, Param, UseGuards } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { BiddingsService } from './biddings.service';

@Controller('biddings')
@UseGuards(AuthGuard('jwt'))
export class BiddingsController {
  constructor(private biddingsService: BiddingsService) {}

  @Get(':id')
  async findOne(@Param('id') id: string) {
    return this.biddingsService.findById(id);
  }

  @Get(':id/items')
  async findItems(@Param('id') id: string) {
    return this.biddingsService.findItems(id);
  }
}
