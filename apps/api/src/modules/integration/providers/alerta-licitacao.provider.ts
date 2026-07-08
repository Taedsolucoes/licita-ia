import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  BiddingSourceProvider,
  BiddingSourceRaw,
  BiddingItemRaw,
  FetchBiddingsOptions,
  FetchBiddingsResult,
} from './bidding-source.provider';

/**
 * Raw shape returned by the AlertaLicitacao API.
 * Fields are mapped defensively to handle variations across API versions.
 */
interface AlertaApiRecord {
  id?: string | number;
  codigo?: string | number;
  numero?: string;
  numero_licitacao?: string;
  numero_aviso?: string;
  modalidade?: string;
  tipo?: string;
  uasg?: string;
  codigo_uasg?: string;
  esfera?: string;
  orgao?: string;
  razao_social?: string;
  nome_orgao?: string;
  cnpj?: string;
  objeto?: string;
  descricao?: string;
  descricao_objeto?: string;
  resumo?: string;
  link?: string;
  url?: string;
  link_edital?: string;
  data_publicacao?: string;
  data_pub?: string;
  data_abertura?: string;
  data_abert?: string;
  data_encerramento?: string;
  data_proposta?: string;
  abertura_proposta?: string;
  valor_estimado?: string | number;
  vl_estimado?: string | number;
  valor?: string | number;
  municipio?: string;
  cidade?: string;
  municipio_nome?: string;
  codigo_ibge?: string;
  ibge?: string;
  uf?: string;
  estado?: string;
  status?: string;
  situacao?: string;
  itens?: AlertaApiItem[];
  items?: AlertaApiItem[];
}

interface AlertaApiItem {
  numero?: number | string;
  item?: number | string;
  descricao?: string;
  description?: string;
  objeto?: string;
  quantidade?: number | string;
  qtd?: number | string;
  quantity?: number | string;
  unidade?: string;
  unidade_medida?: string;
  unit?: string;
  valor_unitario?: number | string;
  vl_unitario?: number | string;
  unit_value?: number | string;
  valor_total?: number | string;
  vl_total?: number | string;
  total_value?: number | string;
  codigo_catmat?: string;
  catmat?: string;
  catalog_code?: string;
  [key: string]: unknown;
}

@Injectable()
export class AlertaLicitacaoProvider implements BiddingSourceProvider {
  private readonly logger = new Logger(AlertaLicitacaoProvider.name);
  readonly sourceName = 'alertalicitacao';

  private readonly token: string;
  private readonly baseUrl = 'https://alertalicitacao.com.br/!api';
  private readonly isRealMode: boolean;

  constructor(private configService: ConfigService) {
    this.token = this.configService.get<string>('ALERTALICITACAO_TOKEN', '');
    this.isRealMode = !!this.token;
    if (this.isRealMode) {
      this.logger.log('AlertaLicitacaoProvider running in REAL mode (API token configured)');
    } else {
      this.logger.warn('AlertaLicitacaoProvider running in MOCK mode (ALERTALICITACAO_TOKEN not set)');
    }
  }

  async fetchBiddings(options?: FetchBiddingsOptions): Promise<FetchBiddingsResult> {
    if (!this.isRealMode) {
      return this.fetchMockBiddings(options);
    }

    try {
      // AlertaLicitacao API uses date-based fetching.
      // cursor encodes a date string (YYYY-MM-DD) for pagination.
      const dateToFetch = options?.cursor
        ? options.cursor
        : this.formatDate(options?.since || this.yesterdayDate());

      this.logger.log(`Fetching real biddings from AlertaLicitacao for date=${dateToFetch}`);

      const params = new URLSearchParams({ token: this.token });
      if (dateToFetch) {
        params.set('data_insercao', dateToFetch);
      }

      const url = `${this.baseUrl}?${params.toString()}`;
      this.logger.debug(`API call: GET ${this.baseUrl}?token=<redacted>&data_insercao=${dateToFetch}`);

      const response = await fetch(url, {
        method: 'GET',
        headers: {
          Accept: 'application/json',
          'User-Agent': 'LicitaIA-Integration/1.0',
        },
        signal: AbortSignal.timeout(30_000),
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const contentType = response.headers.get('content-type') || '';
      const rawText = await response.text();

      this.logger.debug(`API response: status=${response.status} contentType=${contentType} bodyLen=${rawText.length}`);

      if (!rawText || rawText.trim().length === 0) {
        this.logger.warn(`API returned empty body for date=${dateToFetch} — no biddings available`);
        return { biddings: [], nextCursor: null, totalFetched: 0 };
      }

      // Check if response is HTML (login page) instead of JSON
      if (rawText.trimStart().startsWith('<') || rawText.includes('<!DOCTYPE')) {
        this.logger.error(
          'API returned HTML instead of JSON — token may be invalid or API endpoint changed',
        );
        this.logger.debug(`Raw response snippet: ${rawText.substring(0, 200)}`);
        return { biddings: [], nextCursor: null, totalFetched: 0 };
      }

      let parsed: unknown;
      try {
        parsed = JSON.parse(rawText);
      } catch {
        this.logger.error(`Failed to parse API response as JSON. Raw: ${rawText.substring(0, 200)}`);
        return { biddings: [], nextCursor: null, totalFetched: 0 };
      }

      // Normalize: API may return array directly or wrapped in an object
      let records: AlertaApiRecord[] = [];
      if (Array.isArray(parsed)) {
        records = parsed as AlertaApiRecord[];
      } else if (parsed && typeof parsed === 'object') {
        const obj = parsed as Record<string, unknown>;
        const candidateKeys = ['data', 'licitacoes', 'results', 'items', 'registros', 'biddings'];
        for (const key of candidateKeys) {
          if (Array.isArray(obj[key])) {
            records = obj[key] as AlertaApiRecord[];
            break;
          }
        }
        // Log top-level keys for debugging
        this.logger.debug(`API response top-level keys: ${Object.keys(obj).join(', ')}`);
      }

      this.logger.log(`API returned ${records.length} biddings for date=${dateToFetch}`);

      const biddings = records.map((rec) => this.mapRecord(rec));

      return {
        biddings,
        nextCursor: null, // AlertaLicitacao is date-based; no page cursor
        totalFetched: biddings.length,
      };
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error);
      this.logger.error(`fetchBiddings failed: ${msg}`);
      return { biddings: [], nextCursor: null, totalFetched: 0 };
    }
  }

  async fetchBiddingDetails(externalId: string): Promise<BiddingSourceRaw | null> {
    if (!this.isRealMode) {
      return this.getMockBiddings().find((b) => b.externalId === externalId) || null;
    }

    try {
      const params = new URLSearchParams({ token: this.token, id: externalId });
      const url = `${this.baseUrl}?${params.toString()}`;
      const response = await fetch(url, {
        headers: { Accept: 'application/json', 'User-Agent': 'LicitaIA-Integration/1.0' },
        signal: AbortSignal.timeout(15_000),
      });

      if (!response.ok) return null;

      const rawText = await response.text();
      if (!rawText || rawText.trimStart().startsWith('<')) return null;

      const parsed = JSON.parse(rawText);
      const record = Array.isArray(parsed) ? parsed[0] : parsed;
      if (!record) return null;

      return this.mapRecord(record as AlertaApiRecord);
    } catch (error) {
      this.logger.error(`fetchBiddingDetails(${externalId}) failed: ${error}`);
      return null;
    }
  }

  async fetchBiddingItems(externalId: string): Promise<BiddingItemRaw[]> {
    const details = await this.fetchBiddingDetails(externalId);
    return details?.items || [];
  }

  async healthCheck(): Promise<{ healthy: boolean; message: string }> {
    if (!this.isRealMode) {
      return { healthy: true, message: 'Mock mode — no real API calls' };
    }

    try {
      const params = new URLSearchParams({ token: this.token });
      const url = `${this.baseUrl}?${params.toString()}`;
      const response = await fetch(url, {
        headers: { Accept: 'application/json', 'User-Agent': 'LicitaIA-Integration/1.0' },
        signal: AbortSignal.timeout(10_000),
      });

      const contentType = response.headers.get('content-type') || '';
      const rawText = await response.text();
      const isHtml = rawText.trimStart().startsWith('<') || rawText.includes('<!DOCTYPE');

      if (response.ok && !isHtml) {
        return {
          healthy: true,
          message: `API reachable — status=${response.status} contentType=${contentType} bodyLen=${rawText.length}`,
        };
      }

      if (isHtml) {
        return {
          healthy: false,
          message: `API returned HTML (login page) — token may be invalid. Status=${response.status}`,
        };
      }

      return {
        healthy: false,
        message: `API unhealthy — HTTP ${response.status}: ${response.statusText}`,
      };
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error);
      return { healthy: false, message: `API unreachable: ${msg}` };
    }
  }

  // ---------------------------------------------------------------------------
  // Private helpers
  // ---------------------------------------------------------------------------

  private mapRecord(rec: AlertaApiRecord): BiddingSourceRaw {
    const externalId = String(rec.id ?? rec.codigo ?? `AL-${Date.now()}-${Math.random()}`);
    const biddingNumber =
      rec.numero ?? rec.numero_licitacao ?? rec.numero_aviso ?? null;
    const modality = rec.modalidade ?? rec.tipo ?? null;
    const uasg = rec.uasg ?? rec.codigo_uasg ?? null;
    const sphere = rec.esfera ?? null;
    const agencyName = rec.orgao ?? rec.razao_social ?? rec.nome_orgao ?? null;
    const agencyDocument = rec.cnpj ?? null;
    const objectText =
      rec.objeto ?? rec.descricao ?? rec.descricao_objeto ?? '';
    const objectSummary = rec.resumo ?? null;
    const sourceUrl = rec.link ?? rec.url ?? rec.link_edital ?? null;
    const publicationDate = this.parseDate(rec.data_publicacao ?? rec.data_pub);
    const openingDate = this.parseDate(
      rec.data_abertura ?? rec.data_abert ?? rec.abertura_proposta,
    );
    const proposalDueDate = this.parseDate(
      rec.data_encerramento ?? rec.data_proposta,
    );
    const estimatedValue = this.parseNumber(
      rec.valor_estimado ?? rec.vl_estimado ?? rec.valor,
    );
    const municipalityName = rec.municipio ?? rec.cidade ?? rec.municipio_nome ?? null;
    const municipalityIbgeCode = String(rec.codigo_ibge ?? rec.ibge ?? '').slice(0, 7) || null;
    const uf = (rec.uf ?? rec.estado ?? '').toUpperCase().slice(0, 2) || null;
    const status = rec.status ?? rec.situacao ?? 'open';

    const rawItems: AlertaApiItem[] = rec.itens ?? rec.items ?? [];
    const items: BiddingItemRaw[] = rawItems.map((item, idx) => ({
      itemNumber: Number(item.numero ?? item.item ?? idx + 1),
      description: String(item.descricao ?? item.description ?? item.objeto ?? ''),
      quantity: Number(item.quantidade ?? item.qtd ?? item.quantity ?? 1),
      unit: String(item.unidade ?? item.unidade_medida ?? item.unit ?? 'UN'),
      unitValueEstimated: this.parseNumber(item.valor_unitario ?? item.vl_unitario ?? item.unit_value),
      totalValueEstimated: this.parseNumber(item.valor_total ?? item.vl_total ?? item.total_value),
      catalogCode: String(item.codigo_catmat ?? item.catmat ?? item.catalog_code ?? '') || null,
      rawPayload: item as Record<string, unknown>,
    }));

    return {
      externalId,
      biddingNumber,
      modality,
      uasg,
      sphere,
      agencyName,
      agencyDocument,
      objectText,
      objectSummary,
      sourceUrl,
      publicationDate,
      openingDate,
      proposalDueDate,
      estimatedValue,
      municipalityName,
      municipalityIbgeCode,
      uf,
      status,
      rawPayload: rec as Record<string, unknown>,
      items,
    };
  }

  private parseDate(value: string | undefined | null): Date | null {
    if (!value) return null;
    try {
      // Handle dd/mm/yyyy or yyyy-mm-dd
      let normalized = value.trim();
      const ptMatch = normalized.match(/^(\d{2})\/(\d{2})\/(\d{4})/);
      if (ptMatch) {
        normalized = `${ptMatch[3]}-${ptMatch[2]}-${ptMatch[1]}`;
      }
      const d = new Date(normalized);
      return isNaN(d.getTime()) ? null : d;
    } catch {
      return null;
    }
  }

  private parseNumber(value: string | number | undefined | null): number | null {
    if (value === null || value === undefined || value === '') return null;
    const n = typeof value === 'number' ? value : parseFloat(String(value).replace(',', '.'));
    return isNaN(n) ? null : n;
  }

  private formatDate(date: Date): string {
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, '0');
    const d = String(date.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
  }

  private yesterdayDate(): Date {
    const d = new Date();
    d.setDate(d.getDate() - 1);
    return d;
  }

  // ---------------------------------------------------------------------------
  // Mock data (used when ALERTALICITACAO_TOKEN is not configured)
  // ---------------------------------------------------------------------------

  private fetchMockBiddings(options?: FetchBiddingsOptions): FetchBiddingsResult {
    this.logger.log(`Fetching biddings (mock) cursor=${options?.cursor || 'none'}`);
    const biddings = this.getMockBiddings();
    const cursor = options?.cursor ? parseInt(options.cursor, 10) : 0;
    const limit = options?.limit || 50;
    const slice = biddings.slice(cursor, cursor + limit);
    const nextCursor = cursor + limit < biddings.length ? String(cursor + limit) : null;
    return { biddings: slice, nextCursor, totalFetched: slice.length };
  }

  private getMockBiddings(): BiddingSourceRaw[] {
    return [
      {
        externalId: 'AL-2025-001',
        biddingNumber: 'PE 001/2025',
        modality: 'Pregão Eletrônico',
        uasg: '153045',
        sphere: 'Federal',
        agencyName: 'Universidade Federal de São Paulo - UNIFESP',
        agencyDocument: '60.453.032/0001-74',
        objectText:
          'Aquisição de material de escritório e suprimentos de informática, incluindo papel A4, toner para impressora, canetas, pastas, pen drives e mouses para atender as necessidades da administração central.',
        objectSummary: 'Material de escritório e informática para UNIFESP',
        sourceUrl: 'https://alertalicitacao.com.br/licitacao/AL-2025-001',
        publicationDate: new Date('2025-04-10'),
        openingDate: new Date('2025-04-28'),
        proposalDueDate: new Date('2025-04-27'),
        estimatedValue: 185000.0,
        municipalityName: 'São Paulo',
        municipalityIbgeCode: '3550308',
        uf: 'SP',
        status: 'open',
        rawPayload: { source: 'mock', version: '1.0' },
        items: [
          {
            itemNumber: 1,
            description: 'Papel A4 75g/m² - resma 500 folhas',
            quantity: 500,
            unit: 'Resma',
            unitValueEstimated: 28.5,
            totalValueEstimated: 14250.0,
            catalogCode: 'CATMAT-440001',
            rawPayload: {},
          },
          {
            itemNumber: 2,
            description: 'Toner HP CF226A compatível',
            quantity: 100,
            unit: 'Unidade',
            unitValueEstimated: 189.9,
            totalValueEstimated: 18990.0,
            catalogCode: 'CATMAT-440025',
            rawPayload: {},
          },
        ],
      },
      {
        externalId: 'AL-2025-002',
        biddingNumber: 'PE 015/2025',
        modality: 'Pregão Eletrônico',
        uasg: '110161',
        sphere: 'Federal',
        agencyName: 'Tribunal Regional Federal da 2ª Região',
        agencyDocument: '05.765.003/0001-06',
        objectText:
          'Aquisição de computadores desktop, notebooks, monitores LED e equipamentos de rede.',
        objectSummary: 'Equipamentos de TI para o TRF-2',
        sourceUrl: 'https://alertalicitacao.com.br/licitacao/AL-2025-002',
        publicationDate: new Date('2025-04-12'),
        openingDate: new Date('2025-05-02'),
        proposalDueDate: new Date('2025-05-01'),
        estimatedValue: 1250000.0,
        municipalityName: 'Rio de Janeiro',
        municipalityIbgeCode: '3304557',
        uf: 'RJ',
        status: 'open',
        rawPayload: { source: 'mock', version: '1.0' },
        items: [
          {
            itemNumber: 1,
            description: 'Computador desktop Intel Core i7, 16GB RAM, SSD 512GB',
            quantity: 50,
            unit: 'Unidade',
            unitValueEstimated: 5800.0,
            totalValueEstimated: 290000.0,
            catalogCode: 'CATMAT-449010',
            rawPayload: {},
          },
        ],
      },
    ];
  }
}
