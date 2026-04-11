import {
  Injectable,
  NotFoundException,
  ForbiddenException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import {
  Transaction,
  TransactionStatus,
} from '../transactions/entities/transaction.entity';
import { Account } from '../accounts/entities/account.entity';

export interface StatementRow {
  date: string;
  reference: string;
  description: string;
  type: string;
  credit: string;
  debit: string;
  fee: string;
  status: string;
}

@Injectable()
export class StatementsService {
  constructor(
    @InjectRepository(Transaction)
    private readonly txRepo: Repository<Transaction>,
    @InjectRepository(Account)
    private readonly accountRepo: Repository<Account>,
  ) {}

  async generateCsv(
    accountId: string,
    userId: string,
    from: Date,
    to: Date,
  ): Promise<{ csv: string; filename: string; account: Account }> {
    // Ownership check
    const account = await this.accountRepo.findOne({
      where: { id: accountId },
    });
    if (!account) throw new NotFoundException('Account not found');
    if (account.userId !== userId)
      throw new ForbiddenException('Access denied');

    const transactions = await this.txRepo
      .createQueryBuilder('tx')
      .where('(tx.sourceAccountId = :id OR tx.destinationAccountId = :id)', {
        id: accountId,
      })
      .andWhere('tx.status = :status', { status: TransactionStatus.COMPLETED })
      .andWhere('tx.createdAt BETWEEN :from AND :to', { from, to })
      .orderBy('tx.createdAt', 'ASC')
      .getMany();

    const rows: StatementRow[] = transactions.map((tx) => {
      const isCredit = tx.destinationAccountId === accountId;
      return {
        date: tx.createdAt.toISOString().replace('T', ' ').slice(0, 19),
        reference: tx.reference,
        description: tx.description ?? '',
        type: tx.type,
        credit: isCredit ? tx.amount.toString() : '',
        debit: !isCredit ? tx.amount.toString() : '',
        fee: tx.fee?.toString() ?? '0',
        status: tx.status,
      };
    });

    const csv = this.toCsv(rows, account);
    const filename = `statement_${account.accountNumber}_${from.toISOString().slice(0, 10)}_${to.toISOString().slice(0, 10)}.csv`;

    return { csv, filename, account };
  }

  private toCsv(rows: StatementRow[], account: Account): string {
    const header = [
      `Account Number:,${account.accountNumber}`,
      `Currency:,${account.currency}`,
      `Balance:,${account.balance}`,
      `Generated:,${new Date().toISOString()}`,
      '',
      'Date,Reference,Description,Type,Credit,Debit,Fee,Status',
    ].join('\n');

    const body = rows
      .map((r) =>
        [
          `"${r.date}"`,
          `"${r.reference}"`,
          `"${r.description.replace(/"/g, '""')}"`,
          r.type,
          r.credit,
          r.debit,
          r.fee,
          r.status,
        ].join(','),
      )
      .join('\n');

    const footer = [
      '',
      `Total Credits:,${rows.reduce((s, r) => s + parseFloat(r.credit || '0'), 0).toFixed(2)}`,
      `Total Debits:,${rows.reduce((s, r) => s + parseFloat(r.debit || '0'), 0).toFixed(2)}`,
      `Total Fees:,${rows.reduce((s, r) => s + parseFloat(r.fee || '0'), 0).toFixed(2)}`,
      `Transactions:,${rows.length}`,
    ].join('\n');

    return [header, body, footer].join('\n');
  }
}
