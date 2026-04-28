import { NotificationChannel, NotificationStatus } from './enums';

export interface NotificationDto {
  id: string;
  tenantId: string;
  userId: string;
  opportunityId: string | null;
  channel: NotificationChannel;
  templateCode: string;
  status: NotificationStatus;
  sentAt: string | null;
  createdAt: string;
}

export interface NotificationPreferencesDto {
  id: string;
  tenantId: string;
  userId: string | null;
  allowPush: boolean;
  allowWhatsapp: boolean;
  quietHoursStart: string | null;
  quietHoursEnd: string | null;
}
