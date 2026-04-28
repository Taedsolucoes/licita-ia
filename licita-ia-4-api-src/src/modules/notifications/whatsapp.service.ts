import { Injectable, Logger } from '@nestjs/common';

export interface OpportunityAlertData {
  biddingNumber?: string;
  agencyName?: string;
  objectSummary?: string;
  estimatedValue?: string;
  matchingScore?: number;
}

export interface ParticipationConfirmationData {
  biddingNumber?: string;
  agencyName?: string;
  consolidatedTotalValue?: string;
  tenantName?: string;
}

@Injectable()
export class WhatsAppService {
  private readonly logger = new Logger(WhatsAppService.name);

  /**
   * MVP: mock implementation — log only. Replace with Meta WhatsApp Business Cloud API call.
   * POST https://graph.facebook.com/v{VERSION}/{PHONE_NUMBER_ID}/messages
   */
  async sendOpportunityAlert(
    phone: string,
    data: OpportunityAlertData,
  ): Promise<string | null> {
    this.logger.log(
      `[WhatsApp MOCK] opportunity_alert → phone=${phone} bidding=${data.biddingNumber ?? 'N/A'} score=${data.matchingScore ?? 0}`,
    );
    return `mock-wa-oa-${Date.now()}`;
  }

  /**
   * MVP: mock implementation — log only. Replace with Meta WhatsApp Business Cloud API call.
   */
  async sendParticipationConfirmation(
    phone: string,
    data: ParticipationConfirmationData,
  ): Promise<string | null> {
    this.logger.log(
      `[WhatsApp MOCK] participation_confirmation → phone=${phone} tenant=${data.tenantName ?? 'N/A'} total=${data.consolidatedTotalValue ?? 'N/A'}`,
    );
    return `mock-wa-pc-${Date.now()}`;
  }
}
