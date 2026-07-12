-- Phase 1: AuditLog, tokenVersion, Order cancellation fields, Item location, AppConfig

-- 1. AuditLog model
CREATE TABLE "AuditLog" (
    "id" TEXT NOT NULL DEFAULT gen_random_uuid(),
    "actorId" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "targetUserId" TEXT,
    "orderId" TEXT,
    "detail" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AuditLog_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "AuditLog_actorId_idx" ON "AuditLog"("actorId");
CREATE INDEX "AuditLog_targetUserId_idx" ON "AuditLog"("targetUserId");
CREATE INDEX "AuditLog_orderId_idx" ON "AuditLog"("orderId");
CREATE INDEX "AuditLog_createdAt_idx" ON "AuditLog"("createdAt");

ALTER TABLE "AuditLog" ADD CONSTRAINT "AuditLog_actorId_fkey" FOREIGN KEY ("actorId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "AuditLog" ADD CONSTRAINT "AuditLog_targetUserId_fkey" FOREIGN KEY ("targetUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "AuditLog" ADD CONSTRAINT "AuditLog_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "Order"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- 2. User.tokenVersion for session revocation
ALTER TABLE "User" ADD COLUMN "tokenVersion" INTEGER NOT NULL DEFAULT 0;

-- 3. Order cancellation fields
ALTER TABLE "Order" ADD COLUMN "cancelledAt" TIMESTAMP(3);
ALTER TABLE "Order" ADD COLUMN "cancelledById" TEXT;
CREATE INDEX "Order_cancelledById_idx" ON "Order"("cancelledById");
ALTER TABLE "Order" ADD CONSTRAINT "Order_cancelledById_fkey" FOREIGN KEY ("cancelledById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- 4. Item.location
ALTER TABLE "Item" ADD COLUMN "location" TEXT;

-- 5. AppConfig singleton (optional - included per spec)
CREATE TABLE "AppConfig" (
    "id" INTEGER NOT NULL DEFAULT 1,
    "businessName" TEXT,
    "defaultLowStock" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "AppConfig_pkey" PRIMARY KEY ("id")
);

-- Insert default AppConfig row
INSERT INTO "AppConfig" ("id", "businessName", "defaultLowStock") VALUES (1, 'Let It Rain', 0)
ON CONFLICT ("id") DO NOTHING;