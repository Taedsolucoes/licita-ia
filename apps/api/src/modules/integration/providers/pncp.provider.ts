import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  BiddingItemRaw,
  BiddingSourceProvider,
  BiddingSourceRaw,
  FetchBiddingsOptions,
  FetchBiddingsResult,
} from './bidding-source.provider';

type JsonRecord = Record<string, unknown>;
type DateMode = 'publication' | 'update';

interface PncpListEnvelope {
  data?: unknown[];
  totalRegistros?: number;
  totalPaginas?: number;
  numeroPagina?: number;
  paginasRestantes?: number;
  empty?: boolean;
}

/**
 * Public PNCP consultation provider. The list API is served at /api/consulta;
 * item records are served by the public integration API at /api/pncp.
 */
@Injectable()
export class PncpProvider implements BiddingSourceProvider {
  readonly sourceName = 'pncp';
  private readonly logger = new Logger(PncpProvider.name);
  private readonly consultaBaseUrl: string;
  private readonly integracaoBaseUrl: string;
  private readonly requestTimeoutMs: number;
  private readonly maxRetries: number;
  private readonly minRequestIntervalMs: number;
  private requestQueue: Promise<void> = Promise.resolve();
  private lastRequestAt = 0;

  constructor(private readonly configService: ConfigService) {
    this.consultaBaseUrl = this.trimSlash(
      this.configService.get<string>('PNCP_CONSULTA_BASE_URL', 'https://pncp.gov.br/api/consulta'),
    );
    this.integracaoBaseUrl = this.trimSlash(
      this.configService.get<string>('PNCP_INTEGRACAO_BASE_URL', 'https://pncp.gov.br/api/pncp'),
    );
    this.requestTimeoutMs = this.configService.get<number>('PNCP_REQUEST_TIMEOUT_MS', 30_000);
    this.maxRetries = this.configService.get<number>('PNCP_MAX_RETRIES', 3);
    this.minRequestIntervalMs = this.configService.get<number>('PNCP_REQUEST_DELAY_MS', 100);
  }

  async fetchBiddings(options: FetchBiddingsOptions = {}): Promise<FetchBiddingsResult> {
    const since = this.formatPncpDate(options.since);
    const until = this.formatPncpDate(options.until);
    if (!since || !until) {
      throw new Error('PNCP requires both since and until dates (use UTC dates).');
    }
    if (until < since) throw new Error('PNCP until date must be on or after since date.');
    if (!Number.isInteger(options.modalityCode) || (options.modalityCode as number) < 1) {
      throw new Error('PNCP requires a positive modalityCode because the API requires codigoModalidadeContratacao.');
    }

    const page = options.cursor ? Number.parseInt(options.cursor, 10) : 1;
    if (!Number.isInteger(page) || page < 1) throw new Error(`Invalid PNCP page cursor: ${options.cursor}`);
    const pageSize = options.limit ?? 50;
    if (!Number.isInteger(pageSize) || pageSize < 10 || pageSize > 100) {
      throw new Error('PNCP page size must be an integer between 10 and 100.');
    }

    const mode: DateMode = options.dateMode ?? 'publication';
    const endpoint = mode === 'update' ? '/v1/contratacoes/atualizacao' : '/v1/contratacoes/publicacao';
    const url = new URL(`${this.consultaBaseUrl}${endpoint}`);
    url.searchParams.set('dataInicial', since);
    url.searchParams.set('dataFinal', until);
    url.searchParams.set('codigoModalidadeContratacao', String(options.modalityCode));
    url.searchParams.set('pagina', String(page));
    url.searchParams.set('tamanhoPagina', String(pageSize));
    if (options.disputeModeCode != null) url.searchParams.set('codigoModoDisputa', String(options.disputeModeCode));
    if (options.uf) url.searchParams.set('uf', options.uf.trim().toUpperCase());
    if (options.municipalityIbgeCode) url.searchParams.set('codigoMunicipioIbge', options.municipalityIbgeCode.trim());

    const envelope = await this.getJson<PncpListEnvelope>(url.toString());
    const records = Array.isArray(envelope?.data) ? envelope.data : [];
    const biddings: BiddingSourceRaw[] = [];

    for (const value of records) {
      if (!this.isRecord(value)) continue;
      const mapped = this.mapRecord(value);
      if (options.keyword && !this.normalizeText(mapped.objectText).includes(this.normalizeText(options.keyword))) {
        continue;
      }
      if (options.includeItems && mapped.externalId) {
        try {
          mapped.items = await this.fetchBiddingItems(mapped.externalId);
        } catch (error) {
          this.logger.warn(
            `Could not fetch PNCP items for ${mapped.externalId}: ${this.errorMessage(error)}`,
          );
        }
      }
      biddings.push(mapped);
    }

    const totalPages = Number(envelope?.totalPaginas);
    const nextCursor = Number.isFinite(totalPages)
      ? page < totalPages
        ? String(page + 1)
        : null
      : records.length >= pageSize
        ? String(page + 1)
        : null;

    return { biddings, nextCursor, totalFetched: records.length };
  }

  async fetchBiddingDetails(externalId: string): Promise<BiddingSourceRaw | null> {
    const key = this.parseExternalId(externalId);
    if (!key) return null;
    const path = `/v1/orgaos/${key.cnpj}/compras/${key.year}/${key.sequence}`;
    const response = await this.getJson<unknown>(`${this.consultaBaseUrl}${path}`, true);
    return response && this.isRecord(response) ? this.mapRecord(response) : null;
  }

  async fetchBiddingItems(externalId: string): Promise<BiddingItemRaw[]> {
    const key = this.parseExternalId(externalId);
    if (!key) return [];
    const path = `/v1/orgaos/${key.cnpj}/compras/${key.year}/${key.sequence}/itens`;
    const response = await this.getJson<unknown>(`${this.integracaoBaseUrl}${path}`, true);
    if (!Array.isArray(response)) return [];

    return response
      .filter((item): item is JsonRecord => this.isRecord(item))
      .map((item, index) => {
        const number = this.numberValue(item.numeroItem) ?? index + 1;
        const description = this.stringValue(item.descricao) ?? '';
        const quantity = this.numberValue(item.quantidade) ?? 0;
        const unit = this.stringValue(item.unidadeMedida) ?? 'UN';
        const unitValue = this.numberValue(item.valorUnitarioEstimado);
        const totalValue = this.numberValue(item.valorTotal);
        return {
          itemNumber: number,
          description,
          quantity,
          unit,
          unitValueEstimated: unitValue,
          totalValueEstimated: totalValue,
          catalogCode:
            this.stringValue(item.catalogoCodigoItem) ??
            this.stringValue(item.ncmNbsCodigo) ??
            this.stringValue(item.codigoItem),
          rawPayload: item,
        };
      })
      .filter((item) => item.description.length > 0);
  }

  async healthCheck(): Promise<{ healthy: boolean; message: string }> {
    try {
      const response = await this.getJson<JsonRecord>(`${this.consultaBaseUrl}/v3/api-docs`);
      return {
        healthy: this.isRecord(response) && response.openapi === '3.0.1',
        message: 'PNCP public consultation OpenAPI is reachable.',
      };
    } catch (error) {
      return { healthy: false, message: `PNCP unavailable: ${this.errorMessage(error)}` };
    }
  }

  private mapRecord(record: JsonRecord): BiddingSourceRaw {
    const org = this.asRecord(record.orgaoEntidade);
    const unit = this.asRecord(record.unidadeOrgao);
    const controlId = this.stringValue(record.numeroControlePNCP) ?? '';
    const cnpj = this.stringValue(org.cnpj) ?? controlId.split('-')[0] ?? null;
    const year = this.numberValue(record.anoCompra);
    const sequence = this.numberValue(record.sequencialCompra);
    const sourceUrl =
      this.stringValue(record.linkSistemaOrigem) ??
      (cnpj && year != null && sequence != null
        ? `https://pncp.gov.br/app/editais/${cnpj}/${year}/${sequence}`
        : null);
    const modality = this.stringValue(record.modalidadeNome);
    const statusName = this.stringValue(record.situacaoCompraNome)?.toLocaleLowerCase('pt-BR') ?? '';

    return {
      externalId: controlId || this.buildExternalId(cnpj, year, sequence),
      biddingNumber: this.stringValue(record.numeroCompra) ?? this.stringValue(record.processo) ?? (controlId || null),
      modality,
      uasg: this.stringValue(unit.codigoUnidade),
      sphere: this.stringValue(org.esferaId),
      agencyName: this.stringValue(org.razaoSocial) ?? this.stringValue(unit.nomeUnidade),
      agencyDocument: cnpj,
      objectText: this.stringValue(record.objetoCompra) ?? '',
      objectSummary: this.stringValue(record.informacaoComplementar),
      sourceUrl,
      publicationDate: this.parseDate(record.dataPublicacaoPncp) ?? this.parseDate(record.dataInclusao),
      openingDate: this.parseDate(record.dataAberturaProposta),
      proposalDueDate: this.parseDate(record.dataEncerramentoProposta),
      estimatedValue: this.numberValue(record.valorTotalEstimado),
      municipalityName: this.stringValue(unit.municipioNome),
      municipalityIbgeCode: this.stringValue(unit.codigoIbge),
      uf: this.stringValue(unit.ufSigla)?.toUpperCase() ?? null,
      status: this.mapStatus(statusName),
      rawPayload: record,
      items: [],
    };
  }

  private mapStatus(statusName: string): string {
    if (/cancelad|revogad|anulad/.test(statusName)) return 'cancelled';
    if (/suspens/.test(statusName)) return 'suspended';
    if (/encerrad|homologad|finalizad|fracassad|desert/.test(statusName)) return 'closed';
    return 'open';
  }

  private parseExternalId(externalId: string): { cnpj: string; year: number; sequence: number } | null {
    const match = /^(\d{14})-\d+-(\d+)\/(\d{4})$/.exec(externalId.trim());
    if (!match) return null;
    return { cnpj: match[1], sequence: Number(match[2]), year: Number(match[3]) };
  }

  private buildExternalId(cnpj: string | null, year: number | null, sequence: number | null): string {
    if (!cnpj || year == null || sequence == null) return `${cnpj ?? 'pncp'}-${year ?? 'unknown'}-${sequence ?? 'unknown'}`;
    return `${cnpj}-${sequence}/${year}`;
  }

  private formatPncpDate(value?: Date): string | null {
    if (!value || Number.isNaN(value.getTime())) return null;
    return `${value.getUTCFullYear()}${String(value.getUTCMonth() + 1).padStart(2, '0')}${String(value.getUTCDate()).padStart(2, '0')}`;
  }

  private parseDate(value: unknown): Date | null {
    if (typeof value !== 'string' || !value.trim()) return null;
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? null : date;
  }

  private numberValue(value: unknown): number | null {
    if (typeof value === 'number' && Number.isFinite(value)) return value;
    if (typeof value === 'string' && value.trim()) {
      const parsed = Number(value.replace(',', '.'));
      return Number.isFinite(parsed) ? parsed : null;
    }
    return null;
  }

  private stringValue(value: unknown): string | null {
    return typeof value === 'string' && value.trim() ? value.trim() : null;
  }

  private normalizeText(value: string): string {
    return value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLocaleLowerCase('pt-BR');
  }

  private asRecord(value: unknown): JsonRecord {
    return this.isRecord(value) ? value : {};
  }

  private isRecord(value: unknown): value is JsonRecord {
    return typeof value === 'object' && value !== null && !Array.isArray(value);
  }

  private trimSlash(value: string): string {
    return value.replace(/\/+$/, '');
  }

  private errorMessage(error: unknown): string {
    return error instanceof Error ? error.message : String(error);
  }

  private async getJson<T>(url: string, notFoundIsNull = false): Promise<T | null> {
    let lastError: unknown;
    for (let attempt = 0; attempt <= this.maxRetries; attempt++) {
      try {
        await this.waitForRequestSlot();
        const response = await fetch(url, {
          method: 'GET',
          headers: { Accept: 'application/json', 'User-Agent': 'LicitaIA/1.0 (+public-data-ingestion)' },
          signal: AbortSignal.timeout(this.requestTimeoutMs),
        });
        if (response.status === 404 && notFoundIsNull) return null;
        if (response.status === 429 || response.status >= 500) {
          const retryAfter = Number(response.headers.get('retry-after'));
          if (attempt < this.maxRetries) {
            const delayMs = Number.isFinite(retryAfter) && retryAfter > 0
              ? Math.min(retryAfter * 1000, 30_000)
              : Math.min(500 * 2 ** attempt, 8_000);
            await this.delay(delayMs);
            continue;
          }
        }
        if (!response.ok) {
          const body = (await response.text()).slice(0, 500);
          throw new Error(`PNCP HTTP ${response.status} ${response.statusText}: ${body}`);
        }
        if (response.status === 204) return null;
        return (await response.json()) as T;
      } catch (error) {
        lastError = error;
        const status = error instanceof Error ? /PNCP HTTP (\d{3})/.exec(error.message)?.[1] : undefined;
        if (status && Number(status) !== 429 && Number(status) < 500) break;
        if (attempt >= this.maxRetries) break;
        await this.delay(Math.min(500 * 2 ** attempt, 8_000));
      }
    }
    throw lastError instanceof Error ? lastError : new Error(String(lastError ?? 'PNCP request failed'));
  }

  private delay(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  private async waitForRequestSlot(): Promise<void> {
    const slot = this.requestQueue.then(async () => {
      const elapsed = Date.now() - this.lastRequestAt;
      if (elapsed < this.minRequestIntervalMs) {
        await this.delay(this.minRequestIntervalMs - elapsed);
      }
      this.lastRequestAt = Date.now();
    });
    this.requestQueue = slot.catch(() => undefined);
    await slot;
  }
}
