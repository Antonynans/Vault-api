import {
  Injectable,
  NotFoundException,
  ForbiddenException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { FindOptionsWhere, Repository } from 'typeorm';
import { OnEvent } from '@nestjs/event-emitter';
import {
  Notification,
  NotificationType,
  // NotificationChannel,
  NotificationStatus,
} from './entities/notification.entity';
import {
  EVENTS,
  TransferCompletedEvent,
  TransferFailedEvent,
  DepositCompletedEvent,
  WithdrawalCompletedEvent,
  KycApprovedEvent,
  KycRejectedEvent,
  KycSubmittedEvent,
  UserRegisteredEvent,
} from '../events/domain-events';

@Injectable()
export class NotificationsService {
  constructor(
    @InjectRepository(Notification)
    private readonly notifRepo: Repository<Notification>,
  ) {}

  private async create(
    userId: string,
    type: NotificationType,
    title: string,
    body: string,
    data?: Record<string, unknown>,
  ): Promise<Notification> {
    const notif = this.notifRepo.create({
      userId,
      type,
      title,
      body,
      data,
      status: NotificationStatus.SENT,
    });
    return this.notifRepo.save(notif);
  }

  async findForUser(userId: string, page = 1, limit = 20, unreadOnly = false) {
    const offset = (page - 1) * limit;
    const where: FindOptionsWhere<Notification> = { userId };
    if (unreadOnly) where.isRead = false;

    const [data, total] = await this.notifRepo.findAndCount({
      where,
      order: { createdAt: 'DESC' },
      take: Math.min(limit, 50),
      skip: offset,
    });

    return {
      data,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
      unreadCount: unreadOnly ? total : await this.countUnread(userId),
    };
  }

  async markAsRead(notifId: string, userId: string): Promise<Notification> {
    const notif = await this.notifRepo.findOne({ where: { id: notifId } });
    if (!notif) throw new NotFoundException('Notification not found');
    if (notif.userId !== userId) throw new ForbiddenException('Access denied');

    notif.isRead = true;
    notif.readAt = new Date();
    notif.status = NotificationStatus.READ;
    return this.notifRepo.save(notif);
  }

  async markAllAsRead(userId: string): Promise<{ updated: number }> {
    const result = await this.notifRepo.update(
      { userId, isRead: false },
      { isRead: true, readAt: new Date(), status: NotificationStatus.READ },
    );
    return { updated: result.affected ?? 0 };
  }

  async countUnread(userId: string): Promise<number> {
    return this.notifRepo.count({ where: { userId, isRead: false } });
  }

  async deleteOld(): Promise<void> {
    const cutoff = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000); // 90 days
    await this.notifRepo
      .createQueryBuilder()
      .delete()
      .where('createdAt < :cutoff AND isRead = true', { cutoff })
      .execute();
  }

  @OnEvent(EVENTS.USER_REGISTERED)
  async onUserRegistered(event: UserRegisteredEvent) {
    await this.create(
      event.userId,
      NotificationType.SYSTEM_ANNOUNCEMENT,
      `Welcome, ${event.firstName}! 🎉`,
      'Your account is ready. Complete KYC to unlock higher limits.',
    );
  }

  @OnEvent(EVENTS.TRANSFER_COMPLETED)
  async onTransferCompleted(event: TransferCompletedEvent) {
    await this.create(
      event.senderId,
      NotificationType.TRANSACTION_DEBIT,
      'Transfer Successful',
      `You sent ${event.currency} ${event.amount.toLocaleString()}. Ref: ${event.reference}`,
      {
        transactionId: event.transactionId,
        reference: event.reference,
        amount: event.amount,
      },
    );
  }

  @OnEvent(EVENTS.TRANSFER_FAILED)
  async onTransferFailed(event: TransferFailedEvent) {
    await this.create(
      event.userId,
      NotificationType.TRANSACTION_FAILED,
      'Transfer Failed',
      `Your transfer of ${event.amount.toLocaleString()} could not be completed. ${event.reason}`,
      { reference: event.reference, reason: event.reason },
    );
  }

  @OnEvent(EVENTS.DEPOSIT_COMPLETED)
  async onDepositCompleted(event: DepositCompletedEvent) {
    await this.create(
      event.userId,
      NotificationType.TRANSACTION_CREDIT,
      'Account Credited',
      `${event.currency} ${event.amount.toLocaleString()} has been added to your account. Ref: ${event.reference}`,
      { transactionId: event.transactionId, amount: event.amount },
    );
  }

  @OnEvent(EVENTS.WITHDRAWAL_COMPLETED)
  async onWithdrawalCompleted(event: WithdrawalCompletedEvent) {
    await this.create(
      event.userId,
      NotificationType.TRANSACTION_DEBIT,
      'Withdrawal Successful',
      `${event.currency} ${event.amount.toLocaleString()} has been withdrawn. Ref: ${event.reference}`,
      { transactionId: event.transactionId, amount: event.amount },
    );
  }

  @OnEvent(EVENTS.KYC_SUBMITTED)
  async onKycSubmitted(event: KycSubmittedEvent) {
    await this.create(
      event.userId,
      NotificationType.KYC_SUBMITTED,
      'KYC Under Review',
      'Your documents have been received and are under review. We will notify you within 24 hours.',
      { submissionId: event.submissionId },
    );
  }

  @OnEvent(EVENTS.KYC_APPROVED)
  async onKycApproved(event: KycApprovedEvent) {
    await this.create(
      event.userId,
      NotificationType.KYC_APPROVED,
      'KYC Approved',
      'Your identity has been verified. Your wallet limits have been upgraded to Standard tier.',
      { submissionId: event.submissionId },
    );
  }

  @OnEvent(EVENTS.KYC_REJECTED)
  async onKycRejected(event: KycRejectedEvent) {
    await this.create(
      event.userId,
      NotificationType.KYC_REJECTED,
      'KYC Rejected',
      `Your KYC submission was not approved. Reason: ${event.reason}. Please re-submit with correct documents.`,
      { submissionId: event.submissionId, reason: event.reason },
    );
  }
}
