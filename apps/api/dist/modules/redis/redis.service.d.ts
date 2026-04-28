import { OnModuleDestroy } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Redis from 'ioredis';
export declare class RedisService implements OnModuleDestroy {
    private configService;
    private readonly client;
    constructor(configService: ConfigService);
    getClient(): Redis;
    ping(): Promise<string>;
    onModuleDestroy(): Promise<void>;
}
