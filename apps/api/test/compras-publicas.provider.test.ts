import { strict as assert } from 'node:assert';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { test } from 'node:test';
import { ConfigService } from '@nestjs/config';
import { ComprasPublicasProvider } from '../src/modules/integration/providers/compras-publicas.provider';

const fixture = JSON.parse(
  readFileSync(join(__dirname, 'fixtures', 'compras-contratacoes-page.json'), 'utf8'),
) as Record<string, unknown>;

function createProvider(): ComprasPublicasProvider {
  return new ComprasPublicasProvider(
    new ConfigService({
      COMPRAS_PUBLICAS_BASE_URL: 'https://dadosabertos.compras.gov.br',
      COMPRAS_PUBLICAS_PAGE_SIZE: 100,
      COMPRAS_PUBLICAS_LOOKBACK_DAYS: 7,
    }),
  );
}

test('maps the official Compras.gov.br envelope and documented filters', async () => {
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
    assert.equal(result.biddings[0]?.sourceSystemName, 'Compras.gov.br');
    assert.equal(result.biddings[0]?.modalityNormalized, 'pregao-eletronico');
    assert.equal(result.biddings[0]?.municipalityIbgeCode, '5300108');
    assert.equal(result.biddings[0]?.uf, 'DF');
    assert.equal(result.biddings[0]?.estimatedValue, 125000.5);
    assert.equal(result.biddings[0]?.status, 'open');

    const requestUrl = new URL(requests[0] ?? 'https://invalid.local');
    assert.equal(requestUrl.pathname, '/modulo-contratacoes/1_consultarContratacoes_PNCP_14133');
    assert.equal(requestUrl.searchParams.get('dataPublicacaoPncpInicial'), '2026-08-20');
    assert.equal(requestUrl.searchParams.get('dataPublicacaoPncpFinal'), '2026-08-21');
    assert.equal(requestUrl.searchParams.get('codigoModalidade'), '6');
    assert.equal(requestUrl.searchParams.get('unidadeOrgaoUfSigla'), 'DF');
    assert.equal(requestUrl.searchParams.get('unidadeOrgaoCodigoIbge'), '5300108');
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test('does not pretend Compras.gov.br supports the PNCP open-proposals query', async () => {
  const provider = createProvider();
  await assert.rejects(
    provider.fetchBiddings({ queryMode: 'open_proposals', modalityCode: 6 }),
    /does not expose the PNCP open-proposals query/,
  );
});
