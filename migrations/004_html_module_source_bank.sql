-- Add canonical question-bank provenance to HTML modules.
-- Version: 004_html_module_source_bank
-- Required after 003_html_module_source_session.

ALTER TABLE html_modules
  ADD COLUMN IF NOT EXISTS source_bank_id TEXT;

DROP INDEX IF EXISTS idx_html_modules_source_session_id;

CREATE UNIQUE INDEX IF NOT EXISTS idx_html_modules_source_bank_session
  ON html_modules(source_bank_id, source_session_id)
  WHERE source_bank_id IS NOT NULL AND source_session_id IS NOT NULL;

INSERT INTO schema_migrations (version, applied_at)
VALUES ('004_html_module_source_bank', now())
ON CONFLICT (version) DO NOTHING;
