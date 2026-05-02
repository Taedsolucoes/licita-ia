import {
  Injectable,
  NotFoundException,
  ConflictException,
} from '@nestjs/common';
import * as bcrypt from 'bcryptjs';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import {
  CreateTenantDto,
  UpdateTenantDto,
  CreateUserDto,
  UpdateUserDto,
  CreateKeywordDto,
  UpdateKeywordDto,
  CreateRegionDto,
  CreateResultDto,
} from './dto/admin.dto';

@Injectable()
export class AdminService {
  constructor(private prisma: PrismaService) {}

  // ─── Tenants ───────────────────────────────────────────────────────────────

  async listTenants(page = 1, limit = 20) {
    const skip = (page - 1) * limit;
    const [total, data] = await this.prisma.$transaction([
      this.prisma.tenant.count(),
      this.prisma.tenant.findMany({
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
        select: {
          id: true,
          corporateName: true,
          tradeName: true,
          cnpj: true,
          status: true,
          contactName: true,
          contactEmail: true,
          contactPhone: true,
          planType: true,
          createdAt: true,
          _count: { select: { users: true } },
        },
      }),
    ]);
    return { data, pagination: { page, limit, total, totalPages: Math.ceil(total / limit) } };
  }

  async createTenant(dto: CreateTenantDto) {
    const existing = await this.prisma.tenant.findFirst({ where: { cnpj: dto.cnpj } });
    if (existing) throw new ConflictException('CNPJ already registered');

    return this.prisma.tenant.create({
      data: {
        corporateName: dto.corporateName,
        tradeName: dto.tradeName,
        cnpj: dto.cnpj,
        contactName: dto.contactName,
        contactEmail: dto.contactEmail,
        contactPhone: dto.contactPhone,
        whatsappNumber: dto.whatsappNumber,
        planType: dto.planType ?? 'basic',
      },
    });
  }

  async getTenant(id: string) {
    const tenant = await this.prisma.tenant.findUnique({
      where: { id },
      include: {
        _count: { select: { users: true, companyKeywords: true, companyRegions: true } },
      },
    });
    if (!tenant) throw new NotFoundException('Tenant not found');
    return tenant;
  }

  async updateTenant(id: string, dto: UpdateTenantDto) {
    await this.getTenant(id);
    return this.prisma.tenant.update({ where: { id }, data: dto });
  }

  // ─── Users ─────────────────────────────────────────────────────────────────

  async listTenantUsers(tenantId: string) {
    await this.getTenant(tenantId);
    return this.prisma.user.findMany({
      where: { tenantId },
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        fullName: true,
        email: true,
        role: true,
        phone: true,
        isActive: true,
        lastLoginAt: true,
        createdAt: true,
      },
    });
  }

  async createTenantUser(tenantId: string, dto: CreateUserDto) {
    await this.getTenant(tenantId);

    const existing = await this.prisma.user.findUnique({ where: { email: dto.email } });
    if (existing) throw new ConflictException('Email already in use');

    const passwordHash = await bcrypt.hash(dto.password, 12);

    return this.prisma.user.create({
      data: {
        tenantId,
        fullName: dto.fullName,
        email: dto.email,
        passwordHash,
        role: dto.role,
        phone: dto.phone,
      },
      select: {
        id: true,
        tenantId: true,
        fullName: true,
        email: true,
        role: true,
        phone: true,
        isActive: true,
        createdAt: true,
      },
    });
  }

  async updateUser(userId: string, dto: UpdateUserDto) {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw new NotFoundException('User not found');

    return this.prisma.user.update({
      where: { id: userId },
      data: dto,
      select: {
        id: true,
        tenantId: true,
        fullName: true,
        email: true,
        role: true,
        phone: true,
        isActive: true,
        updatedAt: true,
      },
    });
  }

  // ─── Keywords ──────────────────────────────────────────────────────────────

  async listKeywords(tenantId: string) {
    await this.getTenant(tenantId);
    return this.prisma.companyKeyword.findMany({
      where: { tenantId },
      orderBy: { createdAt: 'desc' },
    });
  }

  async createKeyword(tenantId: string, dto: CreateKeywordDto) {
    await this.getTenant(tenantId);

    const normalized = dto.keyword.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');

    return this.prisma.companyKeyword.create({
      data: {
        tenantId,
        keyword: dto.keyword,
        normalizedKeyword: normalized,
        matchType: dto.matchType ?? 'include',
        weight: dto.weight ?? 1.0,
      },
    });
  }

  async updateKeyword(keywordId: string, dto: UpdateKeywordDto) {
    const kw = await this.prisma.companyKeyword.findUnique({ where: { id: keywordId } });
    if (!kw) throw new NotFoundException('Keyword not found');

    const updateData: Record<string, unknown> = { ...dto };
    if (dto.keyword) {
      updateData.normalizedKeyword = dto.keyword
        .toLowerCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '');
    }

    return this.prisma.companyKeyword.update({ where: { id: keywordId }, data: updateData });
  }

  async deleteKeyword(keywordId: string) {
    const kw = await this.prisma.companyKeyword.findUnique({ where: { id: keywordId } });
    if (!kw) throw new NotFoundException('Keyword not found');
    await this.prisma.companyKeyword.delete({ where: { id: keywordId } });
    return { message: 'Keyword deleted' };
  }

  // ─── Regions ───────────────────────────────────────────────────────────────

  async listRegions(tenantId: string) {
    await this.getTenant(tenantId);
    return this.prisma.companyRegion.findMany({
      where: { tenantId },
      orderBy: { createdAt: 'desc' },
    });
  }

  async createRegion(tenantId: string, dto: CreateRegionDto) {
    await this.getTenant(tenantId);

    return this.prisma.companyRegion.create({
      data: {
        tenantId,
        uf: dto.uf.toUpperCase(),
        municipalityName: dto.municipalityName,
        municipalityIbgeCode: dto.municipalityIbgeCode,
        scopeType: dto.scopeType,
      },
    });
  }

  async deleteRegion(regionId: string) {
    const region = await this.prisma.companyRegion.findUnique({ where: { id: regionId } });
    if (!region) throw new NotFoundException('Region not found');
    await this.prisma.companyRegion.delete({ where: { id: regionId } });
    return { message: 'Region deleted' };
  }

  // ─── Dashboard ─────────────────────────────────────────────────────────────

  async getDashboardOverview() {
    const [totalTenants, activeBiddings, pendingParticipations] = await this.prisma.$transaction([
      this.prisma.tenant.count({ where: { status: 'active' } }),
      this.prisma.bidding.count({ where: { status: 'open' } }),
      this.prisma.participation.count({ where: { status: 'submitted_to_taed' } }),
    ]);

    return { totalTenants, activeBiddings, pendingParticipations };
  }

  // ─── Biddings (all) ────────────────────────────────────────────────────────

  async listAllBiddings(
    page = 1,
    limit = 20,
    filters: { status?: string; uf?: string; dateFrom?: string; dateTo?: string } = {},
  ) {
    const skip = (page - 1) * limit;

    const where: Prisma.BiddingWhereInput = {};
    if (filters.status) where.status = filters.status;
    if (filters.uf) where.uf = filters.uf.toUpperCase();
    if (filters.dateFrom || filters.dateTo) {
      where.openingDate = {};
      if (filters.dateFrom) (where.openingDate as Prisma.DateTimeNullableFilter).gte = new Date(filters.dateFrom);
      if (filters.dateTo) (where.openingDate as Prisma.DateTimeNullableFilter).lte = new Date(filters.dateTo);
    }

    const [total, data] = await this.prisma.$transaction([
      this.prisma.bidding.count({ where }),
      this.prisma.bidding.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
        select: {
          id: true,
          biddingNumber: true,
          modality: true,
          agencyName: true,
          objectSummary: true,
          estimatedValue: true,
          uf: true,
          municipalityName: true,
          status: true,
          openingDate: true,
          proposalDueDate: true,
          publicationDate: true,
          riskLevel: true,
          createdAt: true,
          source: true,
          sourceExternalId: true,
          sourceUrl: true,
          _count: {
            select: { opportunities: true },
          },
          analysis: {
            select: {
              id: true,
              riskLevel: true,
              recommendation: true,
              analyzedAt: true,
            },
          },
        },
      }),
    ]);

    return {
      data,
      pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
    };
  }

  async getDashboardParticipations(page = 1, limit = 20) {
    const skip = (page - 1) * limit;

    const [total, data] = await this.prisma.$transaction([
      this.prisma.participation.count(),
      this.prisma.participation.findMany({
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
        include: {
          tenant: {
            select: { id: true, corporateName: true, tradeName: true, cnpj: true },
          },
          opportunity: {
            include: {
              bidding: {
                select: {
                  id: true,
                  biddingNumber: true,
                  agencyName: true,
                  objectSummary: true,
                  estimatedValue: true,
                  uf: true,
                  municipalityName: true,
                },
              },
            },
          },
          items: {
            include: {
              biddingItem: {
                select: { id: true, itemNumber: true, description: true, unit: true },
              },
            },
          },
          acceptedBy: {
            select: { id: true, fullName: true, email: true },
          },
        },
      }),
    ]);

    return { data, pagination: { page, limit, total, totalPages: Math.ceil(total / limit) } };
  }

  // ─── New Dashboard Stats ───────────────────────────────────────────────────

  async getDashboardStats(): Promise<object> {
    const now = new Date();
    const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const startOfLastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const endOfLastMonth = new Date(now.getFullYear(), now.getMonth(), 0, 23, 59, 59);

    const [
      empresasAtivas,
      empresasAtivasLastMonth,
      oportunidadesHoje,
      oportunidadesOntem,
      licitacoesEnviadas,
      licitacoesEnviadasLastMonth,
      licitacoesVencidas,
      licitacoesVencidasLastMonth,
    ] = await this.prisma.$transaction([
      this.prisma.tenant.count({ where: { status: 'active' } }),
      this.prisma.tenant.count({ where: { status: 'active', createdAt: { lt: startOfMonth } } }),
      this.prisma.bidding.count({ where: { createdAt: { gte: startOfToday } } }),
      this.prisma.bidding.count({
        where: {
          createdAt: {
            gte: new Date(startOfToday.getTime() - 86400000),
            lt: startOfToday,
          },
        },
      }),
      this.prisma.participation.count({ where: { createdAt: { gte: startOfMonth } } }),
      this.prisma.participation.count({
        where: { createdAt: { gte: startOfLastMonth, lte: endOfLastMonth } },
      }),
      this.prisma.result.count({ where: { status: 'ganhou', createdAt: { gte: startOfMonth } } }),
      this.prisma.result.count({
        where: { status: 'ganhou', createdAt: { gte: startOfLastMonth, lte: endOfLastMonth } },
      }),
    ]);

    return {
      empresasAtivas: {
        total: empresasAtivas,
        comparativo: empresasAtivas - empresasAtivasLastMonth,
      },
      oportunidadesHoje: {
        total: oportunidadesHoje,
        comparativo: oportunidadesHoje - oportunidadesOntem,
      },
      licitacoesEnviadas: {
        total: licitacoesEnviadas,
        comparativo: licitacoesEnviadas - licitacoesEnviadasLastMonth,
      },
      licitacoesVencidas: {
        total: licitacoesVencidas,
        comparativo: licitacoesVencidas - licitacoesVencidasLastMonth,
      },
    };
  }

  async listCompaniesWithStats(): Promise<object[]> {
    const tenants = await this.prisma.tenant.findMany({
      where: { status: 'active', planType: { not: 'admin' } },
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        corporateName: true,
        tradeName: true,
        cnpj: true,
        status: true,
        planType: true,
        contactEmail: true,
        contactPhone: true,
        createdAt: true,
      },
    });

    const now = new Date();
    const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

    const result = await Promise.all(
      tenants.map(async (tenant: typeof tenants[number]) => {
        const [licitacoesHoje, licitacoesMes, vitoriosas, acoesPendentes] = await this.prisma.$transaction([
          this.prisma.participation.count({
            where: { tenantId: tenant.id, createdAt: { gte: startOfToday } },
          }),
          this.prisma.participation.count({
            where: { tenantId: tenant.id, createdAt: { gte: startOfMonth } },
          }),
          this.prisma.result.count({ where: { tenantId: tenant.id, status: 'ganhou' } }),
          this.prisma.participation.count({
            where: { tenantId: tenant.id, status: 'draft' },
          }),
        ]);

        return {
          ...tenant,
          stats: { licitacoesHoje, licitacoesMes, vitoriosas, acoesPendentes },
        };
      }),
    );

    return result;
  }

  async getExpiringDocuments(daysAhead = 30): Promise<object[]> {
    const now = new Date();
    const limit = new Date(now.getTime() + daysAhead * 86400000);

    return this.prisma.document.findMany({
      where: {
        validUntil: { gte: now, lte: limit },
      },
      orderBy: { validUntil: 'asc' },
      include: {
        tenant: {
          select: { id: true, corporateName: true, tradeName: true, cnpj: true },
        },
      },
    });
  }

  async createResult(dto: CreateResultDto): Promise<object> {
    return this.prisma.result.create({
      data: {
        tenantId: dto.tenantId,
        biddingId: dto.biddingId,
        status: dto.status,
        valorContrato: dto.valorContrato ?? null,
        prazoEntrega: dto.prazoEntrega ? new Date(dto.prazoEntrega) : null,
        obrigacoes: dto.obrigacoes ?? null,
      },
    });
  }
}
