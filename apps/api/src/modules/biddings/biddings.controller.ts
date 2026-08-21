import { Controller, Get, Param, Query, UseGuards } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { BiddingsService } from './biddings.service';
import { BiddingSearchDto } from './dto/bidding-search.dto';

@Controller('biddings')
@UseGuards(AuthGuard('jwt'))
export class BiddingsController {
  constructor(private readonly biddingsService: BiddingsService) {}

  @Get()
  async search(@Query() filters: BiddingSearchDto) {
    return this.biddingsService.search(filters);
  }

  @Get(':id')
  async findOne(@Param('id') id: string) {
    return this.biddingsService.findById(id);
  }

  @Get(':id/items')
  async findItems(@Param('id') id: string) {
    return this.biddingsService.findItems(id);
  }
}
