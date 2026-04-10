import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { TransactionPinService } from './transaction-pin.service';
import { TransactionPinController } from './transaction-pin.controller';
import { User } from '../users/entities/user.entity';

@Module({
  imports: [TypeOrmModule.forFeature([User])],
  providers: [TransactionPinService],
  controllers: [TransactionPinController],
  exports: [TransactionPinService],
})
export class TransactionPinModule {}
