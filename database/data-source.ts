import { DataSource } from 'typeorm';
import * as dotenv from 'dotenv';
import { User } from '../src/users/entities/user.entity';
import { Account } from '../src/accounts/entities/account.entity';
import { Transaction } from '../src/transactions/entities/transaction.entity';
import { Wallet } from '../src/wallets/entities/wallet.entity';

dotenv.config();

export const AppDataSource = new DataSource({
  type: 'postgres',
  host: process.env.DB_HOST ?? 'localhost',
  port: parseInt(process.env.DB_PORT ?? '5432', 10),
  username: process.env.DB_USERNAME ?? 'postgres',
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME ?? 'fintech_db',
  entities: [User, Account, Transaction, Wallet],
  migrations: ['database/migrations/*.ts'],
  migrationsTableName: 'migrations',
  ssl:
    process.env.NODE_ENV === 'production'
      ? { rejectUnauthorized: false }
      : false,
});
