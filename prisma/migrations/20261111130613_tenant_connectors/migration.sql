-- CreateTable
CREATE TABLE "tenant_connectors" (
    "id" UUID NOT NULL,
    "organization_id" UUID NOT NULL,
    "type" TEXT NOT NULL,
    "config_encrypted" TEXT NOT NULL,
    "masked_hint" TEXT,
    "settings" JSONB,
    "status" TEXT NOT NULL DEFAULT 'active',
    "is_default" BOOLEAN NOT NULL DEFAULT false,
    "last_tested_at" TIMESTAMPTZ(3),
    "last_test_ok" BOOLEAN,
    "last_test_error" TEXT,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,
    "created_by" UUID,
    "updated_by" UUID,

    CONSTRAINT "tenant_connectors_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ai_call_logs" (
    "id" UUID NOT NULL,
    "organization_id" UUID NOT NULL,
    "user_id" UUID,
    "feature" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "model" TEXT,
    "status" TEXT NOT NULL,
    "duration_ms" INTEGER NOT NULL,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ai_call_logs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "tenant_connectors_organization_id_idx" ON "tenant_connectors"("organization_id");

-- CreateIndex
CREATE UNIQUE INDEX "tenant_connectors_organization_id_type_key" ON "tenant_connectors"("organization_id", "type");

-- CreateIndex
CREATE INDEX "ai_call_logs_organization_id_created_at_idx" ON "ai_call_logs"("organization_id", "created_at" DESC);

-- AddForeignKey
ALTER TABLE "tenant_connectors" ADD CONSTRAINT "tenant_connectors_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ai_call_logs" ADD CONSTRAINT "ai_call_logs_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
