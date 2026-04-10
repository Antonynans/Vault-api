import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  Index,
} from 'typeorm';

@Entity('beneficiaries')
@Index(['userId', 'accountNumber'], { unique: true })
export class Beneficiary {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column()
  @Index()
  userId!: string;

  @Column()
  accountNumber!: string;

  @Column()
  accountName!: string;

  @Column({ nullable: true })
  bankName!: string;

  @Column({ nullable: true })
  bankCode!: string;

  @Column({ nullable: true })
  nickname!: string;

  @Column({ default: 0 })
  transferCount!: number;

  @Column({ nullable: true })
  lastTransferAt!: Date;

  @Column({ default: true })
  isActive!: boolean;

  @CreateDateColumn()
  createdAt!: Date;

  @UpdateDateColumn()
  updatedAt!: Date;
}
