import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
} from 'typeorm';
import { TransactionType } from '../../transactions/entities/transaction.entity';

export enum FeeType {
  PERCENTAGE = 'percentage', // e.g. 1.5%
  FLAT = 'flat', // e.g. ₦50 fixed
  TIERED = 'tiered', // different rate per amount band
}

export enum FeeStatus {
  ACTIVE = 'active',
  INACTIVE = 'inactive',
}

/**
 * A fee rule that applies to a specific transaction type.
 * Priority: higher number wins when multiple rules match.
 * Cap: maximum fee regardless of percentage (0 = no cap).
 */
@Entity('fee_configs')
export class FeeConfig {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  name: string; // e.g. "Standard Transfer Fee"

  @Column({
    type: 'enum',
    enum: TransactionType,
  })
  transactionType: TransactionType;

  @Column({
    type: 'enum',
    enum: FeeType,
    default: FeeType.PERCENTAGE,
  })
  feeType: FeeType;

  /** Percentage value (e.g. 1.5 = 1.5%) or flat amount in kobo */
  @Column({ type: 'decimal', precision: 10, scale: 4, default: 0 })
  value: number;

  /** Maximum fee in kobo. 0 = no cap */
  @Column({ type: 'bigint', default: 0 })
  cap: number;

  /** Minimum fee in kobo. 0 = no minimum */
  @Column({ type: 'bigint', default: 0 })
  minimum: number;

  /** Minimum transaction amount (kobo) this rule applies to */
  @Column({ type: 'bigint', default: 0 })
  minTransactionAmount: number;

  /** Maximum transaction amount (kobo) this rule applies to. 0 = no limit */
  @Column({ type: 'bigint', default: 0 })
  maxTransactionAmount: number;

  @Column({
    type: 'enum',
    enum: FeeStatus,
    default: FeeStatus.ACTIVE,
  })
  status: FeeStatus;

  @Column({ default: 0 })
  priority: number;

  @Column({ nullable: true })
  description: string;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
