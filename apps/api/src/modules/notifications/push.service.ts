import { Injectable, Logger, OnApplicationBootstrap } from '@nestjs/common';
import type { App } from 'firebase-admin/app';

@Injectable()
export class PushService implements OnApplicationBootstrap {
  private readonly logger = new Logger(PushService.name);
  private firebaseApp: App | null = null;
  private isConfigured = false;

  onApplicationBootstrap(): void {
    const saJson = process.env.FIREBASE_SERVICE_ACCOUNT_JSON;
    if (!saJson) {
      this.logger.warn(
        'Firebase Cloud Messaging not configured (FIREBASE_SERVICE_ACCOUNT_JSON missing) — running in mock mode',
      );
      return;
    }

    try {
      // Accept both raw JSON and base64-encoded JSON
      const decoded = this.decodeServiceAccount(saJson);
      const serviceAccount = JSON.parse(decoded) as Record<string, unknown>;

      // Lazy import to avoid loading firebase-admin at startup when unconfigured
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const { initializeApp, getApps, cert } = require('firebase-admin/app') as typeof import('firebase-admin/app');

      // Re-use existing app if already initialised (e.g., hot-reload)
      if (getApps().length > 0) {
        this.firebaseApp = getApps()[0];
      } else {
        this.firebaseApp = initializeApp({ credential: cert(serviceAccount as Parameters<typeof cert>[0]) });
      }

      this.isConfigured = true;
      this.logger.log('Firebase Admin SDK initialised — FCM push enabled');
    } catch (err) {
      this.logger.error(
        `Failed to initialise Firebase Admin SDK — falling back to mock mode: ${String(err)}`,
      );
    }
  }

  // ----------------------------------------------------------------
  // Public API
  // ----------------------------------------------------------------

  /**
   * Sends a push notification via Firebase Cloud Messaging.
   *
   * Falls back to log-only when FIREBASE_SERVICE_ACCOUNT_JSON is absent or invalid.
   */
  async sendPush(
    fcmToken: string,
    title: string,
    body: string,
    data?: Record<string, string>,
  ): Promise<string | null> {
    if (!this.isConfigured || !this.firebaseApp) {
      this.logger.log(
        `[Push MOCK] token=${fcmToken.substring(0, 8)}… title="${title}" body="${body}" data=${JSON.stringify(data ?? {})}`,
      );
      return `mock-fcm-${Date.now()}`;
    }

    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { getMessaging } = require('firebase-admin/messaging') as typeof import('firebase-admin/messaging');
    const messaging = getMessaging(this.firebaseApp);

    const messageId = await messaging.send({
      token: fcmToken,
      notification: { title, body },
      data: data ?? {},
    });

    this.logger.debug(`FCM sent: ${messageId} → token=${fcmToken.substring(0, 8)}…`);
    return messageId;
  }

  // ----------------------------------------------------------------
  // Helpers
  // ----------------------------------------------------------------

  private decodeServiceAccount(value: string): string {
    // If the value looks like base64 (no '{' as first non-space char), decode it
    const trimmed = value.trim();
    if (!trimmed.startsWith('{')) {
      return Buffer.from(trimmed, 'base64').toString('utf-8');
    }
    return trimmed;
  }
}
