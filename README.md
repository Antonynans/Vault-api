# Vault API

Production-grade NestJS/TypeScript backend. Covers authentication, multi-currency accounts, atomic transactions, KYC, wallet tiers, event-driven notifications, audit logs, admin dashboard, and scheduled maintenance.

---
[![Live Demo](https://img.shields.io/badge/Live-Demo-green?style=for-the-badge&logo=vercel)](https://vault-app1.netlify.app)
[![API Docs](https://img.shields.io/badge/API-Swagger-blue?style=for-the-badge&logo=swagger)](https://vault-api-sbav.onrender.com/api/docs)
---

## Tech stack

| Layer        | Technology                                           |
|--------------|------------------------------------------------------|
| Framework    | NestJS 10 + TypeScript                               |
| Database     | PostgreSQL 16 + TypeORM                              |
| Auth         | JWT (access + refresh tokens), Passport, bcrypt      |
| Validation   | class-validator + class-transformer                  |
| Events       | @nestjs/event-emitter                                |
| Scheduling   | @nestjs/schedule (cron jobs)                         |
| Rate limiting| @nestjs/throttler                                    |
| Docs         | Swagger / OpenAPI 3 at /api/docs                     |
| Health       | @nestjs/terminus                                     |
| Container    | Docker multi-stage + Docker Compose                  |

---

## Quick start

### Docker (zero setup)
```bash
docker compose up --build
# API    → http://localhost:3000/api
# Docs   → http://localhost:3000/api/docs
# Health → http://localhost:3000/api/health/ping
```

### Local
```bash
npm install
cp .env.example .env      # fill in secrets
docker compose up postgres -d
npm run start:dev
```


---

## Key design decisions

**Atomic money movement** — Every financial operation uses a `QueryRunner` to wrap balance changes and transaction records in one PostgreSQL transaction. Failures roll back entirely; the failed record is persisted for audit.

**Event-driven notifications** — Services emit typed domain events (`EVENTS.TRANSFER_COMPLETED`, etc.) via `EventEmitter2`. `NotificationsService` subscribes with `@OnEvent()` decorators — zero coupling between modules.

**Idempotency** — Send `Idempotency-Key: <uuid>` on transfers/withdrawals. The guard rejects duplicate keys used within 24 hours with `409 Conflict` + original transaction details.

**Wallet limits in minor units** — All comparisons use integer kobo/cents (`bigint`) — no floating-point precision bugs.

**Secure by default** — `JwtAuthGuard` is a global `APP_GUARD`. Routes explicitly opt out with `@Public()` rather than opting in.

**Fire-and-forget audit** — `AuditService.log()` is async and internally swallows errors so audit write failures never surface to consumers.

---

## Migrations

```bash
npm run migration:generate   # generate after entity changes
npm run migration:run        # apply pending
npm run migration:revert     # rollback last
npm run migration:show       # list status
```

---

## Testing

```bash
npm run test:unit   # unit tests (auth + transaction money logic)
npm run test:cov    # coverage report
```

---

## Wallet tiers

| Tier     | KYC required | Single tx  | Monthly      |
|----------|-------------|------------|--------------|
| Basic    | No          | ₦50,000    | ₦500,000     |
| Standard | Soft KYC    | ₦200,000   | ₦2,000,000   |
| Premium  | Full KYC    | ₦2,000,000 | ₦20,000,000  |

---

## Scheduled jobs

| When             | Job                                                      |
|------------------|----------------------------------------------------------|
| Every hour       | Expire PENDING transactions stuck > 30 min → FAILED      |
| Daily 02:00      | Purge read notifications older than 90 days              |
| Weekly Sunday    | Purge audit logs older than 1 year                       |

---

## Security

Helmet · CORS per-env · JWT 15m access / 7d refresh (hashed) · bcrypt 12 rounds · `whitelist: true` validation · global rate limiting · idempotency guard · RBAC on all sensitive routes · non-root Docker user · `@Exclude()` on password/refreshToken · SSL for Postgres in production
