import { Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { BiddingSearchDto } from './dto/bidding-search.dto';

type GroupCount = number | { _all?: number } | true | null | undefined;

function countOf(group: { _count: GroupCount }): number {
  if (typeof group._count === 'number') return group._count;
  if (group._count && typeof group._count === 'object') return group._count._all ?? 0;
  return 0;
}

@Injectable()
export class BiddingsService {
  constructor(private readonly prisma: PrismaService) {}

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

  /**
   * Search the local canonical index. Facets are computed from the same
   * filtered relation, so a query with no `q` still returns municipality and
   * modality counts, matching the product requirement for unqualified lists.
   */
  async search(filters: BiddingSearchDto) {
    const page = filters.page ?? 1;
    const limit = filters.limit ?? 20;
    const skip = (page - 1) * limit;
    const where = this.buildWhere(filters);
    const sortBy = filters.sortBy ?? 'publicationDate';
    const sortDirection = filters.sortDirection ?? 'desc';
    const orderBy = { [sortBy]: sortDirection } as Prisma.BiddingOrderByWithRelationInput;

    const [total, data, municipalityGroups, modalityGroups, sourceGroups, statusGroups] =
      await this.prisma.$transaction([
        this.prisma.bidding.count({ where }),
        this.prisma.bidding.findMany({
          where,
          select: {
            id: true,
            source: true,
            sourceExternalId: true,
            sourceRecordKey: true,
            pncpControlNumber: true,
            sourceSystemName: true,
            modalityCode: true,
            modalityNormalized: true,
            procurementLaw: true,
            processNumber: true,
            purchaseYear: true,
            sourceUrl: true,
            biddingNumber: true,
            modality: true,
            uasg: true,
            sphere: true,
            agencyName: true,
            agencyDocument: true,
            objectText: true,
            objectSummary: true,
            publicationDate: true,
            openingDate: true,
            proposalDueDate: true,
            estimatedValue: true,
            municipalityName: true,
            municipalityIbgeCode: true,
            uf: true,
            status: true,
            publicationUpdatedAt: true,
            sourceUpdatedAt: true,
            lastSeenAt: true,
          },
          orderBy,
          skip,
          take: limit,
        }),
        this.prisma.bidding.groupBy({
          by: ['municipalityIbgeCode', 'municipalityName', 'uf'],
          where,
          _count: true,
          orderBy: { municipalityName: 'asc' },
        }),
        this.prisma.bidding.groupBy({
          by: ['modalityCode', 'modality', 'modalityNormalized'],
          where,
          _count: true,
          orderBy: { modality: 'asc' },
        }),
        this.prisma.bidding.groupBy({
          by: ['source'],
          where,
          _count: true,
          orderBy: { source: 'asc' },
        }),
        this.prisma.bidding.groupBy({
          by: ['status'],
          where,
          _count: true,
          orderBy: { status: 'asc' },
        }),
      ]);

    return {
      data,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
      facets: {
        municipality: municipalityGroups
          .sort((left, right) => countOf(right) - countOf(left))
          .slice(0, 100)
          .map((group) => ({
            code: group.municipalityIbgeCode,
            name: group.municipalityName,
            uf: group.uf,
            count: countOf(group),
          })),
        modality: modalityGroups
          .sort((left, right) => countOf(right) - countOf(left))
          .map((group) => ({
            code: group.modalityCode,
            name: group.modality,
            normalized: group.modalityNormalized,
            count: countOf(group),
          })),
        source: sourceGroups
          .sort((left, right) => countOf(right) - countOf(left))
          .map((group) => ({ source: group.source, count: countOf(group) })),
        status: statusGroups
          .sort((left, right) => countOf(right) - countOf(left))
          .map((group) => ({ status: group.status, count: countOf(group) })),
      },
    };
  }

  private buildWhere(filters: BiddingSearchDto): Prisma.BiddingWhereInput {
    const where: Prisma.BiddingWhereInput = {};
    const q = filters.q?.trim();

    if (q) {
      where.OR = [
        { objectText: { contains: q, mode: 'insensitive' } },
        { objectSummary: { contains: q, mode: 'insensitive' } },
        { agencyName: { contains: q, mode: 'insensitive' } },
        { biddingNumber: { contains: q, mode: 'insensitive' } },
        { pncpControlNumber: { contains: q, mode: 'insensitive' } },
      ];
    }

    if (filters.uf) where.uf = filters.uf.trim().toUpperCase();
    if (filters.municipalityIbgeCode) {
      where.municipalityIbgeCode = filters.municipalityIbgeCode.trim();
    }
    if (filters.municipalityName) {
      where.municipalityName = {
        contains: filters.municipalityName.trim(),
        mode: 'insensitive',
      };
    }
    if (filters.modalityCode !== undefined) {
      where.modalityCode = String(filters.modalityCode);
    }
    if (filters.modality) {
      where.modality = { contains: filters.modality.trim(), mode: 'insensitive' };
    }
    if (filters.source) where.source = filters.source.trim();
    if (filters.status) where.status = filters.status.trim();
    if (filters.sphere) where.sphere = filters.sphere.trim().toUpperCase();

    if (filters.minValue !== undefined || filters.maxValue !== undefined) {
      const valueFilter: Prisma.DecimalNullableFilter = {};
      if (filters.minValue !== undefined) valueFilter.gte = filters.minValue;
      if (filters.maxValue !== undefined) valueFilter.lte = filters.maxValue;
      where.estimatedValue = valueFilter;
    }

    const publicationDate = this.dateFilter(filters.publicationFrom, filters.publicationTo);
    if (publicationDate) where.publicationDate = publicationDate;
    const proposalDueDate = this.dateFilter(filters.proposalFrom, filters.proposalTo);
    if (proposalDueDate) where.proposalDueDate = proposalDueDate;
    const openingDate = this.dateFilter(filters.openingFrom, filters.openingTo);
    if (openingDate) where.openingDate = openingDate;

    return where;
  }

  private dateFilter(from?: string, to?: string): Prisma.DateTimeNullableFilter | undefined {
    if (!from && !to) return undefined;
    const filter: Prisma.DateTimeNullableFilter = {};
    if (from) filter.gte = new Date(from);
    if (to) filter.lte = new Date(to);
    return filter;
  }
}
