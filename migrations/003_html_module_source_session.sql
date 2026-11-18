-- FRTS - Link generated HTML modules to their canonical learning session
-- Version: 003_html_module_source_session

ALTER TABLE html_modules
  ADD COLUMN IF NOT EXISTS source_session_id TEXT;

CREATE INDEX IF NOT EXISTS idx_html_modules_source_session
  ON html_modules(source_session_id);

CREATE UNIQUE INDEX IF NOT EXISTS uq_html_modules_source_session
  ON html_modules(source_session_id)
  WHERE source_session_id IS NOT NULL;

INSERT INTO schema_migrations (version, applied_at)
VALUES ('003_html_module_source_session', now())
ON CONFLICT (version) DO NOTHING;
