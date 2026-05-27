-- AlterTable
ALTER TABLE "Vehicle" ADD COLUMN "deletedAt" TIMESTAMP(3);
ALTER TABLE "Deal" ADD COLUMN "deletedAt" TIMESTAMP(3);
ALTER TABLE "Lead" ADD COLUMN "deletedAt" TIMESTAMP(3);
ALTER TABLE "Customer" ADD COLUMN "deletedAt" TIMESTAMP(3);
ALTER TABLE "CrmTask" ADD COLUMN "deletedAt" TIMESTAMP(3);

-- DropIndex: global VIN unique replaced by partial unique (active rows only)
DROP INDEX IF EXISTS "Vehicle_vin_key";

-- Partial unique: same VIN may exist again after soft-delete
CREATE UNIQUE INDEX "Vehicle_vin_active_key" ON "Vehicle"("vin") WHERE "deletedAt" IS NULL;

CREATE INDEX "Vehicle_vin_idx" ON "Vehicle"("vin");
CREATE INDEX "Vehicle_deletedAt_idx" ON "Vehicle"("deletedAt");
CREATE INDEX "Deal_deletedAt_idx" ON "Deal"("deletedAt");
CREATE INDEX "Lead_deletedAt_idx" ON "Lead"("deletedAt");
CREATE INDEX "Customer_deletedAt_idx" ON "Customer"("deletedAt");
CREATE INDEX "CrmTask_deletedAt_idx" ON "CrmTask"("deletedAt");
