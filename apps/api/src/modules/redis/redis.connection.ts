import type { ConfigService } from '@nestjs/config';
import type { RedisOptions } from 'ioredis';

export function getRedisConnectionOptions(configService: ConfigService): RedisOptions {
  const configuredUrl = configService.get<string>('REDIS_URL');
  const redisTls = configService.get<string>('REDIS_TLS', 'false') === 'true';

  if (configuredUrl) {
    const url = new URL(configuredUrl);
    const database = url.pathname.replace(/^\//, '');
    const tlsEnabled = redisTls || url.protocol === 'rediss:';

    return {
      host: url.hostname,
      port: url.port ? Number(url.port) : 6379,
      username: url.username ? decodeURIComponent(url.username) : undefined,
      password: url.password ? decodeURIComponent(url.password) : undefined,
      db: database ? Number(database) : undefined,
      tls: tlsEnabled ? {} : undefined,
      maxRetriesPerRequest: null,
    };
  }

  return {
    host: configService.get<string>('REDIS_HOST', 'localhost'),
    port: configService.get<number>('REDIS_PORT', 6379),
    username: configService.get<string>('REDIS_USERNAME') || undefined,
    password: configService.get<string>('REDIS_PASSWORD') || undefined,
    db: configService.get<number>('REDIS_DB', 0),
    tls: redisTls ? {} : undefined,
    maxRetriesPerRequest: null,
  };
}
