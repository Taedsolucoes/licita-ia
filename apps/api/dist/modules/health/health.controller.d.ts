import { PrismaService } from '../prisma/prisma.service';
import { RedisService } from '../redis/redis.service';
export declare class HealthController {
    private prisma;
    private redis;
    constructor(prisma: PrismaService, redis: RedisService);
    health(): Promise<{
        status: string;
        timestamp: string;
        service: string;
    }>;
    ready(): Promise<{
        status: string;
        timestamp: string;
        checks: Record<string, string>;
    }>;
}
