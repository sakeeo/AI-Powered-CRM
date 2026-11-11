-- AlterTable
ALTER TABLE "companies" ADD COLUMN     "merged_into_id" UUID;

-- AlterTable
ALTER TABLE "contacts" ADD COLUMN     "merged_into_id" UUID,
ADD COLUMN     "phone_normalized" TEXT;

-- AlterTable
ALTER TABLE "leads" ADD COLUMN     "merged_into_id" UUID,
ADD COLUMN     "phone_normalized" TEXT;

-- CreateIndex
CREATE INDEX "contacts_organization_id_phone_normalized_idx" ON "contacts"("organization_id", "phone_normalized");

-- CreateIndex
CREATE INDEX "leads_organization_id_phone_normalized_idx" ON "leads"("organization_id", "phone_normalized");
