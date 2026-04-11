import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import { getRepositoryToken } from '@nestjs/typeorm';
import { ConfigModule } from '@nestjs/config';
import { ThrottlerModule } from '@nestjs/throttler';
import { EventEmitterModule } from '@nestjs/event-emitter';
import request from 'supertest';
import * as jwt from 'jsonwebtoken';

import { AuthModule } from '../../src/auth/auth.module';
import { UsersModule } from '../../src/users/users.module';
import { AccountsModule } from '../../src/accounts/accounts.module';
import { AuditModule } from '../../src/audit/audit.module';
import {
  User,
  UserRole,
  KycStatus,
} from '../../src/users/entities/user.entity';
import {
  Account,
  AccountStatus,
  AccountType,
  Currency,
} from '../../src/accounts/entities/account.entity';
import { AuditLog } from '../../src/audit/entities/audit-log.entity';

const JWT_SECRET = 'test-secret-32-chars-minimum!!!!!';

const mockUser: Partial<User> = {
  id: 'user-001',
  email: 'ada@test.com',
  firstName: 'Ada',
  lastName: 'Okonkwo',
  role: UserRole.CUSTOMER,
  kycStatus: KycStatus.PENDING,
  isActive: true,
};

const mockAccount: Partial<Account> = {
  id: 'acct-001',
  accountNumber: '0123456789',
  type: AccountType.WALLET,
  status: AccountStatus.ACTIVE,
  currency: Currency.NGN,
  balance: 50000,
  ledgerBalance: 50000,
  userId: 'user-001',
};

const userRepoMock = {
  findOne: jest.fn(),
  create: jest.fn(),
  save: jest.fn(),
  update: jest.fn(),
};
const accountRepoMock = {
  findOne: jest.fn(),
  find: jest.fn(),
  create: jest.fn(),
  save: jest.fn(),
  update: jest.fn(),
};
const auditRepoMock = {
  create: jest.fn().mockReturnValue({}),
  save: jest.fn().mockResolvedValue({}),
};

function makeToken(
  role: UserRole = UserRole.CUSTOMER,
  userId = 'user-001',
): string {
  return jwt.sign({ sub: userId, email: 'ada@test.com', role }, JWT_SECRET, {
    expiresIn: '15m',
  });
}

async function buildApp(): Promise<INestApplication> {
  const module: TestingModule = await Test.createTestingModule({
    imports: [
      ConfigModule.forRoot({
        isGlobal: true,
        load: [
          () => ({
            jwt: {
              secret: JWT_SECRET,
              expiresIn: '15m',
              refreshSecret: 'refresh!!!!',
              refreshExpiresIn: '7d',
            },
          }),
        ],
      }),
      ThrottlerModule.forRoot([{ ttl: 60_000, limit: 1000 }]),
      EventEmitterModule.forRoot(),
      AuditModule,
      AuthModule,
      UsersModule,
      AccountsModule,
    ],
  })
    .overrideProvider(getRepositoryToken(User))
    .useValue(userRepoMock)
    .overrideProvider(getRepositoryToken(Account))
    .useValue(accountRepoMock)
    .overrideProvider(getRepositoryToken(AuditLog))
    .useValue(auditRepoMock)
    .compile();

  const app = module.createNestApplication();
  app.setGlobalPrefix('api');
  app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));
  await app.init();
  return app;
}

describe('Accounts (e2e)', () => {
  let app: INestApplication;

  beforeAll(async () => {
    app = await buildApp();
  });
  afterAll(async () => {
    await app.close();
  });
  beforeEach(() => {
    jest.clearAllMocks();
    userRepoMock.findOne.mockResolvedValue(mockUser);
    accountRepoMock.findOne.mockResolvedValue(mockAccount);
    accountRepoMock.find.mockResolvedValue([mockAccount]);
    accountRepoMock.create.mockReturnValue(mockAccount);
    accountRepoMock.save.mockResolvedValue(mockAccount);
  });

  // ── Create ──────────────────────────────────────────────────────────────────
  describe('POST /api/accounts', () => {
    it('201 — creates a new account', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/accounts')
        .set('Authorization', `Bearer ${makeToken()}`)
        .send({ type: 'wallet', currency: 'NGN' });

      expect(res.status).toBe(201);
      expect(
        (res.body as { data: Record<string, unknown> }).data,
      ).toHaveProperty('accountNumber');
    });

    it('401 — requires authentication', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/accounts')
        .send({ type: 'wallet', currency: 'NGN' });

      expect(res.status).toBe(401);
    });

    it('400 — rejects invalid account type', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/accounts')
        .set('Authorization', `Bearer ${makeToken()}`)
        .send({ type: 'invalid_type' });

      expect(res.status).toBe(400);
    });

    it('400 — rejects invalid currency', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/accounts')
        .set('Authorization', `Bearer ${makeToken()}`)
        .send({ currency: 'DOGE' });

      expect(res.status).toBe(400);
    });
  });

  // ── List ────────────────────────────────────────────────────────────────────
  describe('GET /api/accounts', () => {
    it('200 — returns list of accounts', async () => {
      const res = await request(app.getHttpServer())
        .get('/api/accounts')
        .set('Authorization', `Bearer ${makeToken()}`);

      expect(res.status).toBe(200);
      expect(
        Array.isArray((res.body as { data: Record<string, unknown> }).data),
      ).toBe(true);
    });

    it('401 — requires authentication', async () => {
      const res = await request(app.getHttpServer()).get('/api/accounts');
      expect(res.status).toBe(401);
    });
  });

  // ── Freeze ──────────────────────────────────────────────────────────────────
  describe('PATCH /api/accounts/:id/freeze', () => {
    it('200 — freezes an account', async () => {
      accountRepoMock.save.mockResolvedValue({
        ...mockAccount,
        status: AccountStatus.FROZEN,
      });

      const res = await request(app.getHttpServer())
        .patch('/api/accounts/acct-001/freeze')
        .set('Authorization', `Bearer ${makeToken()}`);

      expect(res.status).toBe(200);

      expect((res.body as { data: Record<string, unknown> }).data.status).toBe(
        'frozen',
      );
    });

    it('403 — customer cannot unfreeze (admin only)', async () => {
      const res = await request(app.getHttpServer())
        .patch('/api/accounts/acct-001/unfreeze')
        .set('Authorization', `Bearer ${makeToken(UserRole.CUSTOMER)}`);

      expect(res.status).toBe(403);
    });

    it('200 — admin can unfreeze', async () => {
      accountRepoMock.save.mockResolvedValue({
        ...mockAccount,
        status: AccountStatus.ACTIVE,
      });

      const res = await request(app.getHttpServer())
        .patch('/api/accounts/acct-001/unfreeze')
        .set('Authorization', `Bearer ${makeToken(UserRole.ADMIN)}`);

      expect(res.status).toBe(200);
    });
  });

  // ── RBAC ────────────────────────────────────────────────────────────────────
  describe('Role-based access', () => {
    it('403 — customer cannot access admin-only routes', async () => {
      const res = await request(app.getHttpServer())
        .get('/api/users')
        .set('Authorization', `Bearer ${makeToken(UserRole.CUSTOMER)}`);

      expect(res.status).toBe(403);
    });
  });
});
