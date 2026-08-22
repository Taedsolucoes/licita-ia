import { Injectable, Inject, Logger, Optional } from '@nestjs/common';
import { createHash, randomUUID } from 'node:crypto';
import { InjectQueue } from '@nestjs/bullmq';
import { ConfigService } from '@nestjs/config';
import { Queue } from 'bullmq';
import { PrismaService } from '../prisma/prisma.service';
import { QUEUE_NAMES } from '../queue/queue.module';
import { RedisService } from '../redis/redis.service';
import {
  BiddingSourceProvider,
  BIDDING_SOURCE_PROVIDERS,
  BiddingSourceRaw,
} from './providers/bidding-source.provider';

export interface SyncResult {
  syncRunId: string;
  syncRunIds?: string[];
  recordsRead: number;
  recordsCreated: number;
  recordsUpdated: number;
  status: string;
  errors: string[];
}

interface PersistedIngestionCursor {
  ufIndex: number;
  providerCursor: string | null;
  queryMode: 'publication' | 'open_proposals';
}

@Injectable()
export class IntegrationService {
  private readonly logger = new Logger(IntegrationService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly configService: ConfigService,
    @InjectQueue(QUEUE_NAMES.MATCHING) private readonly matchingQueue: Queue,
    @Optional()
    @Inject(BIDDING_SOURCE_PROVIDERS)
    private readonly providers?: BiddingSourceProvider[],
    @Optional() private readonly redis?: RedisService,
  ) {}

  /** Resolve the UFs configured by active tenants for providers that require scoped calls. */
  private async resolveSyncUfs(): Promise<string[]> {
    const regions = await this.prisma.companyRegion.findMany({
      where: { tenant: { status: 'active' }, uf: { not: '' } },
      select: { uf: true },
    });

    return Array.from(new Set(regions.map((region) => region.uf).filter((uf): uf is string => !!uf)));
  }

  async syncBiddings(runType: string = 'manual'): Promise<SyncResult> {
    if (!this.redis) return this.syncBiddingsUnlocked(runType);

    const lockKey = 'licita-ia:lock:official-source-sync';
    const lockToken = randomUUID();
    const configuredTtl = Number(this.configService.get<number>('SYNC_LOCK_TTL_SECONDS', 3600));
    const lockTtlSeconds = Math.max(60, Number.isFinite(configuredTtl) ? configuredTtl : 3600);
    const acquired = await this.redis.getClient().set(lockKey, lockToken, 'EX', lockTtlSeconds, 'NX');

    if (acquired !== 'OK') {
      this.logger.warn('Official-source sync skipped because another cycle holds the distributed lock');
      return {
        syncRunId: '',
        recordsRead: 0,
        recordsCreated: 0,
        recordsUpdated: 0,
        status: 'skipped',
        errors: ['Another official-source synchronization is already running'],
      };
    }

    try {
      return await this.syncBiddingsUnlocked(runType);
    } finally {
      try {
        await this.redis.getClient().eval(
          "if redis.call('get', KEYS[1]) == ARGV[1] then return redis.call('del', KEYS[1]) else return 0 end",
          1,
          lockKey,
          lockToken,
        );
      } catch (error) {
        this.logger.error(`Could not release official-source sync lock: ${String(error)}`);
      }
    }
  }

  private async syncBiddingsUnlocked(runType: string): Promise<SyncResult> {
    const providers = this.providers ?? [];
    if (providers.length === 0) {
      return this.createDisabledSync(runType);
    }

    const results: SyncResult[] = [];
    for (const provider of providers) {
      const queryModes: Array<'publication' | 'open_proposals'> = provider.sourceName === 'pncp'
        ? ['publication', 'open_proposals']
        : ['publication'];
      for (const queryMode of queryModes) {
        results.push(await this.syncProvider(provider, runType, queryMode));
      }
    }

    const status = results.some((result) => result.status === 'failed')
      ? 'failed'
      : results.some((result) => result.status === 'partial')
        ? 'partial'
        : results.every((result) => result.status === 'skipped')
          ? 'skipped'
          : 'success';

    return {
      syncRunId: results.map((result) => result.syncRunId).join(','),
      syncRunIds: results.map((result) => result.syncRunId),
      recordsRead: results.reduce((total, result) => total + result.recordsRead, 0),
      recordsCreated: results.reduce((total, result) => total + result.recordsCreated, 0),
      recordsUpdated: results.reduce((total, result) => total + result.recordsUpdated, 0),
      status,
      errors: results.flatMap((result) => result.errors),
    };
  }

  private async createDisabledSync(runType: string): Promise<SyncResult> {
    const syncRun = await this.prisma.integrationSyncRun.create({
      data: {
        integrationName: 'public-sources-disabled',
        runType,
        status: 'skipped',
        finishedAt: new Date(),
        errorSummary: 'No official bidding source provider is registered',
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

  private async syncProvider(
    provider: BiddingSourceProvider,
    runType: string,
    queryMode: 'publication' | 'open_proposals',
  ): Promise<SyncResult> {
    const sourceId = await this.ensureSourceRegistry(provider);
    const syncRun = await this.prisma.integrationSyncRun.create({
      data: {
        integrationName: provider.sourceName,
        sourceId,
        runType: `${runType}:${queryMode}`,
        status: 'running',
      },
    });

    let recordsRead = 0;
    let recordsCreated = 0;
    let recordsUpdated = 0;
    const errors: string[] = [];

    try {
      const ufs = provider.requiresFilter === false ? [undefined] : await this.resolveSyncUfs();

      if (ufs.length === 0) {
        const message = 'No active tenant regions configured — source requires a scoped filter';
        this.logger.warn(`${provider.sourceName}: ${message}`);
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

      const cursorState = sourceId
        ? await this.prisma.ingestionCursor.findUnique({ where: { sourceId } })
        : null;
      const parsedCursor = this.parsePersistedCursor(cursorState?.cursorValue);
      const persisted = parsedCursor.queryMode === queryMode
        ? parsedCursor
        : { ufIndex: 0, providerCursor: null, queryMode };
      const window = this.resolveSyncWindow(provider.sourceName, cursorState?.windowStart, cursorState?.windowEnd);
      const initialUfIndex = Math.min(persisted.ufIndex, Math.max(0, ufs.length - 1));

      await this.prisma.integrationSyncRun.update({
        where: { id: syncRun.id },
        data: {
          cursorReference: JSON.stringify({
            windowStart: window.since.toISOString(),
            windowEnd: window.until.toISOString(),
            ufIndex: initialUfIndex,
            providerCursor: persisted.providerCursor,
            queryMode,
          }),
        },
      });

      if (sourceId) {
        await this.persistCursor(
          sourceId,
          persisted,
          window.since,
          window.until,
        );
      }

      for (let ufIndex = initialUfIndex; ufIndex < ufs.length; ufIndex++) {
        const uf = ufs[ufIndex];
        let cursor: string | undefined = ufIndex === initialUfIndex
          ? persisted.providerCursor ?? undefined
          : undefined;
        let hasMore = true;

        while (hasMore) {
          const result = await provider.fetchBiddings({
            cursor,
            limit: 500,
            uf,
            since: window.since,
            until: window.until,
            queryMode,
          });
          recordsRead += result.totalFetched;

          for (const biddingRaw of result.biddings) {
            try {
              await this.recordRawSnapshot(biddingRaw, sourceId, syncRun.id, provider.sourceName);
              const { created } = await this.upsertBidding(biddingRaw, sourceId, provider);
              if (created) {
                recordsCreated++;
              } else {
                recordsUpdated++;
              }
            } catch (error) {
              const message =
                `Error processing ${provider.sourceName} bidding ${biddingRaw.externalId}: `
                + `${error instanceof Error ? error.message : String(error)}`;
              this.logger.error(message);
              errors.push(message);
            }
          }

          cursor = result.nextCursor || undefined;
          hasMore = result.nextCursor !== null;

          if (sourceId) {
            await this.persistCursor(
              sourceId,
              { ufIndex, providerCursor: result.nextCursor, queryMode },
              window.since,
              window.until,
            );
          }
        }

        if (sourceId && ufIndex < ufs.length - 1) {
          await this.persistCursor(
            sourceId,
            { ufIndex: ufIndex + 1, providerCursor: null, queryMode },
            window.since,
            window.until,
          );
        }
      }

      if (sourceId) {
        const overlapHours = Math.max(
          0,
          this.configService.get<number>('SYNC_WINDOW_OVERLAP_HOURS', 6),
        );
        const nextWindowStart = new Date(window.until.getTime() - overlapHours * 60 * 60 * 1000);
        await this.persistCursor(
          sourceId,
          { ufIndex: 0, providerCursor: null, queryMode },
          nextWindowStart,
          null,
        );
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
      const errorMessage = error instanceof Error ? error.message : String(error);
      this.logger.error(`${provider.sourceName} sync failed: ${errorMessage}`);

      await this.prisma.integrationSyncRun.update({
        where: { id: syncRun.id },
        data: {
          finishedAt: new Date(),
          status: 'failed',
          recordsRead,
          recordsCreated,
          recordsUpdated,
          errorSummary: errorMessage,
        },
      });

      return {
        syncRunId: syncRun.id,
        recordsRead,
        recordsCreated,
        recordsUpdated,
        status: 'failed',
        errors: [errorMessage],
      };
    }
  }

  private parsePersistedCursor(value?: string | null): PersistedIngestionCursor {
    if (!value) return { ufIndex: 0, providerCursor: null, queryMode: 'publication' };

    try {
      const parsed = JSON.parse(value) as Record<string, unknown>;
      const ufIndex = typeof parsed.ufIndex === 'number' && Number.isInteger(parsed.ufIndex)
        ? Math.max(0, parsed.ufIndex)
        : 0;
      const providerCursor = typeof parsed.providerCursor === 'string'
        ? parsed.providerCursor
        : null;
      const queryMode = parsed.queryMode === 'open_proposals' ? 'open_proposals' : 'publication';
      return { ufIndex, providerCursor, queryMode };
    } catch {
      this.logger.warn('Invalid persisted ingestion cursor; restarting source window from its fallback');
      return { ufIndex: 0, providerCursor: null, queryMode: 'publication' };
    }
  }

  private resolveSyncWindow(
    sourceName: string,
    storedStart?: Date | null,
    storedEnd?: Date | null,
  ): { since: Date; until: Date } {
    const now = new Date();
    const defaultDays = sourceName === 'pncp'
      ? this.configService.get<number>('PNCP_LOOKBACK_DAYS', 7)
      : this.configService.get<number>('COMPRAS_PUBLICAS_LOOKBACK_DAYS', 7);
    const fallbackSince = new Date(now.getTime() - Math.max(1, defaultDays) * 24 * 60 * 60 * 1000);
    const since = storedStart ?? fallbackSince;
    const until = storedEnd ?? now;

    if (until <= since) {
      return { since: fallbackSince, until: now };
    }
    return { since, until };
  }

  private async persistCursor(
    sourceId: string,
    cursor: PersistedIngestionCursor,
    windowStart: Date,
    windowEnd: Date | null,
  ): Promise<void> {
    await this.prisma.ingestionCursor.upsert({
      where: { sourceId },
      create: {
        sourceId,
        cursorType: 'provider-page',
        cursorValue: JSON.stringify(cursor),
        windowStart,
        windowEnd,
      },
      update: {
        cursorType: 'provider-page',
        cursorValue: JSON.stringify(cursor),
        windowStart,
        windowEnd,
      },
    });
  }

  async healthCheck(): Promise<{
    healthy: boolean;
    checkedAt: string;
    message: string;
    sources: Array<{
      sourceName: string;
      healthy: boolean;
      message: string;
      lastSuccessfulSyncAt: string | null;
      ingestionFresh: boolean;
    }>;
  }> {
    const providers = this.providers ?? [];
    if (providers.length === 0) {
      return {
        healthy: false,
        checkedAt: new Date().toISOString(),
        message: 'No official bidding source provider is registered',
        sources: [],
      };
    }

    const configuredInterval = Number(this.configService.get<number>('SYNC_INTERVAL_MS', 1_800_000));
    const freshnessWindowMs = Math.max(300_000, (Number.isFinite(configuredInterval) ? configuredInterval : 1_800_000) * 2);
    const syncEnabled = this.configService.get<string>('PUBLIC_SOURCES_SYNC_ENABLED', 'false') === 'true';
    const checks: Array<{
      sourceName: string;
      healthy: boolean;
      message: string;
      lastSuccessfulSyncAt: string | null;
      ingestionFresh: boolean;
    }> = [];

    for (const provider of providers) {
      try {
        const sourceHealth = await provider.healthCheck();
        const recentRuns = await this.prisma.integrationSyncRun.findMany({
          where: {
            integrationName: provider.sourceName,
            status: { in: ['success', 'partial'] },
          },
          orderBy: { finishedAt: 'desc' },
          take: 1,
          select: { finishedAt: true },
        });
        const lastSuccessfulAt = recentRuns[0]?.finishedAt ?? null;
        const ingestionFresh = !syncEnabled
          || (lastSuccessfulAt instanceof Date && Date.now() - lastSuccessfulAt.getTime() <= freshnessWindowMs);
        checks.push({
          sourceName: provider.sourceName,
          healthy: sourceHealth.healthy && ingestionFresh,
          message: ingestionFresh
            ? sourceHealth.message
            : `${sourceHealth.message}; ingestion is stale or has not completed`,
          lastSuccessfulSyncAt: lastSuccessfulAt?.toISOString() ?? null,
          ingestionFresh,
        });
      } catch (error) {
        checks.push({
          sourceName: provider.sourceName,
          healthy: false,
          message: error instanceof Error ? error.message : String(error),
          lastSuccessfulSyncAt: null,
          ingestionFresh: false,
        });
      }
    }

    return {
      healthy: checks.every((check) => check.healthy),
      checkedAt: new Date().toISOString(),
      message: checks.map((check) => `${check.sourceName}: ${check.message}`).join('; '),
      sources: checks,
    };
  }

  async listSyncRuns(limit = 50) {
    const safeLimit = Math.min(100, Math.max(1, Math.trunc(limit)));
    const [total, data] = await this.prisma.$transaction([
      this.prisma.integrationSyncRun.count(),
      this.prisma.integrationSyncRun.findMany({
        orderBy: { startedAt: 'desc' },
        take: safeLimit,
        select: {
          id: true,
          integrationName: true,
          sourceId: true,
          runType: true,
          startedAt: true,
          finishedAt: true,
          status: true,
          cursorReference: true,
          recordsRead: true,
          recordsCreated: true,
          recordsUpdated: true,
          errorSummary: true,
          sourceRegistry: {
            select: { code: true, name: true, authority: true },
          },
        },
      }),
    ]);

    return { data, total, limit: safeLimit };
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
    provider: BiddingSourceProvider,
  ): Promise<{ created: boolean }> {
    const sourceRecordKey = raw.sourceRecordKey ?? raw.externalId;
    const existing = await this.prisma.bidding.findUnique({
      where: {
        source_sourceExternalId: {
          source: provider.sourceName,
          sourceExternalId: raw.externalId,
        },
      },
    });

    const provenance = {
      sourceId,
      sourceRecordKey,
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
    };

    if (existing) {
      await this.prisma.bidding.update({
        where: { id: existing.id },
        data: {
          ...provenance,
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

      this.logger.debug(`Updated ${provider.sourceName} bidding ${raw.externalId}`);
      return { created: false };
    }

    const bidding = await this.prisma.bidding.create({
      data: {
        source: provider.sourceName,
        sourceExternalId: raw.externalId,
        sourceUrl: raw.sourceUrl,
        ...provenance,
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

    this.logger.log(
      `Created ${provider.sourceName} bidding ${raw.externalId} (id: ${bidding.id}) with ${raw.items.length} items`,
    );
    await this.matchingQueue.add('match-bidding', { biddingId: bidding.id });
    return { created: true };
  }
}
