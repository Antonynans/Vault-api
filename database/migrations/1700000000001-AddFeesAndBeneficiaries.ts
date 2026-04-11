import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddFeesAndBeneficiaries1700000000001 implements MigrationInterface {
  name = 'AddFeesAndBeneficiaries1700000000001';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // ── Enums ──────────────────────────────────────────────────────────────────
    await queryRunner.query(
      `CREATE TYPE "fee_type_enum" AS ENUM('percentage', 'flat', 'tiered')`,
    );
    await queryRunner.query(
      `CREATE TYPE "fee_status_enum" AS ENUM('active', 'inactive')`,
    );

    // ── fee_configs ────────────────────────────────────────────────────────────
    await queryRunner.query(`
      CREATE TABLE "fee_configs" (
        "id"                     UUID DEFAULT gen_random_uuid() PRIMARY KEY,
        "name"                   VARCHAR NOT NULL,
        "transactionType"        "transaction_type_enum" NOT NULL,
        "feeType"                "fee_type_enum" NOT NULL DEFAULT 'percentage',
        "value"                  DECIMAL(10,4) NOT NULL DEFAULT 0,
        "cap"                    BIGINT NOT NULL DEFAULT 0,
        "minimum"                BIGINT NOT NULL DEFAULT 0,
        "minTransactionAmount"   BIGINT NOT NULL DEFAULT 0,
        "maxTransactionAmount"   BIGINT NOT NULL DEFAULT 0,
        "status"                 "fee_status_enum" NOT NULL DEFAULT 'active',
        "priority"               INTEGER NOT NULL DEFAULT 0,
        "description"            VARCHAR,
        "createdAt"              TIMESTAMP NOT NULL DEFAULT now(),
        "updatedAt"              TIMESTAMP NOT NULL DEFAULT now()
      )
    `);
    await queryRunner.query(
      `CREATE INDEX "idx_fee_configs_type_status" ON "fee_configs"("transactionType", "status")`,
    );

    // ── beneficiaries ──────────────────────────────────────────────────────────
    await queryRunner.query(`
      CREATE TABLE "beneficiaries" (
        "id"             UUID DEFAULT gen_random_uuid() PRIMARY KEY,
        "userId"         UUID NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
        "accountNumber"  VARCHAR NOT NULL,
        "accountName"    VARCHAR NOT NULL,
        "bankName"       VARCHAR,
        "bankCode"       VARCHAR,
        "nickname"       VARCHAR,
        "transferCount"  INTEGER NOT NULL DEFAULT 0,
        "lastTransferAt" TIMESTAMP,
        "isActive"       BOOLEAN NOT NULL DEFAULT true,
        "createdAt"      TIMESTAMP NOT NULL DEFAULT now(),
        "updatedAt"      TIMESTAMP NOT NULL DEFAULT now(),
        UNIQUE ("userId", "accountNumber")
      )
    `);
    await queryRunner.query(
      `CREATE INDEX "idx_beneficiaries_userId" ON "beneficiaries"("userId")`,
    );

    // ── notifications ──────────────────────────────────────────────────────────
    await queryRunner.query(`
      CREATE TYPE "notification_type_enum" AS ENUM(
        'transaction.credit', 'transaction.debit', 'transaction.failed',
        'kyc.submitted', 'kyc.approved', 'kyc.rejected',
        'security.alert', 'system.announcement'
      )
    `);
    await queryRunner.query(
      `CREATE TYPE "notification_channel_enum" AS ENUM('in_app', 'email', 'sms', 'push')`,
    );
    await queryRunner.query(
      `CREATE TYPE "notification_status_enum" AS ENUM('pending', 'sent', 'delivered', 'failed', 'read')`,
    );
    await queryRunner.query(`
      CREATE TABLE "notifications" (
        "id"        UUID DEFAULT gen_random_uuid() PRIMARY KEY,
        "userId"    UUID NOT NULL,
        "type"      "notification_type_enum" NOT NULL,
        "channel"   "notification_channel_enum" NOT NULL DEFAULT 'in_app',
        "status"    "notification_status_enum" NOT NULL DEFAULT 'pending',
        "title"     VARCHAR NOT NULL,
        "body"      TEXT NOT NULL,
        "data"      JSONB,
        "isRead"    BOOLEAN NOT NULL DEFAULT false,
        "readAt"    TIMESTAMP,
        "createdAt" TIMESTAMP NOT NULL DEFAULT now()
      )
    `);
    await queryRunner.query(
      `CREATE INDEX "idx_notifications_userId_isRead" ON "notifications"("userId", "isRead", "createdAt" DESC)`,
    );

    // ── audit_logs ─────────────────────────────────────────────────────────────
    await queryRunner.query(`
      CREATE TYPE "audit_action_enum" AS ENUM(
        'user.registered','user.login','user.logout','user.login_failed','token.refreshed',
        'account.created','account.frozen','account.unfrozen','account.closed',
        'transaction.transfer_initiated','transaction.transfer_completed','transaction.transfer_failed',
        'transaction.deposit_completed','transaction.withdrawal_completed',
        'kyc.submitted','kyc.approved','kyc.rejected',
        'admin.user_deactivated','admin.wallet_upgraded'
      )
    `);
    await queryRunner.query(`
      CREATE TABLE "audit_logs" (
        "id"           UUID DEFAULT gen_random_uuid() PRIMARY KEY,
        "action"       "audit_action_enum" NOT NULL,
        "userId"       UUID,
        "resourceId"   VARCHAR,
        "resourceType" VARCHAR,
        "ipAddress"    VARCHAR,
        "userAgent"    VARCHAR,
        "metadata"     JSONB,
        "isSuspicious" BOOLEAN NOT NULL DEFAULT false,
        "createdAt"    TIMESTAMP NOT NULL DEFAULT now()
      )
    `);
    await queryRunner.query(
      `CREATE INDEX "idx_audit_userId_createdAt" ON "audit_logs"("userId", "createdAt" DESC)`,
    );
    await queryRunner.query(
      `CREATE INDEX "idx_audit_action_createdAt" ON "audit_logs"("action", "createdAt" DESC)`,
    );

    // ── kyc_submissions ────────────────────────────────────────────────────────
    await queryRunner.query(`
      CREATE TYPE "document_type_enum" AS ENUM('nin','bvn','intl_passport','drivers_license','voters_card')
    `);
    await queryRunner.query(`
      CREATE TYPE "kyc_submission_status_enum" AS ENUM('draft','submitted','under_review','approved','rejected')
    `);
    await queryRunner.query(`
      CREATE TABLE "kyc_submissions" (
        "id"               UUID DEFAULT gen_random_uuid() PRIMARY KEY,
        "userId"           UUID NOT NULL UNIQUE REFERENCES "users"("id") ON DELETE CASCADE,
        "documentType"     "document_type_enum" NOT NULL,
        "documentNumber"   VARCHAR NOT NULL,
        "documentFrontUrl" VARCHAR,
        "documentBackUrl"  VARCHAR,
        "selfieUrl"        VARCHAR,
        "status"           "kyc_submission_status_enum" NOT NULL DEFAULT 'draft',
        "rejectionReason"  VARCHAR,
        "reviewedBy"       UUID,
        "reviewedAt"       TIMESTAMP,
        "verificationData" JSONB,
        "createdAt"        TIMESTAMP NOT NULL DEFAULT now(),
        "updatedAt"        TIMESTAMP NOT NULL DEFAULT now()
      )
    `);

    // ── wallets ────────────────────────────────────────────────────────────────
    await queryRunner.query(
      `CREATE TYPE "wallet_tier_enum" AS ENUM('basic','standard','premium')`,
    );
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

    // ── transactionPin column on users ─────────────────────────────────────────
    await queryRunner.query(
      `ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "transactionPin" VARCHAR`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "users" DROP COLUMN IF EXISTS "transactionPin"`,
    );
    await queryRunner.query(`DROP TABLE IF EXISTS "wallets"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "kyc_submissions"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "audit_logs"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "notifications"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "beneficiaries"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "fee_configs"`);
    await queryRunner.query(`DROP TYPE IF EXISTS "wallet_tier_enum"`);
    await queryRunner.query(`DROP TYPE IF EXISTS "kyc_submission_status_enum"`);
    await queryRunner.query(`DROP TYPE IF EXISTS "document_type_enum"`);
    await queryRunner.query(`DROP TYPE IF EXISTS "audit_action_enum"`);
    await queryRunner.query(`DROP TYPE IF EXISTS "notification_status_enum"`);
    await queryRunner.query(`DROP TYPE IF EXISTS "notification_channel_enum"`);
    await queryRunner.query(`DROP TYPE IF EXISTS "notification_type_enum"`);
    await queryRunner.query(`DROP TYPE IF EXISTS "fee_status_enum"`);
    await queryRunner.query(`DROP TYPE IF EXISTS "fee_type_enum"`);
  }
}
