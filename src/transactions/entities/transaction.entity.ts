import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { Account } from '../../accounts/entities/account.entity';
import { Currency } from '../../common/enums/currency.enum';

export enum TransactionType {
  TRANSFER = 'transfer',
  DEPOSIT = 'deposit',
  WITHDRAWAL = 'withdrawal',
  PAYMENT = 'payment',
  REVERSAL = 'reversal',
}

export enum TransactionStatus {
  PENDING = 'pending',
  PROCESSING = 'processing',
  COMPLETED = 'completed',
  FAILED = 'failed',
  REVERSED = 'reversed',
}

@Entity('transactions')
export class Transaction {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ unique: true })
  reference: string; // e.g. TXN-20240101-XXXXXXXX

  @Column({
    type: 'enum',
    enum: TransactionType,
  })
  type: TransactionType;

  @Column({
    type: 'enum',
    enum: TransactionStatus,
    default: TransactionStatus.PENDING,
  })
  status: TransactionStatus;

  @Column({ type: 'decimal', precision: 18, scale: 2 })
  amount: number;

  @Column({ type: 'decimal', precision: 18, scale: 2, default: 0 })
  fee: number;

  @Column({ type: 'enum', enum: Currency })
  currency: Currency;

  @Column({ nullable: true })
  description: string;

  @Column({ nullable: true })
  metadata: string; // JSON string for extra data

  @ManyToOne(() => Account, (account) => account.outgoingTransactions, {
    nullable: true,
  })
  @JoinColumn({ name: 'sourceAccountId' })
  sourceAccount: Account;

  @Column({ nullable: true })
  sourceAccountId: string;

  @ManyToOne(() => Account, (account) => account.incomingTransactions, {
    nullable: true,
  })
  @JoinColumn({ name: 'destinationAccountId' })
  destinationAccount: Account;

  @Column({ nullable: true })
  destinationAccountId: string;

  @Column({ nullable: true })
  reversalOf: string; // reference of the reversed transaction

  @Column({ nullable: true })
  failureReason: string;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
