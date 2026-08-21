BEGIN;

-- Remove foreign keys that reference the provenance tables.
ALTER TABLE IF EXISTS "biddings"
  DROP CONSTRAINT IF EXISTS "biddings_source_id_fkey";
ALTER TABLE IF EXISTS "integration_sync_runs"
  DROP CONSTRAINT IF EXISTS "integration_sync_runs_source_id_fkey";

-- Remove the unique index added to the existing biddings table before dropping its columns.
DROP INDEX IF EXISTS "biddings_source_id_source_record_key_key";

-- Remove the index added to the existing sync-runs table.
DROP INDEX IF EXISTS "integration_sync_runs_source_id_started_at_idx";

-- Drop new tables. CASCADE removes their local indexes and foreign keys.
DROP TABLE IF EXISTS "bidding_events" CASCADE;
DROP TABLE IF EXISTS "ingestion_cursors" CASCADE;
DROP TABLE IF EXISTS "raw_ingest_records" CASCADE;
DROP TABLE IF EXISTS "source_modality_map" CASCADE;
DROP TABLE IF EXISTS "modality_catalog" CASCADE;
DROP TABLE IF EXISTS "source_registry" CASCADE;

-- Remove columns added to existing tables.
ALTER TABLE IF EXISTS "integration_sync_runs"
  DROP COLUMN IF EXISTS "source_id";

ALTER TABLE IF EXISTS "biddings"
  DROP COLUMN IF EXISTS "closed_at",
  DROP COLUMN IF EXISTS "last_seen_at",
  DROP COLUMN IF EXISTS "modality_code",
  DROP COLUMN IF EXISTS "modality_normalized",
  DROP COLUMN IF EXISTS "pncp_control_number",
  DROP COLUMN IF EXISTS "process_number",
  DROP COLUMN IF EXISTS "procurement_law",
  DROP COLUMN IF EXISTS "publication_updated_at",
  DROP COLUMN IF EXISTS "purchase_year",
  DROP COLUMN IF EXISTS "raw_payload_version",
  DROP COLUMN IF EXISTS "source_id",
  DROP COLUMN IF EXISTS "source_record_key",
  DROP COLUMN IF EXISTS "source_system_name",
  DROP COLUMN IF EXISTS "source_updated_at";

COMMIT;
