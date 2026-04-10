import {
  Injectable,
  CanActivate,
  ExecutionContext,
  ConflictException,
  Logger,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Transaction } from '../../transactions/entities/transaction.entity';
import { Request } from 'express';

@Injectable()
export class IdempotencyGuard implements CanActivate {
  private readonly logger = new Logger(IdempotencyGuard.name);

  constructor(
    @InjectRepository(Transaction)
    private readonly txRepo: Repository<Transaction>,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<Request>();
    const rawKey = request.headers['idempotency-key'];
    const key = Array.isArray(rawKey) ? rawKey[0] : rawKey;
    if (!key) return true;

    const uuidRegex =
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    if (!uuidRegex.test(key)) return true;

    const cutoff = new Date(Date.now() - 24 * 60 * 60 * 1000);
    const existing = await this.txRepo
      .createQueryBuilder('tx')
      .where("tx.metadata::jsonb ->> 'idempotencyKey' = :key", { key })
      .andWhere('tx.createdAt > :cutoff', { cutoff })
      .getOne();

    if (existing) {
      this.logger.warn(`Duplicate idempotency key: ${key}`);
      throw new ConflictException({
        message: 'Duplicate request — this idempotency key was already used',
        existingTransactionId: existing.id,
        existingReference: existing.reference,
      });
    }

    request.idempotencyKey = key;
    return true;
  }
}
