import { TenantStatus } from './enums';

export interface TenantDto {
  id: string;
  corporateName: string;
  tradeName: string;
  cnpj: string;
  status: TenantStatus;
  contactName: string;
  contactEmail: string;
  contactPhone: string;
  whatsappNumber: string | null;
  planType: string;
  createdAt: string;
}
