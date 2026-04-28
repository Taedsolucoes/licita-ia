import { Injectable, Inject, Logger } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { PrismaService } from '../prisma/prisma.service';
import { QUEUE_NAMES } from '../queue/queue.module';
import {
  BiddingSourceProvider,
  BIDDING_SOURCE_PROVIDER,
  BiddingSourceRaw,
} from './providers/bidding-source.provider';

export interface SyncResult {
  syncRunId: string;
  recordsRead: number;
  recordsCreated: number;
  recordsUpdated: number;
  status: string;
  errors: string[];
}

@Injectable()
export class IntegrationService {
  private readonly logger = new Logger(IntegrationService.name);

  constructor(
    private prisma: PrismaService,
    @Inject(BIDDING_SOURCE_PROVIDER) private provider: BiddingSourceProvider,
    @InjectQueue(QUEUE_NAMES.MATCHING) private matchingQueue: Queue,
  ) {}

  async syncBiddings(): Promise<SyncResult> {
    const syncRun = await this.prisma.integrationSyncRun.create({
      data: {
        integrationName: this.provider.sourceName,
        runType: 'manual',
        status: 'running',
      },
    });

    let recordsRead = 0;
    let recordsCreated = 0;
    let recordsUpdated = 0;
    const errors: string[] = [];

    try {
      let cursor: string | undefined;
      let hasMore = true;

      while (hasMore) {
        const result = await this.provider.fetchBiddings({ cursor, limit: 50 });
        recordsRead += result.totalFetched;

        for (const biddingRaw of result.biddings) {
          try {
            const { created } = await this.upsertBidding(biddingRaw);
            if (created) {
              recordsCreated++;
            } else {
              recordsUpdated++;
            }
          } catch (error) {
            const msg = `Error processing bidding ${biddingRaw.externalId}: ${error instanceof Error ? error.message : String(error)}`;
            this.logger.error(msg);
            errors.push(msg);
          }
        }

        cursor = result.nextCursor || undefined;
        hasMore = result.nextCursor !== null;
      }

      const status = errors.length > 0 ? 'partial' : 'success';

      await this.prisma.integrationSyncRun.update({
        where: { id: syncRun.id },
        data: {
          finishedAt: new Date(),
          status,
          recordsRead,
          recordsCreated,
          recordsUpdated,
          errorSummary: errors.length > 0 ? errors.join('; ') : null,
        },
      });

      return {
        syncRunId: syncRun.id,
        recordsRead,
        recordsCreated,
        recordsUpdated,
        status,
        errors,
      };
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error);
      this.logger.error(`Sync failed: ${errorMsg}`);

      await this.prisma.integrationSyncRun.update({
        where: { id: syncRun.id },
        data: {
          finishedAt: new Date(),
          status: 'failed',
          recordsRead,
          recordsCreated,
          recordsUpdated,
          errorSummary: errorMsg,
        },
      });

      return {
        syncRunId: syncRun.id,
        recordsRead,
        recordsCreated,
        recordsUpdated,
        status: 'failed',
        errors: [errorMsg],
      };
    }
  }

  async healthCheck() {
    return this.provider.healthCheck();
  }

  private async upsertBidding(raw: BiddingSourceRaw): Promise<{ created: boolean }> {
    const existing = await this.prisma.bidding.findUnique({
      where: {
        source_sourceExternalId: {
          source: this.provider.sourceName,
          sourceExternalId: raw.externalId,
        },
      },
    });

    if (existing) {
      // Update existing bidding
      await this.prisma.bidding.update({
        where: { id: existing.id },
        data: {
          biddingNumber: raw.biddingNumber,
          modality: raw.modality,
          uasg: raw.uasg,
          sphere: raw.sphere,
          agencyName: raw.agencyName,
          agencyDocument: raw.agencyDocument,
          objectText: raw.objectText,
          objectSummary: raw.objectSummary,
          sourceUrl: raw.sourceUrl,
          publicationDate: raw.publicationDate,
          openingDate: raw.openingDate,
          proposalDueDate: raw.proposalDueDate,
          estimatedValue: raw.estimatedValue,
          municipalityName: raw.municipalityName,
          municipalityIbgeCode: raw.municipalityIbgeCode,
          uf: raw.uf,
          status: raw.status,
          rawPayload: raw.rawPayload as any,
        },
      });

      this.logger.debug(`Updated bidding ${raw.externalId}`);
      return { created: false };
    }

    // Create new bidding with items
    const bidding = await this.prisma.bidding.create({
      data: {
        source: this.provider.sourceName,
        sourceExternalId: raw.externalId,
        sourceUrl: raw.sourceUrl,
        biddingNumber: raw.biddingNumber,
        modality: raw.modality,
        uasg: raw.uasg,
        sphere: raw.sphere,
        agencyName: raw.agencyName,
        agencyDocument: raw.agencyDocument,
        objectText: raw.objectText,
        objectSummary: raw.objectSummary,
        publicationDate: raw.publicationDate,
        openingDate: raw.openingDate,
        proposalDueDate: raw.proposalDueDate,
        estimatedValue: raw.estimatedValue,
        municipalityName: raw.municipalityName,
        municipalityIbgeCode: raw.municipalityIbgeCode,
        uf: raw.uf,
        status: raw.status,
        rawPayload: raw.rawPayload as any,
        items: {
          create: raw.items.map((item) => ({
            itemNumber: item.itemNumber,
            description: item.description,
            quantity: item.quantity,
            unit: item.unit,
            unitValueEstimated: item.unitValueEstimated,
            totalValueEstimated: item.totalValueEstimated,
            catalogCode: item.catalogCode,
            rawPayload: item.rawPayload as any,
          })),
        },
      },
    });

    this.logger.log(`Created bidding ${raw.externalId} (id: ${bidding.id}) with ${raw.items.length} items`);

    // Dispatch matching job for the new bidding
    await this.matchingQueue.add('match-bidding', {
      biddingId: bidding.id,
    });

    this.logger.log(`Queued matching job for bidding ${bidding.id}`);

    return { created: true };
  }
}
