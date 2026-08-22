import assert from 'node:assert/strict';
import test from 'node:test';
import { getOfficialJson } from '../src/modules/integration/providers/official-source-http';

const originalFetch = globalThis.fetch;

test('retries transient official-source responses and returns the recovered JSON', async () => {
  let calls = 0;
  globalThis.fetch = (async () => {
    calls += 1;
    if (calls === 1) return new Response('temporarily unavailable', { status: 503 });
    return new Response(JSON.stringify({ data: ['ok'] }), { status: 200, headers: { 'content-type': 'application/json' } });
  }) as typeof fetch;

  try {
    const result = await getOfficialJson<{ data: string[] }>({
      url: 'https://official.example/resource',
      sourceName: 'Official source',
      emptyBody: { data: [] },
      maxAttempts: 2,
    });
    assert.deepEqual(result, { data: ['ok'] });
    assert.equal(calls, 2);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test('does not retry permanent client errors', async () => {
  let calls = 0;
  globalThis.fetch = (async () => {
    calls += 1;
    return new Response('bad request', { status: 400 });
  }) as typeof fetch;

  try {
    await assert.rejects(
      getOfficialJson({
        url: 'https://official.example/resource',
        sourceName: 'Official source',
        emptyBody: {},
        maxAttempts: 4,
      }),
      /Official source HTTP 400/,
    );
    assert.equal(calls, 1);
  } finally {
    globalThis.fetch = originalFetch;
  }
});
