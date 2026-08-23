import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { UpdateAlertProfileDto } from './alert-profile.dto';

const DEFAULT_FILTER = {
  municipioBase: null,
  raioKm: 50,
  participaMunicipal: true,
  participaEstadual: true,
  participaFederal: true,
  participaAutarquias: false,
  modalidadePregao: true,
  modalidadeDispensa: true,
  modalidadeOutros: false,
  notificaEmail: true,
  notificaWhatsapp: false,
  notificaPush: true,
} as const;

function normalizeKeyword(value: string): string {
  return value.trim().toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
}

@Injectable()
export class AlertProfileService {
  constructor(private readonly prisma: PrismaService) {}

  async getProfile(tenantId: string) {
    const [filter, keywords, regions, cnaes] = await Promise.all([
      this.prisma.companyFilter.findUnique({ where: { tenantId } }),
      this.prisma.companyKeyword.findMany({
        where: { tenantId },
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.companyRegion.findMany({
        where: { tenantId },
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.companyCnae.findMany({
        where: { tenantId },
        orderBy: [{ isPrimary: 'desc' }, { code: 'asc' }],
      }),
    ]);

    return {
      filter: filter ?? { tenantId, ...DEFAULT_FILTER },
      keywords,
      regions,
      cnaes,
    };
  }

  async updateProfile(tenantId: string, dto: UpdateAlertProfileDto) {
    const current = await this.prisma.companyFilter.findUnique({ where: { tenantId } });
    const merged = {
      ...DEFAULT_FILTER,
      ...(current ?? {}),
      ...dto,
    };

    const filterData: Prisma.CompanyFilterUncheckedCreateInput = {
      tenantId,
      municipioBase: merged.municipioBase ?? null,
      raioKm: merged.raioKm,
      participaMunicipal: merged.participaMunicipal,
      participaEstadual: merged.participaEstadual,
      participaFederal: merged.participaFederal,
      participaAutarquias: merged.participaAutarquias,
      modalidadePregao: merged.modalidadePregao,
      modalidadeDispensa: merged.modalidadeDispensa,
      modalidadeOutros: merged.modalidadeOutros,
      notificaEmail: merged.notificaEmail,
      notificaWhatsapp: merged.notificaWhatsapp,
      notificaPush: merged.notificaPush,
    };

    const operations: Prisma.PrismaPromise<unknown>[] = [
      this.prisma.companyFilter.upsert({
        where: { tenantId },
        create: filterData,
        update: filterData,
      }),
    ];

    if (dto.keywords !== undefined) {
      const deduplicated = new Map<string, { keyword: string; normalizedKeyword: string; matchType: string; weight: number }>();
      for (const input of dto.keywords) {
        const keyword = input.keyword.trim();
        const normalizedKeyword = normalizeKeyword(keyword);
        if (!normalizedKeyword) continue;
        const matchType = input.matchType ?? 'include';
        const key = `${matchType}:${normalizedKeyword}`;
        deduplicated.set(key, {
          keyword,
          normalizedKeyword,
          matchType,
          weight: input.weight ?? 1,
        });
      }

      operations.push(this.prisma.companyKeyword.deleteMany({ where: { tenantId } }));
      if (deduplicated.size > 0) {
        operations.push(
          this.prisma.companyKeyword.createMany({
            data: Array.from(deduplicated.values()).map((keyword) => ({
              tenantId,
              ...keyword,
            })),
          }),
        );
      }
    }

    if (dto.regions !== undefined) {
      const deduplicated = new Map<string, {
        tenantId: string;
        uf: string;
        municipalityName: string | null;
        municipalityIbgeCode: string | null;
        scopeType: string;
      }>();
      for (const input of dto.regions) {
        const uf = input.uf.trim().toUpperCase();
        const municipalityIbgeCode = input.municipalityIbgeCode?.trim() || null;
        const municipalityName = input.municipalityName?.trim() || null;
        const key = `${input.scopeType}:${uf}:${municipalityIbgeCode ?? municipalityName ?? ''}`;
        deduplicated.set(key, {
          tenantId,
          uf,
          municipalityName,
          municipalityIbgeCode,
          scopeType: input.scopeType,
        });
      }

      operations.push(this.prisma.companyRegion.deleteMany({ where: { tenantId } }));
      if (deduplicated.size > 0) {
        operations.push(this.prisma.companyRegion.createMany({ data: Array.from(deduplicated.values()) }));
      }
    }

    await this.prisma.$transaction(operations);
    return this.getProfile(tenantId);
  }
}
