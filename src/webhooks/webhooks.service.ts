import { Injectable, Logger } from '@nestjs/common';
import { createHmac } from 'crypto';
import { TransactionsService } from '../transactions/transactions.service';
import { AuditService } from '../audit/audit.service';
import { AuditAction } from '../audit/entities/audit-log.entity';
import {
  PaystackWebhookBody,
  PaystackChargeData,
  FlutterwaveWebhookBody,
  FlutterwaveChargeData,
} from './webhook-payload';

type PaystackVerification = {
  status: string;
  data?: PaystackChargeData & {
    status: string;
  };
};

type FlutterwaveVerification = {
  status: string;
  data?: FlutterwaveChargeData;
};

@Injectable()
export class PaystackService {
  async verifyTransaction(reference: string): Promise<PaystackVerification> {
    const secret = process.env.PAYSTACK_SECRET_KEY;
    if (!secret) {
      throw new Error('PAYSTACK_SECRET_KEY not configured');
    }

    const response = await fetch(
      `https://api.paystack.co/transaction/verify/${encodeURIComponent(reference)}`,
      {
        headers: {
          Authorization: `Bearer ${secret}`,
        },
      },
    );

    if (!response.ok) {
      throw new Error(`Paystack verify request failed: ${response.status}`);
    }

    return (await response.json()) as PaystackVerification;
  }
}

@Injectable()
export class FlutterwaveService {
  async verifyTransaction(reference: string): Promise<FlutterwaveVerification> {
    const secret = process.env.FLUTTERWAVE_SECRET_KEY;
    if (!secret) {
      throw new Error('FLUTTERWAVE_SECRET_KEY not configured');
    }

    const response = await fetch(
      `https://api.flutterwave.com/v3/transactions/verify_by_reference?tx_ref=${encodeURIComponent(reference)}`,
      {
        headers: {
          Authorization: `Bearer ${secret}`,
        },
      },
    );

    if (!response.ok) {
      throw new Error(`Flutterwave verify request failed: ${response.status}`);
    }

    return (await response.json()) as FlutterwaveVerification;
  }
}

@Injectable()
export class WebhookService {
  private readonly logger = new Logger(WebhookService.name);

  constructor(
    private readonly transactionsService: TransactionsService,
    private readonly paystackService: PaystackService,
    private readonly flutterwaveService: FlutterwaveService,
    private readonly auditService: AuditService,
  ) {}

  // ======================= ENTRY POINTS =======================

  async processPaystackWebhook(
    signature: string,
    rawBody: Buffer,
    body: PaystackWebhookBody,
  ) {
    this.verifyPaystackSignature(signature, rawBody);

    const { event, data } = body;
    this.logger.log(`Paystack event: ${event}`);

    if (event === 'charge.success') {
      await this.handlePaystackChargeSuccess(data);
    }
  }

  async processFlutterwaveWebhook(hash: string, body: FlutterwaveWebhookBody) {
    this.verifyFlutterwaveHash(hash);

    const { event, data } = body;
    this.logger.log(`Flutterwave event: ${event}`);

    if (event === 'charge.completed' && data?.status === 'successful') {
      await this.handleFlutterwaveChargeSuccess(data);
    }
  }

  // ======================= PAYSTACK HANDLER =======================

  private async handlePaystackChargeSuccess(
    data: PaystackChargeData,
  ): Promise<void> {
    const { reference } = data;

    const existing = await this.transactionsService.findByReference(reference);
    if (existing) {
      this.logger.warn(`Duplicate Paystack webhook: ${reference}`);
      return;
    }

    const verification =
      await this.paystackService.verifyTransaction(reference);

    if (!verification || verification.status !== 'success') {
      this.logger.warn(`Paystack verification failed: ${reference}`);
      return;
    }

    const verifiedData = verification.data;

    if (!verifiedData || verifiedData.status !== 'success') {
      this.logger.warn(`Invalid Paystack data: ${reference}`);
      return;
    }

    const amount = verifiedData.amount / 100;

    const pendingTx =
      await this.transactionsService.findPendingByReference(reference);

    if (!pendingTx) {
      this.logger.warn(`No pending transaction: ${reference}`);
      return;
    }

    try {
      await this.transactionsService.deposit({
        accountId: pendingTx.destinationAccountId!,
        amount,
        reference,
        description: `Paystack deposit — ref: ${reference}`,
      });

      this.auditService.log(AuditAction.DEPOSIT_COMPLETED, {
        resourceId: reference,
        resourceType: 'paystack',
        metadata: {
          amount,
          email: this.maskEmail(verifiedData.customer?.email),
        },
      });

      this.logger.log(`Paystack deposit OK: ₦${amount}`);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      this.logger.error(`Paystack deposit failed: ${message}`);
    }
  }

  // ======================= FLUTTERWAVE HANDLER =======================

  private async handleFlutterwaveChargeSuccess(
    data: FlutterwaveChargeData,
  ): Promise<void> {
    const { tx_ref } = data;

    const existing = await this.transactionsService.findByReference(tx_ref);
    if (existing) {
      this.logger.warn(`Duplicate Flutterwave webhook: ${tx_ref}`);
      return;
    }

    const verification =
      await this.flutterwaveService.verifyTransaction(tx_ref);

    if (!verification || verification.status !== 'success') {
      this.logger.warn(`Flutterwave verification failed: ${tx_ref}`);
      return;
    }

    const verifiedData = verification.data;

    if (!verifiedData || verifiedData.status !== 'successful') {
      this.logger.warn(`Invalid Flutterwave data: ${tx_ref}`);
      return;
    }

    if (verifiedData.currency !== 'NGN') {
      this.logger.warn(`Invalid currency: ${verifiedData.currency}`);
      return;
    }

    const amount = verifiedData.amount;

    const pendingTx =
      await this.transactionsService.findPendingByReference(tx_ref);

    if (!pendingTx) {
      this.logger.warn(`No pending transaction: ${tx_ref}`);
      return;
    }

    try {
      await this.transactionsService.deposit({
        accountId: pendingTx.destinationAccountId!,
        amount,
        reference: tx_ref,
        description: `Flutterwave deposit — ref: ${tx_ref}`,
      });

      this.auditService.log(AuditAction.DEPOSIT_COMPLETED, {
        resourceId: tx_ref,
        resourceType: 'flutterwave',
        metadata: {
          amount,
          currency: verifiedData.currency,
          email: this.maskEmail(verifiedData.customer?.email),
        },
      });

      this.logger.log(
        `Flutterwave deposit OK: ${verifiedData.currency} ${amount}`,
      );
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      this.logger.error(`Flutterwave deposit failed: ${message}`);
    }
  }

  // ======================= HELPERS =======================

  private verifyPaystackSignature(signature: string, rawBody: Buffer) {
    const secret = process.env.PAYSTACK_SECRET_KEY;
    if (!secret) {
      throw new Error('PAYSTACK_SECRET_KEY not configured');
    }
    const expectedSignature = createHmac('sha512', secret)
      .update(rawBody)
      .digest('hex');
    if (signature !== expectedSignature) {
      throw new Error('Invalid Paystack signature');
    }
  }

  private verifyFlutterwaveHash(hash: string) {
    const secretHash = process.env.FLUTTERWAVE_SECRET_HASH;
    if (!secretHash) {
      throw new Error('FLUTTERWAVE_SECRET_HASH not configured');
    }
    if (hash !== secretHash) {
      throw new Error('Invalid Flutterwave hash');
    }
  }

  private maskEmail(email?: string): string | undefined {
    if (!email) return undefined;
    const [name, domain] = email.split('@');
    return `${name?.slice(0, 2)}***@${domain}`;
  }
}
