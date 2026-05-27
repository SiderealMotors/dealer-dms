-- Every lead must have a customer for the pipeline.
DO $$
DECLARE
  r RECORD;
  cid TEXT;
BEGIN
  FOR r IN SELECT id, "fullName", phone, email FROM "Lead" WHERE "customerId" IS NULL LOOP
    cid := gen_random_uuid()::text;
    INSERT INTO "Customer" (id, "fullName", phone, email, "createdAt", "updatedAt")
    VALUES (cid, r."fullName", r.phone, r.email, NOW(), NOW());
    UPDATE "Lead" SET "customerId" = cid WHERE "Lead".id = r.id;
  END LOOP;
END $$;

CREATE TYPE "LeadStatus_new" AS ENUM ('NEW_LEAD', 'CONTACTED', 'NEGOTIATING', 'CLOSED');

ALTER TABLE "Lead" ADD COLUMN "status_pipeline" "LeadStatus_new";

UPDATE "Lead" SET "status_pipeline" = CASE "status"::text
  WHEN 'NEW' THEN 'NEW_LEAD'::"LeadStatus_new"
  WHEN 'CONTACTED' THEN 'CONTACTED'::"LeadStatus_new"
  WHEN 'QUALIFIED' THEN 'NEGOTIATING'::"LeadStatus_new"
  WHEN 'PROPOSAL' THEN 'NEGOTIATING'::"LeadStatus_new"
  WHEN 'NEGOTIATION' THEN 'NEGOTIATING'::"LeadStatus_new"
  WHEN 'CONVERTED' THEN 'CLOSED'::"LeadStatus_new"
  WHEN 'LOST' THEN 'CLOSED'::"LeadStatus_new"
  ELSE 'NEW_LEAD'::"LeadStatus_new"
END;

ALTER TABLE "Lead" ALTER COLUMN "status" DROP DEFAULT;
ALTER TABLE "Lead" DROP COLUMN "status";
DROP TYPE "LeadStatus";

ALTER TABLE "Lead" RENAME COLUMN "status_pipeline" TO "status";
ALTER TYPE "LeadStatus_new" RENAME TO "LeadStatus";

ALTER TABLE "Lead" ALTER COLUMN "status" SET NOT NULL;
ALTER TABLE "Lead" ALTER COLUMN "status" SET DEFAULT 'NEW_LEAD'::"LeadStatus";

ALTER TABLE "Lead" DROP CONSTRAINT IF EXISTS "Lead_customerId_fkey";
ALTER TABLE "Lead" ALTER COLUMN "customerId" SET NOT NULL;
ALTER TABLE "Lead" ADD CONSTRAINT "Lead_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "Customer"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
