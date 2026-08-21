export interface BiddingSourceRaw {
  externalId: string;
  sourceRecordKey?: string | null;
  pncpControlNumber?: string | null;
  sourceSystemName?: string | null;
  modalityCode?: string | null;
  modalityNormalized?: string | null;
  procurementLaw?: string | null;
  processNumber?: string | null;
  purchaseYear?: number | null;
  publicationUpdatedAt?: Date | null;
  sourceUpdatedAt?: Date | null;
  biddingNumber: string | null;
  modality: string | null;
  uasg: string | null;
  sphere: string | null;
  agencyName: string | null;
  agencyDocument: string | null;
  objectText: string;
  objectSummary: string | null;
  sourceUrl: string | null;
  publicationDate: Date | null;
  openingDate: Date | null;
  proposalDueDate: Date | null;
  estimatedValue: number | null;
  municipalityName: string | null;
  municipalityIbgeCode: string | null;
  uf: string | null;
  status: string;
  rawPayload: Record<string, unknown>;
  items: BiddingItemRaw[];
}

export interface BiddingItemRaw {
  itemNumber: number;
  description: string;
  quantity: number;
  unit: string;
  unitValueEstimated: number | null;
  totalValueEstimated: number | null;
  catalogCode: string | null;
  rawPayload: Record<string, unknown>;
}

export interface FetchBiddingsOptions {
  cursor?: string;
  limit?: number;
  since?: Date;
  /**
   * UF filter (2-letter state code). AlertaLicitacao contract requires at
   * least one of `uf` or `keyword` on every call — scanning without any
   * filter is prohibited by the supplier.
   */
  uf?: string;
  /** Free-text keyword filter retained for backwards compatibility with the legacy provider. */
  keyword?: string;
  /** Official source modality code, when a source supports an explicit modality filter. */
  modalityCode?: number;
  /** Official source municipality code, when a source supports an IBGE filter. */
  municipalityIbgeCode?: string;
  /** End of the source query window. */
  until?: Date;
  /** Source-specific query mode, such as publication or open proposals. */
  queryMode?: 'publication' | 'open_proposals';
}

export interface BiddingSourceMetadata {
  name: string;
  scope: string;
  authority?: string;
  baseUrl?: string;
  apiUrl?: string;
  protocol?: string;
  coverageNotes?: string;
  termsUrl?: string;
  rateLimitPerSec?: number;
}

export interface FetchBiddingsResult {
  biddings: BiddingSourceRaw[];
  nextCursor: string | null;
  totalFetched: number;
}

export interface BiddingSourceProvider {
  readonly sourceName: string;
  readonly requiresFilter?: boolean;

  getSourceMetadata?(): BiddingSourceMetadata;
  fetchBiddings(options?: FetchBiddingsOptions): Promise<FetchBiddingsResult>;
  fetchBiddingDetails(externalId: string): Promise<BiddingSourceRaw | null>;
  fetchBiddingItems(externalId: string): Promise<BiddingItemRaw[]>;
  healthCheck(): Promise<{ healthy: boolean; message: string }>;
}

export const BIDDING_SOURCE_PROVIDER = 'BIDDING_SOURCE_PROVIDER';
