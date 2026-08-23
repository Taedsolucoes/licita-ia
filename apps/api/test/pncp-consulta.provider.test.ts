import { strict as assert } from 'node:assert';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { test } from 'node:test';
import { ConfigService } from '@nestjs/config';
import { PncpConsultaProvider } from '../src/modules/integration/providers/pncp-consulta.provider';

const fixture = JSON.parse(
  readFileSync(join(__dirname, 'fixtures', 'pncp-publicacao-page.json'), 'utf8'),
) as Record<string, unknown>;

function createProvider(): PncpConsultaProvider {
  return new PncpConsultaProvider(
    new ConfigService({
      PNCP_CONSULTA_BASE_URL: 'https://pncp.gov.br/api/consulta',
      PNCP_PAGE_SIZE: 500,
      PNCP_LOOKBACK_DAYS: 7,
    }),
  );
}

test('maps the official PNCP publication envelope and sends documented filters', async () => {
  const originalFetch = globalThis.fetch;
  const requests: string[] = [];
  globalThis.fetch = async (input) => {
    requests.push(String(input));
    return new Response(JSON.stringify(fixture), {
      status: 200,
      headers: { 'content-type': 'application/json' },
    });
  };

  try {
    const provider = createProvider();
    const result = await provider.fetchBiddings({
      since: new Date('2026-08-20T00:00:00Z'),
      until: new Date('2026-08-21T00:00:00Z'),
      modalityCode: 6,
      uf: 'df',
      municipalityIbgeCode: '5300108',
    });

    assert.equal(result.totalFetched, 1);
    assert.equal(result.nextCursor, null);
    assert.equal(result.biddings[0]?.externalId, '00000000000100-1-000001/2026');
    assert.equal(result.biddings[0]?.pncpControlNumber, '00000000000100-1-000001/2026');
    assert.equal(result.biddings[0]?.modalityCode, '6');
    assert.equal(result.biddings[0]?.modalityNormalized, 'pregao-eletronico');
    assert.equal(result.biddings[0]?.municipalityIbgeCode, '5300108');
    assert.equal(result.biddings[0]?.uf, 'DF');
    assert.equal(result.biddings[0]?.estimatedValue, 125000.5);
    const requestUrl = new URL(requests[0] ?? 'https://invalid.local');
    assert.equal(requestUrl.pathname, '/api/consulta/v1/contratacoes/publicacao');
    assert.equal(requestUrl.searchParams.get('dataFinal'), '20260821');
    assert.equal(requestUrl.searchParams.get('dataInicial'), '20260820');
    assert.equal(requestUrl.searchParams.get('codigoModalidadeContratacao'), '6');
    assert.equal(requestUrl.searchParams.get('uf'), 'DF');
    assert.equal(requestUrl.searchParams.get('codigoMunicipioIbge'), '5300108');
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test('uses the open-proposals endpoint and rejects unsupported modality codes', async () => {
  const originalFetch = globalThis.fetch;
  const requests: string[] = [];
  globalThis.fetch = async (input) => {
    requests.push(String(input));
    return new Response(JSON.stringify({ ...fixture, data: [] }), {
      status: 200,
      headers: { 'content-type': 'application/json' },
    });
  };

  try {
    const provider = createProvider();
    await provider.fetchBiddings({
      queryMode: 'open_proposals',
      modalityCode: 6,
      until: new Date('2026-08-21T00:00:00Z'),
    });

    assert.equal(
      new URL(requests[0] ?? 'https://invalid.local').pathname,
      '/api/consulta/v1/contratacoes/proposta',
    );
    assert.equal(
      new URL(requests[0] ?? 'https://invalid.local').searchParams.get('dataFinal'),
      '20260821',
    );

    await assert.rejects(
      provider.fetchBiddings({ modalityCode: 999 }),
      /Unsupported PNCP modality code: 999/,
    );
  } finally {
    globalThis.fetch = originalFetch;
  }
});
