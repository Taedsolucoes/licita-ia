import { ParticipationStatus } from './enums';

export interface ParticipationDto {
  id: string;
  tenantId: string;
  opportunityId: string;
  acceptedByUserId: string;
  status: ParticipationStatus;
  consolidatedTotalValue: number | null;
  submittedAt: string | null;
  createdAt: string;
}

export interface ParticipationItemDto {
  id: string;
  participationId: string;
  biddingItemId: string;
  brand: string;
  finalUnitPrice: number;
  quantity: number;
  finalTotalPrice: number;
  marginValue: number | null;
  marginPercent: number | null;
}
