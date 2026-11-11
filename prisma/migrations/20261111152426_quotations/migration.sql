-- CreateTable
CREATE TABLE "quotation_settings" (
    "id" UUID NOT NULL,
    "organization_id" UUID NOT NULL,
    "tax_label" TEXT NOT NULL DEFAULT 'PPN',
    "tax_rate" DECIMAL(5,2) NOT NULL DEFAULT 11,
    "tax_inclusive" BOOLEAN NOT NULL DEFAULT false,
    "validity_days" INTEGER NOT NULL DEFAULT 14,
    "terms" TEXT,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "quotation_settings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "quotations" (
    "id" UUID NOT NULL,
    "organization_id" UUID NOT NULL,
    "number" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'draft',
    "deal_id" UUID,
    "contact_id" UUID,
    "company_id" UUID,
    "owner_id" UUID,
    "currency" VARCHAR(3) NOT NULL DEFAULT 'IDR',
    "issue_date" DATE NOT NULL,
    "valid_until" DATE NOT NULL,
    "tax_label" TEXT NOT NULL,
    "tax_rate" DECIMAL(5,2) NOT NULL,
    "tax_inclusive" BOOLEAN NOT NULL DEFAULT false,
    "global_discount_percent" DECIMAL(5,2) NOT NULL DEFAULT 0,
    "subtotal" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "discount_total" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "tax_total" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "total" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "notes" TEXT,
    "terms" TEXT,
    "pdf_key" TEXT,
    "pdf_generated_at" TIMESTAMPTZ(3),
    "sent_at" TIMESTAMPTZ(3),
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,
    "created_by" UUID,
    "updated_by" UUID,
    "deleted_at" TIMESTAMPTZ(3),

    CONSTRAINT "quotations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "quotation_items" (
    "id" UUID NOT NULL,
    "organization_id" UUID NOT NULL,
    "quotation_id" UUID NOT NULL,
    "position" INTEGER NOT NULL,
    "product_id" UUID,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "quantity" DECIMAL(12,2) NOT NULL,
    "unit_price" DECIMAL(18,2) NOT NULL,
    "discount_percent" DECIMAL(5,2) NOT NULL DEFAULT 0,
    "line_total" DECIMAL(18,2) NOT NULL,

    CONSTRAINT "quotation_items_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "quotation_settings_organization_id_key" ON "quotation_settings"("organization_id");

-- CreateIndex
CREATE INDEX "quotations_organization_id_status_valid_until_idx" ON "quotations"("organization_id", "status", "valid_until");

-- CreateIndex
CREATE INDEX "quotations_organization_id_deal_id_idx" ON "quotations"("organization_id", "deal_id");

-- CreateIndex
CREATE INDEX "quotations_organization_id_owner_id_idx" ON "quotations"("organization_id", "owner_id");

-- CreateIndex
CREATE UNIQUE INDEX "quotations_organization_id_number_key" ON "quotations"("organization_id", "number");

-- CreateIndex
CREATE INDEX "quotation_items_organization_id_quotation_id_position_idx" ON "quotation_items"("organization_id", "quotation_id", "position");

-- AddForeignKey
ALTER TABLE "quotation_settings" ADD CONSTRAINT "quotation_settings_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "quotations" ADD CONSTRAINT "quotations_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "quotations" ADD CONSTRAINT "quotations_deal_id_fkey" FOREIGN KEY ("deal_id") REFERENCES "deals"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "quotations" ADD CONSTRAINT "quotations_contact_id_fkey" FOREIGN KEY ("contact_id") REFERENCES "contacts"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "quotations" ADD CONSTRAINT "quotations_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "quotation_items" ADD CONSTRAINT "quotation_items_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "quotation_items" ADD CONSTRAINT "quotation_items_quotation_id_fkey" FOREIGN KEY ("quotation_id") REFERENCES "quotations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
