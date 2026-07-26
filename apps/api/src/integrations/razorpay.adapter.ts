import { createHmac, timingSafeEqual } from 'crypto';
import {
  Injectable,
  Logger,
  ServiceUnavailableException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Razorpay from 'razorpay';

@Injectable()
export class RazorpayAdapter {
  private readonly logger = new Logger(RazorpayAdapter.name);
  private client: Razorpay | null = null;
  private readonly keyId: string;
  private readonly webhookSecret: string;

  constructor(private readonly config: ConfigService) {
    this.keyId = this.config.get<string>('RAZORPAY_KEY_ID')?.trim() ?? '';
    const secret = this.config.get<string>('RAZORPAY_KEY_SECRET')?.trim() ?? '';
    this.webhookSecret =
      this.config.get<string>('RAZORPAY_WEBHOOK_SECRET')?.trim() ?? '';
    if (this.keyId && secret) {
      this.client = new Razorpay({ key_id: this.keyId, key_secret: secret });
      this.logger.log('Razorpay adapter ready');
    } else {
      this.logger.warn('Razorpay not configured — using demo payments');
    }
  }

  get enabled() {
    return this.client != null;
  }

  get demoEnabled() {
    return this.config.get<string>('RAZORPAY_DEMO') === 'true';
  }

  async createOrder(amountInr: number, receipt: string) {
    if (!this.client) {
      if (!this.demoEnabled) {
        throw new ServiceUnavailableException(
          'Payments are unavailable. Configure Razorpay credentials or set RAZORPAY_DEMO=true for local demos.',
        );
      }
      const externalId = `order_rzp_demo_${receipt.slice(0, 10)}`;
      return {
        mode: 'demo' as const,
        orderId: externalId,
        amount: amountInr * 100,
        currency: 'INR',
        keyId: 'rzp_test_demo',
      };
    }

    const order = await this.client.orders.create({
      amount: amountInr * 100,
      currency: 'INR',
      receipt,
    });
    return {
      mode: 'live' as const,
      orderId: order.id,
      amount: Number(order.amount),
      currency: order.currency,
      keyId: this.keyId,
    };
  }

  verifyWebhookSignature(rawBody: string, signature: string) {
    if (!this.webhookSecret) return false;
    const expected = createHmac('sha256', this.webhookSecret)
      .update(rawBody)
      .digest('hex');
    try {
      return timingSafeEqual(
        Buffer.from(expected),
        Buffer.from(signature),
      );
    } catch {
      return false;
    }
  }
}
