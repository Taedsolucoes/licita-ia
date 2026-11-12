import { Injectable, Inject, Logger } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { PrismaService } from '../prisma/prisma.service';
import { QUEUE_NAMES } from '../queue/queue.module';
import {
  BiddingSourceProvider,
  BIDDING_SOURCE_PROVIDER,
  BiddingSourceRaw,
  FetchBiddingsOptions,
} from './providers/bidding-source.provider';
import { PncpProvider } from './providers/pncp.provider';
import { ComprasGovProvider } from './providers/compras-gov.provider';
import { PetronectProvider } from './providers/petronect.provider';

export interface SyncResult {
  syncRunId: string;
  recordsRead: number;
  recordsCreated: number;
  recordsUpdated: number;
  status: string;
  errors: string[];
}

export interface PncpSyncOptions {
  dataInicial: string;
  dataFinal: string;
  codigoModalidadeContratacao: number;
  codigoModoDisputa?: number;
  uf?: string;
  codigoMunicipioIbge?: string;
  palavraChave?: string;
  tamanhoPagina?: number;
  dataTipo?: 'publicacao' | 'atualizacao';
  incluirItens?: boolean;
  maxPages?: number;
  runType?: string;
}

@Injectable()
export class IntegrationService {
  private readonly logger = new Logger(IntegrationService.name);

  constructor(
    private readonly prisma: PrismaService,
    @Inject(BIDDING_SOURCE_PROVIDER) private readonly legacyProvider: BiddingSourceProvider,
    private readonly pncpProvider: PncpProvider,
    private readonly comprasGovProvider: ComprasGovProvider,
    private readonly petronectProvider: PetronectProvider,
    @InjectQueue(QUEUE_NAMES.MATCHING) private readonly matchingQueue: Queue,
  ) {}

  /** Existing AlertaLicitacao workflow: it requires a filtered request. */
  async syncBiddings(runType = 'manual'): Promise<SyncResult> {
    const ufs = await this.resolveSyncUfs();
    if (ufs.length === 0) {
      return this.recordSkippedRun(
        this.legacyProvider.sourceName,
        runType,
        'No active tenant regions configured — no UF filter available for AlertaLicitacao call',
      );
    }
    return this.syncProvider(
      this.legacyProvider,
      runType,
      ufs.map((uf) => ({ uf })),
      50,
    );
  }

  /**
   * Syncs one PNCP publication/update date window and one required modality.
   * Each modality is a separate PNCP query because the public endpoint requires
   * codigoModalidadeContratacao on every request.
   */
  async syncPncpBiddings(options: PncpSyncOptions): Promise<SyncResult> {
    const since = this.parsePncpDate(options.dataInicial);
    const until = this.parsePncpDate(options.dataFinal);
    if (!since || !until) throw new Error('PNCP dates must use yyyyMMdd.');
    if (until < since) throw new Error('PNCP dataFinal must be on or after dataInicial.');
    if (!Number.isInteger(options.codigoModalidadeContratacao) || options.codigoModalidadeContratacao < 1) {
      throw new Error('codigoModalidadeContratacao is required and must be a positive integer.');
    }

    const fetchOptions: FetchBiddingsOptions = {
      since,
      until,
      modalityCode: options.codigoModalidadeContratacao,
      disputeModeCode: options.codigoModoDisputa,
      uf: options.uf,
      municipalityIbgeCode: options.codigoMunicipioIbge,
      keyword: options.palavraChave,
      limit: options.tamanhoPagina ?? 50,
      dateMode: options.dataTipo === 'atualizacao' ? 'update' : 'publication',
      includeItems: options.incluirItens ?? false,
    };
    return this.syncProvider(this.pncpProvider, options.runType ?? 'manual', [fetchOptions], fetchOptions.limit ?? 50, options.maxPages);
  }
  async syncComprasGovBiddings(options: PncpSyncOptions): Promise<SyncResult> {
    const since = this.parsePncpDate(options.dataInicial);
    const until = this.parsePncpDate(options.dataFinal);
    if (!since || !until) throw new Error('Compras.gov.br dates must use yyyyMMdd.');
    if (until < since) throw new Error('Compras.gov.br dataFinal must be on or after dataInicial.');
    if (!Number.isInteger(options.codigoModalidadeContratacao) || options.codigoModalidadeContratacao < 1) {
      throw new Error('Compras.gov.br codigoModalidadeContratacao is required and must be positive.');
    }
    const fetchOptions: FetchBiddingsOptions = {
      since,
      until,
      modalityCode: options.codigoModalidadeContratacao,
      uf: options.uf,
      municipalityIbgeCode: options.codigoMunicipioIbge,
      keyword: options.palavraChave,
      limit: options.tamanhoPagina ?? 50,
      includeItems: options.incluirItens ?? false,
    };
    return this.syncProvider(this.comprasGovProvider, options.runType ?? 'manual', [fetchOptions], fetchOptions.limit ?? 50, options.maxPages);
  }
  async syncPetronectOpportunities(state: 'open' | 'closed', limit = 50): Promise<SyncResult> {
    const fetchOptions: FetchBiddingsOptions = { opportunityState: state, limit };
    return this.syncProvider(this.petronectProvider, 'queued', [fetchOptions], limit);
  }

  async healthCheck() {
    return this.legacyProvider.healthCheck();
  }

  async pncpHealthCheck() {
    return this.pncpProvider.healthCheck();
  }
  async comprasGovHealthCheck() {
    return this.comprasGovProvider.healthCheck();
  }
  async petronectHealthCheck() {
    return this.petronectProvider.healthCheck();
  }

  private async syncProvider(
    provider: BiddingSourceProvider,
    runType: string,
    filterSets: FetchBiddingsOptions[],
    limit: number,
    maxPages?: number,
  ): Promise<SyncResult> {
    const syncRun = await this.prisma.integrationSyncRun.create({
      data: { integrationName: provider.sourceName, runType, status: 'running' },
    });

    let recordsRead = 0;
    let recordsCreated = 0;
    let recordsUpdated = 0;
    const errors: string[] = [];

    try {
      for (const filters of filterSets) {
        let cursor: string | undefined;
        let pagesRead = 0;
        do {
          const result = await provider.fetchBiddings({ ...filters, cursor, limit });
          pagesRead++;
          recordsRead += result.totalFetched;

          for (const raw of result.biddings) {
            try {
              const { created } = await this.upsertBidding(provider.sourceName, raw);
              if (created) recordsCreated++;
              else recordsUpdated++;
            } catch (error) {
              const message = `Error processing ${provider.sourceName} bidding ${raw.externalId}: ${this.errorMessage(error)}`;
              this.logger.error(message);
              errors.push(message);
            }
          }
          cursor = result.nextCursor || undefined;
        } while (cursor && (maxPages === undefined || pagesRead < maxPages));
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
          errorSummary: errors.length > 0 ? errors.join('; ').slice(0, 10_000) : null,
        },
      });
      return { syncRunId: syncRun.id, recordsRead, recordsCreated, recordsUpdated, status, errors };
    } catch (error) {
      const errorMsg = this.errorMessage(error);
      this.logger.error(`${provider.sourceName} sync failed: ${errorMsg}`);
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

  private async recordSkippedRun(source: string, runType: string, reason: string): Promise<SyncResult> {
    const run = await this.prisma.integrationSyncRun.create({
      data: {
        integrationName: source,
        runType,
        status: 'skipped',
        finishedAt: new Date(),
        errorSummary: reason,
      },
    });
    this.logger.warn(reason);
    return {
      syncRunId: run.id,
      recordsRead: 0,
      recordsCreated: 0,
      recordsUpdated: 0,
      status: 'skipped',
      errors: [],
    };
  }

  private async resolveSyncUfs(): Promise<string[]> {
    const regions = await this.prisma.companyRegion.findMany({
      where: { tenant: { status: 'active' }, uf: { not: '' } },
      select: { uf: true },
    });
    return Array.from(new Set(regions.map((region) => region.uf).filter((uf): uf is string => !!uf)));
  }

  private async upsertBidding(source: string, raw: BiddingSourceRaw): Promise<{ created: boolean }> {
    if (!raw.externalId) throw new Error('Source record is missing its external id.');

    const uniqueKey = { source_sourceExternalId: { source, sourceExternalId: raw.externalId } };
    const existing = await this.prisma.bidding.findUnique({ where: uniqueKey });
    const scalarData = {
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
    };

    const bidding = existing
      ? await this.prisma.bidding.update({ where: { id: existing.id }, data: scalarData })
      : await this.prisma.bidding.create({
          data: {
            source,
            sourceExternalId: raw.externalId,
            ...scalarData,
          },
        });

    for (const item of raw.items ?? []) {
      const itemData = {
        description: item.description,
        quantity: item.quantity,
        unit: item.unit,
        unitValueEstimated: item.unitValueEstimated,
        totalValueEstimated: item.totalValueEstimated,
        catalogCode: item.catalogCode,
        rawPayload: item.rawPayload as any,
      };
      const existingItem = await this.prisma.biddingItem.findFirst({
        where: { biddingId: bidding.id, itemNumber: item.itemNumber },
        select: { id: true },
      });
      if (existingItem) {
        await this.prisma.biddingItem.update({ where: { id: existingItem.id }, data: itemData });
      } else {
        await this.prisma.biddingItem.create({
          data: { biddingId: bidding.id, itemNumber: item.itemNumber, ...itemData },
        });
      }
    }

    if (!existing) {
      await this.matchingQueue.add('match-bidding', { biddingId: bidding.id });
      this.logger.log(`Created ${source} bidding ${raw.externalId} with ${(raw.items ?? []).length} items; matching queued.`);
    }
    return { created: !existing };
  }

  private parsePncpDate(value: string): Date | null {
    if (!/^\d{8}$/.test(value)) return null;
    const year = Number(value.slice(0, 4));
    const month = Number(value.slice(4, 6));
    const day = Number(value.slice(6, 8));
    const date = new Date(Date.UTC(year, month - 1, day));
    if (date.getUTCFullYear() !== year || date.getUTCMonth() !== month - 1 || date.getUTCDate() !== day) return null;
    return date;
  }

  private errorMessage(error: unknown): string {
    return error instanceof Error ? error.message : String(error);
  }
}
