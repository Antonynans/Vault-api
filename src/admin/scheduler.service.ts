import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, LessThan } from 'typeorm';
import {
  Transaction,
  TransactionStatus,
} from '../transactions/entities/transaction.entity';
import { NotificationsService } from '../notifications/notifications.service';
import { AuditLog } from '../audit/entities/audit-log.entity';

@Injectable()
export class SchedulerService {
  private readonly logger = new Logger(SchedulerService.name);

  constructor(
    @InjectRepository(Transaction)
    private readonly txRepo: Repository<Transaction>,
    @InjectRepository(AuditLog)
    private readonly auditRepo: Repository<AuditLog>,
    private readonly notificationsService: NotificationsService,
  ) {}

  /**
   * Every hour: mark any PENDING transactions older than 30 minutes as FAILED.
   */
  @Cron(CronExpression.EVERY_HOUR)
  async expireStuckTransactions() {
    const cutoff = new Date(Date.now() - 30 * 60 * 1000); // 30 min ago
    const result = await this.txRepo.update(
      { status: TransactionStatus.PENDING, createdAt: LessThan(cutoff) },
      {
        status: TransactionStatus.FAILED,
        failureReason: 'Transaction expired — timed out',
      },
    );

    if (result.affected && result.affected > 0) {
      this.logger.warn(
        `Expired ${result.affected} stuck pending transaction(s)`,
      );
    }
  }

  /**
   * Every day at 2:00 AM: purge read notifications older than 90 days.
   */
  @Cron('0 2 * * *')
  async purgeOldNotifications() {
    this.logger.log('Running notification cleanup...');
    await this.notificationsService.deleteOld();
    this.logger.log('Notification cleanup complete');
  }

  /**
   * Every Sunday at 3:00 AM: purge audit logs older than 1 year.
   */
  @Cron('0 3 * * 0')
  async purgeOldAuditLogs() {
    const cutoff = new Date(Date.now() - 365 * 24 * 60 * 60 * 1000);
    const result = await this.auditRepo.delete({ createdAt: LessThan(cutoff) });
    if (result.affected) {
      this.logger.log(`Purged ${result.affected} old audit log entries`);
    }
  }
}
