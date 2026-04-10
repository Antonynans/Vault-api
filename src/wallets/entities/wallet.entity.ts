import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  OneToOne,
  JoinColumn,
} from 'typeorm';
import { Account } from '../../accounts/entities/account.entity';

export enum WalletTier {
  BASIC = 'basic', // low limits, no KYC
  STANDARD = 'standard', // mid limits, soft KYC
  PREMIUM = 'premium', // full limits, full KYC
}

@Entity('wallets')
export class Wallet {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @OneToOne(() => Account, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'accountId' })
  account!: Account;

  @Column()
  accountId!: string;

  @Column({ type: 'enum', enum: WalletTier, default: WalletTier.BASIC })
  tier!: WalletTier;

  @Column({ type: 'bigint', default: 100_000_00 }) // ₦100,000 in kobo
  dailyLimit!: number;

  @Column({ type: 'bigint', default: 50_000_00 })
  singleTransactionLimit!: number;

  @Column({ type: 'bigint', default: 0 })
  monthlySpend!: number;

  @Column({ type: 'bigint', default: 500_000_00 }) // ₦500,000
  monthlyLimit!: number;

  @Column({ nullable: true })
  spendResetDate!: Date;

  @Column({ default: false })
  isVirtual!: boolean; // true for API-issued virtual cards

  @CreateDateColumn()
  createdAt!: Date;

  @UpdateDateColumn()
  updatedAt!: Date;
}
