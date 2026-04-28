import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { RedisService } from '../redis/redis.service';
import { CAPAG_SEED_DATA } from './capag-seed.data';

const CACHE_TTL_SECONDS = 60 * 60 * 24; // 24 hours
const REFERENCE_YEAR = 2024;

export const CAPAG_EXPLANATIONS: Record<string, string> = {
  A: 'Boa saúde financeira - baixo risco de inadimplência',
  B: 'Saúde financeira mediana - possibilidade de atrasos nos pagamentos',
  C: 'Saúde financeira ruim - alto risco de atrasos e inadimplência',
  ND: 'Dados não disponíveis - impossível avaliar risco financeiro',
};

export interface CapagResult {
  municipalityIbgeCode: string;
  municipalityName: string;
  uf: string;
  capagRating: string;
  explanation: string;
  referenceYear: number;
}

export interface CapagSyncResult {
  created: number;
  updated: number;
  total: number;
}

@Injectable()
export class CapagService {
  private readonly logger = new Logger(CapagService.name);

  constructor(
    private prisma: PrismaService,
    private redisService: RedisService,
  ) {}

  async syncCapagData(): Promise<CapagSyncResult> {
    this.logger.log('Starting CAPAG data sync from seed dataset...');

    let created = 0;
    let updated = 0;

    for (const entry of CAPAG_SEED_DATA) {
      const explanation = CAPAG_EXPLANATIONS[entry.capagRating] ?? CAPAG_EXPLANATIONS['ND'];

      const existingRecord = await this.prisma.capagRecord.findUnique({
        where: { municipalityIbgeCode: entry.municipalityIbgeCode },
      });

      if (!existingRecord) {
        await this.prisma.capagRecord.create({
          data: {
            municipalityIbgeCode: entry.municipalityIbgeCode,
            municipalityName: entry.municipalityName,
            uf: entry.uf,
            capagRating: entry.capagRating,
            explanationShort: explanation,
            referenceYear: REFERENCE_YEAR,
            sourceReference: 'seed_mvp_2024',
            updatedFromSourceAt: new Date(),
          },
        });

        await this.prisma.capagHistory.create({
          data: {
            municipalityIbgeCode: entry.municipalityIbgeCode,
            capagRating: entry.capagRating,
            explanationShort: explanation,
            referenceYear: REFERENCE_YEAR,
          },
        });

        created++;
      } else if (existingRecord.capagRating !== entry.capagRating) {
        await this.prisma.capagRecord.update({
          where: { municipalityIbgeCode: entry.municipalityIbgeCode },
          data: {
            capagRating: entry.capagRating,
            explanationShort: explanation,
            referenceYear: REFERENCE_YEAR,
            updatedFromSourceAt: new Date(),
          },
        });

        await this.prisma.capagHistory.create({
          data: {
            municipalityIbgeCode: entry.municipalityIbgeCode,
            capagRating: entry.capagRating,
            explanationShort: explanation,
            referenceYear: REFERENCE_YEAR,
          },
        });

        const redis = this.redisService.getClient();
        await redis.del(`capag:mun:${entry.municipalityIbgeCode}`);
        await redis.del(`capag:uf:${entry.uf}`);

        updated++;
      }
    }

    this.logger.log(
      `CAPAG sync complete: ${created} created, ${updated} updated out of ${CAPAG_SEED_DATA.length}`,
    );

    return { created, updated, total: CAPAG_SEED_DATA.length };
  }

  async getCapagByMunicipality(ibgeCode: string): Promise<CapagResult | null> {
    const cacheKey = `capag:mun:${ibgeCode}`;
    const redis = this.redisService.getClient();

    const cached = await redis.get(cacheKey);
    if (cached) {
      return JSON.parse(cached) as CapagResult;
    }

    const record = await this.prisma.capagRecord.findUnique({
      where: { municipalityIbgeCode: ibgeCode },
    });

    if (!record) {
      return null;
    }

    const result: CapagResult = {
      municipalityIbgeCode: record.municipalityIbgeCode,
      municipalityName: record.municipalityName,
      uf: record.uf,
      capagRating: record.capagRating,
      explanation: CAPAG_EXPLANATIONS[record.capagRating] ?? CAPAG_EXPLANATIONS['ND'],
      referenceYear: record.referenceYear,
    };

    await redis.set(cacheKey, JSON.stringify(result), 'EX', CACHE_TTL_SECONDS);

    return result;
  }

  async getCapagByUf(uf: string): Promise<CapagResult[]> {
    const normalizedUf = uf.toUpperCase();
    const cacheKey = `capag:uf:${normalizedUf}`;
    const redis = this.redisService.getClient();

    const cached = await redis.get(cacheKey);
    if (cached) {
      return JSON.parse(cached) as CapagResult[];
    }

    const records = await this.prisma.capagRecord.findMany({
      where: { uf: normalizedUf },
      orderBy: { municipalityName: 'asc' },
    });

    const results: CapagResult[] = records.map((record) => ({
      municipalityIbgeCode: record.municipalityIbgeCode,
      municipalityName: record.municipalityName,
      uf: record.uf,
      capagRating: record.capagRating,
      explanation: CAPAG_EXPLANATIONS[record.capagRating] ?? CAPAG_EXPLANATIONS['ND'],
      referenceYear: record.referenceYear,
    }));

    await redis.set(cacheKey, JSON.stringify(results), 'EX', CACHE_TTL_SECONDS);

    return results;
  }
}
