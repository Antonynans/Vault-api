import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { StatementsService } from './statements.service';
import { StatementsController } from './statements.controller';
import { Transaction } from '../transactions/entities/transaction.entity';
import { Account } from '../accounts/entities/account.entity';

@Module({
  imports: [TypeOrmModule.forFeature([Transaction, Account])],
  providers: [StatementsService],
  controllers: [StatementsController],
})
export class StatementsModule {}
