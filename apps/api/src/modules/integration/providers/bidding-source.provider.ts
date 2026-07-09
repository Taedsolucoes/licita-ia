export interface BiddingSourceRaw {
  externalId: string;
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
  /** Free-text keyword filter (maps to `palavra_chave` on AlertaLicitacao). */
  keyword?: string;
}

export interface FetchBiddingsResult {
  biddings: BiddingSourceRaw[];
  nextCursor: string | null;
  totalFetched: number;
}

export interface BiddingSourceProvider {
  readonly sourceName: string;

  fetchBiddings(options?: FetchBiddingsOptions): Promise<FetchBiddingsResult>;
  fetchBiddingDetails(externalId: string): Promise<BiddingSourceRaw | null>;
  fetchBiddingItems(externalId: string): Promise<BiddingItemRaw[]>;
  healthCheck(): Promise<{ healthy: boolean; message: string }>;
}

export const BIDDING_SOURCE_PROVIDER = 'BIDDING_SOURCE_PROVIDER';
