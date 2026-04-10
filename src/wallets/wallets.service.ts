import {
  Injectable,
  NotFoundException,
  BadRequestException,
  // ForbiddenException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Wallet, WalletTier } from './entities/wallet.entity';

const TIER_LIMITS: Record<
  WalletTier,
  { daily: number; single: number; monthly: number }
> = {
  [WalletTier.BASIC]: {
    daily: 100_000_00,
    single: 50_000_00,
    monthly: 500_000_00,
  },
  [WalletTier.STANDARD]: {
    daily: 500_000_00,
    single: 200_000_00,
    monthly: 2_000_000_00,
  },
  [WalletTier.PREMIUM]: {
    daily: 5_000_000_00,
    single: 2_000_000_00,
    monthly: 20_000_000_00,
  },
};

@Injectable()
export class WalletsService {
  constructor(
    @InjectRepository(Wallet)
    private readonly walletRepo: Repository<Wallet>,
  ) {}

  async createForAccount(accountId: string): Promise<Wallet> {
    const wallet = this.walletRepo.create({ accountId });
    return this.walletRepo.save(wallet);
  }

  async findByAccount(accountId: string): Promise<Wallet> {
    const wallet = await this.walletRepo.findOne({ where: { accountId } });
    if (!wallet)
      throw new NotFoundException('Wallet not found for this account');
    return wallet;
  }

  async findById(id: string): Promise<Wallet> {
    const wallet = await this.walletRepo.findOne({ where: { id } });
    if (!wallet) throw new NotFoundException('Wallet not found');
    return wallet;
  }

  async validateSpendLimit(
    walletId: string,
    amountInKobo: number,
  ): Promise<void> {
    const wallet = await this.findById(walletId);

    if (amountInKobo > wallet.singleTransactionLimit) {
      throw new BadRequestException(
        `Amount exceeds single transaction limit of ₦${(wallet.singleTransactionLimit / 100).toLocaleString()}`,
      );
    }

    // Reset monthly spend if new calendar month
    const now = new Date();
    if (!wallet.spendResetDate || now > wallet.spendResetDate) {
      wallet.monthlySpend = 0;
      wallet.spendResetDate = new Date(
        now.getFullYear(),
        now.getMonth() + 1,
        1,
      );
      await this.walletRepo.save(wallet);
    }

    if (Number(wallet.monthlySpend) + amountInKobo > wallet.monthlyLimit) {
      throw new BadRequestException('Monthly spending limit exceeded');
    }
  }

  async recordSpend(walletId: string, amountInKobo: number): Promise<void> {
    await this.walletRepo.increment(
      { id: walletId },
      'monthlySpend',
      amountInKobo,
    );
  }

  async upgradeTier(accountId: string, tier: WalletTier): Promise<Wallet> {
    const wallet = await this.findByAccount(accountId);
    const limits = TIER_LIMITS[tier];

    wallet.tier = tier;
    wallet.dailyLimit = limits.daily;
    wallet.singleTransactionLimit = limits.single;
    wallet.monthlyLimit = limits.monthly;

    return this.walletRepo.save(wallet);
  }

  async getLimits(accountId: string) {
    const wallet = await this.findByAccount(accountId);
    return {
      tier: wallet.tier,
      limits: {
        single: wallet.singleTransactionLimit / 100,
        daily: wallet.dailyLimit / 100,
        monthly: wallet.monthlyLimit / 100,
      },
      usage: {
        monthlySpend: Number(wallet.monthlySpend) / 100,
        monthlyRemaining:
          (wallet.monthlyLimit - Number(wallet.monthlySpend)) / 100,
      },
    };
  }
}
