import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  BiddingItemRaw,
  BiddingSourceProvider,
  BiddingSourceRaw,
  FetchBiddingsOptions,
  FetchBiddingsResult,
} from './bidding-source.provider';

type JsonRecord = Record<string, unknown>;

@Injectable()
export class ComprasGovProvider implements BiddingSourceProvider {
  readonly sourceName = 'compras-gov';
  private readonly baseUrl: string;
  private readonly timeoutMs: number;

  constructor(private readonly config: ConfigService) {
    this.baseUrl = (this.config.get<string>('COMPRAS_GOV_BASE_URL') ?? 'https://dadosabertos.compras.gov.br').replace(/\/+$/, '');
    this.timeoutMs = this.config.get<number>('COMPRAS_GOV_REQUEST_TIMEOUT_MS', 30_000);
  }

  async fetchBiddings(options: FetchBiddingsOptions = {}): Promise<FetchBiddingsResult> {
    if (!options.since || !options.until || Number.isNaN(options.since.getTime()) || Number.isNaN(options.until.getTime())) {
      throw new Error('Compras.gov.br requires valid since and until dates.');
    }
    if (options.until < options.since) throw new Error('Compras.gov.br until date must be on or after since date.');
    if (!Number.isInteger(options.modalityCode) || (options.modalityCode as number) < 1) {
      throw new Error('Compras.gov.br requires a positive modalityCode.');
    }
    const page = options.cursor ? Number.parseInt(options.cursor, 10) : 1;
    if (!Number.isInteger(page) || page < 1) throw new Error(`Invalid Compras.gov.br page cursor: ${options.cursor}`);
    const pageSize = options.limit ?? 50;
    if (!Number.isInteger(pageSize) || pageSize < 10 || pageSize > 500) {
      throw new Error('Compras.gov.br page size must be an integer between 10 and 500.');
    }
    const url = new URL(`${this.baseUrl}/modulo-contratacoes/1_consultarContratacoes_PNCP_14133`);
    url.searchParams.set('pagina', String(page));
    url.searchParams.set('tamanhoPagina', String(pageSize));
    url.searchParams.set('dataPublicacaoPncpInicial', this.isoDate(options.since));
    url.searchParams.set('dataPublicacaoPncpFinal', this.isoDate(options.until));
    url.searchParams.set('codigoModalidade', String(options.modalityCode));
    if (options.uf) url.searchParams.set('unidadeOrgaoUfSigla', options.uf.toUpperCase());
    if (options.municipalityIbgeCode) url.searchParams.set('unidadeOrgaoCodigoIbge', options.municipalityIbgeCode);
    const response = await this.getJson(url.toString());
    const records = this.asArray(response.resultado ?? response.data ?? response.content);
    const totalPages = this.number(response.totalPaginas ?? response.totalPages ?? response.quantidadePaginas);
    const keyword = options.keyword ? this.normalizeText(options.keyword) : null;
    const biddings = records
      .map((record) => this.mapRecord(record))
      .filter((record) => !!record.externalId)
      .filter((record) => !keyword || this.normalizeText(record.objectText).includes(keyword));
    const nextCursor = totalPages !== null ? (page < totalPages ? String(page + 1) : null) : (records.length === pageSize ? String(page + 1) : null);
    return { biddings, nextCursor, totalFetched: records.length };
  }

  async fetchBiddingDetails(externalId: string): Promise<BiddingSourceRaw | null> {
    const url = new URL(`${this.baseUrl}/modulo-contratacoes/1.1_consultarContratacoes_PNCP_14133_Id`);
    url.searchParams.set('tipo', 'numeroControlePNCPCompra');
    url.searchParams.set('codigo', externalId);
    const response = await this.getJson(url.toString(), true);
    const first = this.asArray(response.resultado ?? response.data)[0];
    return first ? this.mapRecord(first) : null;
  }

  async fetchBiddingItems(_externalId: string): Promise<BiddingItemRaw[]> {
    // The official items-by-id endpoint requires the source idCompra. It is not
    // encoded in BiddingSourceProvider's details signature, so item hydration is
    // intentionally deferred rather than issuing a guessed lookup.
    return [];
  }

  async healthCheck(): Promise<{ healthy: boolean; message: string }> {
    try {
      const response = await fetch(`${this.baseUrl}/v3/api-docs`, { signal: AbortSignal.timeout(this.timeoutMs) });
      return { healthy: response.ok, message: response.ok ? 'Compras.gov.br OpenAPI is reachable.' : `Compras.gov.br returned HTTP ${response.status}.` };
    } catch (error) {
      return { healthy: false, message: `Compras.gov.br unavailable: ${this.errorMessage(error)}` };
    }
  }

  private mapRecord(record: JsonRecord): BiddingSourceRaw {
    const externalId = this.string(record.numeroControlePNCP) ?? this.string(record.idCompra) ?? '';
    const statusName = (this.string(record.situacaoCompraNomePncp) ?? '').toLocaleLowerCase('pt-BR');
    const controlId = this.string(record.numeroControlePNCP);
    return {
      externalId,
      biddingNumber: this.string(record.numeroCompra) ?? this.string(record.processo),
      modality: this.string(record.modalidadeNome),
      uasg: this.string(record.unidadeOrgaoCodigoUnidade),
      sphere: this.string(record.orgaoEntidadeEsferaId),
      agencyName: this.string(record.orgaoEntidadeRazaoSocial) ?? this.string(record.unidadeOrgaoNomeUnidade),
      agencyDocument: this.string(record.orgaoEntidadeCnpj),
      objectText: this.string(record.objetoCompra) ?? '',
      objectSummary: this.string(record.informacaoComplementar),
      sourceUrl: this.string(record.linkSistemaOrigem) ?? this.pncpUrl(controlId),
      publicationDate: this.date(record.dataPublicacaoPncp),
      openingDate: this.date(record.dataAberturaPropostaPncp),
      proposalDueDate: this.date(record.dataEncerramentoPropostaPncp),
      estimatedValue: this.number(record.valorTotalEstimado),
      municipalityName: this.string(record.unidadeOrgaoMunicipioNome),
      municipalityIbgeCode: record.unidadeOrgaoCodigoIbge == null ? null : String(record.unidadeOrgaoCodigoIbge),
      uf: this.string(record.unidadeOrgaoUfSigla)?.toUpperCase() ?? null,
      status: this.status(statusName),
      rawPayload: record,
      items: [],
    };
  }

  private status(name: string): string {
    if (/cancelad|revogad|anulad|exclu/.test(name)) return 'cancelled';
    if (/suspens/.test(name)) return 'suspended';
    if (/encerrad|homologad|finalizad|fracassad|desert/.test(name)) return 'closed';
    return 'open';
  }
  private async getJson(url: string, notFoundIsNull = false): Promise<JsonRecord> {
    const response = await fetch(url, { headers: { Accept: 'application/json', 'User-Agent': 'LicitaIA/1.0 (+public-data-ingestion)' }, signal: AbortSignal.timeout(this.timeoutMs) });
    if (response.status === 404 && notFoundIsNull) return {};
    if (!response.ok) throw new Error(`Compras.gov.br HTTP ${response.status} ${response.statusText}: ${(await response.text()).slice(0, 500)}`);
    const body: unknown = await response.json();
    if (!body || typeof body !== 'object' || Array.isArray(body)) throw new Error('Compras.gov.br returned an unexpected JSON envelope.');
    return body as JsonRecord;
  }
  private asArray(value: unknown): JsonRecord[] { return Array.isArray(value) ? value.filter((item): item is JsonRecord => !!item && typeof item === 'object' && !Array.isArray(item)) : []; }
  private string(value: unknown): string | null { return typeof value === 'string' && value.trim() ? value.trim() : null; }
  private number(value: unknown): number | null { const n = typeof value === 'number' ? value : typeof value === 'string' ? Number(value) : NaN; return Number.isFinite(n) ? n : null; }
  private date(value: unknown): Date | null { if (typeof value !== 'string' || !value) return null; const d = new Date(value); return Number.isNaN(d.getTime()) ? null : d; }
  private isoDate(value: Date): string { return `${value.getUTCFullYear()}-${String(value.getUTCMonth() + 1).padStart(2, '0')}-${String(value.getUTCDate()).padStart(2, '0')}`; }
  private normalizeText(value: string): string { return value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLocaleLowerCase('pt-BR'); }
  private pncpUrl(controlId: string | null): string | null {
    const match = controlId ? /^(\d{14})-\d+-(\d+)\/(\d{4})$/.exec(controlId) : null;
    return match ? `https://pncp.gov.br/app/editais/${match[1]}/${match[3]}/${match[2]}` : null;
  }
  private errorMessage(error: unknown): string { return error instanceof Error ? error.message : String(error); }
}
