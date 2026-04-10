import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Param,
  Body,
  UseGuards,
} from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import {
  BeneficiariesService,
  CreateBeneficiaryDto,
} from './beneficiaries.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../auth/decorators/public.decorator';
import { User } from '../users/entities/user.entity';

@ApiTags('Beneficiaries')
@ApiBearerAuth()
@Controller('beneficiaries')
@UseGuards(JwtAuthGuard)
export class BeneficiariesController {
  constructor(private readonly beneficiariesService: BeneficiariesService) {}

  @Post()
  @ApiOperation({ summary: 'Save a new beneficiary' })
  create(@CurrentUser() user: User, @Body() dto: CreateBeneficiaryDto) {
    return this.beneficiariesService.create(user.id, dto);
  }

  @Get()
  @ApiOperation({ summary: 'List saved beneficiaries (most used first)' })
  findAll(@CurrentUser() user: User) {
    return this.beneficiariesService.findAll(user.id);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get a single beneficiary' })
  findOne(@Param('id') id: string, @CurrentUser() user: User) {
    return this.beneficiariesService.findOne(id, user.id);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Update nickname or bank details' })
  update(
    @Param('id') id: string,
    @CurrentUser() user: User,
    @Body() dto: Partial<CreateBeneficiaryDto>,
  ) {
    return this.beneficiariesService.update(id, user.id, dto);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Remove a saved beneficiary' })
  remove(@Param('id') id: string, @CurrentUser() user: User) {
    return this.beneficiariesService.remove(id, user.id);
  }
}
