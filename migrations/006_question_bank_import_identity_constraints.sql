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

-- The importer uses ON CONFLICT (question_id, sort_order). The initial
-- migration does not define this uniqueness, although some existing databases
-- may already have an equivalent index under another name. Avoid creating a
-- duplicate physical index while making clean installs satisfy the conflict
-- target. Existing duplicate positions intentionally fail this migration.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_index i
    WHERE i.indrelid = 'public.question_options'::regclass
      AND i.indisunique
      AND i.indpred IS NULL
      AND i.indnkeyatts = 2
      AND i.indnatts = 2
      AND (
        SELECT array_agg(a.attname ORDER BY k.ordinality)
        FROM unnest(i.indkey) WITH ORDINALITY AS k(attnum, ordinality)
        JOIN pg_attribute a
          ON a.attrelid = i.indrelid
         AND a.attnum = k.attnum
      ) = ARRAY['question_id', 'sort_order']::name[]
  ) THEN
    CREATE UNIQUE INDEX uq_question_options_position
      ON public.question_options(question_id, sort_order);
  END IF;
END
$$;

CREATE UNIQUE INDEX IF NOT EXISTS uq_submission_receipts_attempt
  ON submission_receipts(attempt_id);

INSERT INTO schema_migrations(version, applied_at)
VALUES ('006_question_bank_import_identity_constraints', now())
ON CONFLICT (version) DO NOTHING;
