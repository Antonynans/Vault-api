import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ConfigModule } from '@nestjs/config';
import { EventEmitterModule } from '@nestjs/event-emitter';
import { ThrottlerModule } from '@nestjs/throttler';

import { AuthModule } from '../../src/auth/auth.module';
import { UsersModule } from '../../src/users/users.module';
import { AccountsModule } from '../../src/accounts/accounts.module';
import { TransactionsModule } from '../../src/transactions/transactions.module';
import { WalletsModule } from '../../src/wallets/wallets.module';
import { NotificationsModule } from '../../src/notifications/notifications.module';
import { AuditModule } from '../../src/audit/audit.module';

import { User } from '../../src/users/entities/user.entity';
import { Account } from '../../src/accounts/entities/account.entity';
import { Transaction } from '../../src/transactions/entities/transaction.entity';
import { Wallet } from '../../src/wallets/entities/wallet.entity';
import { AuditLog } from '../../src/audit/entities/audit-log.entity';
import { Notification } from '../../src/notifications/entities/notification.entity';

export async function createTestApp(): Promise<INestApplication> {
  const moduleFixture: TestingModule = await Test.createTestingModule({
    imports: [
      ConfigModule.forRoot({ isGlobal: true, envFilePath: '.env.test' }),
      TypeOrmModule.forRoot({
        type: 'sqlite',
        database: ':memory:',
        entities: [User, Account, Transaction, Wallet, AuditLog, Notification],
        synchronize: true,
        logging: false,
      }),
      ThrottlerModule.forRoot([{ ttl: 60_000, limit: 1000 }]), // high limit for tests
      EventEmitterModule.forRoot(),
      AuditModule,
      AuthModule,
      UsersModule,
      AccountsModule,
      TransactionsModule,
      WalletsModule,
      NotificationsModule,
    ],
  }).compile();

  const app = moduleFixture.createNestApplication();

  app.setGlobalPrefix('api');
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );

  await app.init();
  return app;
}
