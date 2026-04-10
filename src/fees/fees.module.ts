import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { FeesService } from './fees.service';
import { FeesController } from './fees.controller';
import { FeeConfig } from './entities/fee-config.entity';

@Module({
  imports: [TypeOrmModule.forFeature([FeeConfig])],
  providers: [FeesService],
  controllers: [FeesController],
  exports: [FeesService],
})
export class FeesModule {}
