import {
  BadGatewayException,
  BadRequestException,
  ConflictException,
  Injectable,
  Logger,
  NotFoundException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { SaveCompanyProfileDto } from './dto/company-profile.dto';
import ibgeMunicipalitySnapshot from '../../data/municipalities.json';

const OFFICIAL_CNPJ_CARD_URL =
  'https://solucoes.receita.fazenda.gov.br/Servicos/cnpjreva/cnpjreva_solicitacao.asp';
const IBGE_BASE_URL = 'https://servicodados.ibge.gov.br/api/v1/localidades';
const ALLOWED_UFS = new Set([
  'AC', 'AL', 'AP', 'AM', 'BA', 'CE', 'DF', 'ES', 'GO', 'MA', 'MT', 'MS',
  'MG', 'PA', 'PB', 'PR', 'PE', 'PI', 'RJ', 'RN', 'RS', 'RO', 'RR', 'SC',
  'SP', 'SE', 'TO',
]);

interface BrasilApiCnae {
  codigo?: number | string;
  descricao?: string;
}

interface BrasilApiCompany {
  cnpj?: string;
  razao_social?: string;
  nome_fantasia?: string;
  cnae_fiscal?: number | string;
  cnae_fiscal_descricao?: string;
  cnaes_secundarios?: BrasilApiCnae[];
  descricao_situacao_cadastral?: string;
  municipio?: string;
  uf?: string;
  logradouro?: string;
  numero?: string;
  complemento?: string;
  bairro?: string;
  cep?: string;
}

interface IbgeMunicipality {
  id: number;
  nome: string;
}

function cleanCnpj(value: string): string {
  return value.replace(/[^0-9a-z]/gi, '').toUpperCase();
}

function normalizeSearch(value: string): string {
  return value
    .toLocaleLowerCase('pt-BR')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim();
}

@Injectable()
export class ProfileService {
  private readonly logger = new Logger(ProfileService.name);
  private readonly municipalitiesCache = new Map<
    string,
    { expiresAt: number; municipalities: IbgeMunicipality[] }
  >();

  constructor(private readonly prisma: PrismaService) {}

  async getCompanyProfile(tenantId: string) {
    const tenant = await this.prisma.tenant.findUnique({
      where: { id: tenantId },
      include: {
        cnaes: { orderBy: [{ isPrimary: 'desc' }, { code: 'asc' }] },
        companyKeywords: { orderBy: { keyword: 'asc' } },
        companyRegions: { orderBy: [{ scopeType: 'asc' }, { uf: 'asc' }, { municipalityName: 'asc' }] },
        companyFilter: true,
        habilitationDocuments: {
          where: { name: { contains: 'CNPJ', mode: 'insensitive' } },
          orderBy: { createdAt: 'desc' },
          take: 1,
        },
      },
    });

    if (!tenant) throw new NotFoundException('Empresa não encontrada.');
    const cardDocument = tenant.habilitationDocuments[0] ?? null;

    return {
      id: tenant.id,
      cnpj: cleanCnpj(tenant.cnpj),
      corporateName: tenant.corporateName,
      tradeName: tenant.tradeName,
      status: tenant.status,
      cnaes: tenant.cnaes,
      keywords: tenant.companyKeywords,
      regions: tenant.companyRegions,
      companyFilter: tenant.companyFilter,
      cnpjCard: {
        url: cardDocument?.externalLink ?? OFFICIAL_CNPJ_CARD_URL,
        fileUrl: cardDocument?.fileUrl ?? null,
        status: cardDocument?.status ?? 'acesso_online',
      },
    };
  }

  async lookupCnpj(cnpj: string): Promise<object> {
    const clean = cleanCnpj(cnpj);
    if (!/^[A-Z0-9]{12}\d{2}$/.test(clean)) {
      throw new BadRequestException('Informe um CNPJ válido com 14 caracteres.');
    }

    let response: Response;
    try {
      response = await fetch(`https://brasilapi.com.br/api/cnpj/v1/${clean}`, {
        signal: AbortSignal.timeout(15_000),
        headers: { 'User-Agent': 'LicitaIA/1.0' },
      });
    } catch (error) {
      this.logger.warn(`Falha ao consultar CNPJ: ${error instanceof Error ? error.message : String(error)}`);
      throw new ServiceUnavailableException('Serviço de consulta CNPJ indisponível no momento.');
    }

    if (response.status === 400) {
      throw new BadRequestException('O CNPJ informado não é válido.');
    }
    if (response.status === 404) {
      throw new NotFoundException('CNPJ não encontrado na base consultada.');
    }
    if (!response.ok) {
      throw new BadGatewayException('A consulta cadastral retornou erro. Tente novamente mais tarde.');
    }

    const company = (await response.json()) as BrasilApiCompany;
    const cnaes = [
      ...(company.cnae_fiscal && company.cnae_fiscal_descricao
        ? [{
            code: String(company.cnae_fiscal).padStart(7, '0'),
            description: company.cnae_fiscal_descricao,
            isPrimary: true,
          }]
        : []),
      ...(company.cnaes_secundarios ?? []).map((cnae) => ({
        code: String(cnae.codigo ?? '').padStart(7, '0'),
        description: String(cnae.descricao ?? ''),
        isPrimary: false,
      })).filter((cnae) => cnae.code.length >= 4 && cnae.description.length > 0),
    ];

    return {
      cnpj: clean,
      corporateName: company.razao_social ?? '',
      tradeName: company.nome_fantasia || company.razao_social || '',
      status: company.descricao_situacao_cadastral ?? null,
      address: [company.logradouro, company.numero, company.complemento, company.bairro]
        .filter(Boolean)
        .join(', '),
      municipalityName: company.municipio ?? null,
      uf: company.uf ?? null,
      cep: company.cep ?? null,
      cnaes,
      officialCardUrl: OFFICIAL_CNPJ_CARD_URL,
      source: 'BrasilAPI / Minha Receita',
    };
  }

  async findMunicipalities(ufValue: string, queryValue: string) {
    const uf = (ufValue ?? '').trim().toUpperCase();
    const query = normalizeSearch(queryValue ?? '');
    if (!ALLOWED_UFS.has(uf)) throw new BadRequestException('Informe uma UF brasileira válida.');
    if (query.length < 2) return [];

    let cached = this.municipalitiesCache.get(uf);
    if (!cached || cached.expiresAt <= Date.now()) {
      const municipalities = ibgeMunicipalitySnapshot
        .filter((municipality) => municipality.uf === uf)
        .map((municipality) => ({ id: Number(municipality.code), nome: municipality.name }));
      if (municipalities.length === 0) {
        throw new ServiceUnavailableException('A base de municípios do IBGE está indisponível no momento.');
      }
      cached = { expiresAt: Date.now() + 24 * 60 * 60 * 1000, municipalities };
      this.municipalitiesCache.set(uf, cached);
      void this.refreshMunicipalitiesFromIbge(uf);
    }

    return cached.municipalities
      .filter((municipality) => normalizeSearch(municipality.nome).includes(query))
      .slice(0, 20)
      .map((municipality) => ({
        code: String(municipality.id).padStart(7, '0'),
        name: municipality.nome,
        uf,
        label: `${municipality.nome} - ${uf}`,
      }));
  }

  private async refreshMunicipalitiesFromIbge(uf: string): Promise<void> {
    try {
      const response = await fetch(
        `${IBGE_BASE_URL}/estados/${uf}/municipios?orderBy=nome`,
        { signal: AbortSignal.timeout(5_000) },
      );
      if (!response.ok) throw new Error(`IBGE HTTP ${response.status}`);
      const municipalities = (await response.json()) as IbgeMunicipality[];
      if (municipalities.length > 0) {
        this.municipalitiesCache.set(uf, {
          expiresAt: Date.now() + 6 * 60 * 60 * 1000,
          municipalities,
        });
      }
    } catch (error) {
      this.logger.warn(`IBGE indisponível; mantendo snapshot oficial local: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  async updateCompanyProfile(tenantId: string, dto: SaveCompanyProfileDto) {
    const existing = await this.prisma.tenant.findUnique({ where: { id: tenantId }, select: { id: true } });
    if (!existing) throw new NotFoundException('Empresa não encontrada.');

    const cnpj = cleanCnpj(dto.cnpj);
    if (!/^[A-Z0-9]{12}\d{2}$/.test(cnpj)) {
      throw new BadRequestException('Informe um CNPJ válido com 14 caracteres.');
    }
    const duplicate = await this.prisma.tenant.findFirst({
      where: { cnpj, id: { not: tenantId } },
      select: { id: true },
    });
    if (duplicate) throw new ConflictException('Este CNPJ já está vinculado a outra empresa.');

    const cnaes = dto.cnaes
      .map((cnae) => ({
        code: cnae.code.replace(/[^0-9a-z]/gi, '').toUpperCase(),
        description: cnae.description.trim(),
        isPrimary: cnae.isPrimary,
      }))
      .filter((cnae) => cnae.code.length >= 4 && cnae.description.length > 0)
      .filter((cnae, index, all) => all.findIndex((candidate) => candidate.code === cnae.code) === index);
    const keywords = dto.keywords
      .map((item) => ({ keyword: item.keyword.trim(), matchType: item.matchType, weight: item.weight ?? 1 }))
      .filter((item) => item.keyword.length > 0)
      .filter((item, index, all) => all.findIndex((candidate) =>
        candidate.keyword.toLocaleLowerCase('pt-BR') === item.keyword.toLocaleLowerCase('pt-BR') &&
        candidate.matchType === item.matchType,
      ) === index);
    const regions = dto.regions
      .map((region) => ({
        uf: region.scopeType === 'nacional' ? 'BR' : region.uf.toUpperCase(),
        scopeType: region.scopeType,
        municipalityName: region.scopeType === 'municipio' ? region.municipalityName?.trim() ?? null : null,
        municipalityIbgeCode: region.scopeType === 'municipio' ? region.municipalityIbgeCode ?? null : null,
      }))
      .filter((region) =>
        region.scopeType === 'nacional' ||
        (ALLOWED_UFS.has(region.uf) &&
          (region.scopeType === 'uf' || (region.municipalityName && region.municipalityIbgeCode))),
      )
      .filter((region, index, all) => all.findIndex((candidate) =>
        candidate.scopeType === region.scopeType &&
        candidate.uf === region.uf &&
        candidate.municipalityIbgeCode === region.municipalityIbgeCode,
      ) === index);

    const municipalityBase = regions.find((region) => region.scopeType === 'municipio')?.municipalityName ?? null;

    await this.prisma.$transaction(async (tx) => {
      await tx.tenant.update({
        where: { id: tenantId },
        data: {
          cnpj,
          corporateName: dto.corporateName.trim(),
          tradeName: dto.tradeName.trim(),
        },
      });

      await tx.companyCnae.deleteMany({ where: { tenantId } });
      if (cnaes.length > 0) {
        await tx.companyCnae.createMany({ data: cnaes.map((cnae) => ({ tenantId, ...cnae })) });
      }

      await tx.companyKeyword.deleteMany({ where: { tenantId } });
      if (keywords.length > 0) {
        await tx.companyKeyword.createMany({
          data: keywords.map((item) => ({
            tenantId,
            keyword: item.keyword,
            normalizedKeyword: normalizeSearch(item.keyword),
            matchType: item.matchType,
            weight: item.weight,
          })),
        });
      }

      await tx.companyRegion.deleteMany({ where: { tenantId } });
      if (regions.length > 0) {
        await tx.companyRegion.createMany({ data: regions.map((region) => ({ tenantId, ...region })) });
      }

      await tx.companyFilter.upsert({
        where: { tenantId },
        create: { tenantId, municipioBase: municipalityBase },
        update: { municipioBase: municipalityBase },
      });

      const currentCard = await tx.habilitationDocument.findFirst({
        where: { tenantId, name: { contains: 'CNPJ', mode: 'insensitive' } },
        orderBy: { createdAt: 'desc' },
      });
      if (currentCard) {
        await tx.habilitationDocument.update({
          where: { id: currentCard.id },
          data: {
            externalLink: OFFICIAL_CNPJ_CARD_URL,
            origin: 'link',
            status: currentCard.fileUrl ? currentCard.status : 'pendente',
          },
        });
      } else {
        await tx.habilitationDocument.create({
          data: {
            tenantId,
            name: 'Cartão CNPJ — Receita Federal',
            origin: 'link',
            externalLink: OFFICIAL_CNPJ_CARD_URL,
            status: 'pendente',
          },
        });
      }
    });

    return this.getCompanyProfile(tenantId);
  }
}
