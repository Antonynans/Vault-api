import {
  Injectable,
  NotFoundException,
  ConflictException,
  ForbiddenException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Beneficiary } from './entities/beneficiary.entity';
import { IsNotEmpty, IsOptional, IsString } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsNuban } from '../common/validators/fintech.validators';

export class CreateBeneficiaryDto {
  @ApiProperty({ example: '0123456789' })
  @IsNuban()
  accountNumber!: string;

  @ApiProperty({ example: 'Ada Okonkwo' })
  @IsString()
  @IsNotEmpty()
  accountName!: string;

  @ApiPropertyOptional({ example: 'Access Bank' })
  @IsString()
  @IsOptional()
  bankName?: string;

  @ApiPropertyOptional({ example: '044' })
  @IsString()
  @IsOptional()
  bankCode?: string;

  @ApiPropertyOptional({ example: 'Mum' })
  @IsString()
  @IsOptional()
  nickname?: string;
}

@Injectable()
export class BeneficiariesService {
  constructor(
    @InjectRepository(Beneficiary)
    private readonly beneficiaryRepo: Repository<Beneficiary>,
  ) {}

  async create(
    userId: string,
    dto: CreateBeneficiaryDto,
  ): Promise<Beneficiary> {
    const existing = await this.beneficiaryRepo.findOne({
      where: { userId, accountNumber: dto.accountNumber },
    });
    if (existing) {
      throw new ConflictException(
        'Beneficiary with this account number already saved',
      );
    }

    const beneficiary = this.beneficiaryRepo.create({ userId, ...dto });
    return this.beneficiaryRepo.save(beneficiary);
  }

  async findAll(userId: string): Promise<Beneficiary[]> {
    return this.beneficiaryRepo.find({
      where: { userId, isActive: true },
      order: { transferCount: 'DESC', accountName: 'ASC' }, // most used first
    });
  }

  async findOne(id: string, userId: string): Promise<Beneficiary> {
    const b = await this.beneficiaryRepo.findOne({ where: { id } });
    if (!b) throw new NotFoundException('Beneficiary not found');
    if (b.userId !== userId) throw new ForbiddenException('Access denied');
    return b;
  }

  async update(
    id: string,
    userId: string,
    dto: Partial<CreateBeneficiaryDto>,
  ): Promise<Beneficiary> {
    const b = await this.findOne(id, userId);
    Object.assign(b, dto);
    return this.beneficiaryRepo.save(b);
  }

  async remove(id: string, userId: string): Promise<void> {
    const b = await this.findOne(id, userId);
    b.isActive = false;
    await this.beneficiaryRepo.save(b);
  }

  async recordTransfer(userId: string, accountNumber: string): Promise<void> {
    const b = await this.beneficiaryRepo.findOne({
      where: { userId, accountNumber },
    });
    if (!b) return;
    b.transferCount += 1;
    b.lastTransferAt = new Date();
    await this.beneficiaryRepo.save(b);
  }
}
