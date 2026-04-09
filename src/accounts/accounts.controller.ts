import {
  Controller,
  Get,
  Post,
  Param,
  Body,
  Patch,
  UseGuards,
} from '@nestjs/common';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import { AccountsService } from './accounts.service';
import { CreateAccountDto } from './dto/account.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { CurrentUser } from '../auth/decorators/public.decorator';
import { Roles } from '../auth/decorators/roles.decorator';
import { UserRole } from '../users/entities/user.entity';

@ApiTags('Accounts')
@ApiBearerAuth()
@Controller('accounts')
@UseGuards(JwtAuthGuard, RolesGuard)
export class AccountsController {
  constructor(private readonly accountsService: AccountsService) {}

  @Post()
  create(@CurrentUser() user: any, @Body() dto: CreateAccountDto) {
    return this.accountsService.create(user.id, dto);
  }

  @Get()
  findMyAccounts(@CurrentUser() user: any) {
    return this.accountsService.findAllForUser(user.id);
  }

  @Get(':id')
  findOne(@Param('id') id: string, @CurrentUser() user: any) {
    return this.accountsService.findOne(id, user.id);
  }

  @Patch(':id/freeze')
  freeze(@Param('id') id: string, @CurrentUser() user: any) {
    return this.accountsService.freeze(id, user.id);
  }

  @Patch(':id/unfreeze')
  @Roles(UserRole.ADMIN)
  unfreeze(@Param('id') id: string) {
    return this.accountsService.unfreeze(id);
  }
}
