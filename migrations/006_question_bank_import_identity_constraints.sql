-- Importer conflict targets: canonical source identities must be unique.
-- Version: 006_question_bank_import_identity_constraints
-- Preflight duplicate audit is required before applying this migration.

CREATE UNIQUE INDEX IF NOT EXISTS uq_question_banks_source_identity
  ON question_banks(source_package, source_bank_id, package_version)
  WHERE source_package IS NOT NULL
    AND source_bank_id IS NOT NULL
    AND package_version IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS uq_learning_sessions_source_identity
  ON learning_sessions(bank_id, source_session_id)
  WHERE source_session_id IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS uq_stimuli_source_identity
  ON stimuli(session_id, source_stimulus_id)
  WHERE source_stimulus_id IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS uq_questions_source_identity
  ON questions(bank_id, source_question_id)
  WHERE source_question_id IS NOT NULL;


INSERT INTO schema_migrations(version, applied_at)
VALUES ('006_question_bank_import_identity_constraints', now())
ON CONFLICT (version) DO NOTHING;
