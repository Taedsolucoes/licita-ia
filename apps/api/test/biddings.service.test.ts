import { strict as assert } from 'node:assert';
import { test } from 'node:test';
import { BiddingsService } from '../src/modules/biddings/biddings.service';
import { BiddingSearchDto } from '../src/modules/biddings/dto/bidding-search.dto';

type PrismaMock = {
  bidding: {
    count: (args: unknown) => Promise<number>;
    findMany: (args: unknown) => Promise<unknown[]>;
    groupBy: (args: unknown) => Promise<unknown[]>;
  };
  $transaction: (operations: Promise<unknown>[]) => Promise<unknown[]>;
};

function createPrismaMock() {
  const countCalls: unknown[] = [];
  const findManyCalls: unknown[] = [];
  const groupByCalls: unknown[] = [];
  let groupByCall = 0;

  const prisma: PrismaMock = {
    bidding: {
      count: async (args) => {
        countCalls.push(args);
        return 3;
      },
      findMany: async (args) => {
        findManyCalls.push(args);
        return [
          {
            id: 'bidding-1',
            municipalityName: 'Rio das Ostras',
            uf: 'RJ',
            modality: 'Pregão Eletrônico',
          },
        ];
      },
      groupBy: async (args) => {
        groupByCalls.push(args);
        groupByCall += 1;
        if (groupByCall === 1) {
          return [
            { municipalityIbgeCode: '3304524', municipalityName: 'Rio das Ostras', uf: 'RJ', _count: 2 },
            { municipalityIbgeCode: '3304557', municipalityName: 'Rio de Janeiro', uf: 'RJ', _count: 1 },
          ];
        }
        if (groupByCall === 2) {
          return [
            { modalityCode: '6', modality: 'Pregão Eletrônico', modalityNormalized: 'pregao-eletronico', _count: 3 },
          ];
        }
        if (groupByCall === 3) return [{ source: 'pncp', _count: 2 }];
        return [{ status: 'open', _count: 3 }];
      },
    },
    $transaction: async (operations) => Promise.all(operations),
  };

  return { prisma, countCalls, findManyCalls, groupByCalls };
}

test('returns unqualified municipality and modality facets with pagination', async () => {
  const { prisma, countCalls, findManyCalls, groupByCalls } = createPrismaMock();
  const service = new BiddingsService(prisma as never);
  const filters: BiddingSearchDto = {
    uf: 'rj',
    municipalityIbgeCode: '3304524',
    modalityCode: 6,
    page: 2,
    limit: 10,
  };

  const result = await service.search(filters);

  assert.equal(countCalls.length, 1);
  assert.deepEqual(countCalls[0], {
    where: {
      uf: 'RJ',
      municipalityIbgeCode: '3304524',
      modalityCode: '6',
    },
  });
  assert.equal(findManyCalls.length, 1);
  const findManyArgs = findManyCalls[0] as Record<string, unknown>;
  assert.deepEqual(findManyArgs.where, {
    uf: 'RJ',
    municipalityIbgeCode: '3304524',
    modalityCode: '6',
  });
  assert.deepEqual(findManyArgs.orderBy, { publicationDate: 'desc' });
  assert.equal(findManyArgs.skip, 10);
  assert.equal(findManyArgs.take, 10);
  assert.ok(findManyArgs.select);
  assert.equal(groupByCalls.length, 4);
  assert.equal((groupByCalls[0] as { _count: true })._count, true);
  assert.deepEqual(result.pagination, { page: 2, limit: 10, total: 3, totalPages: 1 });
  assert.deepEqual(result.facets.municipality[0], {
    code: '3304524',
    name: 'Rio das Ostras',
    uf: 'RJ',
    count: 2,
  });
  assert.deepEqual(result.facets.modality[0], {
    code: '6',
    name: 'Pregão Eletrônico',
    normalized: 'pregao-eletronico',
    count: 3,
  });
  assert.deepEqual(result.facets.source, [{ source: 'pncp', count: 2 }]);
  assert.deepEqual(result.facets.status, [{ status: 'open', count: 3 }]);
});

test('builds compound text, value and date filters and uses requested ordering', async () => {
  const { prisma, countCalls, findManyCalls } = createPrismaMock();
  const service = new BiddingsService(prisma as never);
  const filters: BiddingSearchDto = {
    q: 'insumo hospitalar',
    municipalityName: 'Ostras',
    source: 'compras-publicas',
    status: 'open',
    sphere: 'municipal',
    minValue: 1000,
    maxValue: 50000,
    publicationFrom: '2026-08-01T00:00:00.000Z',
    publicationTo: '2026-08-21T23:59:59.999Z',
    proposalFrom: '2026-08-10T00:00:00.000Z',
    sortBy: 'estimatedValue',
    sortDirection: 'asc',
  };

  await service.search(filters);

  const where = (countCalls[0] as { where: Record<string, unknown> }).where;
  assert.deepEqual(where.uf, undefined);
  assert.deepEqual(where.municipalityName, {
    contains: 'Ostras',
    mode: 'insensitive',
  });
  assert.deepEqual(where.source, 'compras-publicas');
  assert.deepEqual(where.status, 'open');
  assert.deepEqual(where.sphere, 'MUNICIPAL');
  assert.deepEqual(where.estimatedValue, { gte: 1000, lte: 50000 });
  assert.deepEqual(where.publicationDate, {
    gte: new Date('2026-08-01T00:00:00.000Z'),
    lte: new Date('2026-08-21T23:59:59.999Z'),
  });
  assert.deepEqual(where.proposalDueDate, {
    gte: new Date('2026-08-10T00:00:00.000Z'),
  });
  assert.deepEqual(where.OR, [
    { objectText: { contains: 'insumo hospitalar', mode: 'insensitive' } },
    { objectSummary: { contains: 'insumo hospitalar', mode: 'insensitive' } },
    { agencyName: { contains: 'insumo hospitalar', mode: 'insensitive' } },
    { biddingNumber: { contains: 'insumo hospitalar', mode: 'insensitive' } },
    { pncpControlNumber: { contains: 'insumo hospitalar', mode: 'insensitive' } },
  ]);
  assert.deepEqual((findManyCalls[0] as { orderBy: unknown }).orderBy, {
    estimatedValue: 'asc',
  });
});
