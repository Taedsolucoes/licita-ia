import assert from 'node:assert/strict';
import test from 'node:test';
import { getRedisConnectionOptions } from '../src/modules/redis/redis.connection';

function config(values: Record<string, string | undefined>) {
  return { get: <T>(key: string, fallback?: T) => (values[key] ?? fallback) as T };
}

test('parses managed rediss URL with credentials and logical database', () => {
  const options = getRedisConnectionOptions(config({
    REDIS_URL: 'rediss://redis-user:secret%2Fpass@redis.example:6380/2',
    REDIS_TLS: 'false',
  }) as never);

  assert.equal(options.host, 'redis.example');
  assert.equal(options.port, 6380);
  assert.equal(options.username, 'redis-user');
  assert.equal(options.password, 'secret/pass');
  assert.equal(options.db, 2);
  assert.deepEqual(options.tls, {});
});

test('uses local host/port fallback when no URL is configured', () => {
  const options = getRedisConnectionOptions(config({
    REDIS_HOST: '127.0.0.1',
    REDIS_PORT: '6381',
    REDIS_DB: '4',
    REDIS_PASSWORD: 'local-secret',
    REDIS_TLS: 'true',
  }) as never);

  assert.equal(options.host, '127.0.0.1');
  assert.equal(options.port, '6381');
  assert.equal(options.db, '4');
  assert.equal(options.password, 'local-secret');
  assert.deepEqual(options.tls, {});
});
