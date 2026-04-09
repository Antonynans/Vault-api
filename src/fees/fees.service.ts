import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { FeeConfig, FeeType, FeeStatus } from './entities/fee-config.entity';
import { TransactionType } from '../transactions/entities/transaction.entity';

export interface FeeCalculation {
  feeInKobo: number; // fee amount in minor units
  feeInMajor: number; // fee amount in naira/dollars
  ruleApplied: string; // name of the rule used (for audit trail)
  breakdown: string; // human-readable e.g. "1.5% of ₦5,000 = ₦75 (capped at ₦50)"
}

@Injectable()
export class FeesService {
  private readonly logger = new Logger(FeesService.name);

  // In-memory cache — refreshed every 5 minutes to avoid DB hits on every tx
  private cache: FeeConfig[] | null = null;
  private cacheExpiry = 0;
  private readonly CACHE_TTL_MS = 5 * 60 * 1000;

  constructor(
    @InjectRepository(FeeConfig)
    private readonly feeRepo: Repository<FeeConfig>,
  ) {}

  /**
   * Calculate fee for a given transaction.
   * @param type       - transaction type
   * @param amountKobo - transaction amount in minor units
   */
  async calculate(
    type: TransactionType,
    amountKobo: number,
  ): Promise<FeeCalculation> {
    const rules = await this.getActiveRules();

    // Find best matching rule for this type and amount
    const applicable = rules
      .filter(
        (r) => r.transactionType === type && r.status === FeeStatus.ACTIVE,
      )
      .filter((r) => {
        const aboveMin = amountKobo >= Number(r.minTransactionAmount);
        const belowMax =
          Number(r.maxTransactionAmount) === 0 ||
          amountKobo <= Number(r.maxTransactionAmount);
        return aboveMin && belowMax;
      })
      .sort((a, b) => b.priority - a.priority); // highest priority first

    if (applicable.length === 0) {
      // Fallback: no fee rule found — zero fee, log a warning
      this.logger.warn(
        `No fee rule found for type=${type} amount=${amountKobo}. Applying zero fee.`,
      );
      return {
        feeInKobo: 0,
        feeInMajor: 0,
        ruleApplied: 'none',
        breakdown: 'No fee rule configured',
      };
    }

    const rule = applicable[0];
    let rawFeeKobo: number;

    if (rule.feeType === FeeType.FLAT) {
      rawFeeKobo = Number(rule.value); // value stored as kobo for flat fees
    } else {
      // PERCENTAGE — value is the percentage number (e.g. 1.5)
      rawFeeKobo = Math.round((amountKobo * Number(rule.value)) / 100);
    }

    // Apply floor
    if (Number(rule.minimum) > 0) {
      rawFeeKobo = Math.max(rawFeeKobo, Number(rule.minimum));
    }

    // Apply cap
    if (Number(rule.cap) > 0) {
      rawFeeKobo = Math.min(rawFeeKobo, Number(rule.cap));
    }

    const feeInMajor = rawFeeKobo / 100;
    const amountInMajor = amountKobo / 100;

    const breakdown =
      rule.feeType === FeeType.PERCENTAGE
        ? `${rule.value}% of ₦${amountInMajor.toLocaleString()} = ₦${feeInMajor.toLocaleString()}${Number(rule.cap) > 0 ? ` (cap ₦${Number(rule.cap) / 100})` : ''}`
        : `Flat fee ₦${feeInMajor.toLocaleString()}`;

    return {
      feeInKobo: rawFeeKobo,
      feeInMajor,
      ruleApplied: rule.name,
      breakdown,
    };
  }

  async getActiveRules(): Promise<FeeConfig[]> {
    if (this.cache && Date.now() < this.cacheExpiry) return this.cache;

    this.cache = await this.feeRepo.find({
      where: { status: FeeStatus.ACTIVE },
      order: { priority: 'DESC' },
    });
    this.cacheExpiry = Date.now() + this.CACHE_TTL_MS;
    return this.cache;
  }

  invalidateCache(): void {
    this.cache = null;
    this.cacheExpiry = 0;
  }

  async upsert(data: Partial<FeeConfig>): Promise<FeeConfig> {
    this.invalidateCache();
    const config = this.feeRepo.create(data);
    return this.feeRepo.save(config);
  }

  async deactivate(id: string): Promise<void> {
    this.invalidateCache();
    await this.feeRepo.update(id, { status: FeeStatus.INACTIVE });
  }

  async findAll(): Promise<FeeConfig[]> {
    return this.feeRepo.find({
      order: { transactionType: 'ASC', priority: 'DESC' },
    });
  }

  /**
   * Seed default fee rules — call once on first deploy.
   */
  async seedDefaults(): Promise<void> {
    const existing = await this.feeRepo.count();
    if (existing > 0) return;

    await this.feeRepo.save([
      {
        name: 'Standard Transfer Fee',
        transactionType: TransactionType.TRANSFER,
        feeType: FeeType.PERCENTAGE,
        value: 1.5,
        cap: 500_00, // ₦500 cap
        minimum: 10_00, // ₦10 minimum
        minTransactionAmount: 0,
        maxTransactionAmount: 0,
        priority: 1,
        description: '1.5% of transfer amount, min ₦10, max ₦500',
      },
      {
        name: 'Withdrawal Fee',
        transactionType: TransactionType.WITHDRAWAL,
        feeType: FeeType.FLAT,
        value: 2500, // ₦25 flat (in kobo)
        cap: 0,
        minimum: 0,
        minTransactionAmount: 0,
        maxTransactionAmount: 0,
        priority: 1,
        description: '₦25 flat withdrawal fee',
      },
      {
        name: 'Free Deposit',
        transactionType: TransactionType.DEPOSIT,
        feeType: FeeType.FLAT,
        value: 0,
        cap: 0,
        minimum: 0,
        minTransactionAmount: 0,
        maxTransactionAmount: 0,
        priority: 1,
        description: 'No fee on deposits',
      },
    ]);

    this.logger.log('Default fee rules seeded');
  }
}
