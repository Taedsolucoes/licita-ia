-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateTable
CREATE TABLE "tenants" (
    "id" UUID NOT NULL,
    "corporate_name" TEXT NOT NULL,
    "trade_name" TEXT NOT NULL,
    "cnpj" VARCHAR(18) NOT NULL,
    "status" VARCHAR(20) NOT NULL DEFAULT 'active',
    "contact_name" TEXT NOT NULL,
    "contact_email" TEXT NOT NULL,
    "contact_phone" TEXT NOT NULL,
    "whatsapp_number" TEXT,
    "plan_type" VARCHAR(30) NOT NULL DEFAULT 'basic',
    "lgpd_consent_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "tenants_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "users" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "role" VARCHAR(20) NOT NULL,
    "full_name" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "password_hash" TEXT NOT NULL,
    "phone" TEXT,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "last_login_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "refresh_tokens" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "token_hash" TEXT NOT NULL,
    "expires_at" TIMESTAMP(3) NOT NULL,
    "revoked_at" TIMESTAMP(3),
    "replaced_by_token_hash" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "refresh_tokens_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "devices" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "platform" VARCHAR(10) NOT NULL,
    "fcm_token" TEXT NOT NULL,
    "app_version" TEXT,
    "last_seen_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "devices_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "company_keywords" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "keyword" TEXT NOT NULL,
    "normalized_keyword" TEXT NOT NULL,
    "match_type" VARCHAR(10) NOT NULL DEFAULT 'include',
    "weight" DOUBLE PRECISION NOT NULL DEFAULT 1.0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "company_keywords_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "company_regions" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "uf" VARCHAR(2) NOT NULL,
    "municipality_name" TEXT,
    "municipality_ibge_code" VARCHAR(7),
    "scope_type" VARCHAR(15) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "company_regions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "biddings" (
    "id" UUID NOT NULL,
    "source" VARCHAR(30) NOT NULL,
    "source_external_id" TEXT NOT NULL,
    "source_url" TEXT,
    "bidding_number" TEXT,
    "modality" TEXT,
    "uasg" TEXT,
    "sphere" TEXT,
    "agency_name" TEXT,
    "agency_document" TEXT,
    "object_text" TEXT NOT NULL,
    "object_summary" TEXT,
    "publication_date" TIMESTAMP(3),
    "opening_date" TIMESTAMP(3),
    "proposal_due_date" TIMESTAMP(3),
    "estimated_value" DECIMAL(18,2),
    "municipality_name" TEXT,
    "municipality_ibge_code" VARCHAR(7),
    "uf" VARCHAR(2),
    "status" VARCHAR(20) NOT NULL DEFAULT 'open',
    "risk_level" VARCHAR(10),
    "raw_payload" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "biddings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "bidding_items" (
    "id" UUID NOT NULL,
    "bidding_id" UUID NOT NULL,
    "item_number" INTEGER NOT NULL,
    "description" TEXT NOT NULL,
    "quantity" DECIMAL(18,4) NOT NULL,
    "unit" VARCHAR(20) NOT NULL,
    "unit_value_estimated" DECIMAL(18,2),
    "total_value_estimated" DECIMAL(18,2),
    "catalog_code" TEXT,
    "raw_payload" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "bidding_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "bidding_documents" (
    "id" UUID NOT NULL,
    "bidding_id" UUID NOT NULL,
    "document_type" VARCHAR(50) NOT NULL,
    "file_name" TEXT NOT NULL,
    "source_url" TEXT,
    "checksum" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "bidding_documents_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "capag_records" (
    "id" UUID NOT NULL,
    "municipality_ibge_code" VARCHAR(7) NOT NULL,
    "municipality_name" TEXT NOT NULL,
    "uf" VARCHAR(2) NOT NULL,
    "capag_rating" VARCHAR(2) NOT NULL,
    "explanation_short" TEXT,
    "reference_year" INTEGER NOT NULL,
    "source_reference" TEXT,
    "raw_payload" JSONB,
    "updated_from_source_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "capag_records_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "capag_history" (
    "id" UUID NOT NULL,
    "municipality_ibge_code" VARCHAR(7) NOT NULL,
    "capag_rating" VARCHAR(2) NOT NULL,
    "explanation_short" TEXT,
    "reference_year" INTEGER NOT NULL,
    "raw_payload" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "capag_history_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "opportunities" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "bidding_id" UUID NOT NULL,
    "matching_score" DOUBLE PRECISION NOT NULL,
    "matched_keywords" JSONB,
    "matched_region_type" VARCHAR(15),
    "capag_rating_snapshot" VARCHAR(2),
    "status" VARCHAR(20) NOT NULL DEFAULT 'new',
    "analysis_completed_at" TIMESTAMP(3),
    "first_notified_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "opportunities_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "opportunity_items" (
    "id" UUID NOT NULL,
    "opportunity_id" UUID NOT NULL,
    "bidding_item_id" UUID NOT NULL,
    "suggested_brand" TEXT,
    "estimated_margin_percent" DECIMAL(5,2),
    "customer_brand" TEXT,
    "customer_unit_price" DECIMAL(18,2),
    "customer_total_price" DECIMAL(18,2),
    "customer_notes" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "opportunity_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "participations" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "opportunity_id" UUID NOT NULL,
    "accepted_by_user_id" UUID NOT NULL,
    "status" VARCHAR(30) NOT NULL DEFAULT 'draft',
    "consolidated_total_value" DECIMAL(18,2),
    "submitted_at" TIMESTAMP(3),
    "taed_notified_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "participations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "participation_items" (
    "id" UUID NOT NULL,
    "participation_id" UUID NOT NULL,
    "bidding_item_id" UUID NOT NULL,
    "brand" TEXT NOT NULL,
    "final_unit_price" DECIMAL(18,2) NOT NULL,
    "quantity" DECIMAL(18,4) NOT NULL,
    "final_total_price" DECIMAL(18,2) NOT NULL,
    "margin_value" DECIMAL(18,2),
    "margin_percent" DECIMAL(5,2),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "participation_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "reports" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "bidding_id" UUID NOT NULL,
    "opportunity_id" UUID,
    "report_type" VARCHAR(30) NOT NULL DEFAULT 'bidding_analysis',
    "status" VARCHAR(20) NOT NULL DEFAULT 'queued',
    "storage_key" TEXT,
    "file_name" TEXT,
    "checksum" TEXT,
    "generated_at" TIMESTAMP(3),
    "expires_at" TIMESTAMP(3),
    "created_by_system" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "reports_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "report_downloads" (
    "id" UUID NOT NULL,
    "report_id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "downloaded_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "ip_address" VARCHAR(45),
    "user_agent" TEXT,

    CONSTRAINT "report_downloads_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "notifications" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "opportunity_id" UUID,
    "channel" VARCHAR(10) NOT NULL,
    "template_code" VARCHAR(50) NOT NULL,
    "payload" JSONB,
    "provider_message_id" TEXT,
    "status" VARCHAR(15) NOT NULL DEFAULT 'queued',
    "sent_at" TIMESTAMP(3),
    "delivered_at" TIMESTAMP(3),
    "failed_reason" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "notifications_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "notification_preferences" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "user_id" UUID,
    "allow_push" BOOLEAN NOT NULL DEFAULT true,
    "allow_whatsapp" BOOLEAN NOT NULL DEFAULT true,
    "quiet_hours_start" VARCHAR(5),
    "quiet_hours_end" VARCHAR(5),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "notification_preferences_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "integration_sync_runs" (
    "id" UUID NOT NULL,
    "integration_name" VARCHAR(50) NOT NULL,
    "run_type" VARCHAR(30) NOT NULL,
    "started_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "finished_at" TIMESTAMP(3),
    "status" VARCHAR(20) NOT NULL,
    "cursor_reference" TEXT,
    "records_read" INTEGER NOT NULL DEFAULT 0,
    "records_created" INTEGER NOT NULL DEFAULT 0,
    "records_updated" INTEGER NOT NULL DEFAULT 0,
    "error_summary" TEXT,

    CONSTRAINT "integration_sync_runs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "audit_logs" (
    "id" UUID NOT NULL,
    "tenant_id" UUID,
    "actor_user_id" UUID,
    "action" VARCHAR(50) NOT NULL,
    "resource_type" VARCHAR(50) NOT NULL,
    "resource_id" UUID,
    "metadata" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "audit_logs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "tenants_cnpj_key" ON "tenants"("cnpj");

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

-- CreateIndex
CREATE INDEX "users_tenant_id_idx" ON "users"("tenant_id");

-- CreateIndex
CREATE UNIQUE INDEX "refresh_tokens_token_hash_key" ON "refresh_tokens"("token_hash");

-- CreateIndex
CREATE INDEX "refresh_tokens_user_id_idx" ON "refresh_tokens"("user_id");

-- CreateIndex
CREATE INDEX "devices_user_id_idx" ON "devices"("user_id");

-- CreateIndex
CREATE INDEX "company_keywords_tenant_id_normalized_keyword_idx" ON "company_keywords"("tenant_id", "normalized_keyword");

-- CreateIndex
CREATE INDEX "company_regions_tenant_id_uf_municipality_ibge_code_idx" ON "company_regions"("tenant_id", "uf", "municipality_ibge_code");

-- CreateIndex
CREATE INDEX "biddings_status_proposal_due_date_idx" ON "biddings"("status", "proposal_due_date");

-- CreateIndex
CREATE INDEX "biddings_municipality_ibge_code_uf_idx" ON "biddings"("municipality_ibge_code", "uf");

-- CreateIndex
CREATE UNIQUE INDEX "biddings_source_source_external_id_key" ON "biddings"("source", "source_external_id");

-- CreateIndex
CREATE INDEX "bidding_items_bidding_id_idx" ON "bidding_items"("bidding_id");

-- CreateIndex
CREATE INDEX "bidding_documents_bidding_id_idx" ON "bidding_documents"("bidding_id");

-- CreateIndex
CREATE UNIQUE INDEX "capag_records_municipality_ibge_code_key" ON "capag_records"("municipality_ibge_code");

-- CreateIndex
CREATE INDEX "capag_history_municipality_ibge_code_reference_year_idx" ON "capag_history"("municipality_ibge_code", "reference_year");

-- CreateIndex
CREATE INDEX "opportunities_tenant_id_status_created_at_idx" ON "opportunities"("tenant_id", "status", "created_at");

-- CreateIndex
CREATE INDEX "opportunity_items_opportunity_id_idx" ON "opportunity_items"("opportunity_id");

-- CreateIndex
CREATE UNIQUE INDEX "participations_opportunity_id_key" ON "participations"("opportunity_id");

-- CreateIndex
CREATE INDEX "participations_tenant_id_status_submitted_at_idx" ON "participations"("tenant_id", "status", "submitted_at");

-- CreateIndex
CREATE INDEX "participation_items_participation_id_idx" ON "participation_items"("participation_id");

-- CreateIndex
CREATE INDEX "reports_tenant_id_idx" ON "reports"("tenant_id");

-- CreateIndex
CREATE INDEX "report_downloads_report_id_idx" ON "report_downloads"("report_id");

-- CreateIndex
CREATE INDEX "notifications_tenant_id_channel_status_idx" ON "notifications"("tenant_id", "channel", "status");

-- CreateIndex
CREATE INDEX "notification_preferences_tenant_id_idx" ON "notification_preferences"("tenant_id");

-- CreateIndex
CREATE INDEX "integration_sync_runs_integration_name_started_at_idx" ON "integration_sync_runs"("integration_name", "started_at");

-- CreateIndex
CREATE INDEX "audit_logs_tenant_id_created_at_idx" ON "audit_logs"("tenant_id", "created_at");

-- CreateIndex
CREATE INDEX "audit_logs_resource_type_resource_id_idx" ON "audit_logs"("resource_type", "resource_id");

-- AddForeignKey
ALTER TABLE "users" ADD CONSTRAINT "users_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "refresh_tokens" ADD CONSTRAINT "refresh_tokens_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "devices" ADD CONSTRAINT "devices_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "company_keywords" ADD CONSTRAINT "company_keywords_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "company_regions" ADD CONSTRAINT "company_regions_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bidding_items" ADD CONSTRAINT "bidding_items_bidding_id_fkey" FOREIGN KEY ("bidding_id") REFERENCES "biddings"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bidding_documents" ADD CONSTRAINT "bidding_documents_bidding_id_fkey" FOREIGN KEY ("bidding_id") REFERENCES "biddings"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "opportunities" ADD CONSTRAINT "opportunities_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "opportunities" ADD CONSTRAINT "opportunities_bidding_id_fkey" FOREIGN KEY ("bidding_id") REFERENCES "biddings"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "opportunity_items" ADD CONSTRAINT "opportunity_items_opportunity_id_fkey" FOREIGN KEY ("opportunity_id") REFERENCES "opportunities"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "opportunity_items" ADD CONSTRAINT "opportunity_items_bidding_item_id_fkey" FOREIGN KEY ("bidding_item_id") REFERENCES "bidding_items"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "participations" ADD CONSTRAINT "participations_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "participations" ADD CONSTRAINT "participations_opportunity_id_fkey" FOREIGN KEY ("opportunity_id") REFERENCES "opportunities"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "participations" ADD CONSTRAINT "participations_accepted_by_user_id_fkey" FOREIGN KEY ("accepted_by_user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "participation_items" ADD CONSTRAINT "participation_items_participation_id_fkey" FOREIGN KEY ("participation_id") REFERENCES "participations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "participation_items" ADD CONSTRAINT "participation_items_bidding_item_id_fkey" FOREIGN KEY ("bidding_item_id") REFERENCES "bidding_items"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reports" ADD CONSTRAINT "reports_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reports" ADD CONSTRAINT "reports_bidding_id_fkey" FOREIGN KEY ("bidding_id") REFERENCES "biddings"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reports" ADD CONSTRAINT "reports_opportunity_id_fkey" FOREIGN KEY ("opportunity_id") REFERENCES "opportunities"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "report_downloads" ADD CONSTRAINT "report_downloads_report_id_fkey" FOREIGN KEY ("report_id") REFERENCES "reports"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "report_downloads" ADD CONSTRAINT "report_downloads_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_opportunity_id_fkey" FOREIGN KEY ("opportunity_id") REFERENCES "opportunities"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notification_preferences" ADD CONSTRAINT "notification_preferences_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notification_preferences" ADD CONSTRAINT "notification_preferences_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE SET NULL ON UPDATE CASCADE;
