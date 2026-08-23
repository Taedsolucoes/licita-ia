import { strict as assert } from 'node:assert';
import { test } from 'node:test';
import { ConfigService } from '@nestjs/config';
import { IntegrationProcessor } from '../src/modules/integration/integration.processor';
import { IntegrationScheduler } from '../src/modules/integration/integration.scheduler';
import { IntegrationService } from '../src/modules/integration/integration.service';
import type {
  BiddingSourceProvider,
  BiddingSourceRaw,
  FetchBiddingsOptions,
} from '../src/modules/integration/providers/bidding-source.provider';

function createRawBidding(): BiddingSourceRaw {
  return {
    externalId: 'source-record-1',
    sourceRecordKey: 'source-record-1',
    pncpControlNumber: 'source-record-1',
    sourceSystemName: 'Official source',
    modalityCode: '6',
    modalityNormalized: 'pregao-eletronico',
    procurementLaw: '14.133/2021',
    processNumber: '1/2026',
    purchaseYear: 2026,
    publicationUpdatedAt: new Date('2026-08-21T12:00:00.000Z'),
    sourceUpdatedAt: new Date('2026-08-21T12:00:00.000Z'),
    biddingNumber: '1/2026',
    modality: 'Pregão Eletrônico',
    uasg: null,
    sphere: 'MUNICIPAL',
    agencyName: 'Prefeitura Teste',
    agencyDocument: null,
    objectText: 'Aquisição de insumos hospitalares',
    objectSummary: 'Insumos hospitalares',
    sourceUrl: 'https://example.gov/licitacao/1',
    publicationDate: new Date('2026-08-21T12:00:00.000Z'),
    openingDate: new Date('2026-09-01T12:00:00.000Z'),
    proposalDueDate: new Date('2026-08-31T12:00:00.000Z'),
    estimatedValue: 10000,
    municipalityName: 'Rio das Ostras',
    municipalityIbgeCode: '3304524',
    uf: 'RJ',
    status: 'open',
    rawPayload: { id: 'source-record-1' },
    items: [
      {
        itemNumber: 1,
        description: 'Luva hospitalar',
        quantity: 10,
        unit: 'unidade',
        unitValueEstimated: 100,
        totalValueEstimated: 1000,
        catalogCode: null,
        rawPayload: { item: 1 },
      },
    ],
  };
}

function createProvider(calls: FetchBiddingsOptions[]): BiddingSourceProvider {
  let page = 0;
  return {
    sourceName: 'pncp',
    requiresFilter: false,
    getSourceMetadata: () => ({
      name: 'Portal Nacional de Contratações Públicas',
      scope: 'federal',
      authority: 'Governo Federal',
      baseUrl: 'https://pncp.gov.br',
      apiUrl: 'https://pncp.gov.br/api/consulta',
      protocol: 'REST/HTTP JSON',
    }),
    fetchBiddings: async (options) => {
      calls.push(options ?? {});
      page += 1;
      return page === 1
        ? { biddings: [createRawBidding()], nextCursor: 'cursor-page-2', totalFetched: 1 }
        : { biddings: [], nextCursor: null, totalFetched: 0 };
    },
    fetchBiddingDetails: async () => null,
    fetchBiddingItems: async () => [],
    healthCheck: async () => ({ healthy: true, message: 'ok' }),
  };
}

function createIntegrationPrisma(cursorState: Record<string, unknown> | null = null) {
  const cursorUpserts: unknown[] = [];
  const runUpdates: unknown[] = [];
  const rawUpserts: unknown[] = [];
  const queueAdds: unknown[] = [];
  const prisma = {
    companyRegion: { findMany: async () => [] },
    sourceRegistry: {
      upsert: async () => ({ id: 'source-id' }),
    },
    integrationSyncRun: {
      create: async () => ({ id: 'run-id' }),
      update: async (args: unknown) => {
        runUpdates.push(args);
        return {};
      },
      count: async () => 0,
      findMany: async () => [],
    },
    ingestionCursor: {
      findUnique: async () => cursorState,
      upsert: async (args: unknown) => {
        cursorUpserts.push(args);
        return {};
      },
    },
    rawIngestRecord: {
      updateMany: async () => ({}),
      upsert: async (args: unknown) => {
        rawUpserts.push(args);
        return {};
      },
    },
    bidding: {
      findUnique: async () => null,
      create: async () => ({ id: 'bidding-id' }),
      update: async () => ({}),
    },
    $transaction: async (operations: Promise<unknown>[]) => Promise.all(operations),
  };
  const matchingQueue = {
    add: async (...args: unknown[]) => {
      queueAdds.push(args);
      return {};
    },
  };

  return { prisma, cursorUpserts, runUpdates, rawUpserts, queueAdds, matchingQueue };
}

test('registers a persistent BullMQ scheduler only when public sync is enabled', async () => {
  const calls: unknown[] = [];
  const queue = {
    upsertJobScheduler: async (...args: unknown[]) => {
      calls.push(args);
      return { id: 'next-job-id' };
    },
  };
  const scheduler = new IntegrationScheduler(
    { syncBiddings: async () => ({ syncRunId: 'run', recordsRead: 0, recordsCreated: 0, recordsUpdated: 0, status: 'success', errors: [] }) } as never,
    new ConfigService({ PUBLIC_SOURCES_SYNC_ENABLED: 'true', SYNC_INTERVAL_MS: 120000 }),
    queue as never,
  );

  await scheduler.onApplicationBootstrap();

  assert.equal(calls.length, 1);
  assert.deepEqual(calls[0], [
    'public-source-sync',
    { every: 120000 },
    {
      name: 'sync-public-sources',
      data: { runType: 'scheduled' },
      opts: {
        attempts: 3,
        backoff: { type: 'exponential', delay: 10000 },
        removeOnComplete: { count: 100 },
        removeOnFail: { count: 100 },
      },
    },
  ]);
});

test('does not register the public-source scheduler when the feature flag is off', async () => {
  let called = false;
  const removedIds: string[] = [];
  const queue = {
    upsertJobScheduler: async () => {
      called = true;
      return { id: 'unexpected' };
    },
    removeJobScheduler: async (id: string) => {
      removedIds.push(id);
      return true;
    },
  };
  const scheduler = new IntegrationScheduler(
    { syncBiddings: async () => ({ syncRunId: 'run', recordsRead: 0, recordsCreated: 0, recordsUpdated: 0, status: 'success', errors: [] }) } as never,
    new ConfigService({ PUBLIC_SOURCES_SYNC_ENABLED: 'false' }),
    queue as never,
  );

  await scheduler.onApplicationBootstrap();
  assert.equal(called, false);
  assert.deepEqual(removedIds, ['public-source-sync']);
});

test('persists the source cursor after each page and closes the window with overlap', async () => {
  const calls: FetchBiddingsOptions[] = [];
  const provider = createProvider(calls);
  const { prisma, cursorUpserts, runUpdates, rawUpserts, queueAdds, matchingQueue } = createIntegrationPrisma();
  const service = new IntegrationService(
    prisma as never,
    new ConfigService({ PNCP_LOOKBACK_DAYS: 7, SYNC_WINDOW_OVERLAP_HOURS: 6 }),
    matchingQueue as never,
    [provider],
  );

  const result = await service.syncBiddings('scheduled');

  assert.equal(result.status, 'success');
  assert.equal(result.recordsRead, 1);
  assert.equal(result.recordsCreated, 1);
  assert.equal(rawUpserts.length, 1);
  assert.equal(queueAdds.length, 1);
  assert.equal(calls.length, 2);
  assert.equal(calls[0]?.cursor, undefined);
  assert.equal(calls[1]?.cursor, 'cursor-page-2');
  assert.ok(calls[0]?.since instanceof Date);
  assert.ok(calls[0]?.until instanceof Date);
  assert.equal(calls[0]?.since?.toISOString(), calls[1]?.since?.toISOString());
  assert.equal(calls[0]?.until?.toISOString(), calls[1]?.until?.toISOString());
  assert.ok(cursorUpserts.length >= 3);

  const finalCursor = cursorUpserts[cursorUpserts.length - 1] as { update: { cursorValue: string; windowEnd: Date | null } };
  assert.deepEqual(JSON.parse(finalCursor.update.cursorValue), {
    ufIndex: 0,
    providerCursor: null,
  });
  assert.equal(finalCursor.update.windowEnd, null);

  const cursorReferenceUpdate = runUpdates.find((entry) =>
    Boolean((entry as { data?: { cursorReference?: string } }).data?.cursorReference),
  ) as { data: { cursorReference: string } } | undefined;
  assert.ok(cursorReferenceUpdate);
  assert.equal(JSON.parse(cursorReferenceUpdate.data.cursorReference).ufIndex, 0);
});

test('resumes a persisted provider cursor and fixed window after interruption', async () => {
  const calls: FetchBiddingsOptions[] = [];
  const provider = createProvider(calls);
  const cursorState = {
    cursorValue: JSON.stringify({ ufIndex: 0, providerCursor: 'resume-cursor' }),
    windowStart: new Date('2026-08-20T00:00:00.000Z'),
    windowEnd: new Date('2026-08-21T00:00:00.000Z'),
  };
  const { prisma, matchingQueue } = createIntegrationPrisma(cursorState);
  const service = new IntegrationService(
    prisma as never,
    new ConfigService({ PNCP_LOOKBACK_DAYS: 7 }),
    matchingQueue as never,
    [provider],
  );

  await service.syncBiddings('scheduled');

  assert.equal(calls[0]?.cursor, 'resume-cursor');
  assert.equal(calls[0]?.since?.toISOString(), '2026-08-20T00:00:00.000Z');
  assert.equal(calls[0]?.until?.toISOString(), '2026-08-21T00:00:00.000Z');
});

test('processor propagates failed syncs so BullMQ can retry them', async () => {
  let called = false;
  const processor = new IntegrationProcessor({
    syncBiddings: async () => {
      called = true;
      return {
        syncRunId: 'run-id',
        recordsRead: 0,
        recordsCreated: 0,
        recordsUpdated: 0,
        status: 'failed',
        errors: ['upstream unavailable'],
      };
    },
  } as never);

  await assert.rejects(
    processor.process({ id: 'job-id', data: { runType: 'scheduled' } } as never),
    /upstream unavailable/,
  );
  assert.equal(called, true);
});
