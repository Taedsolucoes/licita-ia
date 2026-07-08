import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

/**
 * Simple SMTP mail service via nodemailer.
 *
 * Required envs (production):
 *   SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS, SMTP_FROM
 * Optional:
 *   SMTP_SECURE=true|false (default: true when port 465)
 *   APP_WEB_URL (base URL used to build the reset link)
 *
 * Falls back to log-only mock mode when SMTP_HOST is not configured,
 * so dev environments keep working without a mail server.
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

    const subject = 'LicitaIA — Redefinição de senha';
    const text = [
      'Você solicitou a redefinição de senha da sua conta LicitaIA.',
      '',
      resetLink
        ? `Acesse o link para definir uma nova senha: ${resetLink}`
        : `Use o código a seguir para redefinir sua senha: ${resetToken}`,
      '',
      'O código expira em 1 hora. Se você não solicitou, ignore este e-mail.',
    ].join('\n');

    if (!this.isConfigured) {
      this.logger.log(`[Mail MOCK] to=${to} subject="${subject}" token=${resetToken}`);
      return;
    }

    const host = this.configService.get<string>('SMTP_HOST')!;
    const port = parseInt(this.configService.get<string>('SMTP_PORT', '587'), 10);
    const secureEnv = this.configService.get<string>('SMTP_SECURE');
    const secure = secureEnv !== undefined ? secureEnv === 'true' : port === 465;
    const user = this.configService.get<string>('SMTP_USER');
    const pass = this.configService.get<string>('SMTP_PASS');
    const from = this.configService.get<string>('SMTP_FROM', user ?? 'no-reply@licitaia.com.br');

    // Lazy require so the app still boots if nodemailer is absent in dev.
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const nodemailer: any = require('nodemailer');

    const transporter = nodemailer.createTransport({
      host,
      port,
      secure,
      auth: user && pass ? { user, pass } : undefined,
    });

    await transporter.sendMail({ from, to, subject, text });
    this.logger.log(`Password reset email sent to ${to}`);
  }
}
