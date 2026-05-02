import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class BiddingsService {
  constructor(private prisma: PrismaService) {}

  async findById(id: string) {
    const bidding = await this.prisma.bidding.findUnique({
      where: { id },
    });
    if (!bidding) {
      throw new NotFoundException('Bidding not found');
    }
    return bidding;
  }

  async findItems(biddingId: string) {
    const bidding = await this.prisma.bidding.findUnique({
      where: { id: biddingId },
    });
    if (!bidding) {
      throw new NotFoundException('Bidding not found');
    }

    return this.prisma.biddingItem.findMany({
      where: { biddingId },
      orderBy: { itemNumber: 'asc' },
    });
  }
}
