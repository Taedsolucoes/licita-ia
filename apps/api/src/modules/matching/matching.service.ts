import { Injectable, Logger } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { PrismaService } from '../prisma/prisma.service';
import { QUEUE_NAMES } from '../queue/queue.module';
import { CapagService } from '../capag/capag.service';

interface TenantWithPreferences {
  id: string;
  status: string;
  companyKeywords: Array<{
    keyword: string;
    normalizedKeyword: string;
    matchType: string;
    weight: number;
  }>;
  companyRegions: Array<{
    uf: string;
    municipalityIbgeCode: string | null;
    scopeType: string;
  }>;
}

interface BiddingWithItems {
  id: string;
  objectText: string;
  uf: string | null;
  municipalityIbgeCode: string | null;
  status: string;
  items: Array<{ description: string }>;
}

const SCORE_THRESHOLD = 0.5;

function normalize(text: string): string {
  return text
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');
}

@Injectable()
export class MatchingService {
  private readonly logger = new Logger(MatchingService.name);

  constructor(
    private prisma: PrismaService,
    @InjectQueue(QUEUE_NAMES.REPORTS) private reportsQueue: Queue,
    @InjectQueue(QUEUE_NAMES.NOTIFICATIONS) private notificationsQueue: Queue,
    private capagService: CapagService,
  ) {}

  async matchBiddingForAllTenants(biddingId: string): Promise<void> {
    const bidding = await this.prisma.bidding.findUnique({
      where: { id: biddingId },
      include: { items: { select: { description: true } } },
    });

    if (!bidding) {
      this.logger.warn(`Bidding ${biddingId} not found, skipping matching`);
      return;
    }

    if (bidding.status !== 'open') {
      this.logger.debug(`Bidding ${biddingId} status=${bidding.status}, skipping matching`);
      return;
    }

    const tenants = await this.prisma.tenant.findMany({
      where: { status: 'active' },
      include: {
        companyKeywords: {
          select: { keyword: true, normalizedKeyword: true, matchType: true, weight: true },
        },
        companyRegions: {
          select: { uf: true, municipalityIbgeCode: true, scopeType: true },
        },
      },
    });

    let matched = 0;
    for (const tenant of tenants) {
      try {
        const created = await this.matchBiddingForTenant(bidding, tenant);
        if (created) matched++;
      } catch (error) {
        this.logger.error(
          `Error matching bidding ${biddingId} for tenant ${tenant.id}: ${error instanceof Error ? error.message : String(error)}`,
        );
      }
    }

    this.logger.log(
      `Matching complete for bidding ${biddingId}: ${matched} opportunities created out of ${tenants.length} tenants`,
    );
  }

  private async matchBiddingForTenant(
    bidding: BiddingWithItems,
    tenant: TenantWithPreferences,
  ): Promise<boolean> {
    const includeKeywords = tenant.companyKeywords.filter((k) => k.matchType === 'include');
    const excludeKeywords = tenant.companyKeywords.filter((k) => k.matchType === 'exclude');

    if (includeKeywords.length === 0 || tenant.companyRegions.length === 0) {
      return false;
    }

    const regionCheck = this.checkRegionMatch(bidding, tenant.companyRegions);
    if (!regionCheck.matches) {
      return false;
    }

    const normalizedObjectText = normalize(bidding.objectText);

    // Exclude keywords short-circuit
    const hasExclude = excludeKeywords.some((k) =>
      normalizedObjectText.includes(normalize(k.normalizedKeyword)),
    );
    if (hasExclude) {
      return false;
    }

    // Score from object text (weight x1)
    const matchedKeywords: string[] = [];
    let score = 0;

    for (const keyword of includeKeywords) {
      const normalizedKw = normalize(keyword.normalizedKeyword);
      if (normalizedObjectText.includes(normalizedKw)) {
        matchedKeywords.push(keyword.keyword);
        score += keyword.weight;
      }
    }

    // Score from item descriptions (weight x0.7)
    for (const item of bidding.items) {
      const normalizedItem = normalize(item.description);
      for (const keyword of includeKeywords) {
        const normalizedKw = normalize(keyword.normalizedKeyword);
        if (
          normalizedItem.includes(normalizedKw) &&
          !matchedKeywords.includes(keyword.keyword)
        ) {
          matchedKeywords.push(keyword.keyword);
          score += keyword.weight * 0.7;
        }
      }
    }

    // Region type multiplier
    if (regionCheck.regionType === 'municipio') {
      score *= 1.5;
    } else if (regionCheck.regionType === 'nacional') {
      score *= 0.8;
    }

    if (score < SCORE_THRESHOLD || matchedKeywords.length === 0) {
      return false;
    }

    // Avoid duplicates
    const existing = await this.prisma.opportunity.findFirst({
      where: { tenantId: tenant.id, biddingId: bidding.id },
    });
    if (existing) {
      return false;
    }

    // Enrich with CAPAG rating when bidding is municipal
    let capagRatingSnapshot: string | null = null;
    if (bidding.municipalityIbgeCode) {
      try {
        const capag = await this.capagService.getCapagByMunicipality(bidding.municipalityIbgeCode);
        capagRatingSnapshot = capag?.capagRating ?? null;
      } catch (capagError) {
        this.logger.warn(
          `Could not fetch CAPAG for ibgeCode=${bidding.municipalityIbgeCode}: ${capagError instanceof Error ? capagError.message : String(capagError)}`,
        );
      }
    }

    await this.prisma.opportunity.create({
      data: {
        tenantId: tenant.id,
        biddingId: bidding.id,
        matchingScore: score,
        matchedKeywords: matchedKeywords,
        matchedRegionType: regionCheck.regionType,
        capagRatingSnapshot,
        status: 'new',
      },
    });

    this.logger.log(
      `Opportunity created: tenant=${tenant.id} bidding=${bidding.id} score=${score.toFixed(2)} keywords=[${matchedKeywords.join(', ')}]`,
    );

    // Dispatch report generation job
    try {
      const opportunity = await this.prisma.opportunity.findFirst({
        where: { tenantId: tenant.id, biddingId: bidding.id },
        orderBy: { createdAt: 'desc' },
      });

      if (opportunity) {
        const report = await this.prisma.report.create({
          data: {
            tenantId: tenant.id,
            biddingId: bidding.id,
            opportunityId: opportunity.id,
            reportType: 'bidding_analysis',
            status: 'queued',
            createdBySystem: true,
          },
        });

        await this.reportsQueue.add(
          'generate-report',
          {
            reportId: report.id,
            biddingId: bidding.id,
            tenantId: tenant.id,
            opportunityId: opportunity.id,
          },
          { attempts: 3, backoff: { type: 'exponential', delay: 5000 } },
        );

        this.logger.log(
          `Queued report generation: reportId=${report.id} for opportunity=${opportunity.id}`,
        );
      }
    } catch (reportError) {
      this.logger.error(
        `Failed to queue report for bidding=${bidding.id} tenant=${tenant.id}: ${reportError instanceof Error ? reportError.message : String(reportError)}`,
      );
    }

    // Dispatch notification job
    try {
      const opportunityForNotif = await this.prisma.opportunity.findFirst({
        where: { tenantId: tenant.id, biddingId: bidding.id },
        orderBy: { createdAt: 'desc' },
        select: { id: true },
      });

      if (opportunityForNotif) {
        await this.notificationsQueue.add(
          'opportunity-alert',
          {
            type: 'opportunity_alert',
            opportunityId: opportunityForNotif.id,
            tenantId: tenant.id,
          },
          { attempts: 3, backoff: { type: 'exponential', delay: 5000 } },
        );

        this.logger.log(
          `Queued notification: opportunityId=${opportunityForNotif.id} tenant=${tenant.id}`,
        );
      }
    } catch (notifError) {
      this.logger.error(
        `Failed to queue notification for bidding=${bidding.id} tenant=${tenant.id}: ${notifError instanceof Error ? notifError.message : String(notifError)}`,
      );
    }

    return true;
  }

  private checkRegionMatch(
    bidding: BiddingWithItems,
    regions: TenantWithPreferences['companyRegions'],
  ): { matches: boolean; regionType: string | null } {
    for (const region of regions) {
      if (region.scopeType === 'nacional') {
        return { matches: true, regionType: 'nacional' };
      }
      if (region.scopeType === 'uf' && bidding.uf && bidding.uf === region.uf) {
        return { matches: true, regionType: 'uf' };
      }
      if (
        region.scopeType === 'municipio' &&
        bidding.municipalityIbgeCode &&
        bidding.municipalityIbgeCode === region.municipalityIbgeCode
      ) {
        return { matches: true, regionType: 'municipio' };
      }
    }
    return { matches: false, regionType: null };
  }
}
