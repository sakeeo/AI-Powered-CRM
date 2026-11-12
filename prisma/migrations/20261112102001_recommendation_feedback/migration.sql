-- CreateTable
CREATE TABLE "recommendation_feedback" (
    "id" UUID NOT NULL,
    "organization_id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "kind" TEXT NOT NULL,
    "subject_type" TEXT NOT NULL,
    "subject_id" UUID NOT NULL,
    "decision" TEXT NOT NULL,
    "channel" TEXT,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "recommendation_feedback_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "recommendation_feedback_organization_id_kind_created_at_idx" ON "recommendation_feedback"("organization_id", "kind", "created_at" DESC);

-- CreateIndex
CREATE INDEX "recommendation_feedback_organization_id_subject_type_subjec_idx" ON "recommendation_feedback"("organization_id", "subject_type", "subject_id");

-- AddForeignKey
ALTER TABLE "recommendation_feedback" ADD CONSTRAINT "recommendation_feedback_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
