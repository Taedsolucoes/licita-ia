import { Injectable, OnModuleDestroy } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Redis from 'ioredis';
import { getRedisConnectionOptions } from './redis.connection';

@Injectable()
export class RedisService implements OnModuleDestroy {
  private readonly client: Redis;

  constructor(private configService: ConfigService) {
    this.client = new Redis(getRedisConnectionOptions(this.configService));
  }

  getClient(): Redis {
    return this.client;
  }

  async ping(): Promise<string> {
    return this.client.ping();
  }

  async onModuleDestroy() {
    await this.client.quit();
  }
}
