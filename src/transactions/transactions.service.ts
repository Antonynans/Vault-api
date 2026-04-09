import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource } from 'typeorm';
import { EventEmitter2 } from '@nestjs/event-emitter';
import {
  Transaction,
  TransactionStatus,
  TransactionType,
} from './entities/transaction.entity';
import { AccountsService } from '../accounts/accounts.service';
import { AuditService } from '../audit/audit.service';
import { AuditAction } from '../audit/entities/audit-log.entity';
import {
  InitiateTransferDto,
  DepositDto,
  WithdrawalDto,
} from './dto/transaction.dto';
import {
  EVENTS,
  TransferCompletedEvent,
  TransferFailedEvent,
  DepositCompletedEvent,
  WithdrawalCompletedEvent,
} from '../events/domain-events';
import { v4 as uuidv4 } from 'uuid';
import { FeesService } from '../fees/fees.service';

export interface PaginatedResult<T> {
  data: T[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

@Injectable()
export class TransactionsService {
  constructor(
    @InjectRepository(Transaction)
    private readonly txRepo: Repository<Transaction>,
    private readonly accountsService: AccountsService,
    private readonly auditService: AuditService,
    private readonly eventEmitter: EventEmitter2,
    private readonly feesService: FeesService,
    private readonly dataSource: DataSource,
  ) {}

  private generateReference(): string {
    const date = new Date().toISOString().slice(0, 10).replace(/-/g, '');
    const unique = uuidv4().replace(/-/g, '').slice(0, 8).toUpperCase();
    return `TXN-${date}-${unique}`;
  }

  private paginate<T>(
    data: T[],
    total: number,
    page: number,
    limit: number,
  ): PaginatedResult<T> {
    return { data, total, page, limit, totalPages: Math.ceil(total / limit) };
  }

  // ── Transfer ─────────────────────────────────────────────────────────────────
  async transfer(
    userId: string,
    dto: InitiateTransferDto,
    idempotencyKey?: string,
  ): Promise<Transaction> {
    const src = await this.accountsService.findOne(dto.sourceAccountId, userId);
    const dest = await this.accountsService.findByAccountNumber(
      dto.destinationAccountNumber,
    );

    if (!dest) throw new NotFoundException('Destination account not found');
    if (src.id === dest.id)
      throw new BadRequestException('Cannot transfer to the same account');
    if (src.currency !== dest.currency)
      throw new BadRequestException('Cross-currency transfers not supported');

    const feeCalc = await this.feesService.calculate(
      TransactionType.TRANSFER,
      Math.round(dto.amount * 100),
    );
    const fee = feeCalc.feeInMajor;
    const totalDebit = dto.amount + fee;

    const qr = this.dataSource.createQueryRunner();
    await qr.connect();
    await qr.startTransaction();

    const tx = this.txRepo.create({
      reference: this.generateReference(),
      type: TransactionType.TRANSFER,
      status: TransactionStatus.PENDING,
      amount: dto.amount,
      fee,
      currency: src.currency,
      description: dto.description ?? 'Transfer',
      sourceAccountId: src.id,
      destinationAccountId: dest.id,
      metadata: idempotencyKey ? JSON.stringify({ idempotencyKey }) : undefined,
    });

    this.auditService.log(AuditAction.TRANSFER_INITIATED, {
      userId,
      resourceId: tx.reference,
      resourceType: 'transaction',
      metadata: {
        amount: dto.amount,
        fee,
        destination: dto.destinationAccountNumber,
      },
    });

    try {
      await qr.manager.save(tx);
      await this.accountsService.debitAccount(src.id, totalDebit, qr);
      await this.accountsService.creditAccount(dest.id, dto.amount, qr);

      tx.status = TransactionStatus.COMPLETED;
      await qr.manager.save(tx);
      await qr.commitTransaction();

      this.auditService.log(AuditAction.TRANSFER_COMPLETED, {
        userId,
        resourceId: tx.id,
        resourceType: 'transaction',
      });

      this.eventEmitter.emit(EVENTS.TRANSFER_COMPLETED, {
        transactionId: tx.id,
        reference: tx.reference,
        senderId: userId,
        senderAccountId: src.id,
        receiverAccountId: dest.id,
        amount: dto.amount,
        fee,
        currency: src.currency,
      } satisfies TransferCompletedEvent);

      return tx;
    } catch (err) {
      await qr.rollbackTransaction();
      tx.status = TransactionStatus.FAILED;
      tx.failureReason = err.message;
      await this.txRepo.save(tx);

      this.auditService.log(AuditAction.TRANSFER_FAILED, {
        userId,
        resourceId: tx.reference,
        resourceType: 'transaction',
        metadata: { reason: err.message },
      });
      this.eventEmitter.emit(EVENTS.TRANSFER_FAILED, {
        reference: tx.reference,
        userId,
        amount: dto.amount,
        reason: err.message,
      } satisfies TransferFailedEvent);

      throw err;
    } finally {
      await qr.release();
    }
  }

  // ── Deposit ───────────────────────────────────────────────────────────────────
  async deposit(dto: DepositDto): Promise<Transaction> {
    const account = await this.accountsService.findOne(dto.accountId);
    const qr = this.dataSource.createQueryRunner();
    await qr.connect();
    await qr.startTransaction();

    const tx = this.txRepo.create({
      reference: this.generateReference(),
      type: TransactionType.DEPOSIT,
      status: TransactionStatus.PENDING,
      amount: dto.amount,
      fee: 0,
      currency: account.currency,
      description: dto.description ?? 'Deposit',
      destinationAccountId: account.id,
    });

    try {
      await qr.manager.save(tx);
      await this.accountsService.creditAccount(account.id, dto.amount, qr);
      tx.status = TransactionStatus.COMPLETED;
      await qr.manager.save(tx);
      await qr.commitTransaction();

      this.auditService.log(AuditAction.DEPOSIT_COMPLETED, {
        userId: account.userId,
        resourceId: tx.id,
        resourceType: 'transaction',
      });
      this.eventEmitter.emit(EVENTS.DEPOSIT_COMPLETED, {
        transactionId: tx.id,
        reference: tx.reference,
        accountId: account.id,
        userId: account.userId,
        amount: dto.amount,
        currency: account.currency,
      } satisfies DepositCompletedEvent);

      return tx;
    } catch (err) {
      await qr.rollbackTransaction();
      tx.status = TransactionStatus.FAILED;
      tx.failureReason = err.message;
      await this.txRepo.save(tx);
      throw err;
    } finally {
      await qr.release();
    }
  }

  // ── Withdrawal ────────────────────────────────────────────────────────────────
  async withdraw(
    userId: string,
    dto: WithdrawalDto,
    idempotencyKey?: string,
  ): Promise<Transaction> {
    const account = await this.accountsService.findOne(dto.accountId, userId);
    const qr = this.dataSource.createQueryRunner();
    await qr.connect();
    await qr.startTransaction();

    const tx = this.txRepo.create({
      reference: this.generateReference(),
      type: TransactionType.WITHDRAWAL,
      status: TransactionStatus.PENDING,
      amount: dto.amount,
      fee: 0,
      currency: account.currency,
      description: dto.description ?? 'Withdrawal',
      sourceAccountId: account.id,
      metadata: idempotencyKey ? JSON.stringify({ idempotencyKey }) : undefined,
    });

    try {
      await qr.manager.save(tx);
      await this.accountsService.debitAccount(account.id, dto.amount, qr);
      tx.status = TransactionStatus.COMPLETED;
      await qr.manager.save(tx);
      await qr.commitTransaction();

      this.auditService.log(AuditAction.WITHDRAWAL_COMPLETED, {
        userId,
        resourceId: tx.id,
        resourceType: 'transaction',
      });
      this.eventEmitter.emit(EVENTS.WITHDRAWAL_COMPLETED, {
        transactionId: tx.id,
        reference: tx.reference,
        accountId: account.id,
        userId,
        amount: dto.amount,
        currency: account.currency,
      } satisfies WithdrawalCompletedEvent);

      return tx;
    } catch (err) {
      await qr.rollbackTransaction();
      tx.status = TransactionStatus.FAILED;
      tx.failureReason = err.message;
      await this.txRepo.save(tx);
      throw err;
    } finally {
      await qr.release();
    }
  }

  // ── Queries ───────────────────────────────────────────────────────────────────
  async findByAccount(
    accountId: string,
    userId: string,
    page = 1,
    limit = 20,
  ): Promise<PaginatedResult<Transaction>> {
    await this.accountsService.findOne(accountId, userId);
    const [data, total] = await this.txRepo
      .createQueryBuilder('tx')
      .where('tx.sourceAccountId = :id OR tx.destinationAccountId = :id', {
        id: accountId,
      })
      .orderBy('tx.createdAt', 'DESC')
      .skip((page - 1) * limit)
      .take(Math.min(limit, 100))
      .getManyAndCount();
    return this.paginate(data, total, page, limit);
  }

  async findByReference(reference: string): Promise<Transaction> {
    const tx = await this.txRepo.findOne({ where: { reference } });
    if (!tx) throw new NotFoundException('Transaction not found');
    return tx;
  }

  async findAll(page = 1, limit = 50): Promise<PaginatedResult<Transaction>> {
    const [data, total] = await this.txRepo.findAndCount({
      order: { createdAt: 'DESC' },
      skip: (page - 1) * limit,
      take: Math.min(limit, 100),
    });
    return this.paginate(data, total, page, limit);
  }

  // ── Stats helpers (used by AdminService) ─────────────────────────────────────
  async getDailyVolume(
    days = 30,
  ): Promise<{ date: string; volume: number; count: number }[]> {
    return this.txRepo
      .createQueryBuilder('tx')
      .select('DATE(tx.createdAt) AS date')
      .addSelect('SUM(tx.amount)', 'volume')
      .addSelect('COUNT(*)', 'count')
      .where("tx.status = 'completed'")
      .andWhere("tx.createdAt >= NOW() - INTERVAL ':days days'", { days })
      .groupBy('DATE(tx.createdAt)')
      .orderBy('date', 'ASC')
      .getRawMany();
  }
}
