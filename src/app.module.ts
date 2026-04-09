import { Module, MiddlewareConsumer, NestModule } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ThrottlerModule, ThrottlerGuard } from '@nestjs/throttler';
import { EventEmitterModule } from '@nestjs/event-emitter';
import { ScheduleModule } from '@nestjs/schedule';
import { APP_GUARD, APP_INTERCEPTOR, APP_FILTER } from '@nestjs/core';

import configuration from './config/configuration';

import { AuditModule } from './audit/audit.module';
import { AuthModule } from './auth/auth.module';
import { UsersModule } from './users/users.module';
import { AccountsModule } from './accounts/accounts.module';
import { TransactionsModule } from './transactions/transactions.module';
import { WalletsModule } from './wallets/wallets.module';

import { User } from './users/entities/user.entity';
import { Account } from './accounts/entities/account.entity';
import { Transaction } from './transactions/entities/transaction.entity';
import { Wallet } from './wallets/entities/wallet.entity';
import { AuditLog } from './audit/entities/audit-log.entity';

import { JwtAuthGuard } from './auth/guards/jwt-auth.guard';
import { RolesGuard } from './auth/guards/roles.guard';
import { TransformInterceptor } from './common/interceptors/transform.interceptor';
import { LoggingInterceptor } from './common/interceptors/logging.interceptor';
import { CorrelationIdInterceptor } from './common/interceptors/correlation-id.interceptor';
import { GlobalExceptionFilter } from './common/filters/global-exception.filter';
import {
  CorrelationIdMiddleware,
  RequestLoggerMiddleware,
} from './common/middleware/request-logger.middleware';

const ENTITIES = [User, Account, Transaction, Wallet, AuditLog];

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true, load: [configuration] }),

    TypeOrmModule.forRootAsync({
      imports: [ConfigModule],
      useFactory: (cs: ConfigService) => ({
        type: 'postgres',
        host: cs.get('database.host'),
        port: cs.get('database.port'),
        username: cs.get('database.username'),
        password: cs.get('database.password'),
        database: cs.get('database.name'),
        entities: ENTITIES,
        synchronize: cs.get('nodeEnv') === 'development',
        migrationsRun: cs.get('nodeEnv') !== 'development',
        migrations: ['dist/database/migrations/*.js'],
        logging: cs.get('nodeEnv') === 'development',
        ssl:
          cs.get('nodeEnv') === 'production'
            ? { rejectUnauthorized: false }
            : false,
      }),
      inject: [ConfigService],
    }),

    ThrottlerModule.forRootAsync({
      imports: [ConfigModule],
      useFactory: (cs: ConfigService) => [
        {
          ttl: cs.get<number>('throttle.ttl')! * 1000,
          limit: cs.get<number>('throttle.limit')!,
        },
      ],
      inject: [ConfigService],
    }),

    EventEmitterModule.forRoot({
      wildcard: false,
      delimiter: '.',
      maxListeners: 20,
    }),
    ScheduleModule.forRoot(),

    AuditModule, // @Global — injectable everywhere
    AuthModule,
    UsersModule,
    AccountsModule,
    TransactionsModule,
    WalletsModule,
  ],

  providers: [
    { provide: APP_GUARD, useClass: JwtAuthGuard },
    { provide: APP_GUARD, useClass: RolesGuard },
    { provide: APP_GUARD, useClass: ThrottlerGuard },
    { provide: APP_INTERCEPTOR, useClass: CorrelationIdInterceptor },
    { provide: APP_INTERCEPTOR, useClass: LoggingInterceptor },
    { provide: APP_INTERCEPTOR, useClass: TransformInterceptor },
    { provide: APP_FILTER, useClass: GlobalExceptionFilter },
  ],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    consumer
      .apply(CorrelationIdMiddleware, RequestLoggerMiddleware)
      .forRoutes('*');
  }
}
