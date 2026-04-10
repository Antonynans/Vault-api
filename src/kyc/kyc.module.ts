import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { KycService } from './kyc.service';
import { KycController } from './kyc.controller';
import { KycSubmission } from './entities/kyc-submission.entity';
import { UsersModule } from '../users/users.module';
import { WalletsModule } from '../wallets/wallets.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([KycSubmission]),
    UsersModule,
    WalletsModule,
  ],
  providers: [KycService],
  controllers: [KycController],
  exports: [KycService],
})
export class KycModule {}
