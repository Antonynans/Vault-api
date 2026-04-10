// ── Event name constants ──────────────────────────────────────────────────────
export const EVENTS = {
  USER_REGISTERED: 'user.registered',
  USER_LOGIN: 'user.login',

  TRANSFER_COMPLETED: 'transaction.transfer.completed',
  TRANSFER_FAILED: 'transaction.transfer.failed',
  DEPOSIT_COMPLETED: 'transaction.deposit.completed',
  WITHDRAWAL_COMPLETED: 'transaction.withdrawal.completed',

  KYC_SUBMITTED: 'kyc.submitted',
  KYC_APPROVED: 'kyc.approved',
  KYC_REJECTED: 'kyc.rejected',

  // Wallets
  WALLET_LIMIT_BREACHED: 'wallet.limit.breached',
} as const;

export class UserRegisteredEvent {
  userId!: string;
  email!: string;
  firstName!: string;
}

export class UserLoginEvent {
  userId!: string;
  email!: string;
  ipAddress!: string;
}

export class TransferCompletedEvent {
  transactionId!: string;
  reference!: string;
  senderId!: string;
  senderAccountId!: string;
  receiverAccountId!: string;
  amount!: number;
  fee!: number;
  currency!: string;
}

export class TransferFailedEvent {
  reference!: string;
  userId!: string;
  amount!: number;
  reason!: string;
}

export class DepositCompletedEvent {
  transactionId!: string;
  reference!: string;
  accountId!: string;
  userId!: string;
  amount!: number;
  currency!: string;
}

export class WithdrawalCompletedEvent {
  transactionId!: string;
  reference!: string;
  accountId!: string;
  userId!: string;
  amount!: number;
  currency!: string;
}

export class KycSubmittedEvent {
  submissionId!: string;
  userId!: string;
  documentType!: string;
}

export class KycApprovedEvent {
  submissionId!: string;
  userId!: string;
}

export class KycRejectedEvent {
  submissionId!: string;
  userId!: string;
  reason!: string;
}

export class WalletLimitBreachedEvent {
  userId!: string;
  accountId!: string;
  attemptedAmount!: number;
  limit!: number;
  limitType!: 'single' | 'daily' | 'monthly';
}
