-- AlterTable
ALTER TABLE "customer_segments" ADD COLUMN     "kind" TEXT NOT NULL DEFAULT 'static',
ADD COLUMN     "rules" JSONB;

-- CreateTable
CREATE TABLE "saved_reports" (
    "id" UUID NOT NULL,
    "organization_id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "definition" JSONB NOT NULL,
    "visibility" TEXT NOT NULL DEFAULT 'personal',
    "owner_id" UUID NOT NULL,
    "frequency" TEXT NOT NULL DEFAULT 'none',
    "weekday" INTEGER,
    "monthday" INTEGER,
    "hour" INTEGER NOT NULL DEFAULT 8,
    "recipient_ids" JSONB NOT NULL DEFAULT '[]',
    "next_run_at" TIMESTAMPTZ(3),
    "last_run_at" TIMESTAMPTZ(3),
    "last_status" TEXT,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,
    "created_by" UUID,
    "updated_by" UUID,

    CONSTRAINT "saved_reports_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "saved_reports_organization_id_owner_id_idx" ON "saved_reports"("organization_id", "owner_id");

-- CreateIndex
CREATE INDEX "saved_reports_frequency_next_run_at_idx" ON "saved_reports"("frequency", "next_run_at");

-- AddForeignKey
ALTER TABLE "saved_reports" ADD CONSTRAINT "saved_reports_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
