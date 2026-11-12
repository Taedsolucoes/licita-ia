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
type OpportunityState = 'open' | 'closed';

/**
 * Petronect API Store adapter. Endpoint URLs and token URL are environment
 * supplied because the public API Store landing page does not publish the
 * subscribed API's private OpenAPI paths or OAuth issuer URL.
 */
@Injectable()
export class PetronectProvider implements BiddingSourceProvider {
  readonly sourceName = 'petronect';
  private readonly environment: 'sandbox' | 'production';
  private readonly clientId: string;
  private readonly clientSecret: string;
  private readonly tokenUrl: string;
  private readonly openUrl: string;
  private readonly closedUrl: string;
  private readonly timeoutMs: number;
  private accessToken: string | null = null;
  private tokenExpiresAt = 0;

  constructor(private readonly config: ConfigService) {
    const environment = (this.config.get<string>('PETRONECT_ENV') ?? 'sandbox').toLowerCase();
    if (environment !== 'sandbox' && environment !== 'production') throw new Error('PETRONECT_ENV must be sandbox or production.');
    this.environment = environment;
    this.clientId = this.config.get<string>('PETRONECT_CLIENT_ID', '');
    this.clientSecret = this.config.get<string>('PETRONECT_CLIENT_SECRET', '');
    const suffix = environment === 'sandbox' ? 'SANDBOX' : 'PRODUCTION';
    this.tokenUrl = this.config.get<string>(`PETRONECT_TOKEN_URL_${suffix}`, '');
    this.openUrl = this.config.get<string>(`PETRONECT_PUBLIC_OPEN_URL_${suffix}`, '');
    this.closedUrl = this.config.get<string>(`PETRONECT_PUBLIC_CLOSED_URL_${suffix}`, '');
    this.timeoutMs = this.config.get<number>('PETRONECT_REQUEST_TIMEOUT_MS', 30_000);
  }

  async fetchBiddings(options: FetchBiddingsOptions = {}): Promise<FetchBiddingsResult> {
    const state: OpportunityState = options.opportunityState ?? 'open';
    const endpoint = state === 'open' ? this.openUrl : this.closedUrl;
    if (!endpoint) throw new Error(`Set PETRONECT_PUBLIC_${state === 'open' ? 'OPEN' : 'CLOSED'}_URL_${this.environment.toUpperCase()} from the subscribed API Store specification.`);
    const page = options.cursor ? Number.parseInt(options.cursor, 10) : 1;
    if (!Number.isInteger(page) || page < 1) throw new Error(`Invalid Petronect page cursor: ${options.cursor}`);
    const url = new URL(endpoint);
    // API Store subscriptions may define additional query parameters. These
    // standard pagination names are used only when supported by the endpoint.
    url.searchParams.set('page', String(page));
    url.searchParams.set('limit', String(options.limit ?? 50));
    const payload = await this.authorizedJson(url.toString());
    const records = this.array(payload.data ?? payload.resultado ?? payload.results ?? payload.content ?? payload.items);
    const totalPages = this.number(payload.totalPages ?? payload.total_pages ?? payload.pages);
    const pageSize = options.limit ?? 50;
    const biddings = records.map((record) => this.mapOpportunity(record, state)).filter((record) => !!record.externalId);
    return { biddings, nextCursor: totalPages !== null ? (page < totalPages ? String(page + 1) : null) : (records.length === pageSize ? String(page + 1) : null), totalFetched: records.length };
  }

  fetchPublicOpenOpportunities(options: FetchBiddingsOptions = {}): Promise<FetchBiddingsResult> {
    return this.fetchBiddings({ ...options, opportunityState: 'open' });
  }

  fetchPublicClosedOpportunities(options: FetchBiddingsOptions = {}): Promise<FetchBiddingsResult> {
    return this.fetchBiddings({ ...options, opportunityState: 'closed' });
  }

  async fetchBiddingDetails(externalId: string): Promise<BiddingSourceRaw | null> {
    const result = await this.fetchPublicOpenOpportunities({ limit: 100 });
    return result.biddings.find((item) => item.externalId === externalId) ?? null;
  }

  async fetchBiddingItems(_externalId: string): Promise<BiddingItemRaw[]> { return []; }

  async healthCheck(): Promise<{ healthy: boolean; message: string }> {
    if (!this.clientId || !this.clientSecret) return { healthy: false, message: 'Petronect OAuth client credentials are not configured.' };
    if (!this.tokenUrl || !this.openUrl || !this.closedUrl) return { healthy: false, message: `Petronect ${this.environment} API Store endpoint URLs are not configured.` };
    try {
      await this.getAccessToken();
      return { healthy: true, message: `Petronect OAuth token acquired for ${this.environment}; no opportunity data was requested.` };
    } catch (error) {
      return { healthy: false, message: `Petronect ${this.environment} authentication failed: ${this.errorMessage(error)}` };
    }
  }

  private async authorizedJson(url: string): Promise<JsonRecord> {
    const token = await this.getAccessToken();
    const response = await fetch(url, { headers: { Accept: 'application/json', Authorization: `Bearer ${token}` }, signal: AbortSignal.timeout(this.timeoutMs) });
    if (!response.ok) throw new Error(`Petronect HTTP ${response.status} ${response.statusText}: ${(await response.text()).slice(0, 500)}`);
    const body: unknown = await response.json();
    if (!body || typeof body !== 'object' || Array.isArray(body)) throw new Error('Petronect returned an unexpected JSON envelope.');
    return body as JsonRecord;
  }

  private async getAccessToken(): Promise<string> {
    if (this.accessToken && Date.now() < this.tokenExpiresAt - 30_000) return this.accessToken;
    if (!this.clientId || !this.clientSecret) throw new Error('PETRONECT_CLIENT_ID and PETRONECT_CLIENT_SECRET are required.');
    if (!this.tokenUrl) throw new Error(`PETRONECT_TOKEN_URL_${this.environment.toUpperCase()} is required.`);
    const body = new URLSearchParams({ grant_type: 'client_credentials', client_id: this.clientId, client_secret: this.clientSecret });
    const response = await fetch(this.tokenUrl, { method: 'POST', headers: { Accept: 'application/json', 'Content-Type': 'application/x-www-form-urlencoded' }, body, signal: AbortSignal.timeout(this.timeoutMs) });
    if (!response.ok) throw new Error(`Petronect token endpoint HTTP ${response.status}: ${(await response.text()).slice(0, 500)}`);
    const payload: unknown = await response.json();
    if (!payload || typeof payload !== 'object') throw new Error('Petronect token endpoint returned an invalid JSON response.');
    const tokenData = payload as JsonRecord;
    const token = typeof tokenData.access_token === 'string' ? tokenData.access_token : null;
    if (!token) throw new Error('Petronect token response does not include access_token.');
    const expiresIn = this.number(tokenData.expires_in) ?? 300;
    this.accessToken = token;
    this.tokenExpiresAt = Date.now() + expiresIn * 1000;
    return token;
  }

  private mapOpportunity(record: JsonRecord, requestedState: OpportunityState): BiddingSourceRaw {
    const externalId = this.string(record.id ?? record.opportunityId ?? record.codigo ?? record.numero ?? record.reference);
    const text = this.string(record.object ?? record.description ?? record.title ?? record.objeto ?? record.descricao) ?? '';
    return {
      externalId: externalId ?? '',
      biddingNumber: this.string(record.number ?? record.numero ?? record.reference),
      modality: this.string(record.modality ?? record.modalidade),
      uasg: this.string(record.uasg ?? record.unitCode),
      sphere: null,
      agencyName: this.string(record.buyer ?? record.organization ?? record.orgao ?? record.contratante),
      agencyDocument: this.string(record.cnpj ?? record.organizationDocument),
      objectText: text,
      objectSummary: this.string(record.summary ?? record.informacaoComplementar),
      sourceUrl: this.string(record.url ?? record.link),
      publicationDate: this.date(record.publishedAt ?? record.publicationDate ?? record.dataPublicacao),
      openingDate: this.date(record.openingAt ?? record.openingDate ?? record.dataAbertura),
      proposalDueDate: this.date(record.closingAt ?? record.closingDate ?? record.dataEncerramento),
      estimatedValue: this.number(record.estimatedValue ?? record.valorEstimado),
      municipalityName: this.string(record.municipality ?? record.municipio),
      municipalityIbgeCode: this.string(record.municipalityIbgeCode ?? record.codigoIbge),
      uf: this.string(record.state ?? record.uf)?.toUpperCase() ?? null,
      status: requestedState,
      rawPayload: record,
      items: [],
    };
  }

  private array(value: unknown): JsonRecord[] { return Array.isArray(value) ? value.filter((item): item is JsonRecord => !!item && typeof item === 'object' && !Array.isArray(item)) : []; }
  private string(value: unknown): string | null { return typeof value === 'string' && value.trim() ? value.trim() : typeof value === 'number' ? String(value) : null; }
  private number(value: unknown): number | null { const n = typeof value === 'number' ? value : typeof value === 'string' ? Number(value) : NaN; return Number.isFinite(n) ? n : null; }
  private date(value: unknown): Date | null { if (typeof value !== 'string' || !value) return null; const d = new Date(value); return Number.isNaN(d.getTime()) ? null : d; }
  private errorMessage(error: unknown): string { return error instanceof Error ? error.message : String(error); }
}
