export enum UserRole {
  TENANT_OWNER = 'tenant_owner',
  TENANT_USER = 'tenant_user',
  TAED_ADMIN = 'taed_admin',
  TAED_OPERATOR = 'taed_operator',
}

export enum TenantStatus {
  ACTIVE = 'active',
  INACTIVE = 'inactive',
  SUSPENDED = 'suspended',
}

export enum BiddingStatus {
  OPEN = 'open',
  CLOSED = 'closed',
  SUSPENDED = 'suspended',
  CANCELLED = 'cancelled',
}

export enum RiskLevel {
  LOW = 'low',
  MEDIUM = 'medium',
  HIGH = 'high',
}

export enum OpportunityStatus {
  NEW = 'new',
  VIEWED = 'viewed',
  ACCEPTED = 'accepted',
  DECLINED = 'declined',
  EXPIRED = 'expired',
}

export enum ParticipationStatus {
  DRAFT = 'draft',
  SUBMITTED_TO_TAED = 'submitted_to_taed',
  UNDER_REVIEW = 'under_review',
  COMPLETED = 'completed',
  CANCELLED = 'cancelled',
}

export enum ReportStatus {
  QUEUED = 'queued',
  PROCESSING = 'processing',
  READY = 'ready',
  FAILED = 'failed',
}

export enum NotificationChannel {
  PUSH = 'push',
  WHATSAPP = 'whatsapp',
  EMAIL = 'email',
}

export enum NotificationStatus {
  QUEUED = 'queued',
  SENT = 'sent',
  DELIVERED = 'delivered',
  FAILED = 'failed',
  READ = 'read',
}

export enum CapagRating {
  A = 'A',
  B = 'B',
  C = 'C',
  ND = 'ND',
}

export enum KeywordMatchType {
  INCLUDE = 'include',
  EXCLUDE = 'exclude',
}

export enum RegionScopeType {
  UF = 'uf',
  MUNICIPIO = 'municipio',
  NACIONAL = 'nacional',
}

export enum BiddingSource {
  ALERTALICITACAO = 'alertalicitacao',
}

export enum IntegrationSyncStatus {
  RUNNING = 'running',
  SUCCESS = 'success',
  FAILED = 'failed',
  PARTIAL = 'partial',
}

export enum DevicePlatform {
  ANDROID = 'android',
  IOS = 'ios',
}
