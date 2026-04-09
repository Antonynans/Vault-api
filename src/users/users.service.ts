import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { User } from './entities/user.entity';
import { RegisterDto } from '../auth/dto/auth.dto';
import * as bcrypt from 'bcryptjs';

@Injectable()
export class UsersService {
  constructor(
    @InjectRepository(User)
    private readonly userRepo: Repository<User>,
  ) {}

  async create(dto: RegisterDto): Promise<User> {
    const user = this.userRepo.create(dto);
    return this.userRepo.save(user);
  }

  async findById(id: string): Promise<User | null> {
    return this.userRepo.findOne({ where: { id }, relations: ['accounts'] });
  }

  async findByEmail(email: string): Promise<User | null> {
    return this.userRepo.findOne({ where: { email } });
  }

  async updateRefreshToken(userId: string, refreshToken: string | null) {
    const hashed = refreshToken ? await bcrypt.hash(refreshToken, 10) : null;
    await this.userRepo.update(userId, { refreshToken: hashed ?? undefined });
  }

  async findAll(): Promise<User[]> {
    return this.userRepo.find({
      select: [
        'id',
        'email',
        'firstName',
        'lastName',
        'role',
        'kycStatus',
        'createdAt',
      ],
    });
  }

  async deactivate(id: string): Promise<User> {
    const user = await this.findById(id);
    if (!user) throw new NotFoundException('User not found');
    user.isActive = false;
    return this.userRepo.save(user);
  }
}
