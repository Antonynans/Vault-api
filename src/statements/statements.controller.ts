import {
  Controller,
  Get,
  Param,
  Query,
  UseGuards,
  Res,
  BadRequestException,
} from '@nestjs/common';
import {
  ApiTags,
  ApiBearerAuth,
  ApiOperation,
  ApiQuery,
} from '@nestjs/swagger';
import type { Response } from 'express';
import { StatementsService } from './statements.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../auth/decorators/public.decorator';
import { User } from '../users/entities/user.entity';

@ApiTags('Statements')
@ApiBearerAuth()
@Controller('statements')
@UseGuards(JwtAuthGuard)
export class StatementsController {
  constructor(private readonly statementsService: StatementsService) {}

  @Get(':accountId/csv')
  @ApiOperation({ summary: 'Download account statement as CSV' })
  @ApiQuery({
    name: 'from',
    description: 'Start date YYYY-MM-DD',
    example: '2024-01-01',
  })
  @ApiQuery({
    name: 'to',
    description: 'End date YYYY-MM-DD',
    example: '2024-12-31',
  })
  async downloadCsv(
    @Param('accountId') accountId: string,
    @CurrentUser() user: User,
    @Query('from') fromStr: string,
    @Query('to') toStr: string,
    @Res() res: Response,
  ) {
    if (!fromStr || !toStr) {
      throw new BadRequestException(
        'Query params "from" and "to" are required (YYYY-MM-DD)',
      );
    }

    const from = new Date(fromStr);
    const to = new Date(toStr);
    to.setHours(23, 59, 59, 999); // inclusive end-of-day

    if (isNaN(from.getTime()) || isNaN(to.getTime())) {
      throw new BadRequestException('Invalid date format. Use YYYY-MM-DD');
    }
    if (from > to) {
      throw new BadRequestException('"from" must be before "to"');
    }

    const { csv, filename } = await this.statementsService.generateCsv(
      accountId,
      user.id,
      from,
      to,
    );

    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.send(csv);
  }
}
