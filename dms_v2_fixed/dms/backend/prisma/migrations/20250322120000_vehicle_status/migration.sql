-- CreateEnum
CREATE TYPE "VehicleStatus" AS ENUM ('AVAILABLE', 'PENDING', 'SOLD');

-- AlterTable
ALTER TABLE "Vehicle" ADD COLUMN "status" "VehicleStatus" NOT NULL DEFAULT 'AVAILABLE';

-- Sold units always align with dateSold
UPDATE "Vehicle" SET "status" = 'SOLD' WHERE "dateSold" IS NOT NULL;

CREATE INDEX "Vehicle_status_idx" ON "Vehicle"("status");
