import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { FeesService } from '../../src/fees/fees.service';
import {
  FeeConfig,
  FeeType,
  FeeStatus,
} from '../../src/fees/entities/fee-config.entity';
import { TransactionType } from '../../src/transactions/entities/transaction.entity';

const makeFeeConfig = (overrides: Partial<FeeConfig> = {}): FeeConfig =>
  ({
    id: 'fee-001',
    name: 'Standard Transfer Fee',
    transactionType: TransactionType.TRANSFER,
    feeType: FeeType.PERCENTAGE,
    value: 1.5,
    cap: 50_000, // ₦500 cap in kobo
    minimum: 1_000, // ₦10 minimum in kobo
    minTransactionAmount: 0,
    maxTransactionAmount: 0,
    status: FeeStatus.ACTIVE,
    priority: 1,
    description: '1.5% of amount',
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  }) as FeeConfig;

const feeRepoMock = {
  find: jest.fn(),
  findOne: jest.fn(),
  create: jest.fn(),
  save: jest.fn(),
  update: jest.fn(),
  count: jest.fn(),
};

describe('FeesService', () => {
  let service: FeesService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        FeesService,
        { provide: getRepositoryToken(FeeConfig), useValue: feeRepoMock },
      ],
    }).compile();

    service = module.get<FeesService>(FeesService);
    // Clear cache between tests
    service.invalidateCache();
    jest.clearAllMocks();
  });

  describe('calculate — percentage fee', () => {
    it('calculates 1.5% correctly', async () => {
      feeRepoMock.find.mockResolvedValue([makeFeeConfig()]);

      // ₦5,000 = 500_000 kobo
      const result = await service.calculate(TransactionType.TRANSFER, 500_000);

      expect(result.feeInKobo).toBe(7_500); // 1.5% of 500,000 = 7,500 kobo = ₦75
      expect(result.feeInMajor).toBe(75);
      expect(result.ruleApplied).toBe('Standard Transfer Fee');
    });

    it('applies the fee cap', async () => {
      feeRepoMock.find.mockResolvedValue([makeFeeConfig()]);

      // ₦100,000 = 10,000,000 kobo → 1.5% = 150,000 kobo → capped at 50,000 (₦500)
      const result = await service.calculate(
        TransactionType.TRANSFER,
        10_000_000,
      );

      expect(result.feeInKobo).toBe(50_000); // ₦500 cap
      expect(result.feeInMajor).toBe(500);
    });

    it('applies the minimum fee', async () => {
      feeRepoMock.find.mockResolvedValue([makeFeeConfig()]);

      // ₦100 = 10,000 kobo → 1.5% = 150 kobo → minimum is 1,000 kobo (₦10)
      const result = await service.calculate(TransactionType.TRANSFER, 10_000);

      expect(result.feeInKobo).toBe(1_000); // ₦10 minimum
      expect(result.feeInMajor).toBe(10);
    });
  });

  describe('calculate — flat fee', () => {
    it('returns flat fee amount unchanged', async () => {
      feeRepoMock.find.mockResolvedValue([
        makeFeeConfig({
          transactionType: TransactionType.WITHDRAWAL,
          feeType: FeeType.FLAT,
          value: 2_500,
          cap: 0,
          minimum: 0,
          minTransactionAmount: 0,
          maxTransactionAmount: 0,
        }),
      ]);

      const result = await service.calculate(
        TransactionType.WITHDRAWAL,
        500_000,
      );

      expect(result.feeInKobo).toBe(2_500); // ₦25 flat
      expect(result.feeInMajor).toBe(25);
    });
  });

  describe('calculate — no matching rule', () => {
    it('returns zero fee when no rule exists', async () => {
      feeRepoMock.find.mockResolvedValue([]); // no rules configured

      const result = await service.calculate(TransactionType.TRANSFER, 500_000);

      expect(result.feeInKobo).toBe(0);
      expect(result.feeInMajor).toBe(0);
      expect(result.ruleApplied).toBe('none');
    });
  });

  describe('calculate — amount range filtering', () => {
    it('applies rule only within specified amount band', async () => {
      const bandRule = makeFeeConfig({
        name: 'High-value fee',
        minTransactionAmount: 1_000_000, // only for amounts ≥ ₦10,000
        maxTransactionAmount: 0,
        value: 2.0,
        cap: 0,
        minimum: 0,
      });
      feeRepoMock.find.mockResolvedValue([bandRule]);

      // ₦5,000 = 500,000 kobo — below minTransactionAmount, rule should not apply
      const result = await service.calculate(TransactionType.TRANSFER, 500_000);

      expect(result.feeInKobo).toBe(0); // rule filtered out, falls back to no-rule
    });

    it('applies rule when amount is within band', async () => {
      const bandRule = makeFeeConfig({
        minTransactionAmount: 100_000, // ≥ ₦1,000
        maxTransactionAmount: 0,
        value: 1.5,
        cap: 0,
        minimum: 0,
      });
      feeRepoMock.find.mockResolvedValue([bandRule]);

      const result = await service.calculate(TransactionType.TRANSFER, 500_000);

      expect(result.feeInKobo).toBe(7_500); // 1.5% of 500,000
    });
  });

  describe('priority ordering', () => {
    it('uses the highest-priority rule when multiple match', async () => {
      const lowPriority = makeFeeConfig({
        name: 'Low',
        value: 1.0,
        priority: 1,
        cap: 0,
        minimum: 0,
      });
      const highPriority = makeFeeConfig({
        name: 'High',
        value: 2.0,
        priority: 10,
        cap: 0,
        minimum: 0,
      });
      feeRepoMock.find.mockResolvedValue([lowPriority, highPriority]);

      const result = await service.calculate(TransactionType.TRANSFER, 100_000);

      expect(result.ruleApplied).toBe('High');
      expect(result.feeInKobo).toBe(2_000); // 2% of 100,000
    });
  });

  describe('cache', () => {
    it('caches results and only calls the DB once for rapid successive calls', async () => {
      feeRepoMock.find.mockResolvedValue([makeFeeConfig()]);

      await service.calculate(TransactionType.TRANSFER, 100_000);
      await service.calculate(TransactionType.TRANSFER, 200_000);
      await service.calculate(TransactionType.TRANSFER, 300_000);

      // DB should only be hit once — subsequent calls use cache
      expect(feeRepoMock.find).toHaveBeenCalledTimes(1);
    });

    it('invalidateCache forces a fresh DB read', async () => {
      feeRepoMock.find.mockResolvedValue([makeFeeConfig()]);

      await service.calculate(TransactionType.TRANSFER, 100_000);
      service.invalidateCache();
      await service.calculate(TransactionType.TRANSFER, 100_000);

      expect(feeRepoMock.find).toHaveBeenCalledTimes(2);
    });
  });
});
