import { BiddingStatus, RiskLevel } from './enums';

export interface BiddingDto {
  id: string;
  source: string;
  sourceExternalId: string;
  biddingNumber: string;
  modality: string;
  agencyName: string;
  objectText: string;
  objectSummary: string | null;
  publicationDate: string | null;
  openingDate: string | null;
  proposalDueDate: string | null;
  estimatedValue: number | null;
  municipalityName: string | null;
  uf: string | null;
  status: BiddingStatus;
  riskLevel: RiskLevel | null;
  createdAt: string;
}

export interface BiddingItemDto {
  id: string;
  biddingId: string;
  itemNumber: number;
  description: string;
  quantity: number;
  unit: string;
  unitValueEstimated: number | null;
  totalValueEstimated: number | null;
}
