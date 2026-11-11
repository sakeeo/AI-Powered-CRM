-- CreateTable
CREATE TABLE "activities" (
    "id" UUID NOT NULL,
    "organization_id" UUID NOT NULL,
    "type" TEXT NOT NULL,
    "subject" TEXT NOT NULL,
    "body" TEXT,
    "status" TEXT NOT NULL DEFAULT 'open',
    "due_at" TIMESTAMPTZ(3),
    "completed_at" TIMESTAMPTZ(3),
    "owner_id" UUID,
    "lead_id" UUID,
    "contact_id" UUID,
    "company_id" UUID,
    "deal_id" UUID,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,
    "created_by" UUID,
    "updated_by" UUID,

    CONSTRAINT "activities_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "activities_organization_id_status_due_at_idx" ON "activities"("organization_id", "status", "due_at");

-- CreateIndex
CREATE INDEX "activities_organization_id_owner_id_status_idx" ON "activities"("organization_id", "owner_id", "status");

-- CreateIndex
CREATE INDEX "activities_organization_id_lead_id_created_at_idx" ON "activities"("organization_id", "lead_id", "created_at" DESC);

-- CreateIndex
CREATE INDEX "activities_organization_id_contact_id_created_at_idx" ON "activities"("organization_id", "contact_id", "created_at" DESC);

-- CreateIndex
CREATE INDEX "activities_organization_id_company_id_created_at_idx" ON "activities"("organization_id", "company_id", "created_at" DESC);

-- CreateIndex
CREATE INDEX "activities_organization_id_deal_id_created_at_idx" ON "activities"("organization_id", "deal_id", "created_at" DESC);

-- AddForeignKey
ALTER TABLE "activities" ADD CONSTRAINT "activities_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "activities" ADD CONSTRAINT "activities_lead_id_fkey" FOREIGN KEY ("lead_id") REFERENCES "leads"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "activities" ADD CONSTRAINT "activities_contact_id_fkey" FOREIGN KEY ("contact_id") REFERENCES "contacts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "activities" ADD CONSTRAINT "activities_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "activities" ADD CONSTRAINT "activities_deal_id_fkey" FOREIGN KEY ("deal_id") REFERENCES "deals"("id") ON DELETE CASCADE ON UPDATE CASCADE;
