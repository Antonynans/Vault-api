import {
  Controller,
  Get,
  Post,
  Delete,
  Param,
  Body,
  UseGuards,
} from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { IsEnum, IsNumber, IsOptional, IsString, Min } from 'class-validator';
import { FeesService } from './fees.service';
import { FeeType } from './entities/fee-config.entity';
import { TransactionType } from '../transactions/entities/transaction.entity';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { UserRole } from '../users/entities/user.entity';

class UpsertFeeConfigDto {
  @IsString()
  name: string;

  @IsEnum(TransactionType)
  transactionType: TransactionType;

  @IsEnum(FeeType)
  feeType: FeeType;

  @IsNumber()
  @Min(0)
  value: number;

  @IsNumber()
  @IsOptional()
  cap?: number;

  @IsNumber()
  @IsOptional()
  minimum?: number;

  @IsNumber()
  @IsOptional()
  minTransactionAmount?: number;

  @IsNumber()
  @IsOptional()
  maxTransactionAmount?: number;

  @IsNumber()
  @IsOptional()
  priority?: number;

  @IsString()
  @IsOptional()
  description?: string;
}

@ApiTags('Fees')
@ApiBearerAuth()
@Controller('fees')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.ADMIN)
export class FeesController {
  constructor(private readonly feesService: FeesService) {}

  @Get()
  @ApiOperation({ summary: 'List all fee configurations' })
  findAll() {
    return this.feesService.findAll();
  }

  @Post()
  @ApiOperation({ summary: 'Create or update a fee rule' })
  upsert(@Body() dto: UpsertFeeConfigDto) {
    return this.feesService.upsert(dto);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Deactivate a fee rule' })
  deactivate(@Param('id') id: string) {
    return this.feesService.deactivate(id);
  }

  @Post('seed')
  @ApiOperation({ summary: 'Seed default fee rules (idempotent)' })
  seed() {
    return this.feesService.seedDefaults();
  }
}
