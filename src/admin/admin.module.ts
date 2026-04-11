import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AdminService } from './admin.service';
import { AdminController } from './admin.controller';
import { SchedulerService } from './scheduler.service';
import { User } from '../users/entities/user.entity';
import { Account } from '../accounts/entities/account.entity';
import { Transaction } from '../transactions/entities/transaction.entity';
import { KycSubmission } from '../kyc/entities/kyc-submission.entity';
import { AuditLog } from '../audit/entities/audit-log.entity';
import { NotificationsModule } from '../notifications/notifications.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      User,
      Account,
      Transaction,
      KycSubmission,
      AuditLog,
    ]),
    NotificationsModule,
  ],
  providers: [AdminService, SchedulerService],
  controllers: [AdminController],
})
export class AdminModule {}
