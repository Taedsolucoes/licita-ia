import { Injectable, Logger } from '@nestjs/common';

@Injectable()
export class PushService {
  private readonly logger = new Logger(PushService.name);

  /**
   * MVP: mock implementation — log only. Replace with Firebase Admin SDK call.
   * admin.messaging().send({ token: fcmToken, notification: { title, body }, data })
   */
  async sendPush(
    fcmToken: string,
    title: string,
    body: string,
    data?: Record<string, string>,
  ): Promise<string | null> {
    this.logger.log(
      `[Push MOCK] token=${fcmToken.substring(0, 8)}… title="${title}" body="${body}" data=${JSON.stringify(data ?? {})}`,
    );
    return `mock-fcm-${Date.now()}`;
  }
}
