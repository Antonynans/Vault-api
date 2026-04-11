export interface PaystackChargeData {
  reference: string;
  amount: number;
  customer?: { email?: string };
  metadata?: { accountId?: string };
}

export interface PaystackWebhookBody {
  event: string;
  data: PaystackChargeData;
}

export interface FlutterwaveChargeData {
  tx_ref: string;
  amount: number;
  currency: string;
  status: string;
  customer?: { email?: string };
  meta?: { accountId?: string };
}

export interface FlutterwaveWebhookBody {
  event: string;
  data: FlutterwaveChargeData;
}
