-- CreateTable
CREATE TABLE "outbound_webhooks" (
    "id" UUID NOT NULL,
    "organization_id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "secret_encrypted" TEXT NOT NULL,
    "masked_hint" TEXT NOT NULL,
    "events" JSONB NOT NULL DEFAULT '[]',
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "last_delivery_at" TIMESTAMPTZ(3),
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,
    "created_by" UUID,
    "updated_by" UUID,

    CONSTRAINT "outbound_webhooks_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "outbound_deliveries" (
    "id" UUID NOT NULL,
    "organization_id" UUID NOT NULL,
    "webhook_id" UUID NOT NULL,
    "event" TEXT NOT NULL,
    "event_id" TEXT NOT NULL,
    "payload" JSONB NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "http_status" INTEGER,
    "error" TEXT,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "outbound_deliveries_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "google_integrations" (
    "id" UUID NOT NULL,
    "organization_id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "google_email" TEXT NOT NULL,
    "refresh_token_encrypted" TEXT NOT NULL,
    "access_token_encrypted" TEXT,
    "access_expires_at" TIMESTAMPTZ(3),
    "scopes" TEXT NOT NULL,
    "sync_calendar" BOOLEAN NOT NULL DEFAULT true,
    "sync_email" BOOLEAN NOT NULL DEFAULT false,
    "calendar_sync_token" TEXT,
    "email_synced_at" TIMESTAMPTZ(3),
    "status" TEXT NOT NULL DEFAULT 'active',
    "last_error" TEXT,
    "last_sync_at" TIMESTAMPTZ(3),
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "google_integrations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "calendar_event_links" (
    "id" UUID NOT NULL,
    "organization_id" UUID NOT NULL,
    "integration_id" UUID NOT NULL,
    "activity_id" UUID NOT NULL,
    "external_id" TEXT NOT NULL,
    "etag" TEXT,
    "last_pushed_at" TIMESTAMPTZ(3),
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "calendar_event_links_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "email_sync_logs" (
    "id" UUID NOT NULL,
    "organization_id" UUID NOT NULL,
    "integration_id" UUID NOT NULL,
    "message_id" TEXT NOT NULL,
    "activity_id" UUID,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "email_sync_logs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "outbound_webhooks_organization_id_is_active_idx" ON "outbound_webhooks"("organization_id", "is_active");

-- CreateIndex
CREATE INDEX "outbound_deliveries_organization_id_created_at_idx" ON "outbound_deliveries"("organization_id", "created_at" DESC);

-- CreateIndex
CREATE UNIQUE INDEX "outbound_deliveries_webhook_id_event_id_key" ON "outbound_deliveries"("webhook_id", "event_id");

-- CreateIndex
CREATE UNIQUE INDEX "google_integrations_organization_id_user_id_key" ON "google_integrations"("organization_id", "user_id");

-- CreateIndex
CREATE UNIQUE INDEX "calendar_event_links_integration_id_activity_id_key" ON "calendar_event_links"("integration_id", "activity_id");

-- CreateIndex
CREATE UNIQUE INDEX "calendar_event_links_integration_id_external_id_key" ON "calendar_event_links"("integration_id", "external_id");

-- CreateIndex
CREATE UNIQUE INDEX "email_sync_logs_integration_id_message_id_key" ON "email_sync_logs"("integration_id", "message_id");

-- AddForeignKey
ALTER TABLE "outbound_webhooks" ADD CONSTRAINT "outbound_webhooks_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "outbound_deliveries" ADD CONSTRAINT "outbound_deliveries_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "outbound_deliveries" ADD CONSTRAINT "outbound_deliveries_webhook_id_fkey" FOREIGN KEY ("webhook_id") REFERENCES "outbound_webhooks"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "google_integrations" ADD CONSTRAINT "google_integrations_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "google_integrations" ADD CONSTRAINT "google_integrations_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "calendar_event_links" ADD CONSTRAINT "calendar_event_links_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "calendar_event_links" ADD CONSTRAINT "calendar_event_links_integration_id_fkey" FOREIGN KEY ("integration_id") REFERENCES "google_integrations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "email_sync_logs" ADD CONSTRAINT "email_sync_logs_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "email_sync_logs" ADD CONSTRAINT "email_sync_logs_integration_id_fkey" FOREIGN KEY ("integration_id") REFERENCES "google_integrations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
