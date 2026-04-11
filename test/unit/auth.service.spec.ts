import { Test, TestingModule } from '@nestjs/testing';
import { ConflictException, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { AuthService } from '../../src/auth/auth.service';
import { UsersService } from '../../src/users/users.service';
import {
  User,
  UserRole,
  KycStatus,
} from '../../src/users/entities/user.entity';

// ── Mock factories ──────────────────────────────────────────────────────────
const mockUser: User = Object.assign(new User(), {
  id: 'user-uuid-1',
  email: 'ada@example.com',
  firstName: 'Ada',
  lastName: 'Okonkwo',
  phoneNumber: '08012345678',
  password: 'hashed-password',
  role: UserRole.CUSTOMER,
  kycStatus: KycStatus.PENDING,
  isEmailVerified: false,
  isActive: true,
  refreshToken: null,
  transactionPin: null,
  accounts: [],
  createdAt: new Date('2024-01-01T00:00:00.000Z'),
  updatedAt: new Date('2024-01-01T00:00:00.000Z'),
  validatePassword: jest.fn().mockResolvedValue(true),
});

const mockUsersService = {
  findByEmail: jest.fn(),
  findById: jest.fn(),
  create: jest.fn(),
  updateRefreshToken: jest.fn(),
};

const mockJwtService = {
  signAsync: jest.fn().mockResolvedValue('mock-token'),
};

const mockConfigService = {
  get: jest.fn((key: string) => {
    const config: Record<string, string> = {
      'jwt.secret': 'test-secret',
      'jwt.expiresIn': '15m',
      'jwt.refreshSecret': 'refresh-secret',
      'jwt.refreshExpiresIn': '7d',
    };
    return config[key];
  }),
};

// ── Tests ───────────────────────────────────────────────────────────────────
describe('AuthService', () => {
  let service: AuthService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuthService,
        { provide: UsersService, useValue: mockUsersService },
        { provide: JwtService, useValue: mockJwtService },
        { provide: ConfigService, useValue: mockConfigService },
      ],
    }).compile();

    service = module.get<AuthService>(AuthService);
    jest.clearAllMocks();
  });

  describe('register', () => {
    it('should register a new user and return tokens', async () => {
      mockUsersService.findByEmail.mockResolvedValue(null);
      mockUsersService.create.mockResolvedValue(mockUser);
      mockUsersService.updateRefreshToken.mockResolvedValue(undefined);

      const result = await service.register({
        email: 'ada@example.com',
        firstName: 'Ada',
        lastName: 'Okonkwo',
        password: 'Str0ng!Pass',
      });

      expect(result).toHaveProperty('accessToken');
      expect(result).toHaveProperty('refreshToken');
      expect(result.user).toEqual(mockUser);
      expect(mockUsersService.create).toHaveBeenCalledTimes(1);
    });

    it('should throw ConflictException if email already exists', async () => {
      mockUsersService.findByEmail.mockResolvedValue(mockUser);

      await expect(
        service.register({
          email: 'ada@example.com',
          firstName: 'Ada',
          lastName: 'Okonkwo',
          password: 'Str0ng!Pass',
        }),
      ).rejects.toThrow(ConflictException);
    });
  });

  describe('validateUser', () => {
    it('should return user when credentials are valid', async () => {
      mockUsersService.findByEmail.mockResolvedValue(mockUser);

      const result = await service.validateUser(
        'ada@example.com',
        'Str0ng!Pass',
      );
      expect(result).toEqual(mockUser);
    });

    it('should return null when user is not found', async () => {
      mockUsersService.findByEmail.mockResolvedValue(null);

      const result = await service.validateUser('nobody@example.com', 'pass');
      expect(result).toBeNull();
    });

    it('should return null when password is invalid', async () => {
      const userWithBadPass = {
        ...mockUser,
        validatePassword: jest.fn().mockResolvedValue(false),
      };
      mockUsersService.findByEmail.mockResolvedValue(userWithBadPass);

      const result = await service.validateUser('ada@example.com', 'wrong');
      expect(result).toBeNull();
    });

    it('should throw UnauthorizedException when account is inactive', async () => {
      mockUsersService.findByEmail.mockResolvedValue({
        ...mockUser,
        isActive: false,
      });

      await expect(
        service.validateUser('ada@example.com', 'Str0ng!Pass'),
      ).rejects.toThrow(UnauthorizedException);
    });
  });

  describe('login', () => {
    it('should return tokens on valid login', async () => {
      mockUsersService.updateRefreshToken.mockResolvedValue(undefined);

      const result = await service.login(mockUser);

      expect(result).toHaveProperty('user', mockUser);
      expect(result).toHaveProperty('accessToken', 'mock-token');
      expect(result).toHaveProperty('refreshToken', 'mock-token');
      expect(mockUsersService.updateRefreshToken).toHaveBeenCalledWith(
        mockUser.id,
        'mock-token',
      );
    });
  });

  describe('logout', () => {
    it('should clear the refresh token', async () => {
      mockUsersService.updateRefreshToken.mockResolvedValue(undefined);

      const result = await service.logout(mockUser.id);

      expect(mockUsersService.updateRefreshToken).toHaveBeenCalledWith(
        mockUser.id,
        null,
      );
      expect(result).toEqual({ message: 'Logged out successfully' });
    });
  });
});
