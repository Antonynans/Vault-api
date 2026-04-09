import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  BadRequestException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource } from 'typeorm';
import {
  Account,
  AccountStatus,
  AccountType,
  // Currency,
} from './entities/account.entity';
import { CreateAccountDto } from './dto/account.dto';
// import { v4 as uuidv4 } from 'uuid';
import { Currency } from 'src/common/enums/currency.enum';

@Injectable()
export class AccountsService {
  constructor(
    @InjectRepository(Account)
    private readonly accountRepo: Repository<Account>,
    private readonly dataSource: DataSource,
  ) {}

  private generateAccountNumber(): string {
    // 10-digit account number — similar to NUBAN format
    return Math.floor(1000000000 + Math.random() * 9000000000).toString();
  }

  async create(userId: string, dto: CreateAccountDto): Promise<Account> {
    const account = this.accountRepo.create({
      userId,
      accountNumber: this.generateAccountNumber(),
      type: dto.type ?? AccountType.WALLET,
      currency: dto.currency ?? Currency.NGN,
      balance: 0,
      ledgerBalance: 0,
    });

    return this.accountRepo.save(account);
  }

  async findAllForUser(userId: string): Promise<Account[]> {
    return this.accountRepo.find({ where: { userId } });
  }

  async findOne(id: string, userId?: string): Promise<Account> {
    const account = await this.accountRepo.findOne({ where: { id } });
    if (!account) throw new NotFoundException('Account not found');
    if (userId && account.userId !== userId) {
      throw new ForbiddenException('Access denied');
    }
    return account;
  }

  async findByAccountNumber(accountNumber: string): Promise<Account | null> {
    return this.accountRepo.findOne({ where: { accountNumber } });
  }

  async freeze(id: string, userId: string): Promise<Account> {
    const account = await this.findOne(id, userId);
    if (account.status === AccountStatus.FROZEN) {
      throw new BadRequestException('Account is already frozen');
    }
    account.status = AccountStatus.FROZEN;
    return this.accountRepo.save(account);
  }

  async unfreeze(id: string): Promise<Account> {
    const account = await this.findOne(id);
    account.status = AccountStatus.ACTIVE;
    return this.accountRepo.save(account);
  }

  // Used internally by TransactionsService — runs inside a DB transaction
  async debitAccount(
    accountId: string,
    amount: number,
    queryRunner: any,
  ): Promise<void> {
    const account = await queryRunner.manager.findOne(Account, {
      where: { id: accountId },
    });
    if (!account) throw new NotFoundException('Source account not found');
    if (account.status !== AccountStatus.ACTIVE) {
      throw new BadRequestException('Account is not active');
    }
    if (account.balance < amount) {
      throw new BadRequestException('Insufficient funds');
    }
    account.balance = Number(account.balance) - amount;
    account.ledgerBalance = Number(account.ledgerBalance) - amount;
    await queryRunner.manager.save(account);
  }

  async creditAccount(
    accountId: string,
    amount: number,
    queryRunner: any,
  ): Promise<void> {
    const account = await queryRunner.manager.findOne(Account, {
      where: { id: accountId },
    });
    if (!account) throw new NotFoundException('Destination account not found');
    account.balance = Number(account.balance) + amount;
    account.ledgerBalance = Number(account.ledgerBalance) + amount;
    await queryRunner.manager.save(account);
  }
}
