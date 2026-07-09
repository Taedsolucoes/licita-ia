import { Injectable, ForbiddenException, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { OpportunityFiltersDto, UpdateOpportunityStatusDto } from './dto/opportunity.dto';
import { AnalysisService } from '../analysis/analysis.service';
import { ReportsService } from '../reports/reports.service';

@Injectable()
export class OpportunitiesService {
  constructor(
    private prisma: PrismaService,
    private analysisService: AnalysisService,
    private reportsService: ReportsService,
  ) {}

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
    if (filters.modality) {
      biddingWhere.modality = { equals: filters.modality, mode: 'insensitive' };
    }
    if (filters.q) {
      biddingWhere.OR = [
        { objectText: { contains: filters.q, mode: 'insensitive' } },
        { objectSummary: { contains: filters.q, mode: 'insensitive' } },
        { agencyName: { contains: filters.q, mode: 'insensitive' } },
        { biddingNumber: { contains: filters.q, mode: 'insensitive' } },
      ];
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
              sourceUrl: true,
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

  /**
   * Admin flow: send an opportunity to a specific tenant.
   * 1) Runs analysis pipeline if not done yet
   * 2) Generates PDF report
   * 3) Links the report to the opportunity
   * 4) Updates opportunity status to 'sent_to_client'
   * 5) Records history in AuditLog
   */
  async sendToTenant(
    opportunityId: string,
    targetTenantId: string,
    actorUserId?: string,
  ): Promise<{ opportunityId: string; reportId: string | null; status: string; sentAt: string }> {
    // 1. Fetch the opportunity with bidding
    const opportunity = await this.prisma.opportunity.findUnique({
      where: { id: opportunityId },
      include: {
        bidding: {
          include: { items: { orderBy: { itemNumber: 'asc' } } },
        },
      },
    });

    if (!opportunity) {
      throw new NotFoundException(`Opportunity ${opportunityId} not found`);
    }

    const biddingId = opportunity.biddingId;

    // 2. Run analysis if not already completed
    let analysis = await this.prisma.biddingAnalysis.findUnique({ where: { biddingId } });

    if (!analysis) {
      try {
        await this.analysisService.analyzeEdital(biddingId);
        analysis = await this.prisma.biddingAnalysis.findUnique({ where: { biddingId } });
      } catch (err) {
        // Analysis failed — continue without it (graceful degradation)
      }
    }

    // 3. Schedule PDF report generation
    let reportId: string | null = null;
    try {
      const scheduled = await this.reportsService.scheduleReport(
        biddingId,
        targetTenantId,
        opportunityId,
      );
      reportId = scheduled.reportId;
    } catch (err) {
      // Report scheduling failed — continue
    }

    // 4. Update opportunity status
    const sentAt = new Date();
    await this.prisma.opportunity.update({
      where: { id: opportunityId },
      data: {
        status: 'sent_to_client',
        analysisCompletedAt: analysis ? (opportunity.analysisCompletedAt ?? sentAt) : null,
      },
    });

    // 5. Record in audit log
    try {
      await this.prisma.auditLog.create({
        data: {
          tenantId: targetTenantId,
          actorUserId: actorUserId ?? null,
          action: 'send_to_client',
          resourceType: 'opportunity',
          resourceId: opportunityId,
          metadata: {
            biddingId,
            reportId,
            sentAt: sentAt.toISOString(),
            hasAnalysis: !!analysis,
          } as unknown as object,
          createdAt: sentAt,
        },
      });
    } catch {
      // Audit log failure is non-blocking
    }

    return {
      opportunityId,
      reportId,
      status: 'sent_to_client',
      sentAt: sentAt.toISOString(),
    };
  }
}
