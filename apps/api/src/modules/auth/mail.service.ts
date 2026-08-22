import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

/**
 * Serviço SMTP compartilhado por autenticação e notificações.
 * Sem SMTP_HOST, opera em modo de log para desenvolvimento.
 */
@Injectable()
export class MailService {
  private readonly logger = new Logger(MailService.name);
  private readonly isConfigured: boolean;

  constructor(private configService: ConfigService) {
    this.isConfigured = !!this.configService.get<string>('SMTP_HOST');
    if (!this.isConfigured) {
      this.logger.warn(
        'SMTP not configured (SMTP_HOST missing) — MailService running in mock mode (emails are logged, not sent)',
      );
    }
  }

  async sendPasswordResetEmail(to: string, resetToken: string): Promise<void> {
    const webUrl = this.configService.get<string>('APP_WEB_URL', '');
    const resetLink = webUrl
      ? `${webUrl.replace(/\/$/, '')}/reset-password?token=${resetToken}`
      : null;

    const text = [
      'Você solicitou a redefinição de senha da sua conta LicitaIA.',
      '',
      resetLink
        ? `Acesse o link para definir uma nova senha: ${resetLink}`
        : `Use o código a seguir para redefinir sua senha: ${resetToken}`,
      '',
      'O código expira em 1 hora. Se você não solicitou, ignore este e-mail.',
    ].join('\n');

    await this.sendTextEmail(to, 'LicitaIA — Redefinição de senha', text);
  }

  async sendOpportunityAlertEmail(to: string, details: {
    agencyName?: string | null;
    biddingNumber?: string | null;
    objectSummary?: string | null;
    municipalityName?: string | null;
    uf?: string | null;
    estimatedValue?: string | null;
    sourceUrl?: string | null;
  }): Promise<void> {
    const subject = `LicitaIA — Nova oportunidade${details.biddingNumber ? ` ${details.biddingNumber}` : ''}`;
    const text = [
      'Uma nova licitação compatível com o perfil da sua empresa foi encontrada.',
      '',
      `Órgão: ${details.agencyName ?? 'Não informado'}`,
      `Objeto: ${details.objectSummary ?? 'Não informado'}`,
      `Local: ${[details.municipalityName, details.uf].filter(Boolean).join(' / ') || 'Não informado'}`,
      `Valor estimado: ${details.estimatedValue ? `R$ ${details.estimatedValue}` : 'Não informado'}`,
      details.sourceUrl ? `Publicação oficial: ${details.sourceUrl}` : '',
      '',
      'Acesse o LicitaIA para revisar os documentos, itens e prazos da oportunidade.',
    ].join('\n');

    await this.sendTextEmail(to, subject, text);
  }

  private async sendTextEmail(to: string, subject: string, text: string): Promise<void> {
    if (!this.isConfigured) {
      this.logger.log(`[Mail MOCK] to=${to} subject="${subject}"`);
      return;
    }

    const host = this.configService.get<string>('SMTP_HOST')!;
    const port = parseInt(this.configService.get<string>('SMTP_PORT', '587'), 10);
    const secureEnv = this.configService.get<string>('SMTP_SECURE');
    const secure = secureEnv !== undefined ? secureEnv === 'true' : port === 465;
    const user = this.configService.get<string>('SMTP_USER');
    const pass = this.configService.get<string>('SMTP_PASS');
    const from = this.configService.get<string>('SMTP_FROM', user ?? 'no-reply@licitaia.com.br');

    // Lazy require keeps local development bootable if nodemailer is optional.
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const nodemailer: any = require('nodemailer');
    const transporter = nodemailer.createTransport({
      host,
      port,
      secure,
      auth: user && pass ? { user, pass } : undefined,
    });

    await transporter.sendMail({ from, to, subject, text });
    this.logger.log(`Email sent to ${to} subject="${subject}"`);
  }
}
