-- CreateTable
CREATE TABLE "lead_sources" (
    "id" UUID NOT NULL,
    "organization_id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "is_system" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "lead_sources_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "leads" (
    "id" UUID NOT NULL,
    "organization_id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "email" TEXT,
    "phone" TEXT,
    "company_name" TEXT,
    "needs" TEXT,
    "budget" DECIMAL(18,2),
    "currency" VARCHAR(3) NOT NULL DEFAULT 'IDR',
    "urgency" TEXT,
    "notes" TEXT,
    "status" TEXT NOT NULL DEFAULT 'new',
    "unqualified_reason" TEXT,
    "source_id" UUID,
    "owner_id" UUID,
    "archived_at" TIMESTAMPTZ(3),
    "converted_at" TIMESTAMPTZ(3),
    "converted_contact_id" UUID,
    "converted_company_id" UUID,
    "converted_deal_id" UUID,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,
    "created_by" UUID,
    "updated_by" UUID,

    CONSTRAINT "leads_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "lead_sources_organization_id_idx" ON "lead_sources"("organization_id");

-- CreateIndex
CREATE UNIQUE INDEX "lead_sources_organization_id_name_key" ON "lead_sources"("organization_id", "name");

-- CreateIndex
CREATE INDEX "leads_organization_id_status_idx" ON "leads"("organization_id", "status");

-- CreateIndex
CREATE INDEX "leads_organization_id_owner_id_idx" ON "leads"("organization_id", "owner_id");

-- CreateIndex
CREATE INDEX "leads_organization_id_created_at_idx" ON "leads"("organization_id", "created_at" DESC);

-- CreateIndex
CREATE INDEX "leads_organization_id_email_idx" ON "leads"("organization_id", "email");

-- AddForeignKey
ALTER TABLE "lead_sources" ADD CONSTRAINT "lead_sources_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "leads" ADD CONSTRAINT "leads_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "leads" ADD CONSTRAINT "leads_source_id_fkey" FOREIGN KEY ("source_id") REFERENCES "lead_sources"("id") ON DELETE SET NULL ON UPDATE CASCADE;
