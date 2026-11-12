-- AlterTable
ALTER TABLE "companies" ADD COLUMN     "custom_fields" JSONB NOT NULL DEFAULT '{}';

-- AlterTable
ALTER TABLE "contacts" ADD COLUMN     "custom_fields" JSONB NOT NULL DEFAULT '{}';

-- AlterTable
ALTER TABLE "deals" ADD COLUMN     "custom_fields" JSONB NOT NULL DEFAULT '{}';

-- AlterTable
ALTER TABLE "leads" ADD COLUMN     "custom_fields" JSONB NOT NULL DEFAULT '{}';

-- CreateTable
CREATE TABLE "tags" (
    "id" UUID NOT NULL,
    "organization_id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "color" TEXT NOT NULL DEFAULT 'blue',
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,
    "created_by" UUID,
    "updated_by" UUID,

    CONSTRAINT "tags_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "taggables" (
    "id" UUID NOT NULL,
    "organization_id" UUID NOT NULL,
    "tag_id" UUID NOT NULL,
    "entity_type" TEXT NOT NULL,
    "entity_id" UUID NOT NULL,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "taggables_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "custom_field_definitions" (
    "id" UUID NOT NULL,
    "organization_id" UUID NOT NULL,
    "entity_type" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "options" JSONB NOT NULL DEFAULT '[]',
    "required" BOOLEAN NOT NULL DEFAULT false,
    "show_in_table" BOOLEAN NOT NULL DEFAULT false,
    "filterable" BOOLEAN NOT NULL DEFAULT false,
    "visible_when" JSONB,
    "position" INTEGER NOT NULL DEFAULT 0,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,
    "created_by" UUID,
    "updated_by" UUID,

    CONSTRAINT "custom_field_definitions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "saved_views" (
    "id" UUID NOT NULL,
    "organization_id" UUID NOT NULL,
    "entity_type" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "visibility" TEXT NOT NULL DEFAULT 'personal',
    "team_id" UUID,
    "owner_id" UUID NOT NULL,
    "params" JSONB NOT NULL DEFAULT '{}',
    "columns" JSONB,
    "is_default" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,
    "created_by" UUID,
    "updated_by" UUID,

    CONSTRAINT "saved_views_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "tags_organization_id_idx" ON "tags"("organization_id");

-- CreateIndex
CREATE INDEX "taggables_organization_id_entity_type_entity_id_idx" ON "taggables"("organization_id", "entity_type", "entity_id");

-- CreateIndex
CREATE UNIQUE INDEX "taggables_tag_id_entity_type_entity_id_key" ON "taggables"("tag_id", "entity_type", "entity_id");

-- CreateIndex
CREATE INDEX "custom_field_definitions_organization_id_entity_type_positi_idx" ON "custom_field_definitions"("organization_id", "entity_type", "position");

-- CreateIndex
CREATE UNIQUE INDEX "custom_field_definitions_organization_id_entity_type_key_key" ON "custom_field_definitions"("organization_id", "entity_type", "key");

-- CreateIndex
CREATE INDEX "saved_views_organization_id_entity_type_idx" ON "saved_views"("organization_id", "entity_type");

-- CreateIndex
CREATE INDEX "saved_views_organization_id_owner_id_idx" ON "saved_views"("organization_id", "owner_id");

-- AddForeignKey
ALTER TABLE "tags" ADD CONSTRAINT "tags_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "taggables" ADD CONSTRAINT "taggables_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "taggables" ADD CONSTRAINT "taggables_tag_id_fkey" FOREIGN KEY ("tag_id") REFERENCES "tags"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "custom_field_definitions" ADD CONSTRAINT "custom_field_definitions_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "saved_views" ADD CONSTRAINT "saved_views_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "saved_views" ADD CONSTRAINT "saved_views_team_id_fkey" FOREIGN KEY ("team_id") REFERENCES "teams"("id") ON DELETE CASCADE ON UPDATE CASCADE;
