-- Enforce natural-key uniqueness required by atomic, idempotent package imports.
-- Duplicate preflight on the isolated Neon test branch returned zero conflicts
-- for all five indexes before this migration was authored.

CREATE UNIQUE INDEX IF NOT EXISTS uq_question_banks_source_identity
  ON question_banks(source_package, source_bank_id, package_version)
  WHERE source_package IS NOT NULL
    AND source_bank_id IS NOT NULL
    AND package_version IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS uq_learning_sessions_bank_source
  ON learning_sessions(bank_id, source_session_id)
  WHERE source_session_id IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS uq_stimuli_session_source
  ON stimuli(session_id, source_stimulus_id)
  WHERE source_stimulus_id IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS uq_questions_bank_source
  ON questions(bank_id, source_question_id)
  WHERE source_question_id IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS uq_question_options_question_sort
  ON question_options(question_id, sort_order);

-- A single attempt has one terminal submission, therefore it can have only
-- one receipt regardless of how many concurrent clients retry with new keys.
CREATE UNIQUE INDEX IF NOT EXISTS uq_submission_receipts_attempt
  ON submission_receipts(attempt_id);

INSERT INTO schema_migrations(version, applied_at)
VALUES ('006_question_bank_source_uniques', now())
ON CONFLICT (version) DO NOTHING;

