-- AlterTable
ALTER TABLE "conversations" ADD COLUMN     "channel_label" TEXT,
ADD COLUMN     "email" TEXT,
ADD COLUMN     "handle" TEXT,
ADD COLUMN     "kind" TEXT NOT NULL DEFAULT 'whatsapp',
ALTER COLUMN "phone" DROP NOT NULL,
ALTER COLUMN "phone_normalized" DROP NOT NULL;

-- Backfill: percakapan WhatsApp yang sudah ada memakai nomor ternormalisasi sebagai handle.
UPDATE "conversations" SET "handle" = "phone_normalized" WHERE "handle" IS NULL AND "phone_normalized" IS NOT NULL;

-- CreateTable
CREATE TABLE "channel_routing" (
    "id" UUID NOT NULL,
    "organization_id" UUID NOT NULL,
    "kind" TEXT NOT NULL,
    "strategy" TEXT NOT NULL DEFAULT 'none',
    "pool" JSONB NOT NULL DEFAULT '[]',
    "cursor" INTEGER NOT NULL DEFAULT 0,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,
    "updated_by" UUID,

    CONSTRAINT "channel_routing_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "channel_routing_organization_id_kind_key" ON "channel_routing"("organization_id", "kind");

-- CreateIndex
CREATE UNIQUE INDEX "conversations_organization_id_kind_handle_key" ON "conversations"("organization_id", "kind", "handle");

-- AddForeignKey
ALTER TABLE "channel_routing" ADD CONSTRAINT "channel_routing_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

