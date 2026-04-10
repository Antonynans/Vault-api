import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { AuditLog, AuditAction } from './entities/audit-log.entity';
import { getErrorMessage } from '../common/utils/error';

export interface AuditContext {
  userId?: string;
  ipAddress?: string;
  userAgent?: string;
  resourceId?: string;
  resourceType?: string;
  metadata?: Record<string, any>;
  isSuspicious?: boolean;
}

@Injectable()
export class AuditService {
  private readonly logger = new Logger(AuditService.name);

  constructor(
    @InjectRepository(AuditLog)
    private readonly auditRepo: Repository<AuditLog>,
  ) {}

  /** Fire-and-forget — never throws, never blocks the caller */
  log(action: AuditAction, context: AuditContext = {}): void {
    const entry = this.auditRepo.create({ action, ...context });
    this.auditRepo.save(entry).catch((err) => {
      const message = getErrorMessage(err);
      this.logger.error(`Audit write failed [${action}]: ${message}`);
    });
  }

  async findByUser(
    userId: string,
    limit = 50,
    offset = 0,
  ): Promise<[AuditLog[], number]> {
    return this.auditRepo.findAndCount({
      where: { userId },
      order: { createdAt: 'DESC' },
      take: limit,
      skip: offset,
    });
  }

  async findAll(limit = 100, offset = 0): Promise<[AuditLog[], number]> {
    return this.auditRepo.findAndCount({
      order: { createdAt: 'DESC' },
      take: limit,
      skip: offset,
    });
  }

  async findSuspicious(): Promise<AuditLog[]> {
    return this.auditRepo.find({
      where: { isSuspicious: true },
      order: { createdAt: 'DESC' },
      take: 200,
    });
  }
}
