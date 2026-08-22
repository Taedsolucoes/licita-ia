import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { getOfficialJson } from './official-source-http';
import { PNCP_MODALITIES } from './pncp-consulta.provider';
import {
  BiddingItemRaw,
  BiddingSourceMetadata,
  BiddingSourceProvider,
  BiddingSourceRaw,
  FetchBiddingsOptions,
  FetchBiddingsResult,
} from './bidding-source.provider';

const DEFAULT_BASE_URL = 'https://dadosabertos.compras.gov.br';
const DEFAULT_PAGE_SIZE = 100;
const DEFAULT_LOOKBACK_DAYS = 7;
const MAX_PAGE_SIZE = 500;
const PROCUREMENT_LAW = 'Lei 14.133/2021';

const MODALITY_BY_CODE = new Map<number, (typeof PNCP_MODALITIES)[number]>(
  PNCP_MODALITIES.map((modality) => [modality.code, modality]),
);

interface ComprasEnvelope<T> {
  resultado?: T[];
  totalRegistros?: number;
  totalPaginas?: number;
  paginasRestantes?: number;
}

interface ComprasRecord {
  idCompra?: unknown;
  numeroControlePNCP?: unknown;
  anoCompraPncp?: unknown;
  sequencialCompraPncp?: unknown;
  orgaoEntidadeCnpj?: unknown;
  orgaoSubrogadoCnpj?: unknown;
  codigoOrgao?: unknown;
  orgaoEntidadeRazaoSocial?: unknown;
  orgaoSubrogadoRazaoSocial?: unknown;
  orgaoEntidadeEsferaId?: unknown;
  orgaoEntidadePoderId?: unknown;
  unidadeOrgaoCodigoUnidade?: unknown;
  unidadeOrgaoNomeUnidade?: unknown;
  unidadeOrgaoUfSigla?: unknown;
  unidadeOrgaoMunicipioNome?: unknown;
  unidadeOrgaoCodigoIbge?: unknown;
  numeroCompra?: unknown;
  modalidadeIdPncp?: unknown;
  codigoModalidade?: unknown;
  modalidadeNome?: unknown;
  srp?: unknown;
  modoDisputaIdPncp?: unknown;
  codigoModoDisputa?: unknown;
  amparoLegalCodigoPncp?: unknown;
  amparoLegalNome?: unknown;
  amparoLegalDescricao?: unknown;
  informacaoComplementar?: unknown;
  processo?: unknown;
  existeResultado?: unknown;
  situacaoCompraIdPncp?: unknown;
  situacaoCompraNomePncp?: unknown;
  tipoInstrumentoConvocatorioCodigoPncp?: unknown;
  tipoInstrumentoConvocatorioNome?: unknown;
  modoDisputaNomePncp?: unknown;
  objetoCompra?: unknown;
  valorTotalEstimado?: unknown;
  valorTotalHomologado?: unknown;
  dataInclusaoPncp?: unknown;
  dataAtualizacaoPncp?: unknown;
  dataPublicacaoPncp?: unknown;
  dataAberturaPropostaPncp?: unknown;
  dataEncerramentoPropostaPncp?: unknown;
  contratacaoExcluida?: unknown;
  [key: string]: unknown;
}

interface ComprasCursor {
  modalityIndex: number;
  page: number;
}

@Injectable()
export class ComprasPublicasProvider implements BiddingSourceProvider {
  private readonly logger = new Logger(ComprasPublicasProvider.name);
  readonly sourceName = 'compras.gov.br';
  readonly requiresFilter = false;

  private readonly baseUrl: string;
  private readonly pageSize: number;
  private readonly lookbackDays: number;

  constructor(private readonly configService: ConfigService) {
    this.baseUrl = this.configService
      .get<string>('COMPRAS_PUBLICAS_BASE_URL', DEFAULT_BASE_URL)
      .replace(/\/+$/, '');
    this.pageSize = this.clampPageSize(
      this.configService.get<number>('COMPRAS_PUBLICAS_PAGE_SIZE', DEFAULT_PAGE_SIZE),
    );
    this.lookbackDays = Math.max(
      1,
      this.configService.get<number>('COMPRAS_PUBLICAS_LOOKBACK_DAYS', DEFAULT_LOOKBACK_DAYS),
    );
  }

  getSourceMetadata(): BiddingSourceMetadata {
    return {
      name: 'Compras Públicas em Dados Abertos',
      scope: 'federal',
      authority: 'Ministério da Gestão e Inovação em Serviços Públicos',
      baseUrl: 'https://dadosabertos.compras.gov.br',
      apiUrl: this.baseUrl,
      protocol: 'REST/HTTP JSON',
      coverageNotes:
        'Consulta pública do módulo de Contratações para registros PNCP sob a Lei 14.133/2021, com filtros de publicação, modalidade, UF, município IBGE e unidade administrativa.',
      termsUrl:
        'https://www.gov.br/compras/pt-br/cidadao/portal-de-dados-abertos/documentacao-interativa-da-api-de-dados-abertos',
    };
  }

  async fetchBiddings(options: FetchBiddingsOptions = {}): Promise<FetchBiddingsResult> {
    if (options.queryMode === 'open_proposals') {
      throw new Error(
        'Compras.gov.br public contract does not expose the PNCP open-proposals query in this adapter; use the PNCP provider for that mode.',
      );
    }

    const modalities = options.modalityCode
      ? [this.requireModality(options.modalityCode)]
      : PNCP_MODALITIES;
    const cursor = this.decodeCursor(options.cursor);
    const modalityIndex = Math.min(cursor.modalityIndex, Math.max(0, modalities.length - 1));
    const modality = modalities[modalityIndex];
    const page = Math.max(1, cursor.page);
    const until = options.until ?? new Date();
    const since = options.since ?? new Date(until.getTime() - this.lookbackDays * 86_400_000);

    const params = new URLSearchParams({
      pagina: String(page),
      tamanhoPagina: String(this.pageSize),
      dataPublicacaoPncpInicial: this.formatDate(since),
      dataPublicacaoPncpFinal: this.formatDate(until),
      codigoModalidade: String(modality.code),
    });

    if (options.uf) params.set('unidadeOrgaoUfSigla', options.uf.trim().toUpperCase());
    if (options.municipalityIbgeCode) {
      params.set('unidadeOrgaoCodigoIbge', options.municipalityIbgeCode.trim());
    }

    const response = await getOfficialJson<ComprasEnvelope<ComprasRecord>>({
      url: `${this.baseUrl}/modulo-contratacoes/1_consultarContratacoes_PNCP_14133?${params.toString()}`,
      sourceName: 'Compras.gov.br',
      emptyBody: { resultado: [], totalRegistros: 0, totalPaginas: 0, paginasRestantes: 0 },
    });
    const records = Array.isArray(response.resultado) ? response.resultado : [];
    const totalPages = this.getTotalPages(response, page);
    const hasNextPage = page < totalPages;
    const hasNextModality = modalityIndex < modalities.length - 1;
    const nextCursor = hasNextPage
      ? this.encodeCursor({ modalityIndex, page: page + 1 })
      : hasNextModality
        ? this.encodeCursor({ modalityIndex: modalityIndex + 1, page: 1 })
        : null;

    this.logger.debug(
      `Compras.gov.br publication: modality=${modality.code} page=${page}/${totalPages} records=${records.length}`,
    );

    return {
      biddings: records.map((record) => this.mapRecord(record)),
      nextCursor,
      totalFetched: records.length,
    };
  }

  /**
   * The list contract is implemented in this PR. Detail and item operations
   * remain intentionally deferred until the public `tipo`/`codigo` semantics
   * are verified against the official operation contract, rather than guessed
   * from a private aggregator or another portal.
   */
  async fetchBiddingDetails(_externalId: string): Promise<BiddingSourceRaw | null> {
    return null;
  }

  async fetchBiddingItems(_externalId: string): Promise<BiddingItemRaw[]> {
    return [];
  }

  async healthCheck(): Promise<{ healthy: boolean; message: string }> {
    try {
      const now = new Date();
      const params = new URLSearchParams({
        pagina: '1',
        tamanhoPagina: '10',
        dataPublicacaoPncpInicial: this.formatDate(now),
        dataPublicacaoPncpFinal: this.formatDate(now),
        codigoModalidade: '6',
      });
      const response = await getOfficialJson<ComprasEnvelope<ComprasRecord>>({
        url: `${this.baseUrl}/modulo-contratacoes/1_consultarContratacoes_PNCP_14133?${params.toString()}`,
        sourceName: 'Compras.gov.br',
        emptyBody: { resultado: [], totalRegistros: 0, totalPaginas: 0, paginasRestantes: 0 },
      });
      return {
        healthy: true,
        message: `Compras.gov.br reachable; totalRegistros=${response.totalRegistros ?? 0}`,
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      return { healthy: false, message: `Compras.gov.br unavailable: ${message}` };
    }
  }

  private mapRecord(record: ComprasRecord): BiddingSourceRaw {
    const controlNumber = this.stringValue(record.numeroControlePNCP);
    const modalityCode = this.numberValue(record.codigoModalidade ?? record.modalidadeIdPncp);
    const modality = modalityCode ? MODALITY_BY_CODE.get(modalityCode) : undefined;
    const proposalDueDate = this.parseDate(record.dataEncerramentoPropostaPncp);
    const sourceUpdatedAt = this.parseDate(record.dataAtualizacaoPncp);
    const sourceRecordKey =
      controlNumber
      || this.stringValue(record.idCompra)
      || this.buildFallbackRecordKey(record);
    const sourceUrl = controlNumber
      ? `https://pncp.gov.br/app/editais/${encodeURIComponent(controlNumber)}`
      : null;

    return {
      externalId: sourceRecordKey,
      sourceRecordKey,
      pncpControlNumber: controlNumber,
      sourceSystemName: 'Compras.gov.br',
      modalityCode: modalityCode ? String(modalityCode) : null,
      modalityNormalized: modality?.normalized ?? null,
      procurementLaw: PROCUREMENT_LAW,
      processNumber: this.stringValue(record.processo),
      purchaseYear: this.numberValue(record.anoCompraPncp),
      publicationUpdatedAt: sourceUpdatedAt,
      sourceUpdatedAt,
      biddingNumber: this.stringValue(record.numeroCompra),
      modality: this.stringValue(record.modalidadeNome) || modality?.label || null,
      uasg: this.stringValue(record.unidadeOrgaoCodigoUnidade),
      sphere: this.stringValue(record.orgaoEntidadeEsferaId),
      agencyName: this.stringValue(record.orgaoEntidadeRazaoSocial),
      agencyDocument: this.stringValue(record.orgaoEntidadeCnpj),
      objectText: this.stringValue(record.objetoCompra) ?? '',
      objectSummary: this.stringValue(record.informacaoComplementar),
      sourceUrl,
      publicationDate: this.parseDate(record.dataPublicacaoPncp),
      openingDate: this.parseDate(record.dataAberturaPropostaPncp),
      proposalDueDate,
      estimatedValue: this.numberValue(record.valorTotalEstimado),
      municipalityName: this.stringValue(record.unidadeOrgaoMunicipioNome),
      municipalityIbgeCode: this.stringValue(record.unidadeOrgaoCodigoIbge),
      uf: this.stringValue(record.unidadeOrgaoUfSigla)?.toUpperCase() || null,
      status: this.mapStatus(record, proposalDueDate),
      rawPayload: record,
      items: [],
    };
  }

  private mapStatus(record: ComprasRecord, proposalDueDate: Date | null): string {
    if (record.contratacaoExcluida === true) return 'deleted';
    const situationCode = this.numberValue(record.situacaoCompraIdPncp);
    if (situationCode === 2) return 'revoked';
    if (situationCode === 3) return 'annulled';
    if (situationCode === 4) return 'suspended';
    if (proposalDueDate && proposalDueDate.getTime() < Date.now()) return 'closed';
    return situationCode === 1 || !situationCode ? 'open' : 'unknown';
  }

  private buildFallbackRecordKey(record: ComprasRecord): string {
    const cnpj = this.stringValue(record.orgaoEntidadeCnpj) ?? 'unknown-cnpj';
    const year = this.numberValue(record.anoCompraPncp) ?? 'unknown-year';
    const sequence = this.numberValue(record.sequencialCompraPncp) ?? 'unknown-sequence';
    return `${cnpj}-${year}-${sequence}`;
  }

  private parseDate(value: unknown): Date | null {
    const text = this.stringValue(value);
    if (!text) return null;
    const normalized = text.includes('T') ? text : text.replace(' ', 'T');
    const parsed = new Date(/Z|[+-]\d\d:\d\d$/.test(normalized) ? normalized : `${normalized}Z`);
    return Number.isNaN(parsed.getTime()) ? null : parsed;
  }

  private stringValue(value: unknown): string | null {
    if (value === null || value === undefined) return null;
    const text = String(value).trim();
    return text || null;
  }

  private numberValue(value: unknown): number | null {
    if (value === null || value === undefined || value === '') return null;
    const number = typeof value === 'number' ? value : Number(String(value).replace(',', '.'));
    return Number.isFinite(number) ? number : null;
  }

  private formatDate(value: Date): string {
    const year = value.getUTCFullYear();
    const month = String(value.getUTCMonth() + 1).padStart(2, '0');
    const day = String(value.getUTCDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  }

  private getTotalPages(response: ComprasEnvelope<unknown>, currentPage: number): number {
    if (typeof response.totalPaginas === 'number' && response.totalPaginas > 0) {
      return response.totalPaginas;
    }
    if (typeof response.paginasRestantes === 'number') {
      return currentPage + Math.max(0, response.paginasRestantes);
    }
    return !response.resultado?.length ? currentPage : currentPage + 1;
  }

  private clampPageSize(value: number): number {
    if (!Number.isFinite(value)) return DEFAULT_PAGE_SIZE;
    return Math.min(MAX_PAGE_SIZE, Math.max(10, Math.trunc(value)));
  }

  private requireModality(code: number) {
    const modality = MODALITY_BY_CODE.get(code);
    if (!modality) throw new Error(`Unsupported Compras.gov.br modality code: ${code}`);
    return modality;
  }

  private encodeCursor(cursor: ComprasCursor): string {
    return Buffer.from(JSON.stringify(cursor), 'utf8').toString('base64url');
  }

  private decodeCursor(value?: string): ComprasCursor {
    if (!value) return { modalityIndex: 0, page: 1 };
    try {
      const parsed = JSON.parse(Buffer.from(value, 'base64url').toString('utf8')) as Partial<ComprasCursor>;
      return {
        modalityIndex:
          Number.isInteger(parsed.modalityIndex) && (parsed.modalityIndex ?? 0) >= 0
            ? (parsed.modalityIndex as number)
            : 0,
        page:
          Number.isInteger(parsed.page) && (parsed.page ?? 1) > 0 ? (parsed.page as number) : 1,
      };
    } catch {
      throw new Error('Invalid Compras.gov.br cursor');
    }
  }
}
