-- CreateEnum
CREATE TYPE "AccountType" AS ENUM ('ASSET', 'LIABILITY', 'EQUITY', 'REVENUE', 'EXPENSE');
CREATE TYPE "NormalBalance" AS ENUM ('DEBIT', 'CREDIT');
CREATE TYPE "JournalStatus" AS ENUM ('DRAFT', 'POSTED');

-- CreateTable
CREATE TABLE "GlAccount" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "type" "AccountType" NOT NULL,
    "normalBalance" "NormalBalance" NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "description" TEXT,
    "parentId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "GlAccount_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "JournalEntry" (
    "id" TEXT NOT NULL,
    "entryNum" SERIAL NOT NULL,
    "entryDate" DATE NOT NULL,
    "description" TEXT NOT NULL,
    "memo" TEXT,
    "status" "JournalStatus" NOT NULL DEFAULT 'DRAFT',
    "postedAt" TIMESTAMP(3),
    "vehicleId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "JournalEntry_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "JournalLine" (
    "id" TEXT NOT NULL,
    "journalEntryId" TEXT NOT NULL,
    "lineNumber" INTEGER NOT NULL,
    "accountId" TEXT NOT NULL,
    "debitAmount" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "creditAmount" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "memo" TEXT,

    CONSTRAINT "JournalLine_pkey" PRIMARY KEY ("id")
);

-- Double-entry integrity: exactly one of debit or credit is positive per line.
ALTER TABLE "JournalLine" ADD CONSTRAINT "JournalLine_debit_credit_exclusive_chk" CHECK (
    ("debitAmount" > 0 AND "creditAmount" = 0) OR ("creditAmount" > 0 AND "debitAmount" = 0)
);

-- CreateIndex
CREATE UNIQUE INDEX "GlAccount_code_key" ON "GlAccount"("code");

CREATE INDEX "GlAccount_type_idx" ON "GlAccount"("type");

CREATE INDEX "GlAccount_parentId_idx" ON "GlAccount"("parentId");

CREATE UNIQUE INDEX "JournalEntry_entryNum_key" ON "JournalEntry"("entryNum");

CREATE INDEX "JournalEntry_entryDate_idx" ON "JournalEntry"("entryDate");

CREATE INDEX "JournalEntry_status_idx" ON "JournalEntry"("status");

CREATE INDEX "JournalEntry_vehicleId_idx" ON "JournalEntry"("vehicleId");

CREATE INDEX "JournalLine_accountId_idx" ON "JournalLine"("accountId");

CREATE UNIQUE INDEX "JournalLine_journalEntryId_lineNumber_key" ON "JournalLine"("journalEntryId", "lineNumber");

-- AddForeignKey
ALTER TABLE "GlAccount" ADD CONSTRAINT "GlAccount_parentId_fkey" FOREIGN KEY ("parentId") REFERENCES "GlAccount"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "JournalEntry" ADD CONSTRAINT "JournalEntry_vehicleId_fkey" FOREIGN KEY ("vehicleId") REFERENCES "Vehicle"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "JournalLine" ADD CONSTRAINT "JournalLine_journalEntryId_fkey" FOREIGN KEY ("journalEntryId") REFERENCES "JournalEntry"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "JournalLine" ADD CONSTRAINT "JournalLine_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "GlAccount"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
