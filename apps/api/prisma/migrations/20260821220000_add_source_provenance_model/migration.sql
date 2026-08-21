-- Create source provenance, raw snapshots, cursors, modality mappings and bidding events.
-- Generated from the schema diff between main and feat/source-provenance-model.

-- AlterTable
ALTER TABLE "biddings" ADD COLUMN     "closed_at" TIMESTAMP(3),
ADD COLUMN     "last_seen_at" TIMESTAMP(3),
ADD COLUMN     "modality_code" VARCHAR(80),
ADD COLUMN     "modality_normalized" VARCHAR(50),
ADD COLUMN     "pncp_control_number" VARCHAR(160),
ADD COLUMN     "process_number" VARCHAR(120),
ADD COLUMN     "procurement_law" VARCHAR(80),
ADD COLUMN     "publication_updated_at" TIMESTAMP(3),
ADD COLUMN     "purchase_year" SMALLINT,
ADD COLUMN     "raw_payload_version" VARCHAR(50),
ADD COLUMN     "source_id" UUID,
ADD COLUMN     "source_record_key" VARCHAR(400),
ADD COLUMN     "source_system_name" VARCHAR(180),
ADD COLUMN     "source_updated_at" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "integration_sync_runs" ADD COLUMN     "source_id" UUID;

-- CreateTable
CREATE TABLE "source_registry" (
    "id" UUID NOT NULL,
    "code" VARCHAR(60) NOT NULL,
    "name" VARCHAR(180) NOT NULL,
    "scope" VARCHAR(30) NOT NULL,
    "authority" VARCHAR(180),
    "base_url" TEXT,
    "api_url" TEXT,
    "protocol" VARCHAR(30) NOT NULL,
    "coverage_notes" TEXT,
    "terms_url" TEXT,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "rate_limit_per_sec" DECIMAL(12,3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "source_registry_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "modality_catalog" (
    "id" UUID NOT NULL,
    "normalized_code" VARCHAR(50) NOT NULL,
    "display_name" VARCHAR(120) NOT NULL,
    "legal_family" VARCHAR(80),
    "active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "modality_catalog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "source_modality_map" (
    "source_id" UUID NOT NULL,
    "source_code" VARCHAR(80) NOT NULL,
    "source_label" VARCHAR(180),
    "modality_id" UUID NOT NULL,

    CONSTRAINT "source_modality_map_pkey" PRIMARY KEY ("source_id", "source_code")
);

-- CreateTable
CREATE TABLE "raw_ingest_records" (
    "id" UUID NOT NULL,
    "source_id" UUID NOT NULL,
    "run_id" UUID,
    "source_record_key" VARCHAR(400) NOT NULL,
    "payload" JSONB NOT NULL,
    "payload_sha256" CHAR(64) NOT NULL,
    "http_status" INTEGER,
    "fetched_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "parser_version" VARCHAR(50) NOT NULL,
    "is_current" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "raw_ingest_records_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ingestion_cursors" (
    "source_id" UUID NOT NULL,
    "cursor_type" VARCHAR(30) NOT NULL,
    "cursor_value" TEXT,
    "window_start" TIMESTAMP(3),
    "window_end" TIMESTAMP(3),
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ingestion_cursors_pkey" PRIMARY KEY ("source_id")
);

-- CreateTable
CREATE TABLE "bidding_events" (
    "id" UUID NOT NULL,
    "bidding_id" UUID NOT NULL,
    "source_event_key" VARCHAR(300),
    "event_type" VARCHAR(40) NOT NULL,
    "event_at" TIMESTAMP(3),
    "title" TEXT,
    "payload" JSONB,
    "payload_sha256" CHAR(64),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "bidding_events_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "source_registry_code_key" ON "source_registry"("code");

-- CreateIndex
CREATE UNIQUE INDEX "modality_catalog_normalized_code_key" ON "modality_catalog"("normalized_code");

-- CreateIndex
CREATE INDEX "source_modality_map_modality_id_idx" ON "source_modality_map"("modality_id");

-- CreateIndex
CREATE INDEX "raw_ingest_records_source_id_source_record_key_is_current_idx" ON "raw_ingest_records"("source_id", "source_record_key", "is_current");

-- CreateIndex
CREATE UNIQUE INDEX "raw_ingest_records_source_id_source_record_key_payload_sha2_key" ON "raw_ingest_records"("source_id", "source_record_key", "payload_sha256");

-- CreateIndex
CREATE INDEX "bidding_events_event_type_event_at_idx" ON "bidding_events"("event_type", "event_at");

-- CreateIndex
CREATE UNIQUE INDEX "bidding_events_bidding_id_source_event_key_key" ON "bidding_events"("bidding_id", "source_event_key");

-- CreateIndex
CREATE UNIQUE INDEX "biddings_source_id_source_record_key_key" ON "biddings"("source_id", "source_record_key");

-- CreateIndex
CREATE INDEX "integration_sync_runs_source_id_started_at_idx" ON "integration_sync_runs"("source_id", "started_at");

-- AddForeignKey
ALTER TABLE "biddings" ADD CONSTRAINT "biddings_source_id_fkey" FOREIGN KEY ("source_id") REFERENCES "source_registry"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "integration_sync_runs" ADD CONSTRAINT "integration_sync_runs_source_id_fkey" FOREIGN KEY ("source_id") REFERENCES "source_registry"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "source_modality_map" ADD CONSTRAINT "source_modality_map_source_id_fkey" FOREIGN KEY ("source_id") REFERENCES "source_registry"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "source_modality_map" ADD CONSTRAINT "source_modality_map_modality_id_fkey" FOREIGN KEY ("modality_id") REFERENCES "modality_catalog"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "raw_ingest_records" ADD CONSTRAINT "raw_ingest_records_source_id_fkey" FOREIGN KEY ("source_id") REFERENCES "source_registry"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "raw_ingest_records" ADD CONSTRAINT "raw_ingest_records_run_id_fkey" FOREIGN KEY ("run_id") REFERENCES "integration_sync_runs"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ingestion_cursors" ADD CONSTRAINT "ingestion_cursors_source_id_fkey" FOREIGN KEY ("source_id") REFERENCES "source_registry"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bidding_events" ADD CONSTRAINT "bidding_events_bidding_id_fkey" FOREIGN KEY ("bidding_id") REFERENCES "biddings"("id") ON DELETE CASCADE ON UPDATE CASCADE;
