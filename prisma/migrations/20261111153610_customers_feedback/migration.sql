-- CreateTable
CREATE TABLE "customer_segments" (
    "id" UUID NOT NULL,
    "organization_id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "customer_segments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "customer_segment_members" (
    "id" UUID NOT NULL,
    "organization_id" UUID NOT NULL,
    "segment_id" UUID NOT NULL,
    "contact_id" UUID,
    "company_id" UUID,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "customer_segment_members_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "feedbacks" (
    "id" UUID NOT NULL,
    "organization_id" UUID NOT NULL,
    "type" TEXT NOT NULL,
    "subject" TEXT NOT NULL,
    "body" TEXT,
    "status" TEXT NOT NULL DEFAULT 'open',
    "contact_id" UUID,
    "company_id" UUID,
    "deal_id" UUID,
    "owner_id" UUID,
    "resolved_at" TIMESTAMPTZ(3),
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,
    "created_by" UUID,

    CONSTRAINT "feedbacks_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "customer_segments_organization_id_name_key" ON "customer_segments"("organization_id", "name");

-- CreateIndex
CREATE INDEX "customer_segment_members_organization_id_segment_id_idx" ON "customer_segment_members"("organization_id", "segment_id");

-- CreateIndex
CREATE UNIQUE INDEX "customer_segment_members_segment_id_contact_id_key" ON "customer_segment_members"("segment_id", "contact_id");

-- CreateIndex
CREATE UNIQUE INDEX "customer_segment_members_segment_id_company_id_key" ON "customer_segment_members"("segment_id", "company_id");

-- CreateIndex
CREATE INDEX "feedbacks_organization_id_status_created_at_idx" ON "feedbacks"("organization_id", "status", "created_at" DESC);

-- CreateIndex
CREATE INDEX "feedbacks_organization_id_contact_id_idx" ON "feedbacks"("organization_id", "contact_id");

-- CreateIndex
CREATE INDEX "feedbacks_organization_id_company_id_idx" ON "feedbacks"("organization_id", "company_id");

-- AddForeignKey
ALTER TABLE "customer_segments" ADD CONSTRAINT "customer_segments_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "customer_segment_members" ADD CONSTRAINT "customer_segment_members_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "customer_segment_members" ADD CONSTRAINT "customer_segment_members_segment_id_fkey" FOREIGN KEY ("segment_id") REFERENCES "customer_segments"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "customer_segment_members" ADD CONSTRAINT "customer_segment_members_contact_id_fkey" FOREIGN KEY ("contact_id") REFERENCES "contacts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "customer_segment_members" ADD CONSTRAINT "customer_segment_members_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "feedbacks" ADD CONSTRAINT "feedbacks_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "feedbacks" ADD CONSTRAINT "feedbacks_contact_id_fkey" FOREIGN KEY ("contact_id") REFERENCES "contacts"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "feedbacks" ADD CONSTRAINT "feedbacks_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "feedbacks" ADD CONSTRAINT "feedbacks_deal_id_fkey" FOREIGN KEY ("deal_id") REFERENCES "deals"("id") ON DELETE SET NULL ON UPDATE CASCADE;
