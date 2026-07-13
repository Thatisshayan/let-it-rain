-- Phase 13a (part 1 of 2): multi-tenant foundation — nullable columns + backfill.
--
-- Strategy (matches Phase 1's nullable -> backfill -> required precedent):
--   1. Create the Organization table and the single existing tenant ("Let It Rain").
--   2. Add organizationId to every tenant-scoped table as NULLABLE.
--   3. Backfill every existing row to the Let It Rain org.
--   4. Add indexes + FKs (FKs tolerate the still-nullable columns).
--   5. Restructure AppConfig from a global id=1 singleton into one-row-per-org.
-- The follow-up migration (…_phase13a_org_not_null) flips the columns to NOT NULL
-- once backfill is confirmed. This migration is one-time-only; the fixed org UUID
-- + ON CONFLICT DO NOTHING make the Organization insert safely idempotent.

-- The single pre-existing tenant. This literal UUID lives ONLY in the
-- migration/seed layer — application logic must never hardcode it (Phase 13b
-- grep rule). Chosen as a fixed value so the backfill is deterministic.

-- 1. Organization table
CREATE TABLE "Organization" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Organization_pkey" PRIMARY KEY ("id")
);

INSERT INTO "Organization" ("id", "name")
VALUES ('11111111-1111-1111-1111-111111111111', 'Let It Rain')
ON CONFLICT ("id") DO NOTHING;

-- 2. Add nullable organizationId columns
ALTER TABLE "User"     ADD COLUMN "organizationId" TEXT;
ALTER TABLE "Item"     ADD COLUMN "organizationId" TEXT;
ALTER TABLE "Movement" ADD COLUMN "organizationId" TEXT;
ALTER TABLE "Order"    ADD COLUMN "organizationId" TEXT;
ALTER TABLE "AuditLog" ADD COLUMN "organizationId" TEXT;

-- 3. Backfill every existing row to the Let It Rain org
UPDATE "User"     SET "organizationId" = '11111111-1111-1111-1111-111111111111' WHERE "organizationId" IS NULL;
UPDATE "Item"     SET "organizationId" = '11111111-1111-1111-1111-111111111111' WHERE "organizationId" IS NULL;
UPDATE "Movement" SET "organizationId" = '11111111-1111-1111-1111-111111111111' WHERE "organizationId" IS NULL;
UPDATE "Order"    SET "organizationId" = '11111111-1111-1111-1111-111111111111' WHERE "organizationId" IS NULL;
UPDATE "AuditLog" SET "organizationId" = '11111111-1111-1111-1111-111111111111' WHERE "organizationId" IS NULL;

-- 4. Indexes
CREATE INDEX "User_organizationId_idx"     ON "User"("organizationId");
CREATE INDEX "Item_organizationId_idx"     ON "Item"("organizationId");
CREATE INDEX "Movement_organizationId_idx" ON "Movement"("organizationId");
CREATE INDEX "Movement_organizationId_createdAt_idx" ON "Movement"("organizationId", "createdAt");
CREATE INDEX "Order_organizationId_idx"    ON "Order"("organizationId");
CREATE INDEX "AuditLog_organizationId_idx" ON "AuditLog"("organizationId");
CREATE INDEX "AuditLog_organizationId_createdAt_idx" ON "AuditLog"("organizationId", "createdAt");

-- 4b. Foreign keys (RESTRICT: an org with data can never be silently cascade-wiped)
ALTER TABLE "User"     ADD CONSTRAINT "User_organizationId_fkey"     FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Item"     ADD CONSTRAINT "Item_organizationId_fkey"     FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Movement" ADD CONSTRAINT "Movement_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Order"    ADD CONSTRAINT "Order_organizationId_fkey"    FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "AuditLog" ADD CONSTRAINT "AuditLog_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- 5. AppConfig: global id=1 singleton -> one row per org.
--    Preserve the existing businessName/defaultLowStock; attach it to Let It Rain;
--    replace the integer id=1 PK with a uuid string PK to match the new schema.
ALTER TABLE "AppConfig" ADD COLUMN "organizationId" TEXT;
UPDATE "AppConfig" SET "organizationId" = '11111111-1111-1111-1111-111111111111' WHERE "organizationId" IS NULL;

ALTER TABLE "AppConfig" ALTER COLUMN "id" DROP DEFAULT;
ALTER TABLE "AppConfig" ALTER COLUMN "id" TYPE TEXT USING gen_random_uuid()::text;

ALTER TABLE "AppConfig" ADD CONSTRAINT "AppConfig_organizationId_key" UNIQUE ("organizationId");
ALTER TABLE "AppConfig" ADD CONSTRAINT "AppConfig_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
