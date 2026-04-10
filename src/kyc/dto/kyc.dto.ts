import { IsEnum, IsString, IsOptional, Length } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { DocumentType } from '../entities/kyc-submission.entity';

export class SubmitKycDto {
  @ApiProperty({ enum: DocumentType, example: DocumentType.NIN })
  @IsEnum(DocumentType)
  documentType!: DocumentType;

  @ApiProperty({
    example: '12345678901',
    description: 'NIN, BVN or document number',
  })
  @IsString()
  @Length(6, 20)
  documentNumber!: string;

  @ApiPropertyOptional({
    description: 'URL to uploaded front-of-document image',
  })
  @IsString()
  @IsOptional()
  documentFrontUrl?: string;

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  documentBackUrl?: string;

  @ApiPropertyOptional({ description: 'URL to selfie image' })
  @IsString()
  @IsOptional()
  selfieUrl?: string;
}

export class ReviewKycDto {
  @ApiProperty({ enum: ['approved', 'rejected'] })
  @IsEnum(['approved', 'rejected'])
  decision!: 'approved' | 'rejected';

  @ApiPropertyOptional({ description: 'Required when decision is rejected' })
  @IsString()
  @IsOptional()
  rejectionReason?: string | null;
}
