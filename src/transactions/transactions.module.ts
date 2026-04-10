import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { TransactionsService } from './transactions.service';
import { TransactionsController } from './transactions.controller';
import { Transaction } from './entities/transaction.entity';
import { AccountsModule } from '../accounts/accounts.module';
import { FeesModule } from '../fees/fees.module';
import { IdempotencyGuard } from '../common/guards/idempotency.guard';

@Module({
  imports: [
    TypeOrmModule.forFeature([Transaction]),
    AccountsModule,
    FeesModule,
  ],
  providers: [TransactionsService, IdempotencyGuard],
  controllers: [TransactionsController],
  exports: [TransactionsService],
})
export class TransactionsModule {}
