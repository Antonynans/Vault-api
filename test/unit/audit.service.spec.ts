import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { AuditService } from '../../src/audit/audit.service';
import {
  AuditLog,
  AuditAction,
} from '../../src/audit/entities/audit-log.entity';

const auditRepoMock = {
  create: jest.fn(),
  save: jest.fn(),
  findOne: jest.fn(),
  findAndCount: jest.fn(),
  find: jest.fn(),
};

describe('AuditService', () => {
  let service: AuditService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuditService,
        { provide: getRepositoryToken(AuditLog), useValue: auditRepoMock },
      ],
    }).compile();

    service = module.get<AuditService>(AuditService);
    jest.clearAllMocks();
  });

  describe('log', () => {
    it('saves an audit entry without throwing', () => {
      const entry = { action: AuditAction.USER_LOGIN, userId: 'user-001' };
      auditRepoMock.create.mockReturnValue(entry);
      auditRepoMock.save.mockResolvedValue(entry);

      expect(() =>
        service.log(AuditAction.USER_LOGIN, {
          userId: 'user-001',
          ipAddress: '127.0.0.1',
        }),
      ).not.toThrow();

      expect(auditRepoMock.create).toHaveBeenCalledWith(
        expect.objectContaining({ action: AuditAction.USER_LOGIN }),
      );
    });

    it('does NOT throw even when the DB save fails (fire-and-forget)', async () => {
      auditRepoMock.create.mockReturnValue({});
      auditRepoMock.save.mockRejectedValue(new Error('DB connection lost'));

      expect(() =>
        service.log(AuditAction.TRANSFER_FAILED, { userId: 'user-001' }),
      ).not.toThrow();

      // Give the async rejection time to fire
      await new Promise((r) => setTimeout(r, 50));
      // If we got here, the error was swallowed as designed
    });

    it('includes all context fields in the created entry', () => {
      const context = {
        userId: 'user-001',
        resourceId: 'tx-001',
        resourceType: 'transaction',
        ipAddress: '10.0.0.1',
        isSuspicious: true,
        metadata: { amount: 5000, reason: 'test' },
      };
      auditRepoMock.create.mockReturnValue({});
      auditRepoMock.save.mockResolvedValue({});

      service.log(AuditAction.TRANSFER_COMPLETED, context);

      expect(auditRepoMock.create).toHaveBeenCalledWith(
        expect.objectContaining({
          action: AuditAction.TRANSFER_COMPLETED,
          ...context,
        }),
      );
    });
  });

  describe('findByUser', () => {
    it('queries with correct userId and ordering', async () => {
      auditRepoMock.findAndCount.mockResolvedValue([[], 0]);

      await service.findByUser('user-001');

      expect(auditRepoMock.findAndCount).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { userId: 'user-001' },
          order: { createdAt: 'DESC' },
        }),
      );
    });

    it('respects limit and offset', async () => {
      auditRepoMock.findAndCount.mockResolvedValue([[], 0]);

      await service.findByUser('user-001', 10, 20);

      expect(auditRepoMock.findAndCount).toHaveBeenCalledWith(
        expect.objectContaining({ take: 10, skip: 20 }),
      );
    });
  });

  describe('findSuspicious', () => {
    it('filters by isSuspicious: true', async () => {
      auditRepoMock.find.mockResolvedValue([]);

      await service.findSuspicious();

      expect(auditRepoMock.find).toHaveBeenCalledWith(
        expect.objectContaining({ where: { isSuspicious: true } }),
      );
    });
  });
});
