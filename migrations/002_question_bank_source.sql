-- FRTS - Add source tracking columns to question_banks (idempotent)
-- Version: 002_question_bank_source

ALTER TABLE question_banks ADD COLUMN IF NOT EXISTS source_bank_id TEXT;
ALTER TABLE question_banks ADD COLUMN IF NOT EXISTS source_package TEXT;
CREATE INDEX IF NOT EXISTS idx_question_banks_source ON question_banks(source_package, source_bank_id);

INSERT INTO schema_migrations (version, applied_at)
VALUES ('002_question_bank_source', now())
ON CONFLICT (version) DO NOTHING;
