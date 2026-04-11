import {
  Controller,
  Post,
  Patch,
  Body,
  UseGuards,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import {
  TransactionPinService,
  SetPinDto,
  ChangePinDto,
  VerifyPinDto,
} from './transaction-pin.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../auth/decorators/public.decorator';
import { User } from '../users/entities/user.entity';

@ApiTags('Transaction PIN')
@ApiBearerAuth()
@Controller('transaction-pin')
@UseGuards(JwtAuthGuard)
export class TransactionPinController {
  constructor(private readonly pinService: TransactionPinService) {}

  @Post('set')
  @ApiOperation({ summary: 'Set transaction PIN (first time)' })
  setPin(@CurrentUser() user: User, @Body() dto: SetPinDto) {
    return this.pinService
      .setPin(user.id, dto)
      .then(() => ({ message: 'PIN set successfully' }));
  }

  @Patch('change')
  @ApiOperation({ summary: 'Change transaction PIN' })
  changePin(@CurrentUser() user: User, @Body() dto: ChangePinDto) {
    return this.pinService
      .changePin(user.id, dto)
      .then(() => ({ message: 'PIN changed successfully' }));
  }

  @Post('verify')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Verify transaction PIN (for pre-authorisation flows)',
  })
  verifyPin(@CurrentUser() user: User, @Body() dto: VerifyPinDto) {
    return this.pinService
      .verifyPin(user.id, dto)
      .then(() => ({ valid: true }));
  }
}
