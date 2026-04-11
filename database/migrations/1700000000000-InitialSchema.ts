import { MigrationInterface, QueryRunner } from 'typeorm';

export class InitialSchema1700000000000 implements MigrationInterface {
  name = 'InitialSchema1700000000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // ── ENUMS ──────────────────────────────────────────────────────────────────
    await queryRunner.query(
      `CREATE TYPE "user_role_enum" AS ENUM('customer', 'admin', 'support')`,
    );
    await queryRunner.query(
      `CREATE TYPE "kyc_status_enum" AS ENUM('pending', 'verified', 'rejected')`,
    );
    await queryRunner.query(
      `CREATE TYPE "account_type_enum" AS ENUM('savings', 'current', 'wallet')`,
    );
    await queryRunner.query(
      `CREATE TYPE "account_status_enum" AS ENUM('active', 'frozen', 'closed')`,
    );
    await queryRunner.query(
      `CREATE TYPE "currency_enum" AS ENUM('NGN', 'USD', 'GBP', 'EUR')`,
    );
    await queryRunner.query(
      `CREATE TYPE "transaction_type_enum" AS ENUM('transfer', 'deposit', 'withdrawal', 'payment', 'reversal')`,
    );
    await queryRunner.query(
      `CREATE TYPE "transaction_status_enum" AS ENUM('pending', 'processing', 'completed', 'failed', 'reversed')`,
    );
    await queryRunner.query(
      `CREATE TYPE "wallet_tier_enum" AS ENUM('basic', 'standard', 'premium')`,
    );

    // ── USERS ──────────────────────────────────────────────────────────────────
    await queryRunner.query(`
      CREATE TABLE "users" (
        "id"              UUID DEFAULT gen_random_uuid() PRIMARY KEY,
        "email"           VARCHAR NOT NULL UNIQUE,
        "firstName"       VARCHAR NOT NULL,
        "lastName"        VARCHAR NOT NULL,
        "phoneNumber"     VARCHAR UNIQUE,
        "password"        VARCHAR NOT NULL,
        "role"            "user_role_enum" NOT NULL DEFAULT 'customer',
        "kycStatus"       "kyc_status_enum" NOT NULL DEFAULT 'pending',
        "isEmailVerified" BOOLEAN NOT NULL DEFAULT false,
        "isActive"        BOOLEAN NOT NULL DEFAULT true,
        "refreshToken"    VARCHAR,
        "createdAt"       TIMESTAMP NOT NULL DEFAULT now(),
        "updatedAt"       TIMESTAMP NOT NULL DEFAULT now()
      )
    `);

    // ── ACCOUNTS ───────────────────────────────────────────────────────────────
    await queryRunner.query(`
      CREATE TABLE "accounts" (
        "id"             UUID DEFAULT gen_random_uuid() PRIMARY KEY,
        "accountNumber"  VARCHAR NOT NULL UNIQUE,
        "type"           "account_type_enum" NOT NULL DEFAULT 'wallet',
        "status"         "account_status_enum" NOT NULL DEFAULT 'active',
        "currency"       "currency_enum" NOT NULL DEFAULT 'NGN',
        "balance"        DECIMAL(18,2) NOT NULL DEFAULT 0,
        "ledgerBalance"  DECIMAL(18,2) NOT NULL DEFAULT 0,
        "userId"         UUID NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
        "createdAt"      TIMESTAMP NOT NULL DEFAULT now(),
        "updatedAt"      TIMESTAMP NOT NULL DEFAULT now()
      )
    `);
    await queryRunner.query(
      `CREATE INDEX "idx_accounts_userId" ON "accounts"("userId")`,
    );

    // ── TRANSACTIONS ───────────────────────────────────────────────────────────
    await queryRunner.query(`
      CREATE TABLE "transactions" (
        "id"                   UUID DEFAULT gen_random_uuid() PRIMARY KEY,
        "reference"            VARCHAR NOT NULL UNIQUE,
        "type"                 "transaction_type_enum" NOT NULL,
        "status"               "transaction_status_enum" NOT NULL DEFAULT 'pending',
        "amount"               DECIMAL(18,2) NOT NULL,
        "fee"                  DECIMAL(18,2) NOT NULL DEFAULT 0,
        "currency"             "currency_enum" NOT NULL,
        "description"          VARCHAR,
        "metadata"             VARCHAR,
        "sourceAccountId"      UUID REFERENCES "accounts"("id"),
        "destinationAccountId" UUID REFERENCES "accounts"("id"),
        "reversalOf"           VARCHAR,
        "failureReason"        VARCHAR,
        "createdAt"            TIMESTAMP NOT NULL DEFAULT now(),
        "updatedAt"            TIMESTAMP NOT NULL DEFAULT now()
      )
    `);
    await queryRunner.query(
      `CREATE INDEX "idx_transactions_sourceAccountId" ON "transactions"("sourceAccountId")`,
    );
    await queryRunner.query(
      `CREATE INDEX "idx_transactions_destinationAccountId" ON "transactions"("destinationAccountId")`,
    );
    await queryRunner.query(
      `CREATE INDEX "idx_transactions_reference" ON "transactions"("reference")`,
    );
    await queryRunner.query(
      `CREATE INDEX "idx_transactions_createdAt" ON "transactions"("createdAt" DESC)`,
    );

    // ── WALLETS ────────────────────────────────────────────────────────────────
    await queryRunner.query(`
      CREATE TABLE "wallets" (
        "id"                     UUID DEFAULT gen_random_uuid() PRIMARY KEY,
        "accountId"              UUID NOT NULL UNIQUE REFERENCES "accounts"("id") ON DELETE CASCADE,
        "tier"                   "wallet_tier_enum" NOT NULL DEFAULT 'basic',
        "dailyLimit"             BIGINT NOT NULL DEFAULT 10000000,
        "singleTransactionLimit" BIGINT NOT NULL DEFAULT 5000000,
        "monthlySpend"           BIGINT NOT NULL DEFAULT 0,
        "monthlyLimit"           BIGINT NOT NULL DEFAULT 50000000,
        "spendResetDate"         TIMESTAMP,
        "isVirtual"              BOOLEAN NOT NULL DEFAULT false,
        "createdAt"              TIMESTAMP NOT NULL DEFAULT now(),
        "updatedAt"              TIMESTAMP NOT NULL DEFAULT now()
      )
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS "wallets"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "transactions"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "accounts"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "users"`);
    await queryRunner.query(`DROP TYPE IF EXISTS "wallet_tier_enum"`);
    await queryRunner.query(`DROP TYPE IF EXISTS "transaction_status_enum"`);
    await queryRunner.query(`DROP TYPE IF EXISTS "transaction_type_enum"`);
    await queryRunner.query(`DROP TYPE IF EXISTS "currency_enum"`);
    await queryRunner.query(`DROP TYPE IF EXISTS "account_status_enum"`);
    await queryRunner.query(`DROP TYPE IF EXISTS "account_type_enum"`);
    await queryRunner.query(`DROP TYPE IF EXISTS "kyc_status_enum"`);
    await queryRunner.query(`DROP TYPE IF EXISTS "user_role_enum"`);
  }
}
