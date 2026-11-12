-- AlterTable
ALTER TABLE "quotation_settings" ADD COLUMN     "approval_threshold" DECIMAL(18,2);

-- AlterTable
ALTER TABLE "quotations" ADD COLUMN     "approval_note" TEXT,
ADD COLUMN     "approval_requested_at" TIMESTAMPTZ(3),
ADD COLUMN     "approval_requested_by" UUID,
ADD COLUMN     "approval_status" TEXT NOT NULL DEFAULT 'none',
ADD COLUMN     "approved_at" TIMESTAMPTZ(3),
ADD COLUMN     "approved_by" UUID;

-- CreateTable
CREATE TABLE "quotation_versions" (
    "id" UUID NOT NULL,
    "organization_id" UUID NOT NULL,
    "quotation_id" UUID NOT NULL,
    "version" INTEGER NOT NULL,
    "label" TEXT NOT NULL,
    "snapshot" JSONB NOT NULL,
    "total" DECIMAL(18,2) NOT NULL,
    "created_by" UUID,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "quotation_versions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "activity_templates" (
    "id" UUID NOT NULL,
    "organization_id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "subject" TEXT NOT NULL,
    "body" TEXT,
    "due_in_days" INTEGER,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,
    "created_by" UUID,
    "updated_by" UUID,

    CONSTRAINT "activity_templates_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "quotation_versions_organization_id_quotation_id_idx" ON "quotation_versions"("organization_id", "quotation_id");

-- CreateIndex
CREATE UNIQUE INDEX "quotation_versions_quotation_id_version_key" ON "quotation_versions"("quotation_id", "version");

-- CreateIndex
CREATE UNIQUE INDEX "activity_templates_organization_id_name_key" ON "activity_templates"("organization_id", "name");

-- AddForeignKey
ALTER TABLE "quotation_versions" ADD CONSTRAINT "quotation_versions_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "quotation_versions" ADD CONSTRAINT "quotation_versions_quotation_id_fkey" FOREIGN KEY ("quotation_id") REFERENCES "quotations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "activity_templates" ADD CONSTRAINT "activity_templates_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
