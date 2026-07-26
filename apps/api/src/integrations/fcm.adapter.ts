import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { getApps } from 'firebase-admin/app';
import { getMessaging } from 'firebase-admin/messaging';

/** FCM send — no-op when Firebase Admin is not initialized. */
@Injectable()
export class FcmAdapter {
  private readonly logger = new Logger(FcmAdapter.name);

  constructor(private readonly config: ConfigService) {}

  get enabled() {
    try {
      return getApps().length > 0;
    } catch {
      return false;
    }
  }

  async sendToToken(
    token: string,
    payload: { title: string; body: string; data?: Record<string, string> },
  ) {
    if (!this.enabled || !token.trim()) {
      this.logger.debug('FCM skipped (admin not ready or empty token)');
      return { mode: 'stub' as const, sent: false };
    }
    try {
      const id = await getMessaging().send({
        token,
        notification: { title: payload.title, body: payload.body },
        data: payload.data,
      });
      return { mode: 'fcm' as const, sent: true, id };
    } catch (err) {
      this.logger.warn(`FCM send failed: ${String(err)}`);
      return { mode: 'fcm' as const, sent: false, error: String(err) };
    }
  }
}
