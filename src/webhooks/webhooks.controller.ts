import { Controller, Post, Headers, Req, Body, HttpCode } from '@nestjs/common';
import { Request } from 'express';
import { WebhookService } from './webhooks.service';
import type {
  PaystackWebhookBody,
  FlutterwaveWebhookBody,
} from './webhook-payload';

interface RawBodyRequest extends Request {
  rawBody: Buffer;
}

@Controller('webhooks')
export class WebhookController {
  constructor(private readonly webhookService: WebhookService) {}

  @Post('paystack')
  @HttpCode(200)
  async handlePaystackWebhook(
    @Headers('x-paystack-signature') signature: string,
    @Req() req: RawBodyRequest,
    @Body() body: PaystackWebhookBody,
  ) {
    await this.webhookService.processPaystackWebhook(
      signature,
      req.rawBody,
      body,
    );

    return { received: true };
  }

  @Post('flutterwave')
  @HttpCode(200)
  async handleFlutterwaveWebhook(
    @Headers('verif-hash') hash: string,
    @Body() body: FlutterwaveWebhookBody,
  ) {
    await this.webhookService.processFlutterwaveWebhook(hash, body);

    return { status: 'success' };
  }
}
