-- CreateTable
CREATE TABLE "automation_rules" (
    "id" UUID NOT NULL,
    "organization_id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "trigger" TEXT NOT NULL,
    "actions" JSONB NOT NULL DEFAULT '[]',
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "max_per_hour" INTEGER NOT NULL DEFAULT 100,
    "run_count" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,
    "created_by" UUID,
    "updated_by" UUID,

    CONSTRAINT "automation_rules_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "automation_runs" (
    "id" UUID NOT NULL,
    "organization_id" UUID NOT NULL,
    "rule_id" UUID NOT NULL,
    "trigger" TEXT NOT NULL,
    "entity_type" TEXT NOT NULL,
    "entity_id" UUID NOT NULL,
    "event_key" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "results" JSONB NOT NULL DEFAULT '[]',
    "error" TEXT,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "automation_runs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "automation_rules_organization_id_trigger_is_active_idx" ON "automation_rules"("organization_id", "trigger", "is_active");

-- CreateIndex
CREATE INDEX "automation_runs_organization_id_created_at_idx" ON "automation_runs"("organization_id", "created_at" DESC);

-- CreateIndex
CREATE INDEX "automation_runs_rule_id_created_at_idx" ON "automation_runs"("rule_id", "created_at" DESC);

-- CreateIndex
CREATE UNIQUE INDEX "automation_runs_rule_id_event_key_key" ON "automation_runs"("rule_id", "event_key");

-- AddForeignKey
ALTER TABLE "automation_rules" ADD CONSTRAINT "automation_rules_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "automation_runs" ADD CONSTRAINT "automation_runs_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "automation_runs" ADD CONSTRAINT "automation_runs_rule_id_fkey" FOREIGN KEY ("rule_id") REFERENCES "automation_rules"("id") ON DELETE CASCADE ON UPDATE CASCADE;
