-- Dealer settings (singleton row)
CREATE TABLE "DealerSettings" (
  "id"              TEXT NOT NULL DEFAULT 'singleton',
  "dealerName"      TEXT NOT NULL DEFAULT 'My Dealership',
  "address"         TEXT,
  "city"            TEXT,
  "province"        TEXT NOT NULL DEFAULT 'ON',
  "postalCode"      TEXT,
  "phone"           TEXT,
  "email"           TEXT,
  "website"         TEXT,
  "hstNumber"       TEXT,
  "omvicNumber"     TEXT,
  "hstRate"         DECIMAL(5,4) NOT NULL DEFAULT 0.13,
  "defaultOmvicFee" DECIMAL(10,2) NOT NULL DEFAULT 75.00,
  "logoUrl"         TEXT,
  "updatedAt"       TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "DealerSettings_pkey" PRIMARY KEY ("id")
);
INSERT INTO "DealerSettings" ("id") VALUES ('singleton') ON CONFLICT DO NOTHING;

-- Expense categories enum
CREATE TYPE "ExpenseCategory" AS ENUM (
  'ADVERTISING',
  'BANK_CHARGES',
  'FLOORPLAN_INTEREST',
  'INSURANCE',
  'OFFICE_SUPPLIES',
  'OMVIC_FEES',
  'RENT',
  'REPAIRS_MAINTENANCE',
  'SALARIES_WAGES',
  'UTILITIES',
  'VEHICLE_PURCHASE',
  'OTHER'
);

-- Expenses table
CREATE TABLE "Expense" (
  "id"           TEXT NOT NULL,
  "date"         DATE NOT NULL,
  "category"     "ExpenseCategory" NOT NULL,
  "vendor"       TEXT,
  "description"  TEXT NOT NULL,
  "amountPreTax" DECIMAL(12,2) NOT NULL,
  "hstAmount"    DECIMAL(12,2) NOT NULL DEFAULT 0,
  "totalAmount"  DECIMAL(12,2) NOT NULL,
  "receiptUrl"   TEXT,
  "glAccountId"  TEXT,
  "journalEntryId" TEXT,
  "vehicleId"    TEXT,
  "createdById"  TEXT,
  "createdAt"    TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"    TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "deletedAt"    TIMESTAMP(3),
  CONSTRAINT "Expense_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "Expense_date_idx" ON "Expense"("date");
CREATE INDEX "Expense_category_idx" ON "Expense"("category");
CREATE INDEX "Expense_deletedAt_idx" ON "Expense"("deletedAt");
CREATE INDEX "Expense_vehicleId_idx" ON "Expense"("vehicleId");

ALTER TABLE "Expense" ADD CONSTRAINT "Expense_glAccountId_fkey"
  FOREIGN KEY ("glAccountId") REFERENCES "GlAccount"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "Expense" ADD CONSTRAINT "Expense_journalEntryId_fkey"
  FOREIGN KEY ("journalEntryId") REFERENCES "JournalEntry"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "Expense" ADD CONSTRAINT "Expense_vehicleId_fkey"
  FOREIGN KEY ("vehicleId") REFERENCES "Vehicle"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Vehicle photos
CREATE TABLE "VehiclePhoto" (
  "id"        TEXT NOT NULL,
  "vehicleId" TEXT NOT NULL,
  "url"       TEXT NOT NULL,
  "sortOrder" INTEGER NOT NULL DEFAULT 0,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "VehiclePhoto_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "VehiclePhoto_vehicleId_idx" ON "VehiclePhoto"("vehicleId");

ALTER TABLE "VehiclePhoto" ADD CONSTRAINT "VehiclePhoto_vehicleId_fkey"
  FOREIGN KEY ("vehicleId") REFERENCES "Vehicle"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Commission rules per salesperson
CREATE TABLE "CommissionRule" (
  "id"           TEXT NOT NULL,
  "userId"       TEXT NOT NULL,
  "ruleType"     TEXT NOT NULL DEFAULT 'FLAT',
  "flatAmount"   DECIMAL(10,2),
  "percentOfProfit" DECIMAL(5,4),
  "minProfit"    DECIMAL(10,2),
  "isActive"     BOOLEAN NOT NULL DEFAULT true,
  "createdAt"    TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"    TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "CommissionRule_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "CommissionRule_userId_key" ON "CommissionRule"("userId");

ALTER TABLE "CommissionRule" ADD CONSTRAINT "CommissionRule_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- HST remittance tracking
CREATE TABLE "HstRemittance" (
  "id"              TEXT NOT NULL,
  "periodStart"     DATE NOT NULL,
  "periodEnd"       DATE NOT NULL,
  "hstCollected"    DECIMAL(12,2) NOT NULL DEFAULT 0,
  "hstPaid"         DECIMAL(12,2) NOT NULL DEFAULT 0,
  "netOwing"        DECIMAL(12,2) NOT NULL DEFAULT 0,
  "filedAt"         TIMESTAMP(3),
  "journalEntryId"  TEXT,
  "notes"           TEXT,
  "createdAt"       TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"       TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "HstRemittance_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "HstRemittance" ADD CONSTRAINT "HstRemittance_journalEntryId_fkey"
  FOREIGN KEY ("journalEntryId") REFERENCES "JournalEntry"("id") ON DELETE SET NULL ON UPDATE CASCADE;
