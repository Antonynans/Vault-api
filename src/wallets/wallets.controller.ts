import { Controller, Get, Patch, Param, Body, UseGuards } from '@nestjs/common';
import { WalletsService } from './wallets.service';
import { WalletTier } from './entities/wallet.entity';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { UserRole } from '../users/entities/user.entity';
import { IsEnum } from 'class-validator';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';

class UpgradeTierDto {
  @IsEnum(WalletTier)
  tier!: WalletTier;
}

@ApiTags('Wallets')
@ApiBearerAuth()
@Controller('wallets')
@UseGuards(JwtAuthGuard, RolesGuard)
export class WalletsController {
  constructor(private readonly walletsService: WalletsService) {}

  @Get('account/:accountId/limits')
  @ApiOperation({ summary: 'Get wallet spend limits and usage for an account' })
  getLimits(@Param('accountId') accountId: string) {
    return this.walletsService.getLimits(accountId);
  }

  @Patch('account/:accountId/upgrade')
  @Roles(UserRole.ADMIN)
  @ApiOperation({ summary: 'Upgrade wallet tier (Admin only)' })
  upgradeTier(
    @Param('accountId') accountId: string,
    @Body() dto: UpgradeTierDto,
  ) {
    return this.walletsService.upgradeTier(accountId, dto.tier);
  }
}
