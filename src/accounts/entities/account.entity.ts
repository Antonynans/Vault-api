import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  OneToMany,
  JoinColumn,
} from 'typeorm';
import { User } from '../../users/entities/user.entity';
import { Transaction } from '../../transactions/entities/transaction.entity';
import { Currency } from '../../common/enums/currency.enum';

export enum AccountType {
  SAVINGS = 'savings',
  CURRENT = 'current',
  WALLET = 'wallet',
}

export enum AccountStatus {
  ACTIVE = 'active',
  FROZEN = 'frozen',
  CLOSED = 'closed',
}

@Entity('accounts')
export class Account {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ unique: true })
  accountNumber!: string;

  @Column({
    type: 'enum',
    enum: AccountType,
    default: AccountType.WALLET,
  })
  type!: AccountType;

  @Column({
    type: 'enum',
    enum: AccountStatus,
    default: AccountStatus.ACTIVE,
  })
  status!: AccountStatus;

  @Column({
    type: 'enum',
    enum: Currency,
    default: Currency.NGN,
  })
  currency!: Currency;

  @Column({ type: 'decimal', precision: 18, scale: 2, default: 0 })
  balance!: number;

  @Column({ type: 'decimal', precision: 18, scale: 2, default: 0 })
  ledgerBalance!: number; // includes pending transactions

  @ManyToOne(() => User, (user) => user.accounts, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'userId' })
  user!: User;

  @Column()
  userId!: string;

  @OneToMany(() => Transaction, (tx) => tx.sourceAccount)
  outgoingTransactions!: Transaction[];

  @OneToMany(() => Transaction, (tx) => tx.destinationAccount)
  incomingTransactions!: Transaction[];

  @CreateDateColumn()
  createdAt!: Date;

  @UpdateDateColumn()
  updatedAt!: Date;
}

export { Currency };
