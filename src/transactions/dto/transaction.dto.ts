import {
  IsString,
  IsNumber,
  IsPositive,
  IsOptional,
  IsEnum,
  Min,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Currency } from '../../common/enums/currency.enum';

export class InitiateTransferDto {
  @ApiProperty({ description: 'UUID of the source account' })
  @IsString()
  sourceAccountId!: string;

  @ApiProperty({
    description: '10-digit destination account number',
    example: '0123456789',
  })
  @IsString()
  destinationAccountNumber!: string;

  @ApiProperty({
    example: 5000.0,
    description: 'Amount to send in major currency units',
  })
  @IsNumber({ maxDecimalPlaces: 2 })
  @IsPositive()
  @Min(1)
  amount!: number;

  @ApiPropertyOptional({ enum: Currency })
  @IsEnum(Currency)
  @IsOptional()
  currency?: Currency;

  @ApiPropertyOptional({ example: 'Payment for services' })
  @IsString()
  @IsOptional()
  description?: string;
}

export class DepositDto {
  @ApiProperty({ description: 'UUID of account to credit' })
  @IsString()
  accountId!: string;

  @ApiProperty({ example: 10000.0 })
  @IsNumber({ maxDecimalPlaces: 2 })
  @IsPositive()
  amount!: number;

  @ApiPropertyOptional({ example: 'Paystack webhook deposit' })
  @IsString()
  @IsOptional()
  description?: string;
}

export class WithdrawalDto {
  @ApiProperty({ description: 'UUID of account to debit' })
  @IsString()
  accountId!: string;

  @ApiProperty({ example: 2000.0 })
  @IsNumber({ maxDecimalPlaces: 2 })
  @IsPositive()
  amount!: number;

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  description?: string;
}
