import {
  Controller,
  Post,
  Get,
  Patch,
  Body,
  Param,
  UseGuards,
} from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { KycService } from './kyc.service';
import { SubmitKycDto, ReviewKycDto } from './dto/kyc.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { CurrentUser } from '../auth/decorators/public.decorator';
import { Roles } from '../auth/decorators/roles.decorator';
import { User, UserRole } from '../users/entities/user.entity';

@ApiTags('KYC')
@ApiBearerAuth()
@Controller('kyc')
@UseGuards(JwtAuthGuard, RolesGuard)
export class KycController {
  constructor(private readonly kycService: KycService) {}

  @Post('submit')
  @ApiOperation({ summary: 'Submit KYC documents for verification' })
  submit(@CurrentUser() user: User, @Body() dto: SubmitKycDto) {
    return this.kycService.submit(user.id, dto);
  }

  @Get('me')
  @ApiOperation({ summary: 'Get my KYC submission status' })
  getMyStatus(@CurrentUser() user: User) {
    return this.kycService.getMySubmission(user.id);
  }

  @Get('pending')
  @Roles(UserRole.ADMIN, UserRole.SUPPORT)
  @ApiOperation({ summary: 'List all pending KYC submissions (Admin/Support)' })
  getPending() {
    return this.kycService.findPending();
  }

  @Get()
  @Roles(UserRole.ADMIN)
  @ApiOperation({ summary: 'List all KYC submissions (Admin only)' })
  getAll() {
    return this.kycService.findAll();
  }

  @Patch(':id/review')
  @Roles(UserRole.ADMIN)
  @ApiOperation({ summary: 'Approve or reject a KYC submission (Admin only)' })
  review(
    @Param('id') id: string,
    @CurrentUser() reviewer: User,
    @Body() dto: ReviewKycDto,
  ) {
    return this.kycService.review(id, reviewer.id, dto);
  }
}
