import assert from 'node:assert/strict';
import test from 'node:test';
import { AlertProfileService } from '../src/modules/alert-profile/alert-profile.service';

function createPrismaMock() {
  const state = {
    filter: null as Record<string, unknown> | null,
    keywords: [] as Array<Record<string, unknown>>,
    regions: [] as Array<Record<string, unknown>>,
    cnaes: [] as Array<Record<string, unknown>>,
  };
  const calls = {
    upsert: [] as unknown[],
    deleteKeywords: [] as unknown[],
    createKeywords: [] as unknown[],
    deleteRegions: [] as unknown[],
    createRegions: [] as unknown[],
  };

  const prisma = {
    companyFilter: {
      findUnique: async () => state.filter,
      upsert: async ({ create }: { create: Record<string, unknown> }) => {
        state.filter = { id: 'filter-id', ...create };
        calls.upsert.push(create);
        return state.filter;
      },
    },
    companyKeyword: {
      findMany: async () => state.keywords,
      deleteMany: async (args: unknown) => { calls.deleteKeywords.push(args); state.keywords = []; return { count: 0 }; },
      createMany: async ({ data }: { data: Array<Record<string, unknown>> }) => { calls.createKeywords.push(data); state.keywords = data.map((item, index) => ({ id: `keyword-${index}`, ...item })); return { count: data.length }; },
    },
    companyRegion: {
      findMany: async () => state.regions,
      deleteMany: async (args: unknown) => { calls.deleteRegions.push(args); state.regions = []; return { count: 0 }; },
      createMany: async ({ data }: { data: Array<Record<string, unknown>> }) => { calls.createRegions.push(data); state.regions = data.map((item, index) => ({ id: `region-${index}`, ...item })); return { count: data.length }; },
    },
    companyCnae: { findMany: async () => state.cnaes },
    $transaction: async (operations: Array<Promise<unknown>>) => Promise.all(operations),
  };

  return { prisma, state, calls };
}

test('returns a complete default profile for a tenant without saved filter', async () => {
  const { prisma } = createPrismaMock();
  const service = new AlertProfileService(prisma as never);
  const profile = await service.getProfile('tenant-1');

  assert.equal(profile.filter.tenantId, 'tenant-1');
  assert.equal(profile.filter.raioKm, 50);
  assert.equal(profile.filter.notificaPush, true);
  assert.deepEqual(profile.keywords, []);
  assert.deepEqual(profile.regions, []);
});

test('upserts filter and replaces duplicate keywords/regions atomically', async () => {
  const { prisma, calls } = createPrismaMock();
  const service = new AlertProfileService(prisma as never);
  const profile = await service.updateProfile('tenant-1', {
    municipioBase: 'Rio das Ostras',
    raioKm: 80,
    keywords: [
      { keyword: 'Material Hospitalar' },
      { keyword: 'material hospitalar' },
      { keyword: 'descartáveis', matchType: 'exclude' },
    ],
    regions: [
      { uf: 'rj', scopeType: 'uf' },
      { uf: 'RJ', scopeType: 'uf' },
      { uf: 'RJ', municipalityIbgeCode: '3304524', scopeType: 'municipio' },
    ],
  });

  assert.equal(profile.filter.municipioBase, 'Rio das Ostras');
  assert.equal(profile.filter.raioKm, 80);
  assert.equal(calls.createKeywords.length, 1);
  assert.equal((calls.createKeywords[0] as Array<unknown>).length, 2);
  assert.equal(calls.createRegions.length, 1);
  assert.equal((calls.createRegions[0] as Array<unknown>).length, 2);
  assert.equal(profile.keywords[0].normalizedKeyword, 'material hospitalar');
  assert.equal(profile.regions[1].municipalityIbgeCode, '3304524');
});
