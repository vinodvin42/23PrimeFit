import {
  BadRequestException,
  Controller,
  Headers,
  Post,
  Req,
} from '@nestjs/common';
import { ApiExcludeController } from '@nestjs/swagger';
import { RazorpayAdapter } from '../integrations/razorpay.adapter';
import { ConsultationsService } from './consultations.service';

@ApiExcludeController()
@Controller('webhooks')
export class PaymentsWebhookController {
  constructor(
    private readonly razorpayAdapter: RazorpayAdapter,
    private readonly consultations: ConsultationsService,
  ) {}

  @Post('razorpay')
  async handleRazorpay(
    @Req() req: { body?: unknown; rawBody?: Buffer },
    @Headers('x-razorpay-signature') signature?: string,
  ) {
    const raw =
      req.rawBody?.toString('utf8') ??
      (typeof req.body === 'string' ? req.body : JSON.stringify(req.body ?? {}));
    if (
      !signature ||
      !this.razorpayAdapter.verifyWebhookSignature(raw, signature)
    ) {
      throw new BadRequestException('Invalid Razorpay signature');
    }

    const payload = (typeof req.body === 'object' && req.body
      ? req.body
      : JSON.parse(raw)) as {
      payload?: { payment?: { entity?: { order_id?: string } } };
    };
    const orderId = payload.payload?.payment?.entity?.order_id;
    if (!orderId) return { ok: true, ignored: true };

    const consult = await this.consultations.markPaidByExternalId(orderId);
    return { ok: true, consultationId: consult?.id ?? null };
  }
}

