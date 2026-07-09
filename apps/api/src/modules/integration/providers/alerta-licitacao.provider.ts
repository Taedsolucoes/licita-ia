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
 * Raw record shape returned by GET /api/v1/licitacoesAbertas/ — format and
 * field names CONFIRMED directly by the AlertaLicitacao supplier (see
 * `.tmp-tools/NOTES_alerta_api.txt` for the empirical evidence captured
 * during integration testing).
 *
 * IMPORTANT: this endpoint does NOT return bidding items and there is no
 * confirmed single-bidding-by-id endpoint. `fetchBiddingDetails` /
 * `fetchBiddingItems` are therefore best-effort only (see below).
 */
interface AlertaApiRecord {
  id_licitacao: string;
  titulo: string;
  municipio_IBGE: string;
  uf: string;
  orgao: string;
  abertura_datetime: string; // "YYYY-MM-DD HH:mm:ss"
  objeto: string;
  link: string; // AlertaLicitacao's own page for this bidding — MUST be persisted as sourceUrl
  linkExterno: string; // Link to the origin portal (PNCP/ComprasNet/BLL/etc.) — NOT the same as `link`
  municipio: string;
  abertura: string; // "dd/mm/yyyy"
  aberturaComHora: string; // "dd/mm/yyyy HH:mm"
  id_tipo: string;
  tipo: string; // modality label, e.g. "Pregão eletrônico"
  valor: string; // numeric string, "0" means unknown/not informed
  id_portal: string;
  emailContato?: string;
}

interface AlertaApiEnvelope {
  totalErros: number;
  erros: Array<{ codigo: string; descricao: string }>;
  totalLicitacoes?: string;
  paginas?: number;
  licitacoesPorPagina?: string;
  licitacoesNestaPagina?: number;
  licitacoes?: AlertaApiRecord[];
}

const DEFAULT_PAGE_SIZE = 50;
const MIN_INTERVAL_MS = 1000; // supplier contract: max 1 request/second

@Injectable()
export class AlertaLicitacaoProvider implements BiddingSourceProvider {
  private readonly logger = new Logger(AlertaLicitacaoProvider.name);
  readonly sourceName = 'alertalicitacao';

  private readonly token: string;
  private readonly baseUrl = 'https://alertalicitacao.com.br/api/v1/licitacoesAbertas/';
  private readonly isRealMode: boolean;

  // --- Throttling state: serializes every outbound call and enforces a
  // minimum 1s gap between requests, per the supplier's rate-limit contract.
  private requestQueue: Promise<void> = Promise.resolve();
  private lastRequestAt = 0;

  constructor(private configService: ConfigService) {
    this.token = this.configService.get<string>('ALERTA_LICITACAO_API_KEY', '');
    this.isRealMode = !!this.token;
    if (this.isRealMode) {
      this.logger.log('AlertaLicitacaoProvider running in REAL mode (API token configured)');
    } else {
      this.logger.warn(
        'AlertaLicitacaoProvider running in MOCK mode (ALERTA_LICITACAO_API_KEY not set)',
      );
    }
  }

  async fetchBiddings(options?: FetchBiddingsOptions): Promise<FetchBiddingsResult> {
    if (!this.isRealMode) {
      return this.fetchMockBiddings(options);
    }

    const uf = options?.uf?.trim() || undefined;
    const keyword = options?.keyword?.trim() || undefined;

    // Supplier contract PROHIBITS scanning all open biddings without any
    // filter. Every real call MUST carry at least uf or palavra_chave.
    if (!uf && !keyword) {
      const msg =
        'AlertaLicitacaoProvider.fetchBiddings called without uf/keyword filter — ' +
        'this is PROHIBITED by the supplier contract. Refusing to call the API.';
      this.logger.error(msg);
      throw new Error(msg);
    }

    const pagina = options?.cursor ? parseInt(options.cursor, 10) || 1 : 1;
    const licitacoesPorPagina = options?.limit || DEFAULT_PAGE_SIZE;

    try {
      const params = new URLSearchParams({
        pagina: String(pagina),
        licitacoesPorPagina: String(licitacoesPorPagina),
      });
      if (uf) params.set('uf', uf);
      if (keyword) params.set('palavra_chave', keyword);

      const url = `${this.baseUrl}?${params.toString()}`;
      this.logger.log(
        `Fetching real biddings from AlertaLicitacao: uf=${uf ?? '-'} palavra_chave=${keyword ?? '-'} pagina=${pagina}`,
      );

      const response = await this.throttledFetch(url);

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const rawText = await response.text();

      if (!rawText || rawText.trim().length === 0) {
        this.logger.warn('API returned empty body — no biddings available');
        return { biddings: [], nextCursor: null, totalFetched: 0 };
      }

      if (rawText.trimStart().startsWith('<') || rawText.includes('<!DOCTYPE')) {
        this.logger.error(
          'API returned HTML instead of JSON — token may be invalid, IP not whitelisted, or endpoint changed',
        );
        this.logger.debug(`Raw response snippet: ${rawText.substring(0, 200)}`);
        return { biddings: [], nextCursor: null, totalFetched: 0 };
      }

      let envelope: AlertaApiEnvelope;
      try {
        envelope = JSON.parse(rawText);
      } catch {
        this.logger.error(`Failed to parse API response as JSON. Raw: ${rawText.substring(0, 200)}`);
        return { biddings: [], nextCursor: null, totalFetched: 0 };
      }

      if (envelope.totalErros && envelope.totalErros > 0) {
        const errMsg = envelope.erros?.map((e) => `${e.codigo}: ${e.descricao}`).join('; ') || 'unknown error';
        this.logger.error(`AlertaLicitacao API returned error(s): ${errMsg}`);
        return { biddings: [], nextCursor: null, totalFetched: 0 };
      }

      const records = envelope.licitacoes || [];
      const biddings = records.map((rec) => this.mapRecord(rec));

      const totalPages = envelope.paginas ?? pagina;
      const nextCursor = pagina < totalPages ? String(pagina + 1) : null;

      this.logger.log(
        `API returned ${biddings.length} biddings (page ${pagina}/${totalPages}, total=${envelope.totalLicitacoes ?? 'n/a'})`,
      );

      return {
        biddings,
        nextCursor,
        totalFetched: biddings.length,
      };
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error);
      this.logger.error(`fetchBiddings failed: ${msg}`);
      return { biddings: [], nextCursor: null, totalFetched: 0 };
    }
  }

  /**
   * NOT SUPPORTED by the confirmed AlertaLicitacao contract: the supplier
   * has only confirmed GET /api/v1/licitacoesAbertas/ (list endpoint). No
   * single-bidding-by-id endpoint has been confirmed. Details already
   * ingested via fetchBiddings are persisted on the Bidding row (rawPayload)
   * — this method intentionally does not attempt an unconfirmed API shape.
   */
  async fetchBiddingDetails(externalId: string): Promise<BiddingSourceRaw | null> {
    if (!this.isRealMode) {
      return this.getMockBiddings().find((b) => b.externalId === externalId) || null;
    }
    this.logger.warn(
      `fetchBiddingDetails(${externalId}): no single-bidding endpoint confirmed by the supplier — returning null`,
    );
    return null;
  }

  /**
   * NOT SUPPORTED: the confirmed licitacoesAbertas payload does not include
   * item-level data. See fetchBiddingDetails note above.
   */
  async fetchBiddingItems(externalId: string): Promise<BiddingItemRaw[]> {
    if (!this.isRealMode) {
      const details = await this.fetchBiddingDetails(externalId);
      return details?.items || [];
    }
    this.logger.warn(
      `fetchBiddingItems(${externalId}): AlertaLicitacao licitacoesAbertas payload has no item-level data`,
    );
    return [];
  }

  async healthCheck(): Promise<{ healthy: boolean; message: string }> {
    if (!this.isRealMode) {
      return { healthy: true, message: 'Mock mode — no real API calls' };
    }

    try {
      // Health check must also comply with the "no filter" prohibition —
      // use a narrow, cheap query (uf=DF) rather than an unfiltered scan.
      const params = new URLSearchParams({ uf: 'DF', pagina: '1', licitacoesPorPagina: '1' });
      const url = `${this.baseUrl}?${params.toString()}`;
      const response = await this.throttledFetch(url);

      const contentType = response.headers.get('content-type') || '';
      const rawText = await response.text();
      const isHtml = rawText.trimStart().startsWith('<') || rawText.includes('<!DOCTYPE');

      if (response.ok && !isHtml) {
        let envelope: AlertaApiEnvelope | null = null;
        try {
          envelope = JSON.parse(rawText);
        } catch {
          // ignore parse error for health check purposes
        }
        if (envelope && envelope.totalErros > 0) {
          const errMsg = envelope.erros?.map((e) => `${e.codigo}: ${e.descricao}`).join('; ') || 'unknown error';
          return { healthy: false, message: `API reachable but returned error: ${errMsg}` };
        }
        return {
          healthy: true,
          message: `API reachable — status=${response.status} contentType=${contentType} bodyLen=${rawText.length}`,
        };
      }

      if (isHtml) {
        return {
          healthy: false,
          message: `API returned HTML — token may be invalid or IP not whitelisted. Status=${response.status}`,
        };
      }

      return {
        healthy: false,
        message: `API unhealthy — HTTP ${response.status}: ${response.statusText}. Body: ${rawText.substring(0, 300)}`,
      };
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error);
      return { healthy: false, message: `API unreachable: ${msg}` };
    }
  }

  // ---------------------------------------------------------------------------
  // Private helpers
  // ---------------------------------------------------------------------------

  /**
   * Serializes all outbound calls and enforces a minimum 1s gap between
   * requests (supplier contract: max 1 call/second). This is a real queue,
   * not just a comment — concurrent callers are forced to wait their turn.
   */
  private throttledFetch(url: string): Promise<Response> {
    const run = this.requestQueue.then(async () => {
      const elapsed = Date.now() - this.lastRequestAt;
      if (elapsed < MIN_INTERVAL_MS) {
        await this.delay(MIN_INTERVAL_MS - elapsed);
      }
      this.lastRequestAt = Date.now();
    });

    this.requestQueue = run.catch(() => undefined);

    return run.then(() =>
      fetch(url, {
        method: 'GET',
        headers: {
          Token: this.token,
          Accept: 'application/json',
          'User-Agent': 'LicitaIA-Integration/1.0',
        },
        signal: AbortSignal.timeout(30_000),
      }),
    );
  }

  private delay(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  private mapRecord(rec: AlertaApiRecord): BiddingSourceRaw {
    const externalId = rec.id_licitacao;
    const openingDate = this.parseDateTime(rec.abertura_datetime);

    return {
      externalId,
      // No dedicated "number" field is provided by this API — `titulo`
      // already carries the human-readable identifier (e.g. "Pregão
      // Eletrônico 17/2026").
      biddingNumber: rec.titulo ?? null,
      modality: rec.tipo ?? null,
      uasg: null, // not present in the confirmed payload
      sphere: null, // `esfera` is rejected as an invalid param by the API — not modeled
      agencyName: rec.orgao ?? null,
      agencyDocument: null, // not present in the confirmed payload
      objectText: rec.objeto ?? '',
      objectSummary: null,
      // REQUIRED by supplier contract: link back to AlertaLicitacao's own page.
      // `linkExterno` (origin portal link) is intentionally NOT used here.
      sourceUrl: rec.link ?? null,
      publicationDate: null, // not present in the confirmed payload
      openingDate,
      // No distinct proposal-deadline field is provided; `abertura_datetime`
      // is the single date exposed and is used for both.
      proposalDueDate: openingDate,
      estimatedValue: this.parseNumber(rec.valor),
      municipalityName: rec.municipio ?? null,
      municipalityIbgeCode: rec.municipio_IBGE ?? null,
      uf: (rec.uf ?? '').toUpperCase().slice(0, 2) || null,
      status: 'open',
      rawPayload: rec as unknown as Record<string, unknown>,
      items: [], // not present in the confirmed licitacoesAbertas payload
    };
  }

  private parseDateTime(value: string | undefined | null): Date | null {
    if (!value) return null;
    try {
      // Format: "YYYY-MM-DD HH:mm:ss"
      const normalized = value.trim().replace(' ', 'T');
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

  // ---------------------------------------------------------------------------
  // Mock data (used when ALERTA_LICITACAO_API_KEY is not configured)
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
