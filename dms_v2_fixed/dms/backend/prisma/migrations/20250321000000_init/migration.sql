-- CreateEnum
CREATE TYPE "Role" AS ENUM ('ADMIN', 'SALES', 'ACCOUNTANT');

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "fullName" TEXT NOT NULL,
    "role" "Role" NOT NULL,
    "supabaseUserId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Vehicle" (
    "id" TEXT NOT NULL,
    "datePurchased" DATE NOT NULL,
    "vin" TEXT NOT NULL,
    "year" INTEGER NOT NULL,
    "make" TEXT NOT NULL,
    "model" TEXT NOT NULL,
    "trim" TEXT NOT NULL,
    "colour" TEXT NOT NULL,
    "odometer" INTEGER NOT NULL,
    "purchasePrice" DECIMAL(12,2) NOT NULL,
    "safetyEstimate" DECIMAL(12,2),
    "safetyCost" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "floorplanInterestCost" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "gas" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "warrantyCost" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "dateSold" DATE,
    "sellingPrice" DECIMAL(12,2),
    "safetyCharge" DECIMAL(12,2),
    "warrantyCharge" DECIMAL(12,2),
    "omvicFee" DECIMAL(12,2),
    "buyerName" TEXT,
    "referralAmount" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "paymentMethod" TEXT,
    "depositAmount" DECIMAL(12,2),
    "salesPersonId" TEXT,
    "salesPersonName" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Vehicle_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Contact" (
    "id" TEXT NOT NULL,
    "fullName" TEXT NOT NULL,
    "email" TEXT,
    "phone" TEXT,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Contact_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "VehicleLedgerEntry" (
    "id" TEXT NOT NULL,
    "vehicleId" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "amount" DECIMAL(12,2) NOT NULL,
    "description" TEXT,
    "occurredOn" DATE NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "VehicleLedgerEntry_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE UNIQUE INDEX "User_supabaseUserId_key" ON "User"("supabaseUserId");

-- CreateIndex
CREATE UNIQUE INDEX "Vehicle_vin_key" ON "Vehicle"("vin");

-- CreateIndex
CREATE INDEX "Vehicle_dateSold_idx" ON "Vehicle"("dateSold");

-- CreateIndex
CREATE INDEX "Vehicle_salesPersonId_idx" ON "Vehicle"("salesPersonId");

-- CreateIndex
CREATE INDEX "VehicleLedgerEntry_vehicleId_idx" ON "VehicleLedgerEntry"("vehicleId");

-- AddForeignKey
ALTER TABLE "Vehicle" ADD CONSTRAINT "Vehicle_salesPersonId_fkey" FOREIGN KEY ("salesPersonId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VehicleLedgerEntry" ADD CONSTRAINT "VehicleLedgerEntry_vehicleId_fkey" FOREIGN KEY ("vehicleId") REFERENCES "Vehicle"("id") ON DELETE CASCADE ON UPDATE CASCADE;
