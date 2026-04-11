# Vault API

Production-grade NestJS/TypeScript backend. Covers authentication, multi-currency accounts, atomic transactions, KYC, wallet tiers, event-driven notifications, audit logs, admin dashboard, and scheduled maintenance.

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

## Architecture

```
src/
├── auth/            JWT, Passport strategies, JwtAuthGuard, RolesGuard
├── users/           User entity, profile, admin management
├── accounts/        Multi-currency accounts (NGN/USD/GBP/EUR)
├── transactions/    Atomic transfers/deposits/withdrawals (QueryRunner)
├── wallets/         Tier-based spend limits in minor units (kobo)
├── kyc/             KYC state machine + auto wallet upgrade on approval
├── notifications/   In-app notifications via EventEmitter listeners
├── audit/           Global fire-and-forget immutable audit log
├── admin/           Dashboard stats + scheduled maintenance cron jobs
├── events/          Strongly-typed domain event payload contracts
├── health/          DB + memory + disk health probes
└── common/
    ├── filters/     Global exception filter (uniform error shape)
    ├── interceptors/ Response transform + HTTP request logging
    ├── guards/      Idempotency guard (prevents duplicate transactions)
    └── pipes/       Pagination pipe
database/
├── data-source.ts   TypeORM CLI datasource
└── migrations/      Versioned schema migrations with indexes
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

## API overview

Base path: `/api` — full docs at `/api/docs`

| Tag           | Key endpoints                                                      |
|---------------|--------------------------------------------------------------------|
| Auth          | POST /auth/register, /auth/login, /auth/refresh, /auth/logout      |
| Users         | GET /users/me, GET /users (Admin), PATCH /users/:id/deactivate     |
| Accounts      | POST /accounts, GET /accounts, PATCH /accounts/:id/freeze          |
| Transactions  | POST /transactions/transfer, /deposit, /withdraw; GET history      |
| Wallets       | GET /wallets/account/:id/limits, PATCH upgrade (Admin)             |
| KYC           | POST /kyc/submit, GET /kyc/me, PATCH /kyc/:id/review (Admin)       |
| Notifications | GET /notifications, PATCH read/read-all, GET unread-count          |
| Admin         | GET /admin/stats, /admin/user-growth                               |
| Health        | GET /health, /health/ping                                          |

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
