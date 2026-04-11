import {
  Injectable,
  BadRequestException,
  UnauthorizedException,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { User } from '../users/entities/user.entity';
import * as bcrypt from 'bcryptjs';
import { IsString, Length, Matches } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class SetPinDto {
  @ApiProperty({ description: '4-6 digit numeric PIN', example: '1234' })
  @IsString()
  @Length(4, 6)
  @Matches(/^\d+$/, { message: 'PIN must be numeric' })
  pin!: string;
}

export class ChangePinDto {
  @ApiProperty()
  @IsString()
  @Length(4, 6)
  @Matches(/^\d+$/, { message: 'PIN must be numeric' })
  currentPin!: string;

  @ApiProperty()
  @IsString()
  @Length(4, 6)
  @Matches(/^\d+$/, { message: 'PIN must be numeric' })
  newPin!: string;
}

export class VerifyPinDto {
  @ApiProperty()
  @IsString()
  @Length(4, 6)
  @Matches(/^\d+$/)
  pin!: string;
}

const MAX_ATTEMPTS = 3;
const LOCKOUT_MS = 15 * 60 * 1000; // 15 minutes

@Injectable()
export class TransactionPinService {
  // In-memory attempt tracker (use Redis in production for multi-instance)
  private readonly attempts = new Map<
    string,
    { count: number; lockedUntil: number }
  >();

  constructor(
    @InjectRepository(User)
    private readonly userRepo: Repository<User>,
  ) {}

  async setPin(userId: string, dto: SetPinDto): Promise<void> {
    const user = await this.userRepo.findOne({ where: { id: userId } });
    if (!user) throw new NotFoundException('User not found');

    const hashed = await bcrypt.hash(dto.pin, 10);
    // Store hashed PIN in a dedicated column (see note below)
    await this.userRepo.update(userId, { transactionPin: hashed });
  }

  async changePin(userId: string, dto: ChangePinDto): Promise<void> {
    await this.verifyPin(userId, { pin: dto.currentPin });
    const hashed = await bcrypt.hash(dto.newPin, 10);
    await this.userRepo.update(userId, { transactionPin: hashed });
    this.clearAttempts(userId);
  }

  async verifyPin(userId: string, dto: VerifyPinDto): Promise<void> {
    this.checkLockout(userId);

    const user = await this.userRepo
      .createQueryBuilder('u')
      .select(['u.id', 'u.transactionPin'])
      .where('u.id = :userId', { userId })
      .getOne();

    if (!user) throw new NotFoundException('User not found');

    const storedPin: string | null = user.transactionPin;
    if (!storedPin) {
      throw new BadRequestException(
        'Transaction PIN not set. Please set a PIN before transacting.',
      );
    }

    const valid = await bcrypt.compare(dto.pin, storedPin);
    if (!valid) {
      this.recordFailedAttempt(userId);
      const remaining = MAX_ATTEMPTS - (this.attempts.get(userId)?.count ?? 0);
      throw new UnauthorizedException(
        remaining > 0
          ? `Incorrect PIN. ${remaining} attempt(s) remaining.`
          : 'PIN locked for 15 minutes due to too many failed attempts.',
      );
    }

    this.clearAttempts(userId);
  }

  async hasPin(userId: string): Promise<boolean> {
    const user = await this.userRepo
      .createQueryBuilder('u')
      .select('u.transactionPin')
      .where('u.id = :userId', { userId })
      .getOne();
    return !!user?.transactionPin;
  }

  private checkLockout(userId: string): void {
    const state = this.attempts.get(userId);
    if (state && state.lockedUntil > Date.now()) {
      const remaining = Math.ceil((state.lockedUntil - Date.now()) / 60_000);
      throw new UnauthorizedException(
        `PIN is locked. Try again in ${remaining} minute(s).`,
      );
    }
  }

  private recordFailedAttempt(userId: string): void {
    const state = this.attempts.get(userId) ?? { count: 0, lockedUntil: 0 };
    state.count += 1;
    if (state.count >= MAX_ATTEMPTS) {
      state.lockedUntil = Date.now() + LOCKOUT_MS;
    }
    this.attempts.set(userId, state);
  }

  private clearAttempts(userId: string): void {
    this.attempts.delete(userId);
  }
}
