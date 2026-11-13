import { ConfigService } from '@nestjs/config';
import { RedisOptions } from 'ioredis';

/**
 * Render Key Value exposes its internal connection as a redis:// URL.
 * Local development can continue using REDIS_HOST/REDIS_PORT/REDIS_PASSWORD.
 */
export function getRedisOptions(config: ConfigService): RedisOptions {
  const redisUrl = config.get<string>('REDIS_URL')?.trim();
  if (redisUrl) {
    let url: URL;
    try {
      url = new URL(redisUrl);
    } catch {
      throw new Error('REDIS_URL must be a valid redis:// or rediss:// URL.');
    }

    if (url.protocol !== 'redis:' && url.protocol !== 'rediss:') {
      throw new Error('REDIS_URL must use the redis:// or rediss:// scheme.');
    }

    const dbPath = url.pathname.replace(/^\//, '');
    if (dbPath && !/^\d+$/.test(dbPath)) {
      throw new Error('REDIS_URL database path must be a non-negative integer.');
    }

    return {
      host: url.hostname,
      port: url.port ? Number(url.port) : url.protocol === 'rediss:' ? 6380 : 6379,
      username: url.username ? decodeURIComponent(url.username) : undefined,
      password: url.password ? decodeURIComponent(url.password) : undefined,
      db: dbPath ? Number(dbPath) : undefined,
      tls: url.protocol === 'rediss:' ? {} : undefined,
      maxRetriesPerRequest: null,
    };
  }

  const configuredPort = config.get<string | number>('REDIS_PORT', 6379);
  const port = Number(configuredPort);
  if (!Number.isInteger(port) || port < 1 || port > 65535) {
    throw new Error('REDIS_PORT must be an integer between 1 and 65535.');
  }

  return {
    host: config.get<string>('REDIS_HOST', 'localhost'),
    port,
    password: config.get<string>('REDIS_PASSWORD') || undefined,
    maxRetriesPerRequest: null,
  };
}
