import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  Index,
} from 'typeorm';

export enum NotificationType {
  TRANSACTION_CREDIT = 'transaction.credit',
  TRANSACTION_DEBIT = 'transaction.debit',
  TRANSACTION_FAILED = 'transaction.failed',
  KYC_SUBMITTED = 'kyc.submitted',
  KYC_APPROVED = 'kyc.approved',
  KYC_REJECTED = 'kyc.rejected',
  SECURITY_ALERT = 'security.alert',
  SYSTEM_ANNOUNCEMENT = 'system.announcement',
}

export enum NotificationChannel {
  IN_APP = 'in_app',
  EMAIL = 'email',
  SMS = 'sms',
  PUSH = 'push',
}

export enum NotificationStatus {
  PENDING = 'pending',
  SENT = 'sent',
  DELIVERED = 'delivered',
  FAILED = 'failed',
  READ = 'read',
}

@Entity('notifications')
@Index(['userId', 'isRead', 'createdAt'])
export class Notification {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column()
  @Index()
  userId!: string;

  @Column({ type: 'enum', enum: NotificationType })
  type!: NotificationType;

  @Column({
    type: 'enum',
    enum: NotificationChannel,
    default: NotificationChannel.IN_APP,
  })
  channel!: NotificationChannel;

  @Column({
    type: 'enum',
    enum: NotificationStatus,
    default: NotificationStatus.PENDING,
  })
  status!: NotificationStatus;

  @Column()
  title!: string;

  @Column({ type: 'text' })
  body!: string;

  @Column({ type: 'jsonb', nullable: true })
  data!: Record<string, any>;

  @Column({ default: false })
  isRead!: boolean;

  @Column({ nullable: true })
  readAt!: Date;

  @CreateDateColumn()
  createdAt!: Date;
}
