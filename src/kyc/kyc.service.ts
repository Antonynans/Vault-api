import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import {
  KycSubmission,
  KycSubmissionStatus,
} from './entities/kyc-submission.entity';
import { SubmitKycDto, ReviewKycDto } from './dto/kyc.dto';
import { UsersService } from '../users/users.service';
import { WalletsService } from '../wallets/wallets.service';
import { AuditService } from '../audit/audit.service';
import { AuditAction } from '../audit/entities/audit-log.entity';
import { KycStatus } from '../users/entities/user.entity';
import { WalletTier } from '../wallets/entities/wallet.entity';

@Injectable()
export class KycService {
  constructor(
    @InjectRepository(KycSubmission)
    private readonly kycRepo: Repository<KycSubmission>,
    private readonly usersService: UsersService,
    private readonly walletsService: WalletsService,
    private readonly auditService: AuditService,
  ) {}

  async submit(userId: string, dto: SubmitKycDto): Promise<KycSubmission> {
    const existing = await this.kycRepo.findOne({ where: { userId } });

    if (existing && existing.status !== KycSubmissionStatus.REJECTED) {
      throw new BadRequestException(
        `KYC is already ${existing.status}. Re-submission only allowed after rejection.`,
      );
    }

    if (existing) {
      Object.assign(existing, dto, {
        status: KycSubmissionStatus.SUBMITTED,
        rejectionReason: null,
        reviewedBy: null,
        reviewedAt: null,
      });
      const saved = await this.kycRepo.save(existing);
      this.auditService.log(AuditAction.KYC_SUBMITTED, {
        userId,
        resourceId: saved.id,
        resourceType: 'kyc',
      });
      return saved;
    }

    const submission = this.kycRepo.create({
      userId,
      ...dto,
      status: KycSubmissionStatus.SUBMITTED,
    });
    const saved = await this.kycRepo.save(submission);
    this.auditService.log(AuditAction.KYC_SUBMITTED, {
      userId,
      resourceId: saved.id,
      resourceType: 'kyc',
    });
    return saved;
  }

  async getMySubmission(userId: string): Promise<KycSubmission> {
    const s = await this.kycRepo.findOne({ where: { userId } });
    if (!s) throw new NotFoundException('No KYC submission found');
    return s;
  }

  async review(
    submissionId: string,
    reviewerId: string,
    dto: ReviewKycDto,
  ): Promise<KycSubmission> {
    const s = await this.kycRepo.findOne({ where: { id: submissionId } });
    if (!s) throw new NotFoundException('KYC submission not found');
    if (s.status === KycSubmissionStatus.APPROVED)
      throw new BadRequestException('Already approved');
    if (dto.decision === 'rejected' && !dto.rejectionReason) {
      throw new BadRequestException('Rejection reason is required');
    }

    s.status =
      dto.decision === 'approved'
        ? KycSubmissionStatus.APPROVED
        : KycSubmissionStatus.REJECTED;
    s.reviewedBy = reviewerId;
    s.reviewedAt = new Date();
    s.rejectionReason = dto.rejectionReason ?? null;
    await this.kycRepo.save(s);

    if (dto.decision === 'approved') {
      await this.upgradeUserAfterKyc(s.userId);
      this.auditService.log(AuditAction.KYC_APPROVED, {
        userId: s.userId,
        resourceId: submissionId,
        resourceType: 'kyc',
        metadata: { reviewedBy: reviewerId },
      });
    } else {
      await this.kycRepo.manager
        .getRepository('users')
        .update(s.userId, { kycStatus: KycStatus.REJECTED });
      this.auditService.log(AuditAction.KYC_REJECTED, {
        userId: s.userId,
        resourceId: submissionId,
        resourceType: 'kyc',
        metadata: { reason: dto.rejectionReason },
      });
    }
    return s;
  }

  private async upgradeUserAfterKyc(userId: string): Promise<void> {
    await this.kycRepo.manager
      .getRepository('users')
      .update(userId, { kycStatus: KycStatus.VERIFIED });
    const user = await this.usersService.findById(userId);
    for (const account of user?.accounts ?? []) {
      try {
        await this.walletsService.upgradeTier(account.id, WalletTier.STANDARD);
      } catch {
        /* skip */
      }
    }
  }

  async findPending(): Promise<KycSubmission[]> {
    return this.kycRepo.find({
      where: { status: KycSubmissionStatus.SUBMITTED },
      order: { createdAt: 'ASC' },
    });
  }

  async findAll(): Promise<KycSubmission[]> {
    return this.kycRepo.find({ order: { createdAt: 'DESC' } });
  }
}
