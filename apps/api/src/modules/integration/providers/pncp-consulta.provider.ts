import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  BiddingItemRaw,
  BiddingSourceMetadata,
  BiddingSourceProvider,
  BiddingSourceRaw,
  FetchBiddingsOptions,
  FetchBiddingsResult,
} from './bidding-source.provider';

const DEFAULT_BASE_URL = 'https://pncp.gov.br/api/consulta';
const DEFAULT_PAGE_SIZE = 500;
const DEFAULT_LOOKBACK_DAYS = 7;
const MAX_PAGE_SIZE = 500;
const PROCUREMENT_LAW = 'Lei 14.133/2021';

/**
 * Official PNCP modality domain documented by the PNCP query manual.
 * Do not replace these values with labels from private aggregators.
 */
export const PNCP_MODALITIES = [
  { code: 1, label: 'Leilão - Eletrônico', normalized: 'leilao-eletronico' },
  { code: 2, label: 'Diálogo Competitivo', normalized: 'dialogo-competitivo' },
  { code: 3, label: 'Concurso', normalized: 'concurso' },
  { code: 4, label: 'Concorrência - Eletrônica', normalized: 'concorrencia-eletronica' },
  { code: 5, label: 'Concorrência - Presencial', normalized: 'concorrencia-presencial' },
  { code: 6, label: 'Pregão - Eletrônico', normalized: 'pregao-eletronico' },
  { code: 7, label: 'Pregão - Presencial', normalized: 'pregao-presencial' },
  { code: 8, label: 'Dispensa de Licitação', normalized: 'dispensa-licitacao' },
  { code: 9, label: 'Inexigibilidade', normalized: 'inexigibilidade' },
  { code: 10, label: 'Manifestação de Interesse', normalized: 'manifestacao-interesse' },
  { code: 11, label: 'Pré-qualificação', normalized: 'pre-qualificacao' },
  { code: 12, label: 'Credenciamento', normalized: 'credenciamento' },
  { code: 13, label: 'Leilão - Presencial', normalized: 'leilao-presencial' },
] as const;

const PNCP_MODALITY_BY_CODE = new Map<number, (typeof PNCP_MODALITIES)[number]>(
  PNCP_MODALITIES.map((modality) => [modality.code, modality]),
);

interface PncpPage<T> {
  data?: T[];
  totalRegistros?: number;
  totalPaginas?: number;
  numeroPagina?: number;
  paginasRestantes?: number;
  empty?: boolean;
}

interface PncpRecord {
  numeroControlePNCP?: unknown;
  numeroCompra?: unknown;
  anoCompra?: unknown;
  processo?: unknown;
  tipoInstrumentoConvocatorioId?: unknown;
  tipoInstrumentoConvocatorioNome?: unknown;
  modalidadeId?: unknown;
  modalidadeNome?: unknown;
  modoDisputaId?: unknown;
  modoDisputaNome?: unknown;
  situacaoCompraId?: unknown;
  situacaoCompraNome?: unknown;
  objetoCompra?: unknown;
  informacaoComplementar?: unknown;
  srp?: unknown;
  amparoLegal?: { codigo?: unknown; nome?: unknown; descricao?: unknown } | null;
  valorTotalEstimado?: unknown;
  valorTotalHomologado?: unknown;
  dataAberturaProposta?: unknown;
  dataEncerramentoProposta?: unknown;
  dataPublicacaoPncp?: unknown;
  dataInclusao?: unknown;
  dataAtualizacao?: unknown;
  sequencialCompra?: unknown;
  orgaoEntidade?: {
    cnpj?: unknown;
    razaosocial?: unknown;
    poderId?: unknown;
    esferaId?: unknown;
  } | null;
  unidadeOrgao?: {
    codigoUnidade?: unknown;
    nomeUnidade?: unknown;
    codigoIbge?: unknown;
    municipioNome?: unknown;
    ufSigla?: unknown;
    ufNome?: unknown;
  } | null;
  usuarioNome?: unknown;
  linkSistemaOrigem?: unknown;
  justificativaPresencial?: unknown;
  [key: string]: unknown;
}

interface PncpCursor {
  modalityIndex: number;
  page: number;
}

@Injectable()
export class PncpConsultaProvider implements BiddingSourceProvider {
  private readonly logger = new Logger(PncpConsultaProvider.name);
  readonly sourceName = 'pncp';
  readonly requiresFilter = false;

  private readonly baseUrl: string;
  private readonly pageSize: number;
  private readonly lookbackDays: number;

  constructor(private readonly configService: ConfigService) {
    this.baseUrl = this.configService
      .get<string>('PNCP_CONSULTA_BASE_URL', DEFAULT_BASE_URL)
      .replace(/\/+$/, '');
    this.pageSize = this.clampPageSize(
      this.configService.get<number>('PNCP_PAGE_SIZE', DEFAULT_PAGE_SIZE),
    );
    this.lookbackDays = Math.max(
      1,
      this.configService.get<number>('PNCP_LOOKBACK_DAYS', DEFAULT_LOOKBACK_DAYS),
    );
  }

  getSourceMetadata(): BiddingSourceMetadata {
    return {
      name: 'Portal Nacional de Contratações Públicas',
      scope: 'national',
      authority: 'Comitê Gestor da Rede Nacional de Contratações Públicas',
      baseUrl: 'https://pncp.gov.br',
      apiUrl: this.baseUrl,
      protocol: 'REST/HTTP JSON',
      coverageNotes:
        'Consulta pública de contratações pela data de publicação e por período de recebimento de propostas em aberto, conforme Manual PNCP API Consultas.',
      termsUrl: 'https://pncp.gov.br/app/entidades-dominio',
    };
  }

  async fetchBiddings(options: FetchBiddingsOptions = {}): Promise<FetchBiddingsResult> {
    const queryMode = options.queryMode ?? 'publication';
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
      codigoModalidadeContratacao: String(modality.code),
      dataFinal: this.formatDate(until),
    });

    if (queryMode === 'publication') {
      params.set('dataInicial', this.formatDate(since));
    }

    if (options.uf) params.set('uf', options.uf.trim().toUpperCase());
    if (options.municipalityIbgeCode) params.set('codigoMunicipioIbge', options.municipalityIbgeCode.trim());

    const endpoint = queryMode === 'open_proposals'
      ? '/v1/contratacoes/proposta'
      : '/v1/contratacoes/publicacao';

    const response = await this.getJson<PncpPage<PncpRecord>>(`${endpoint}?${params.toString()}`);
    const records = Array.isArray(response.data) ? response.data : [];
    const totalPages = this.getTotalPages(response, page);
    const hasNextPage = page < totalPages;
    const hasNextModality = modalityIndex < modalities.length - 1;
    const nextCursor = hasNextPage
      ? this.encodeCursor({ modalityIndex, page: page + 1 })
      : hasNextModality
        ? this.encodeCursor({ modalityIndex: modalityIndex + 1, page: 1 })
        : null;

    this.logger.debug(
      `PNCP ${queryMode}: modality=${modality.code} page=${page}/${totalPages} records=${records.length}`,
    );

    return {
      biddings: records.map((record) => this.mapRecord(record)),
      nextCursor,
      totalFetched: records.length,
    };
  }

  /**
   * The P0 public query contract exposes list endpoints only. A detail endpoint
   * will be added in a later PR after its public consultation contract is
   * separately verified; no private aggregator route is inferred here.
   */
  async fetchBiddingDetails(_externalId: string): Promise<BiddingSourceRaw | null> {
    return null;
  }

  /**
   * The P0 list response does not contain item-level records. Items will be
   * populated by a separately validated official detail connector.
   */
  async fetchBiddingItems(_externalId: string): Promise<BiddingItemRaw[]> {
    return [];
  }

  async healthCheck(): Promise<{ healthy: boolean; message: string }> {
    try {
      const params = new URLSearchParams({
        dataInicial: this.formatDate(new Date()),
        dataFinal: this.formatDate(new Date()),
        codigoModalidadeContratacao: '1',
        pagina: '1',
        tamanhoPagina: '1',
      });
      const response = await this.getJson<PncpPage<PncpRecord>>(
        `/v1/contratacoes/publicacao?${params.toString()}`,
      );
      return {
        healthy: true,
        message: `PNCP consulta reachable; totalRegistros=${response.totalRegistros ?? 0}`,
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      return { healthy: false, message: `PNCP consulta unavailable: ${message}` };
    }
  }

  private async getJson<T>(path: string): Promise<T> {
    const response = await fetch(`${this.baseUrl}${path}`, {
      method: 'GET',
      headers: {
        Accept: 'application/json',
        'User-Agent': 'LicitaIA-PublicSource/1.0',
      },
      signal: AbortSignal.timeout(30_000),
    });

    const text = await response.text();
    if (!response.ok) {
      throw new Error(`PNCP HTTP ${response.status}: ${text.slice(0, 300)}`);
    }
    if (!text.trim()) {
      return { data: [], totalRegistros: 0, totalPaginas: 0, empty: true } as T;
    }

    try {
      return JSON.parse(text) as T;
    } catch {
      throw new Error(`PNCP returned a non-JSON body: ${text.slice(0, 300)}`);
    }
  }

  private mapRecord(record: PncpRecord): BiddingSourceRaw {
    const controlNumber = this.stringValue(record.numeroControlePNCP);
    const modalityCode = this.numberValue(record.modalidadeId);
    const modality = modalityCode ? PNCP_MODALITY_BY_CODE.get(modalityCode) : undefined;
    const openingDate = this.parseDate(record.dataAberturaProposta);
    const proposalDueDate = this.parseDate(record.dataEncerramentoProposta);
    const sourceUpdatedAt = this.parseDate(record.dataAtualizacao);
    const status = this.mapStatus(record, proposalDueDate);
    const sourceRecordKey = controlNumber || this.buildFallbackRecordKey(record);
    const sourceUrl = this.stringValue(record.linkSistemaOrigem)
      || (controlNumber ? `https://pncp.gov.br/app/editais/${encodeURIComponent(controlNumber)}` : null);

    return {
      externalId: sourceRecordKey,
      sourceRecordKey,
      pncpControlNumber: controlNumber,
      sourceSystemName: this.stringValue(record.usuarioNome),
      modalityCode: modalityCode ? String(modalityCode) : null,
      modalityNormalized: modality?.normalized ?? null,
      procurementLaw: PROCUREMENT_LAW,
      processNumber: this.stringValue(record.processo),
      purchaseYear: this.numberValue(record.anoCompra),
      publicationUpdatedAt: sourceUpdatedAt,
      sourceUpdatedAt,
      biddingNumber: this.stringValue(record.numeroCompra),
      modality: this.stringValue(record.modalidadeNome) || modality?.label || null,
      uasg: this.stringValue(record.unidadeOrgao?.codigoUnidade),
      sphere: this.stringValue(record.orgaoEntidade?.esferaId),
      agencyName: this.stringValue(record.orgaoEntidade?.razaosocial),
      agencyDocument: this.stringValue(record.orgaoEntidade?.cnpj),
      objectText: this.stringValue(record.objetoCompra) ?? '',
      objectSummary: this.stringValue(record.informacaoComplementar),
      sourceUrl,
      publicationDate: this.parseDate(record.dataPublicacaoPncp),
      openingDate,
      proposalDueDate,
      estimatedValue: this.numberValue(record.valorTotalEstimado),
      municipalityName: this.stringValue(record.unidadeOrgao?.municipioNome),
      municipalityIbgeCode: this.stringValue(record.unidadeOrgao?.codigoIbge),
      uf: this.stringValue(record.unidadeOrgao?.ufSigla)?.toUpperCase() || null,
      status,
      rawPayload: record,
      items: [],
    };
  }

  private mapStatus(record: PncpRecord, proposalDueDate: Date | null): string {
    const situationCode = this.numberValue(record.situacaoCompraId);
    if (situationCode === 2) return 'revoked';
    if (situationCode === 3) return 'annulled';
    if (situationCode === 4) return 'suspended';
    if (proposalDueDate && proposalDueDate.getTime() < Date.now()) return 'closed';
    return situationCode === 1 || !situationCode ? 'open' : 'unknown';
  }

  private buildFallbackRecordKey(record: PncpRecord): string {
    const cnpj = this.stringValue(record.orgaoEntidade?.cnpj) ?? 'unknown-cnpj';
    const year = this.numberValue(record.anoCompra) ?? 'unknown-year';
    const sequence = this.numberValue(record.sequencialCompra) ?? 'unknown-sequence';
    return `${cnpj}-${year}-${sequence}`;
  }

  private parseDate(value: unknown): Date | null {
    const text = this.stringValue(value);
    if (!text) return null;
    const parsed = new Date(text.includes('T') ? text : `${text}T00:00:00Z`);
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
    return `${year}${month}${day}`;
  }

  private getTotalPages(response: PncpPage<unknown>, currentPage: number): number {
    if (typeof response.totalPaginas === 'number' && response.totalPaginas > 0) {
      return response.totalPaginas;
    }
    if (typeof response.paginasRestantes === 'number') {
      return currentPage + Math.max(0, response.paginasRestantes);
    }
    return response.empty || !response.data?.length ? currentPage : currentPage + 1;
  }

  private clampPageSize(value: number): number {
    if (!Number.isFinite(value)) return DEFAULT_PAGE_SIZE;
    return Math.min(MAX_PAGE_SIZE, Math.max(1, Math.trunc(value)));
  }

  private requireModality(code: number) {
    const modality = PNCP_MODALITY_BY_CODE.get(code);
    if (!modality) throw new Error(`Unsupported PNCP modality code: ${code}`);
    return modality;
  }

  private encodeCursor(cursor: PncpCursor): string {
    return Buffer.from(JSON.stringify(cursor), 'utf8').toString('base64url');
  }

  private decodeCursor(value?: string): PncpCursor {
    if (!value) return { modalityIndex: 0, page: 1 };
    try {
      const parsed = JSON.parse(Buffer.from(value, 'base64url').toString('utf8')) as Partial<PncpCursor>;
      return {
        modalityIndex: Number.isInteger(parsed.modalityIndex) && (parsed.modalityIndex ?? 0) >= 0
          ? parsed.modalityIndex as number
          : 0,
        page: Number.isInteger(parsed.page) && (parsed.page ?? 1) > 0 ? parsed.page as number : 1,
      };
    } catch {
      throw new Error('Invalid PNCP cursor');
    }
  }
}
