import { Injectable, Inject, Logger, Optional } from '@nestjs/common';
import { createHash } from 'node:crypto';
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
    @InjectQueue(QUEUE_NAMES.MATCHING) private matchingQueue: Queue,
    @Optional() @Inject(BIDDING_SOURCE_PROVIDER) private provider?: BiddingSourceProvider,
  ) {}

  /**
   * Determines which UF filters to use for the sync, derived from active
   * tenants' configured regions (CompanyRegion). The supplier's contract
   * PROHIBITS scanning without any filter, so we never call the provider
   * with an empty filter set. A "nacional" scope region has no single UF to
   * scan against every state (27 calls/tenant would blow past reasonable
   * sync time under the 1 req/s throttle) — instead, tenants without a
   * specific UF configured are matched locally against whatever biddings
   * are ingested for the UFs that ARE configured across the tenant base.
   * If no tenant has any UF-scoped region yet, the sync is skipped entirely
   * rather than risk an unfiltered call.
   */
  private async resolveSyncUfs(): Promise<string[]> {
    const regions = await this.prisma.companyRegion.findMany({
      where: { tenant: { status: 'active' }, uf: { not: '' } },
      select: { uf: true },
    });

    return Array.from(new Set(regions.map((r) => r.uf).filter((uf): uf is string => !!uf)));
  }

  async syncBiddings(runType: string = 'manual'): Promise<SyncResult> {
    const provider = this.provider;
    const sourceId = provider ? await this.ensureSourceRegistry(provider) : null;
    const syncRun = await this.prisma.integrationSyncRun.create({
      data: {
        integrationName: provider?.sourceName ?? 'legacy-alertalicitacao-disabled',
        sourceId,
        runType,
        status: 'running',
      },
    });

    let recordsRead = 0;
    let recordsCreated = 0;
    let recordsUpdated = 0;
    const errors: string[] = [];

    if (!provider) {
      const message =
        'Bidding source provider is disabled: the legacy Alerta Licitação adapter is isolated and no official provider is registered yet.';
      this.logger.warn(message);
      await this.prisma.integrationSyncRun.update({
        where: { id: syncRun.id },
        data: {
          finishedAt: new Date(),
          status: 'skipped',
          recordsRead: 0,
          recordsCreated: 0,
          recordsUpdated: 0,
          errorSummary: message,
        },
      });
      return {
        syncRunId: syncRun.id,
        recordsRead: 0,
        recordsCreated: 0,
        recordsUpdated: 0,
        status: 'skipped',
        errors: [],
      };
    }

    try {
      const ufs = provider.requiresFilter === false ? [undefined] : await this.resolveSyncUfs();

      if (ufs.length === 0) {
        this.logger.warn(
          'No active tenant regions configured — skipping sync because this source requires a scoped filter',
        );
        await this.prisma.integrationSyncRun.update({
          where: { id: syncRun.id },
          data: {
            finishedAt: new Date(),
            status: 'skipped',
            recordsRead: 0,
            recordsCreated: 0,
            recordsUpdated: 0,
            errorSummary: 'No tenant regions configured — no filter available for this source',
          },
        });
        return {
          syncRunId: syncRun.id,
          recordsRead: 0,
          recordsCreated: 0,
          recordsUpdated: 0,
          status: 'skipped',
          errors: [],
        };
      }

      for (const uf of ufs) {
        let cursor: string | undefined;
        let hasMore = true;

        while (hasMore) {
          const result = await provider.fetchBiddings({ cursor, limit: 50, uf });
          recordsRead += result.totalFetched;

          for (const biddingRaw of result.biddings) {
            try {
              await this.recordRawSnapshot(biddingRaw, sourceId, syncRun.id, provider.sourceName);
              const { created } = await this.upsertBidding(biddingRaw, sourceId);
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
    if (!this.provider) {
      return {
        healthy: false,
        message:
          'Bidding source provider disabled: the legacy Alerta Licitação adapter is isolated and no official provider is registered yet.',
      };
    }
    return this.provider.healthCheck();
  }

  private async ensureSourceRegistry(provider: BiddingSourceProvider): Promise<string | null> {
    const metadata = provider.getSourceMetadata?.();
    if (!metadata) return null;

    const source = await this.prisma.sourceRegistry.upsert({
      where: { code: provider.sourceName },
      create: {
        code: provider.sourceName,
        name: metadata.name,
        scope: metadata.scope,
        authority: metadata.authority ?? null,
        baseUrl: metadata.baseUrl ?? null,
        apiUrl: metadata.apiUrl ?? null,
        protocol: metadata.protocol ?? 'REST/HTTP JSON',
        coverageNotes: metadata.coverageNotes ?? null,
        termsUrl: metadata.termsUrl ?? null,
        rateLimitPerSec: metadata.rateLimitPerSec ?? null,
      },
      update: {
        name: metadata.name,
        scope: metadata.scope,
        authority: metadata.authority ?? null,
        baseUrl: metadata.baseUrl ?? null,
        apiUrl: metadata.apiUrl ?? null,
        protocol: metadata.protocol ?? 'REST/HTTP JSON',
        coverageNotes: metadata.coverageNotes ?? null,
        termsUrl: metadata.termsUrl ?? null,
        rateLimitPerSec: metadata.rateLimitPerSec ?? null,
        isActive: true,
      },
      select: { id: true },
    });

    return source.id;
  }

  private async recordRawSnapshot(
    raw: BiddingSourceRaw,
    sourceId: string | null,
    runId: string,
    parserVersion: string,
  ): Promise<void> {
    if (!sourceId) return;

    const sourceRecordKey = raw.sourceRecordKey ?? raw.externalId;
    const payloadSha256 = createHash('sha256')
      .update(JSON.stringify(raw.rawPayload))
      .digest('hex');

    await this.prisma.rawIngestRecord.updateMany({
      where: {
        sourceId,
        sourceRecordKey,
        NOT: { payloadSha256 },
      },
      data: { isCurrent: false },
    });

    await this.prisma.rawIngestRecord.upsert({
      where: {
        sourceId_sourceRecordKey_payloadSha256: {
          sourceId,
          sourceRecordKey,
          payloadSha256,
        },
      },
      create: {
        sourceId,
        runId,
        sourceRecordKey,
        payload: raw.rawPayload as any,
        payloadSha256,
        httpStatus: 200,
        parserVersion,
        isCurrent: true,
      },
      update: {
        runId,
        fetchedAt: new Date(),
        httpStatus: 200,
        parserVersion,
        isCurrent: true,
      },
    });
  }

  private async upsertBidding(
    raw: BiddingSourceRaw,
    sourceId: string | null,
  ): Promise<{ created: boolean }> {
    const provider = this.provider;
    if (!provider) {
      throw new Error('Cannot persist bidding without an enabled source provider');
    }
    const existing = await this.prisma.bidding.findUnique({
      where: {
        source_sourceExternalId: {
          source: provider.sourceName,
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
          sourceId,
          sourceRecordKey: raw.sourceRecordKey ?? raw.externalId,
          pncpControlNumber: raw.pncpControlNumber,
          sourceSystemName: raw.sourceSystemName,
          modalityCode: raw.modalityCode,
          modalityNormalized: raw.modalityNormalized,
          procurementLaw: raw.procurementLaw,
          processNumber: raw.processNumber,
          purchaseYear: raw.purchaseYear,
          publicationUpdatedAt: raw.publicationUpdatedAt,
          sourceUpdatedAt: raw.sourceUpdatedAt,
          lastSeenAt: new Date(),
        },
      });

      this.logger.debug(`Updated bidding ${raw.externalId}`);
      return { created: false };
    }

    // Create new bidding with items
    const bidding = await this.prisma.bidding.create({
      data: {
        source: provider.sourceName,
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
        sourceId,
        sourceRecordKey: raw.sourceRecordKey ?? raw.externalId,
        pncpControlNumber: raw.pncpControlNumber,
        sourceSystemName: raw.sourceSystemName,
        modalityCode: raw.modalityCode,
        modalityNormalized: raw.modalityNormalized,
        procurementLaw: raw.procurementLaw,
        processNumber: raw.processNumber,
        purchaseYear: raw.purchaseYear,
        publicationUpdatedAt: raw.publicationUpdatedAt,
        sourceUpdatedAt: raw.sourceUpdatedAt,
        lastSeenAt: new Date(),
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
