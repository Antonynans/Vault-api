import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { BadRequestException, NotFoundException } from '@nestjs/common';
import { WalletsService } from '../../src/wallets/wallets.service';
import { Wallet, WalletTier } from '../../src/wallets/entities/wallet.entity';

const makeWallet = (overrides: Partial<Wallet> = {}): Wallet =>
  ({
    id: 'wallet-001',
    accountId: 'acct-001',
    tier: WalletTier.BASIC,
    dailyLimit: 100_000_00,
    singleTransactionLimit: 50_000_00,
    monthlySpend: 0,
    monthlyLimit: 500_000_00,
    spendResetDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // future
    isVirtual: false,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  }) as Wallet;

const walletRepoMock = {
  findOne: jest.fn(),
  create: jest.fn(),
  save: jest.fn(),
  update: jest.fn(),
  increment: jest.fn(),
};

describe('WalletsService', () => {
  let service: WalletsService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        WalletsService,
        { provide: getRepositoryToken(Wallet), useValue: walletRepoMock },
      ],
    }).compile();

    service = module.get<WalletsService>(WalletsService);
    jest.clearAllMocks();
  });

  describe('validateSpendLimit', () => {
    it('passes when amount is within single transaction limit', async () => {
      walletRepoMock.findOne.mockResolvedValue(makeWallet());

      await expect(
        service.validateSpendLimit('wallet-001', 10_000_00), // ₦10,000 in kobo
      ).resolves.not.toThrow();
    });

    it('throws when amount exceeds single transaction limit', async () => {
      walletRepoMock.findOne.mockResolvedValue(makeWallet());

      await expect(
        service.validateSpendLimit('wallet-001', 60_000_00), // ₦60,000 > ₦50,000 limit
      ).rejects.toThrow(BadRequestException);
    });

    it('throws when monthly spend would be exceeded', async () => {
      walletRepoMock.findOne.mockResolvedValue(
        makeWallet({ monthlySpend: 490_000_00 }), // ₦490,000 already spent
      );

      await expect(
        service.validateSpendLimit('wallet-001', 20_000_00), // ₦20,000 would push over ₦500,000
      ).rejects.toThrow(BadRequestException);
    });

    it('resets monthly spend when spendResetDate has passed', async () => {
      const pastDate = new Date(Date.now() - 1000);
      walletRepoMock.findOne.mockResolvedValue(
        makeWallet({ monthlySpend: 490_000_00, spendResetDate: pastDate }),
      );
      walletRepoMock.save.mockResolvedValue(makeWallet({ monthlySpend: 0 }));

      // After reset, the spend is 0 — so this should pass
      await expect(
        service.validateSpendLimit('wallet-001', 20_000_00),
      ).resolves.not.toThrow();

      expect(walletRepoMock.save).toHaveBeenCalledWith(
        expect.objectContaining({ monthlySpend: 0 }),
      );
    });

    it('throws NotFoundException when wallet does not exist', async () => {
      walletRepoMock.findOne.mockResolvedValue(null);

      await expect(
        service.validateSpendLimit('nonexistent', 1000),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('upgradeTier', () => {
    it('upgrades wallet to STANDARD and sets correct limits', async () => {
      const wallet = makeWallet();
      walletRepoMock.findOne.mockResolvedValue(wallet);
      walletRepoMock.save.mockResolvedValue({
        ...wallet,
        tier: WalletTier.STANDARD,
        singleTransactionLimit: 200_000_00,
        monthlyLimit: 2_000_000_00,
      });

      const result = await service.upgradeTier('acct-001', WalletTier.STANDARD);

      expect(result.tier).toBe(WalletTier.STANDARD);
      expect(result.singleTransactionLimit).toBe(200_000_00);
    });

    it('upgrades wallet to PREMIUM and sets correct limits', async () => {
      const wallet = makeWallet({ tier: WalletTier.STANDARD });
      walletRepoMock.findOne.mockResolvedValue(wallet);
      walletRepoMock.save.mockResolvedValue({
        ...wallet,
        tier: WalletTier.PREMIUM,
        singleTransactionLimit: 2_000_000_00,
        monthlyLimit: 20_000_000_00,
      });

      const result = await service.upgradeTier('acct-001', WalletTier.PREMIUM);

      expect(result.tier).toBe(WalletTier.PREMIUM);
      expect(result.monthlyLimit).toBe(20_000_000_00);
    });
  });

  describe('getLimits', () => {
    it('returns limits and usage in major units (naira)', async () => {
      walletRepoMock.findOne.mockResolvedValue(
        makeWallet({ monthlySpend: 100_000_00 }), // ₦100,000 spent
      );

      const result = await service.getLimits('acct-001');

      expect(result.limits.single).toBe(50_000); // ₦50,000
      expect(result.usage.monthlySpend).toBe(100_000); // ₦100,000
      expect(result.usage.monthlyRemaining).toBe(400_000); // ₦400,000 left
    });
  });
});
