import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import { getRepositoryToken } from '@nestjs/typeorm';
import { ConfigModule } from '@nestjs/config';
import { ThrottlerModule } from '@nestjs/throttler';
import { EventEmitterModule } from '@nestjs/event-emitter';
import request from 'supertest';

import { AuthModule } from '../../src/auth/auth.module';
import { UsersModule } from '../../src/users/users.module';
import { AuditModule } from '../../src/audit/audit.module';
import {
  User,
  UserRole,
  KycStatus,
} from '../../src/users/entities/user.entity';
import { AuditLog } from '../../src/audit/entities/audit-log.entity';

// ── Shared mock user ──────────────────────────────────────────────────────────
const mockUser: Partial<User> = {
  id: 'user-uuid-001',
  email: 'ada@example.com',
  firstName: 'Ada',
  lastName: 'Okonkwo',
  role: UserRole.CUSTOMER,
  kycStatus: KycStatus.PENDING,
  isActive: true,
  isEmailVerified: false,
  refreshToken: undefined,
  validatePassword: jest.fn().mockResolvedValue(true),
  hashPassword: jest.fn(),
};

// ── Repository mocks ──────────────────────────────────────────────────────────
const userRepoMock = {
  findOne: jest.fn(),
  create: jest.fn().mockReturnValue(mockUser),
  save: jest.fn().mockResolvedValue(mockUser),
  update: jest.fn().mockResolvedValue({ affected: 1 }),
  count: jest.fn().mockResolvedValue(0),
  find: jest.fn().mockResolvedValue([]),
};

const auditRepoMock = {
  create: jest.fn().mockReturnValue({}),
  save: jest.fn().mockResolvedValue({}),
};

// ── App factory ───────────────────────────────────────────────────────────────
async function buildApp(): Promise<INestApplication> {
  const module: TestingModule = await Test.createTestingModule({
    imports: [
      ConfigModule.forRoot({
        isGlobal: true,
        load: [
          () => ({
            jwt: {
              secret: 'test-secret-32-chars-minimum!!!!!',
              expiresIn: '15m',
              refreshSecret: 'test-refresh-secret-32-chars!!!!',
              refreshExpiresIn: '7d',
            },
          }),
        ],
      }),
      ThrottlerModule.forRoot([{ ttl: 60_000, limit: 1000 }]),
      EventEmitterModule.forRoot(),
      AuthModule,
      UsersModule,
      AuditModule,
    ],
  })
    .overrideProvider(getRepositoryToken(User))
    .useValue(userRepoMock)
    .overrideProvider(getRepositoryToken(AuditLog))
    .useValue(auditRepoMock)
    .compile();

  const app = module.createNestApplication();
  app.setGlobalPrefix('api');
  app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));
  await app.init();
  return app;
}

// ── Tests ─────────────────────────────────────────────────────────────────────
describe('Auth (e2e)', () => {
  let app: INestApplication;

  beforeAll(async () => {
    app = await buildApp();
  });

  afterAll(async () => {
    await app.close();
  });

  beforeEach(() => jest.clearAllMocks());

  // ── Register ────────────────────────────────────────────────────────────────
  describe('POST /api/auth/register', () => {
    it('201 — registers a new user', async () => {
      userRepoMock.findOne.mockResolvedValue(null); // email not taken

      const res = await request(app.getHttpServer())
        .post('/api/auth/register')
        .send({
          email: 'ada@example.com',
          firstName: 'Ada',
          lastName: 'Okonkwo',
          password: 'Str0ng!Pass',
        });

      expect(res.status).toBe(201);
      expect(
        (res.body as { data: Record<string, unknown> }).data,
      ).toHaveProperty('accessToken');
      expect(
        (res.body as { data: Record<string, unknown> }).data,
      ).toHaveProperty('refreshToken');
      expect(
        (res.body as { data: Record<string, unknown> }).data.user,
      ).toHaveProperty('email', 'ada@example.com');
    });

    it('409 — rejects duplicate email', async () => {
      userRepoMock.findOne.mockResolvedValue(mockUser); // email exists

      const res = await request(app.getHttpServer())
        .post('/api/auth/register')
        .send({
          email: 'ada@example.com',
          firstName: 'Ada',
          lastName: 'Okonkwo',
          password: 'Str0ng!Pass',
        });

      expect(res.status).toBe(409);
      expect((res.body as { data: Record<string, unknown> }).data.success).toBe(
        false,
      );
    });

    it('400 — rejects weak password', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/auth/register')
        .send({
          email: 'new@example.com',
          firstName: 'Test',
          lastName: 'User',
          password: 'weak',
        });

      expect(res.status).toBe(400);
    });

    it('400 — rejects missing fields', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/auth/register')
        .send({ email: 'incomplete@example.com' });

      expect(res.status).toBe(400);
    });

    it('400 — rejects invalid email format', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/auth/register')
        .send({
          email: 'not-an-email',
          firstName: 'Ada',
          lastName: 'Okonkwo',
          password: 'Str0ng!Pass',
        });

      expect(res.status).toBe(400);
    });

    it('400 — rejects unknown fields (whitelist)', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/auth/register')
        .send({
          email: 'ada@example.com',
          firstName: 'Ada',
          lastName: 'Okonkwo',
          password: 'Str0ng!Pass',
          unknownField: 'hacker',
        });

      expect(res.status).toBe(400);
    });
  });

  // ── Login ────────────────────────────────────────────────────────────────────
  describe('POST /api/auth/login', () => {
    it('200 — logs in with valid credentials', async () => {
      userRepoMock.findOne.mockResolvedValue(mockUser);

      const res = await request(app.getHttpServer())
        .post('/api/auth/login')
        .send({ email: 'ada@example.com', password: 'Str0ng!Pass' });

      expect(res.status).toBe(200);
      expect(
        (res.body as { data: Record<string, unknown> }).data,
      ).toHaveProperty('accessToken');
    });

    it('401 — rejects invalid credentials', async () => {
      const userWithBadPass = {
        ...mockUser,
        validatePassword: jest.fn().mockResolvedValue(false),
      };
      userRepoMock.findOne.mockResolvedValue(userWithBadPass);

      const res = await request(app.getHttpServer())
        .post('/api/auth/login')
        .send({ email: 'ada@example.com', password: 'WrongPass1!' });

      expect(res.status).toBe(401);
    });

    it('401 — rejects non-existent user', async () => {
      userRepoMock.findOne.mockResolvedValue(null);

      const res = await request(app.getHttpServer())
        .post('/api/auth/login')
        .send({ email: 'ghost@example.com', password: 'Str0ng!Pass' });

      expect(res.status).toBe(401);
    });

    it('401 — rejects inactive account', async () => {
      userRepoMock.findOne.mockResolvedValue({ ...mockUser, isActive: false });

      const res = await request(app.getHttpServer())
        .post('/api/auth/login')
        .send({ email: 'ada@example.com', password: 'Str0ng!Pass' });

      expect(res.status).toBe(401);
    });
  });

  // ── Protected routes ─────────────────────────────────────────────────────────
  describe('Protected route access', () => {
    it('401 — GET /api/users/me without token', async () => {
      const res = await request(app.getHttpServer()).get('/api/users/me');
      expect(res.status).toBe(401);
    });

    it('401 — POST /api/auth/logout without token', async () => {
      const res = await request(app.getHttpServer()).post('/api/auth/logout');
      expect(res.status).toBe(401);
    });
  });

  // ── Response shape ────────────────────────────────────────────────────────────
  describe('Response envelope', () => {
    it('success responses have { success, statusCode, data, timestamp }', async () => {
      userRepoMock.findOne.mockResolvedValue(null);

      const res = await request(app.getHttpServer())
        .post('/api/auth/register')
        .send({
          email: 'envelope@example.com',
          firstName: 'Test',
          lastName: 'User',
          password: 'Str0ng!Pass',
        });

      expect(
        res.body as { success: boolean; statusCode: number },
      ).toMatchObject({
        success: true,
        statusCode: 201,
      });
      expect(typeof (res.body as { timestamp: unknown }).timestamp).toBe(
        'string',
      );
      expect((res.body as { data: unknown }).data).toBeInstanceOf(Object);
    });

    it('error responses have { success: false, statusCode, message }', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/auth/login')
        .send({ email: 'bad' }); // missing password, invalid email

      expect(res.body as unknown).toMatchObject({
        success: false,
        statusCode: 400,
      });
    });
  });
});
