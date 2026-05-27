-- AlterTable
ALTER TABLE "Vehicle" ADD COLUMN "glRevenueJournalId" TEXT;
ALTER TABLE "Vehicle" ADD COLUMN "glCogsJournalId" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "Vehicle_glRevenueJournalId_key" ON "Vehicle"("glRevenueJournalId");
CREATE UNIQUE INDEX "Vehicle_glCogsJournalId_key" ON "Vehicle"("glCogsJournalId");

-- AddForeignKey
ALTER TABLE "Vehicle" ADD CONSTRAINT "Vehicle_glRevenueJournalId_fkey" FOREIGN KEY ("glRevenueJournalId") REFERENCES "JournalEntry"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "Vehicle" ADD CONSTRAINT "Vehicle_glCogsJournalId_fkey" FOREIGN KEY ("glCogsJournalId") REFERENCES "JournalEntry"("id") ON DELETE SET NULL ON UPDATE CASCADE;
