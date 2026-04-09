import { IsEnum, IsOptional } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { AccountType } from '../entities/account.entity';
import { Currency } from 'src/common/enums/currency.enum';

export class CreateAccountDto {
  @ApiPropertyOptional({ enum: AccountType, default: AccountType.WALLET })
  @IsEnum(AccountType)
  @IsOptional()
  type?: AccountType;

  @ApiPropertyOptional({ enum: Currency, default: Currency.NGN })
  @IsEnum(Currency)
  @IsOptional()
  currency?: Currency;
}
