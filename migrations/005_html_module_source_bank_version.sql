-- Add exact question-bank version provenance to HTML modules.
-- Version: 005_html_module_source_bank_version
-- Required after 004_html_module_source_bank.

ALTER TABLE html_modules
  ADD COLUMN IF NOT EXISTS source_bank_version TEXT;

DROP INDEX IF EXISTS idx_html_modules_source_bank_session;

CREATE UNIQUE INDEX IF NOT EXISTS idx_html_modules_source_bank_version_session
  ON html_modules(source_bank_id, source_bank_version, source_session_id)
  WHERE source_bank_id IS NOT NULL
    AND source_bank_version IS NOT NULL
    AND source_session_id IS NOT NULL;

INSERT INTO schema_migrations (version, applied_at)
VALUES ('005_html_module_source_bank_version', now())
ON CONFLICT (version) DO NOTHING;
