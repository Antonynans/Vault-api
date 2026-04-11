import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { BadRequestException, NotFoundException } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { TransactionsService } from '../../src/transactions/transactions.service';
import {
  Transaction,
  TransactionStatus,
  // TransactionType,
} from '../../src/transactions/entities/transaction.entity';
import { AccountsService } from '../../src/accounts/accounts.service';
import {
  AccountStatus,
  Currency,
} from '../../src/accounts/entities/account.entity';
import { AuditService } from '../../src/audit/audit.service';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { FeesService } from '../../src/fees/fees.service';

// ── Helpers ──────────────────────────────────────────────────────────────────
const makeAccount = (overrides = {}) => ({
  id: 'acct-001',
  accountNumber: '0123456789',
  status: AccountStatus.ACTIVE,
  currency: Currency.NGN,
  balance: 100_000,
  userId: 'user-001',
  ...overrides,
});

const mockQueryRunner = {
  connect: jest.fn(),
  startTransaction: jest.fn(),
  commitTransaction: jest.fn(),
  rollbackTransaction: jest.fn(),
  release: jest.fn(),
  manager: {
    save: jest.fn(),
    findOne: jest.fn(),
  },
};

const mockDataSource = {
  createQueryRunner: jest.fn().mockReturnValue(mockQueryRunner),
};

const mockTxRepo = {
  create: jest.fn(),
  save: jest.fn(),
  findOne: jest.fn(),
  find: jest.fn(),
  createQueryBuilder: jest.fn(),
};

const mockAccountsService = {
  findOne: jest.fn(),
  findByAccountNumber: jest.fn(),
  debitAccount: jest.fn(),
  creditAccount: jest.fn(),
};

const mockAuditService = {
  log: jest.fn(),
};

const mockEventEmitter = {
  emit: jest.fn(),
};

const mockFeesService = {
  calculate: jest.fn(),
};

// ── Tests ────────────────────────────────────────────────────────────────────
describe('TransactionsService', () => {
  let service: TransactionsService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        TransactionsService,
        { provide: getRepositoryToken(Transaction), useValue: mockTxRepo },
        { provide: AccountsService, useValue: mockAccountsService },
        { provide: AuditService, useValue: mockAuditService },
        { provide: EventEmitter2, useValue: mockEventEmitter },
        { provide: FeesService, useValue: mockFeesService },
        { provide: DataSource, useValue: mockDataSource },
      ],
    }).compile();

    service = module.get<TransactionsService>(TransactionsService);
    jest.clearAllMocks();
  });

  describe('transfer', () => {
    it('should complete a transfer between two accounts', async () => {
      const source = makeAccount({ id: 'acct-001', balance: 50_000 });
      const dest = makeAccount({ id: 'acct-002', accountNumber: '0987654321' });
      const mockTx = { id: 'tx-001', status: TransactionStatus.PENDING };

      mockAccountsService.findOne.mockResolvedValue(source);
      mockAccountsService.findByAccountNumber.mockResolvedValue(dest);
      mockTxRepo.create.mockReturnValue(mockTx);
      mockQueryRunner.manager.save.mockResolvedValue(mockTx);
      mockAccountsService.debitAccount.mockResolvedValue(undefined);
      mockAccountsService.creditAccount.mockResolvedValue(undefined);
      mockFeesService.calculate.mockResolvedValue({
        feeInKobo: 15_000,
        feeInMajor: 150,
        ruleApplied: 'Standard Transfer Fee',
        breakdown: '1.5% of ₦1,000 = ₦15',
      });

      const result = await service.transfer('user-001', {
        sourceAccountId: 'acct-001',
        destinationAccountNumber: '0987654321',
        amount: 1000,
      });

      expect(mockAccountsService.debitAccount).toHaveBeenCalledTimes(1);
      expect(mockAccountsService.creditAccount).toHaveBeenCalledTimes(1);
      expect(mockQueryRunner.commitTransaction).toHaveBeenCalledTimes(1);
      expect(result.status).toBe(TransactionStatus.COMPLETED);
    });

    it('should throw BadRequestException when transferring to the same account', async () => {
      const account = makeAccount({ id: 'acct-001' });
      mockAccountsService.findOne.mockResolvedValue(account);
      mockAccountsService.findByAccountNumber.mockResolvedValue(account);

      await expect(
        service.transfer('user-001', {
          sourceAccountId: 'acct-001',
          destinationAccountNumber: '0123456789',
          amount: 1000,
        }),
      ).rejects.toThrow(BadRequestException);
    });

    it('should throw NotFoundException when destination account does not exist', async () => {
      const source = makeAccount();
      mockAccountsService.findOne.mockResolvedValue(source);
      mockAccountsService.findByAccountNumber.mockResolvedValue(null);

      await expect(
        service.transfer('user-001', {
          sourceAccountId: 'acct-001',
          destinationAccountNumber: '9999999999',
          amount: 500,
        }),
      ).rejects.toThrow(NotFoundException);
    });

    it('should throw BadRequestException for cross-currency transfers', async () => {
      const source = makeAccount({ currency: Currency.NGN });
      const dest = makeAccount({ id: 'acct-002', currency: Currency.USD });
      mockAccountsService.findOne.mockResolvedValue(source);
      mockAccountsService.findByAccountNumber.mockResolvedValue(dest);

      await expect(
        service.transfer('user-001', {
          sourceAccountId: 'acct-001',
          destinationAccountNumber: '0987654321',
          amount: 500,
        }),
      ).rejects.toThrow(BadRequestException);
    });

    it('should rollback and save failed transaction on error', async () => {
      const source = makeAccount({ id: 'acct-001' });
      const dest = makeAccount({ id: 'acct-002', accountNumber: '0987654321' });
      const mockTx = { id: 'tx-001', status: TransactionStatus.PENDING };

      mockAccountsService.findOne.mockResolvedValue(source);
      mockAccountsService.findByAccountNumber.mockResolvedValue(dest);
      mockTxRepo.create.mockReturnValue(mockTx);
      mockQueryRunner.manager.save.mockResolvedValueOnce(mockTx);
      mockAccountsService.debitAccount.mockRejectedValue(
        new BadRequestException('Insufficient funds'),
      );

      await expect(
        service.transfer('user-001', {
          sourceAccountId: 'acct-001',
          destinationAccountNumber: '0987654321',
          amount: 999_999_999,
        }),
      ).rejects.toThrow(BadRequestException);

      expect(mockQueryRunner.rollbackTransaction).toHaveBeenCalledTimes(1);
      expect(mockTxRepo.save).toHaveBeenCalledWith(
        expect.objectContaining({ status: TransactionStatus.FAILED }),
      );
    });
  });

  describe('deposit', () => {
    it('should credit account on deposit', async () => {
      const account = makeAccount();
      const mockTx = { id: 'tx-002', status: TransactionStatus.PENDING };

      mockAccountsService.findOne.mockResolvedValue(account);
      mockTxRepo.create.mockReturnValue(mockTx);
      mockQueryRunner.manager.save.mockResolvedValue(mockTx);
      mockAccountsService.creditAccount.mockResolvedValue(undefined);

      const result = await service.deposit({
        accountId: 'acct-001',
        amount: 5000,
      });

      expect(mockAccountsService.creditAccount).toHaveBeenCalledTimes(1);
      expect(mockAccountsService.debitAccount).not.toHaveBeenCalled();
      expect(result.status).toBe(TransactionStatus.COMPLETED);
    });
  });
});
