import { Injectable, ForbiddenException, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { OpportunityFiltersDto, UpdateOpportunityStatusDto } from './dto/opportunity.dto';

@Injectable()
export class OpportunitiesService {
  constructor(private prisma: PrismaService) {}

  async findAll(tenantId: string, filters: OpportunityFiltersDto) {
    const page = filters.page ?? 1;
    const limit = filters.limit ?? 20;
    const skip = (page - 1) * limit;

    const where: Prisma.OpportunityWhereInput = { tenantId };

    if (filters.status) {
      where.status = filters.status;
    }

    if (filters.since || filters.until) {
      where.createdAt = {};
      if (filters.since) {
        (where.createdAt as Prisma.DateTimeFilter).gte = new Date(filters.since);
      }
      if (filters.until) {
        (where.createdAt as Prisma.DateTimeFilter).lte = new Date(filters.until);
      }
    }

    const biddingWhere: Prisma.BiddingWhereInput = {};
    if (filters.uf) {
      biddingWhere.uf = filters.uf;
    }
    if (filters.minValue !== undefined || filters.maxValue !== undefined) {
      const valueFilter: Prisma.DecimalNullableFilter = {};
      if (filters.minValue !== undefined) {
        valueFilter.gte = filters.minValue;
      }
      if (filters.maxValue !== undefined) {
        valueFilter.lte = filters.maxValue;
      }
      biddingWhere.estimatedValue = valueFilter;
    }

    if (Object.keys(biddingWhere).length > 0) {
      where.bidding = biddingWhere;
    }

    const [total, items] = await this.prisma.$transaction([
      this.prisma.opportunity.count({ where }),
      this.prisma.opportunity.findMany({
        where,
        include: {
          bidding: {
            select: {
              id: true,
              biddingNumber: true,
              modality: true,
              agencyName: true,
              objectText: true,
              objectSummary: true,
              estimatedValue: true,
              municipalityName: true,
              uf: true,
              status: true,
              proposalDueDate: true,
              openingDate: true,
            },
          },
        },
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
    ]);

    return {
      data: items,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  async findById(id: string, tenantId: string) {
    const opportunity = await this.prisma.opportunity.findUnique({
      where: { id },
      include: {
        bidding: {
          include: { items: true },
        },
        items: {
          include: { biddingItem: true },
        },
      },
    });

    if (!opportunity) {
      throw new NotFoundException('Opportunity not found');
    }
    if (opportunity.tenantId !== tenantId) {
      throw new ForbiddenException('Access denied');
    }

    return opportunity;
  }

  async updateStatus(id: string, tenantId: string, dto: UpdateOpportunityStatusDto) {
    const opportunity = await this.prisma.opportunity.findUnique({
      where: { id },
    });

    if (!opportunity) {
      throw new NotFoundException('Opportunity not found');
    }
    if (opportunity.tenantId !== tenantId) {
      throw new ForbiddenException('Access denied');
    }

    return this.prisma.opportunity.update({
      where: { id },
      data: { status: dto.status },
    });
  }
}
