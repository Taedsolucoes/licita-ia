-- =============================================
-- Row Level Security (RLS) for Multi-Tenancy
-- Run this AFTER Prisma migrations
-- =============================================

-- Enable RLS on all tenant-scoped tables
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE company_keywords ENABLE ROW LEVEL SECURITY;
ALTER TABLE company_regions ENABLE ROW LEVEL SECURITY;
ALTER TABLE opportunities ENABLE ROW LEVEL SECURITY;
ALTER TABLE opportunity_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE participations ENABLE ROW LEVEL SECURITY;
ALTER TABLE participation_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE reports ENABLE ROW LEVEL SECURITY;
ALTER TABLE report_downloads ENABLE ROW LEVEL SECURITY;
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE notification_preferences ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_logs ENABLE ROW LEVEL SECURITY;

-- Create the app role for application connections
DO $$
BEGIN
  IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'app_user') THEN
    CREATE ROLE app_user;
  END IF;
END
$$;

-- Grant basic permissions to app_user
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO app_user;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO app_user;

-- =============================================
-- RLS Policies for tenant-scoped tables
-- Uses current_setting('app.tenant_id') set by the application
-- =============================================

-- USERS: tenants see only their own users
CREATE POLICY tenant_isolation_users ON users
  USING (tenant_id::text = current_setting('app.tenant_id', true)
         OR current_setting('app.user_role', true) IN ('taed_admin', 'taed_operator'));

-- COMPANY_KEYWORDS
CREATE POLICY tenant_isolation_keywords ON company_keywords
  USING (tenant_id::text = current_setting('app.tenant_id', true)
         OR current_setting('app.user_role', true) IN ('taed_admin', 'taed_operator'));

-- COMPANY_REGIONS
CREATE POLICY tenant_isolation_regions ON company_regions
  USING (tenant_id::text = current_setting('app.tenant_id', true)
         OR current_setting('app.user_role', true) IN ('taed_admin', 'taed_operator'));

-- OPPORTUNITIES
CREATE POLICY tenant_isolation_opportunities ON opportunities
  USING (tenant_id::text = current_setting('app.tenant_id', true)
         OR current_setting('app.user_role', true) IN ('taed_admin', 'taed_operator'));

-- OPPORTUNITY_ITEMS (via join, but for direct access)
CREATE POLICY tenant_isolation_opportunity_items ON opportunity_items
  USING (
    EXISTS (
      SELECT 1 FROM opportunities o
      WHERE o.id = opportunity_items.opportunity_id
        AND (o.tenant_id::text = current_setting('app.tenant_id', true)
             OR current_setting('app.user_role', true) IN ('taed_admin', 'taed_operator'))
    )
  );

-- PARTICIPATIONS
CREATE POLICY tenant_isolation_participations ON participations
  USING (tenant_id::text = current_setting('app.tenant_id', true)
         OR current_setting('app.user_role', true) IN ('taed_admin', 'taed_operator'));

-- PARTICIPATION_ITEMS (via join)
CREATE POLICY tenant_isolation_participation_items ON participation_items
  USING (
    EXISTS (
      SELECT 1 FROM participations p
      WHERE p.id = participation_items.participation_id
        AND (p.tenant_id::text = current_setting('app.tenant_id', true)
             OR current_setting('app.user_role', true) IN ('taed_admin', 'taed_operator'))
    )
  );

-- REPORTS
CREATE POLICY tenant_isolation_reports ON reports
  USING (tenant_id::text = current_setting('app.tenant_id', true)
         OR current_setting('app.user_role', true) IN ('taed_admin', 'taed_operator'));

-- REPORT_DOWNLOADS (via join)
CREATE POLICY tenant_isolation_report_downloads ON report_downloads
  USING (
    EXISTS (
      SELECT 1 FROM reports r
      WHERE r.id = report_downloads.report_id
        AND (r.tenant_id::text = current_setting('app.tenant_id', true)
             OR current_setting('app.user_role', true) IN ('taed_admin', 'taed_operator'))
    )
  );

-- NOTIFICATIONS
CREATE POLICY tenant_isolation_notifications ON notifications
  USING (tenant_id::text = current_setting('app.tenant_id', true)
         OR current_setting('app.user_role', true) IN ('taed_admin', 'taed_operator'));

-- NOTIFICATION_PREFERENCES
CREATE POLICY tenant_isolation_notification_preferences ON notification_preferences
  USING (tenant_id::text = current_setting('app.tenant_id', true)
         OR current_setting('app.user_role', true) IN ('taed_admin', 'taed_operator'));

-- AUDIT_LOGS
CREATE POLICY tenant_isolation_audit_logs ON audit_logs
  USING (tenant_id::text = current_setting('app.tenant_id', true)
         OR tenant_id IS NULL
         OR current_setting('app.user_role', true) IN ('taed_admin', 'taed_operator'));

-- =============================================
-- Full-text search index for biddings
-- =============================================
ALTER TABLE biddings ADD COLUMN IF NOT EXISTS content_tsvector tsvector;

CREATE INDEX IF NOT EXISTS idx_biddings_content_tsvector ON biddings USING GIN (content_tsvector);

-- Function to auto-update tsvector on insert/update
CREATE OR REPLACE FUNCTION biddings_tsvector_trigger() RETURNS trigger AS $$
BEGIN
  NEW.content_tsvector := to_tsvector('portuguese', coalesce(NEW.object_text, '') || ' ' || coalesce(NEW.object_summary, ''));
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS biddings_tsvector_update ON biddings;
CREATE TRIGGER biddings_tsvector_update
  BEFORE INSERT OR UPDATE ON biddings
  FOR EACH ROW EXECUTE FUNCTION biddings_tsvector_trigger();
