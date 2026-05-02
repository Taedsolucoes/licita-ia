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

interface WhatsAppApiResponse {
  messages?: Array<{ id: string }>;
  error?: { message: string; type: string; code: number };
}

@Injectable()
export class WhatsAppService {
  private readonly logger = new Logger(WhatsAppService.name);

  private readonly token: string | undefined;
  private readonly phoneNumberId: string | undefined;
  private readonly templateOpportunity: string;
  private readonly templateParticipation: string;
  private readonly isConfigured: boolean;

  constructor() {
    this.token = process.env.WHATSAPP_TOKEN;
    this.phoneNumberId = process.env.WHATSAPP_PHONE_NUMBER_ID;
    this.templateOpportunity =
      process.env.WHATSAPP_TEMPLATE_OPPORTUNITY ?? 'opportunity_alert';
    this.templateParticipation =
      process.env.WHATSAPP_TEMPLATE_PARTICIPATION ?? 'participation_confirmation';
    this.isConfigured = !!(this.token && this.phoneNumberId);

    if (!this.isConfigured) {
      this.logger.warn(
        'WhatsApp Business API not configured (WHATSAPP_TOKEN / WHATSAPP_PHONE_NUMBER_ID missing) — running in mock mode',
      );
    }
  }

  // ----------------------------------------------------------------
  // Internal helpers
  // ----------------------------------------------------------------

  private async sendTemplate(
    phone: string,
    templateName: string,
    components: Record<string, unknown>[],
  ): Promise<string | null> {
    const url = `https://graph.facebook.com/v18.0/${this.phoneNumberId}/messages`;

    const payload = {
      messaging_product: 'whatsapp',
      to: phone,
      type: 'template',
      template: {
        name: templateName,
        language: { code: 'pt_BR' },
        components,
      },
    };

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${this.token ?? ''}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    });

    const json = (await response.json()) as WhatsAppApiResponse;

    if (!response.ok || json.error) {
      const errMsg = json.error?.message ?? `HTTP ${response.status}`;
      throw new Error(`WhatsApp API error: ${errMsg}`);
    }

    return json.messages?.[0]?.id ?? null;
  }

  // ----------------------------------------------------------------
  // Public API
  // ----------------------------------------------------------------

  /**
   * Sends template `opportunity_alert`:
   *   "Nova oportunidade! Orgao: {{1}}, Objeto: {{2}}, Valor: {{3}}."
   *
   * Falls back to log-only when WHATSAPP_TOKEN / WHATSAPP_PHONE_NUMBER_ID are absent.
   */
  async sendOpportunityAlert(
    phone: string,
    data: OpportunityAlertData,
  ): Promise<string | null> {
    if (!this.isConfigured) {
      this.logger.log(
        `[WhatsApp MOCK] opportunity_alert → phone=${phone} bidding=${data.biddingNumber ?? 'N/A'} score=${data.matchingScore ?? 0}`,
      );
      return `mock-wa-oa-${Date.now()}`;
    }

    const components: Record<string, unknown>[] = [
      {
        type: 'body',
        parameters: [
          { type: 'text', text: data.agencyName ?? 'N/A' },
          { type: 'text', text: data.objectSummary ?? data.biddingNumber ?? 'N/A' },
          { type: 'text', text: data.estimatedValue ?? 'Não informado' },
        ],
      },
    ];

    return this.sendTemplate(phone, this.templateOpportunity, components);
  }

  /**
   * Sends template `participation_confirmation`:
   *   "Proposta enviada! Licitacao: {{1}}, Valor total: {{2}}."
   *
   * Falls back to log-only when credentials are absent.
   */
  async sendParticipationConfirmation(
    phone: string,
    data: ParticipationConfirmationData,
  ): Promise<string | null> {
    if (!this.isConfigured) {
      this.logger.log(
        `[WhatsApp MOCK] participation_confirmation → phone=${phone} tenant=${data.tenantName ?? 'N/A'} total=${data.consolidatedTotalValue ?? 'N/A'}`,
      );
      return `mock-wa-pc-${Date.now()}`;
    }

    const components: Record<string, unknown>[] = [
      {
        type: 'body',
        parameters: [
          { type: 'text', text: data.biddingNumber ?? 'N/A' },
          { type: 'text', text: data.consolidatedTotalValue ?? 'N/A' },
        ],
      },
    ];

    return this.sendTemplate(phone, this.templateParticipation, components);
  }
}
