-- Phase 13a (part 2 of 2): flip organizationId to NOT NULL.
--
-- Run ONLY after the backfill migration above has been applied AND verified
-- (zero NULL organizationId rows in any affected table — confirmed by row-count
-- check against a local DB copy before this is proposed for the real database).
-- Split into its own migration deliberately, per the nullable -> backfill ->
-- required precedent from Phase 1.

ALTER TABLE "User"      ALTER COLUMN "organizationId" SET NOT NULL;
ALTER TABLE "Item"      ALTER COLUMN "organizationId" SET NOT NULL;
ALTER TABLE "Movement"  ALTER COLUMN "organizationId" SET NOT NULL;
ALTER TABLE "Order"     ALTER COLUMN "organizationId" SET NOT NULL;
ALTER TABLE "AuditLog"  ALTER COLUMN "organizationId" SET NOT NULL;
ALTER TABLE "AppConfig" ALTER COLUMN "organizationId" SET NOT NULL;
