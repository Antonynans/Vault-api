import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  OneToOne,
  JoinColumn,
} from 'typeorm';
import { User } from '../../users/entities/user.entity';

export enum DocumentType {
  NIN = 'nin',
  BVN = 'bvn',
  INTL_PASSPORT = 'intl_passport',
  DRIVERS_LICENSE = 'drivers_license',
  VOTERS_CARD = 'voters_card',
}

export enum KycSubmissionStatus {
  DRAFT = 'draft',
  SUBMITTED = 'submitted',
  UNDER_REVIEW = 'under_review',
  APPROVED = 'approved',
  REJECTED = 'rejected',
}

@Entity('kyc_submissions')
export class KycSubmission {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @OneToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'userId' })
  user!: User;

  @Column({ unique: true })
  userId!: string;

  @Column({ type: 'enum', enum: DocumentType })
  documentType!: DocumentType;

  @Column()
  documentNumber!: string;

  @Column({ nullable: true })
  documentFrontUrl!: string;

  @Column({ nullable: true })
  documentBackUrl!: string;

  @Column({ nullable: true })
  selfieUrl!: string;

  @Column({
    type: 'enum',
    enum: KycSubmissionStatus,
    default: KycSubmissionStatus.DRAFT,
  })
  status!: KycSubmissionStatus;

  @Column({ type: 'text', nullable: true })
  rejectionReason!: string | null;

  @Column({ nullable: true })
  reviewedBy!: string;

  @Column({ type: 'timestamptz', nullable: true })
  reviewedAt!: Date | null;

  @Column({ type: 'jsonb', nullable: true })
  verificationData!: Record<string, unknown>;

  @CreateDateColumn()
  createdAt!: Date;

  @UpdateDateColumn()
  updatedAt!: Date;
}
