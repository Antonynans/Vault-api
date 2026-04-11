import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { MoreThanOrEqual, Repository } from 'typeorm';
import { User } from '../users/entities/user.entity';
import { Account } from '../accounts/entities/account.entity';
import {
  Transaction,
  TransactionStatus,
  // TransactionType,
} from '../transactions/entities/transaction.entity';
import {
  KycSubmission,
  KycSubmissionStatus,
} from '../kyc/entities/kyc-submission.entity';
import { AuditLog } from '../audit/entities/audit-log.entity';
import {
  DailyVolumeRow,
  MonthlyVolumeResult,
  TypeBreakdownRow,
  UserGrowthRow,
  VolumeResult,
} from './admin.types';

@Injectable()
export class AdminService {
  constructor(
    @InjectRepository(User) private readonly userRepo: Repository<User>,
    @InjectRepository(Account)
    private readonly accountRepo: Repository<Account>,
    @InjectRepository(Transaction)
    private readonly txRepo: Repository<Transaction>,
    @InjectRepository(KycSubmission)
    private readonly kycRepo: Repository<KycSubmission>,
    @InjectRepository(AuditLog)
    private readonly auditRepo: Repository<AuditLog>,
  ) {}

  async getDashboardStats() {
    const now = new Date();
    const startOfDay = new Date(
      now.getFullYear(),
      now.getMonth(),
      now.getDate(),
    );
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const last30Days = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

    const [
      totalUsers,
      activeUsers,
      newUsersToday,
      newUsersThisMonth,
      totalAccounts,
      totalTransactions,
      completedTransactions,
      failedTransactions,
      txToday,
      txThisMonth,
      pendingKyc,
      approvedKyc,
    ] = await Promise.all([
      this.userRepo.count(),
      this.userRepo.count({ where: { isActive: true } }),
      this.userRepo.count({
        where: { createdAt: MoreThanOrEqual(startOfDay) },
      }),
      this.userRepo.count({
        where: { createdAt: MoreThanOrEqual(startOfMonth) },
      }),

      this.accountRepo.count(),
      this.txRepo.count(),
      this.txRepo.count({ where: { status: TransactionStatus.COMPLETED } }),
      this.txRepo.count({ where: { status: TransactionStatus.FAILED } }),
      this.txRepo.count({
        where: {
          status: TransactionStatus.COMPLETED,
          createdAt: MoreThanOrEqual(startOfDay),
        },
      }),
      this.txRepo.count({
        where: {
          status: TransactionStatus.COMPLETED,
          createdAt: MoreThanOrEqual(startOfMonth),
        },
      }),
      this.kycRepo.count({ where: { status: KycSubmissionStatus.SUBMITTED } }),
      this.kycRepo.count({ where: { status: KycSubmissionStatus.APPROVED } }),
    ]);

    const volumeResult = await this.txRepo
      .createQueryBuilder('tx')
      .select('SUM(tx.amount)', 'totalVolume')
      .addSelect('SUM(tx.fee)', 'totalFees')
      .where('tx.status = :status', { status: TransactionStatus.COMPLETED })
      .getRawOne<VolumeResult>();

    const monthlyVolumeResult = await this.txRepo
      .createQueryBuilder('tx')
      .select('SUM(tx.amount)', 'volume')
      .where('tx.status = :status', { status: TransactionStatus.COMPLETED })
      .andWhere('tx.createdAt >= :start', { start: startOfMonth })
      .getRawOne<MonthlyVolumeResult>();

    const typeBreakdown = await this.txRepo
      .createQueryBuilder('tx')
      .select('tx.type', 'type')
      .addSelect('COUNT(*)', 'count')
      .addSelect('SUM(tx.amount)', 'volume')
      .where('tx.status = :status', { status: TransactionStatus.COMPLETED })
      .groupBy('tx.type')
      .getRawMany<TypeBreakdownRow>();

    const dailyVolume = await this.txRepo
      .createQueryBuilder('tx')
      .select("TO_CHAR(tx.createdAt, 'YYYY-MM-DD')", 'date')
      .addSelect('COUNT(*)', 'count')
      .addSelect('COALESCE(SUM(tx.amount), 0)', 'volume')
      .where('tx.status = :status', { status: TransactionStatus.COMPLETED })
      .andWhere('tx.createdAt >= :since', { since: last30Days })
      .groupBy("TO_CHAR(tx.createdAt, 'YYYY-MM-DD')")
      .orderBy('date', 'ASC')
      .getRawMany<DailyVolumeRow>();

    const suspiciousEvents = await this.auditRepo.find({
      where: { isSuspicious: true },
      order: { createdAt: 'DESC' },
      take: 10,
    });

    const successRate =
      totalTransactions > 0
        ? parseFloat(
            ((completedTransactions / totalTransactions) * 100).toFixed(2),
          )
        : 0;

    return {
      users: {
        total: totalUsers,
        active: activeUsers,
        inactive: totalUsers - activeUsers,
        newToday: newUsersToday,
        newThisMonth: newUsersThisMonth,
      },
      accounts: {
        total: totalAccounts,
      },
      transactions: {
        total: totalTransactions,
        completed: completedTransactions,
        failed: failedTransactions,
        successRate: `${successRate}%`,
        today: txToday,
        thisMonth: txThisMonth,
        totalVolume: parseFloat(volumeResult?.totalVolume ?? '0'),
        totalFees: parseFloat(volumeResult?.totalFees ?? '0'),
        monthlyVolume: parseFloat(monthlyVolumeResult?.volume ?? '0'),
        byType: typeBreakdown.map((r) => ({
          type: r.type,
          count: parseInt(r.count, 10),
          volume: parseFloat(r.volume ?? '0'),
        })),
        dailyVolume: dailyVolume.map((r) => ({
          date: r.date,
          count: parseInt(r.count, 10),
          volume: parseFloat(r.volume),
        })),
      },
      kyc: {
        pending: pendingKyc,
        approved: approvedKyc,
        approvalRate:
          approvedKyc + pendingKyc > 0
            ? `${((approvedKyc / (approvedKyc + pendingKyc)) * 100).toFixed(1)}%`
            : '0%',
      },
      security: {
        recentSuspiciousEvents: suspiciousEvents,
      },
      generatedAt: now.toISOString(),
    };
  }

  async getUserGrowth(days = 30) {
    const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
    return this.userRepo
      .createQueryBuilder('u')
      .select("TO_CHAR(u.createdAt, 'YYYY-MM-DD')", 'date')
      .addSelect('COUNT(*)', 'count')
      .where('u.createdAt >= :since', { since })
      .groupBy("TO_CHAR(u.createdAt, 'YYYY-MM-DD')")
      .orderBy('date', 'ASC')
      .getRawMany<UserGrowthRow>();
  }
}
