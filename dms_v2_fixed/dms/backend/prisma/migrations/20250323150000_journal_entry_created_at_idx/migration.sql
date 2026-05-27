-- Supports filtering/sorting by record creation time (audit, future APIs).
-- List endpoints currently use `entryDate` + existing `JournalEntry_entryDate_idx`.
CREATE INDEX "JournalEntry_createdAt_idx" ON "JournalEntry"("createdAt");
