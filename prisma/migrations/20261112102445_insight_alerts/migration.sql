-- CreateTable
CREATE TABLE "insight_alerts" (
    "id" UUID NOT NULL,
    "organization_id" UUID NOT NULL,
    "kind" TEXT NOT NULL,
    "severity" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "detail" TEXT NOT NULL,
    "subject_type" TEXT,
    "subject_id" UUID,
    "owner_id" UUID,
    "dedupe_key" TEXT NOT NULL,
    "data" JSONB NOT NULL DEFAULT '{}',
    "status" TEXT NOT NULL DEFAULT 'open',
    "dismissed_by" UUID,
    "dismissed_at" TIMESTAMPTZ(3),
    "detected_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "insight_alerts_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "insight_alerts_organization_id_status_detected_at_idx" ON "insight_alerts"("organization_id", "status", "detected_at" DESC);

-- CreateIndex
CREATE UNIQUE INDEX "insight_alerts_organization_id_dedupe_key_key" ON "insight_alerts"("organization_id", "dedupe_key");

-- AddForeignKey
ALTER TABLE "insight_alerts" ADD CONSTRAINT "insight_alerts_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
