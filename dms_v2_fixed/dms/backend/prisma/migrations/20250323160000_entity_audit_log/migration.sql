-- CreateEnum
CREATE TYPE "AuditEntityType" AS ENUM ('VEHICLE', 'DEAL');

-- CreateTable
CREATE TABLE "EntityAuditLog" (
    "id" TEXT NOT NULL,
    "entityType" "AuditEntityType" NOT NULL,
    "entityId" TEXT NOT NULL,
    "actorUserId" TEXT,
    "actorEmail" TEXT,
    "changes" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "EntityAuditLog_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "EntityAuditLog_entityType_entityId_idx" ON "EntityAuditLog"("entityType", "entityId");

CREATE INDEX "EntityAuditLog_createdAt_idx" ON "EntityAuditLog"("createdAt");

CREATE INDEX "EntityAuditLog_actorUserId_idx" ON "EntityAuditLog"("actorUserId");

-- AddForeignKey
ALTER TABLE "EntityAuditLog" ADD CONSTRAINT "EntityAuditLog_actorUserId_fkey" FOREIGN KEY ("actorUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
