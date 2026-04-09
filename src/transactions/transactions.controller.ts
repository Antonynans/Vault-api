import {
  Controller,
  Post,
  Get,
  Param,
  Body,
  UseGuards,
  Query,
  Req,
} from '@nestjs/common';
import {
  ApiTags,
  ApiBearerAuth,
  ApiOperation,
  ApiHeader,
  ApiQuery,
} from '@nestjs/swagger';
import { TransactionsService } from './transactions.service';
import {
  InitiateTransferDto,
  DepositDto,
  WithdrawalDto,
} from './dto/transaction.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { IdempotencyGuard } from '../common/guards/idempotency.guard';
import { CurrentUser } from '../auth/decorators/public.decorator';
import { Roles } from '../auth/decorators/roles.decorator';
import { UserRole } from '../users/entities/user.entity';
import {
  FinancialEndpoint,
  ReadEndpoint,
} from '../common/decorators/throttle.decorators';

@ApiTags('Transactions')
@ApiBearerAuth()
@Controller('transactions')
@UseGuards(JwtAuthGuard, RolesGuard)
export class TransactionsController {
  constructor(private readonly transactionsService: TransactionsService) {}

  @Post('transfer')
  @FinancialEndpoint()
  @UseGuards(IdempotencyGuard)
  @ApiOperation({ summary: 'Transfer funds between accounts' })
  @ApiHeader({
    name: 'Idempotency-Key',
    description: 'UUID v4 to prevent duplicate transfers',
    required: false,
  })
  transfer(
    @CurrentUser() user: any,
    @Req() req: any,
    @Body() dto: InitiateTransferDto,
  ) {
    return this.transactionsService.transfer(user.id, dto, req.idempotencyKey);
  }

  @Post('deposit')
  @FinancialEndpoint()
  @Roles(UserRole.ADMIN)
  @ApiOperation({
    summary: 'Credit an account (Admin / payment gateway webhook)',
  })
  deposit(@Body() dto: DepositDto) {
    return this.transactionsService.deposit(dto);
  }

  @Post('withdraw')
  @FinancialEndpoint()
  @UseGuards(IdempotencyGuard)
  @ApiOperation({ summary: 'Withdraw funds from an account' })
  @ApiHeader({
    name: 'Idempotency-Key',
    description: 'UUID v4 to prevent duplicate withdrawals',
    required: false,
  })
  withdraw(
    @CurrentUser() user: any,
    @Req() req: any,
    @Body() dto: WithdrawalDto,
  ) {
    return this.transactionsService.withdraw(user.id, dto, req.idempotencyKey);
  }

  @Get('account/:accountId')
  @ReadEndpoint()
  @ApiOperation({ summary: 'Paginated transaction history for an account' })
  @ApiQuery({ name: 'page', required: false, type: Number })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  getByAccount(
    @Param('accountId') accountId: string,
    @CurrentUser() user: any,
    @Query('page') page = 1,
    @Query('limit') limit = 20,
  ) {
    return this.transactionsService.findByAccount(
      accountId,
      user.id,
      Number(page),
      Number(limit),
    );
  }

  @Get('ref/:reference')
  @ReadEndpoint()
  @ApiOperation({ summary: 'Fetch a transaction by its reference' })
  getByReference(@Param('reference') reference: string) {
    return this.transactionsService.findByReference(reference);
  }

  @Get()
  @ReadEndpoint()
  @Roles(UserRole.ADMIN)
  @ApiOperation({ summary: 'All transactions — paginated (Admin only)' })
  @ApiQuery({ name: 'page', required: false, type: Number })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  findAll(@Query('page') page = 1, @Query('limit') limit = 50) {
    return this.transactionsService.findAll(Number(page), Number(limit));
  }
}
