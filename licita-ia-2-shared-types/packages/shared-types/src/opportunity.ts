import { OpportunityStatus, CapagRating } from './enums';

export interface OpportunityDto {
  id: string;
  tenantId: string;
  biddingId: string;
  matchingScore: number;
  matchedKeywords: string[];
  matchedRegionType: string | null;
  capagRatingSnapshot: CapagRating | null;
  status: OpportunityStatus;
  analysisCompletedAt: string | null;
  firstNotifiedAt: string | null;
  createdAt: string;
}

export interface OpportunityItemDto {
  id: string;
  opportunityId: string;
  biddingItemId: string;
  suggestedBrand: string | null;
  estimatedMarginPercent: number | null;
  customerBrand: string | null;
  customerUnitPrice: number | null;
  customerTotalPrice: number | null;
  customerNotes: string | null;
}
