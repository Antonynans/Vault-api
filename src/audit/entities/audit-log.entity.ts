import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  Index,
} from 'typeorm';

export enum AuditAction {
  USER_REGISTERED = 'user.registered',
  USER_LOGIN = 'user.login',
  USER_LOGOUT = 'user.logout',
  USER_LOGIN_FAILED = 'user.login_failed',
  TOKEN_REFRESHED = 'token.refreshed',
  ACCOUNT_CREATED = 'account.created',
  ACCOUNT_FROZEN = 'account.frozen',
  ACCOUNT_UNFROZEN = 'account.unfrozen',
  ACCOUNT_CLOSED = 'account.closed',
  TRANSFER_INITIATED = 'transaction.transfer_initiated',
  TRANSFER_COMPLETED = 'transaction.transfer_completed',
  TRANSFER_FAILED = 'transaction.transfer_failed',
  DEPOSIT_COMPLETED = 'transaction.deposit_completed',
  WITHDRAWAL_COMPLETED = 'transaction.withdrawal_completed',
  KYC_SUBMITTED = 'kyc.submitted',
  KYC_APPROVED = 'kyc.approved',
  KYC_REJECTED = 'kyc.rejected',
  USER_DEACTIVATED = 'admin.user_deactivated',
  WALLET_UPGRADED = 'admin.wallet_upgraded',
}

@Entity('audit_logs')
@Index(['userId', 'createdAt'])
@Index(['action', 'createdAt'])
export class AuditLog {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'enum', enum: AuditAction })
  action!: AuditAction;

  @Column({ nullable: true })
  @Index()
  userId!: string;

  @Column({ nullable: true })
  resourceId!: string;

  @Column({ nullable: true })
  resourceType!: string;

  @Column({ nullable: true })
  ipAddress!: string;

  @Column({ nullable: true })
  userAgent!: string;

  @Column({ type: 'jsonb', nullable: true })
  metadata!: Record<string, any>;

  @Column({ default: false })
  isSuspicious!: boolean;

  @CreateDateColumn()
  createdAt!: Date;
}
