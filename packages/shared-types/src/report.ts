import { ReportStatus } from './enums';

export interface ReportDto {
  id: string;
  tenantId: string;
  biddingId: string;
  opportunityId: string | null;
  reportType: string;
  status: ReportStatus;
  fileName: string | null;
  generatedAt: string | null;
  expiresAt: string | null;
  createdAt: string;
}
