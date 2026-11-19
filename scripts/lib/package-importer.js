export function buildPackageImportQueries(sql, norm, pkg) {
  const sourcePackage = pkg.file;
  const bankId = norm.bank.source_bank_id;
  const bankVersion = norm.bank.package_version;
  const bankRef = sql`SELECT id FROM question_banks
    WHERE source_package = ${sourcePackage}
      AND source_bank_id = ${bankId}
      AND package_version = ${bankVersion}`;

  const queries = [];

  // Idempotent bank creation. The unique natural-key index serializes races.
  queries.push(sql`INSERT INTO question_banks
    (id, name, source_package, source_bank_id, package_version, status, total_questions, total_sessions, created_at)
    VALUES (gen_random_uuid(), ${norm.bank.name}, ${sourcePackage}, ${bankId}, ${bankVersion},
      ${norm.bank.status}, 0, 0, now())
    ON CONFLICT (source_package, source_bank_id, package_version)
      WHERE source_package IS NOT NULL AND source_bank_id IS NOT NULL AND package_version IS NOT NULL
    DO NOTHING`);

  // Existing rows must exactly match the canonical package. Any mismatch raises
  // a database error inside this same transaction, rolling back every write.
  queries.push(sql`SELECT 1 / CASE WHEN EXISTS (
    SELECT 1 FROM question_banks
    WHERE source_package = ${sourcePackage}
      AND source_bank_id = ${bankId}
      AND package_version = ${bankVersion}
      AND (name IS DISTINCT FROM ${norm.bank.name}
        OR status IS DISTINCT FROM ${norm.bank.status})
  ) THEN 0 ELSE 1 END AS source_bank_preflight`);

  for (const item of norm.sessions) {
    queries.push(sql`SELECT 1 / CASE WHEN EXISTS (
      SELECT 1 FROM learning_sessions
      WHERE bank_id = (${bankRef})
        AND source_session_id = ${item.source_session_id}
        AND (week IS DISTINCT FROM ${item.week}
          OR session_no IS DISTINCT FROM ${item.session_no}
          OR title IS DISTINCT FROM ${item.title}
          OR total_questions IS DISTINCT FROM ${item.total_questions})
    ) THEN 0 ELSE 1 END AS session_preflight`);
  }

  for (const item of norm.stimuli) {
    queries.push(sql`SELECT 1 / CASE WHEN EXISTS (
      SELECT 1 FROM stimuli st
      JOIN learning_sessions ls ON ls.id = st.session_id
      WHERE ls.bank_id = (${bankRef})
        AND ls.source_session_id = ${item.session_id}
        AND st.source_stimulus_id = ${item.source_stimulus_id}
        AND (st.content IS DISTINCT FROM ${item.content}
          OR st.content_type IS DISTINCT FROM ${item.content_type})
    ) THEN 0 ELSE 1 END AS stimulus_preflight`);
  }

  for (const item of norm.questions) {
    queries.push(sql`SELECT 1 / CASE WHEN EXISTS (
      SELECT 1 FROM questions q
      JOIN learning_sessions ls ON ls.id = q.session_id
      LEFT JOIN stimuli st ON st.id = q.stimulus_id
      WHERE q.bank_id = (${bankRef})
        AND q.source_question_id = ${item.source_question_id}
        AND (ls.source_session_id IS DISTINCT FROM ${item.session_id}
          OR COALESCE(st.source_stimulus_id, '') IS DISTINCT FROM ${(item.stimulus_id || '')}
          OR q.type IS DISTINCT FROM ${item.type}
          OR q.prompt IS DISTINCT FROM ${item.prompt}
          OR q.points IS DISTINCT FROM ${item.points}
          OR q.status IS DISTINCT FROM ${item.status})
    ) THEN 0 ELSE 1 END AS question_preflight`);

    const expectedOptions = norm.options
      .filter(option => option.question_source_id === item.source_question_id)
      .map(option => ({
        label: option.label,
        text: option.text,
        is_correct: option.is_correct,
        sort_order: Number(option.sort_order),
      }));

    queries.push(sql`SELECT 1 / CASE WHEN EXISTS (
      SELECT 1 FROM questions q
      WHERE q.bank_id = (${bankRef})
        AND q.source_question_id = ${item.source_question_id}
        AND COALESCE((
          SELECT jsonb_agg(jsonb_build_object(
            'label', qo.label, 'text', qo.text,
            'is_correct', qo.is_correct, 'sort_order', qo.sort_order
          ) ORDER BY qo.sort_order)
          FROM question_options qo WHERE qo.question_id = q.id
        ), '[]'::jsonb) IS DISTINCT FROM ${JSON.stringify(expectedOptions)}::jsonb
    ) THEN 0 ELSE 1 END AS options_preflight`);

    const key = norm.answerKeys.find(candidate => candidate.question_source_id === item.source_question_id);
    queries.push(sql`SELECT 1 / CASE WHEN EXISTS (
      SELECT 1 FROM questions q
      WHERE q.bank_id = (${bankRef})
        AND q.source_question_id = ${item.source_question_id}
        AND EXISTS (SELECT 1 FROM question_answer_keys ak WHERE ak.question_id = q.id)
        AND NOT EXISTS (
          SELECT 1 FROM question_answer_keys ak
          WHERE ak.question_id = q.id
            AND ak.answer = ${key ? JSON.stringify(key.answer) : null}::jsonb
            AND ak.explanation IS NOT DISTINCT FROM ${key ? key.explanation : null}
        )
    ) THEN 0 ELSE 1 END AS answer_key_preflight`);
  }

  // All inserts use natural-key subqueries, so existing row IDs are used for
  // child relationships and no result from an earlier HTTP query is required.
  for (const item of norm.sessions) {
    queries.push(sql`INSERT INTO learning_sessions
      (id, bank_id, source_session_id, week, session_no, title, total_questions, created_at)
      VALUES (gen_random_uuid(), (${bankRef}), ${item.source_session_id},
        ${item.week}, ${item.session_no}, ${item.title}, ${item.total_questions}, now())
      ON CONFLICT (bank_id, source_session_id)
        WHERE source_session_id IS NOT NULL DO NOTHING`);
  }

  for (const item of norm.stimuli) {
    queries.push(sql`INSERT INTO stimuli
      (id, session_id, source_stimulus_id, content, content_type, created_at)
      VALUES (gen_random_uuid(),
        (SELECT id FROM learning_sessions WHERE bank_id = (${bankRef}) AND source_session_id = ${item.session_id}),
        ${item.source_stimulus_id}, ${item.content}, ${item.content_type}, now())
      ON CONFLICT (session_id, source_stimulus_id)
        WHERE source_stimulus_id IS NOT NULL DO NOTHING`);
  }

  for (const item of norm.questions) {
    queries.push(sql`INSERT INTO questions
      (id, bank_id, session_id, stimulus_id, source_question_id, type, prompt, points, status, created_at)
      VALUES (gen_random_uuid(), (${bankRef}),
        (SELECT id FROM learning_sessions WHERE bank_id = (${bankRef}) AND source_session_id = ${item.session_id}),
        (SELECT st.id FROM stimuli st
          JOIN learning_sessions ls ON ls.id = st.session_id
          WHERE ls.bank_id = (${bankRef})
            AND ls.source_session_id = ${item.session_id}
            AND st.source_stimulus_id = ${item.stimulus_id}),
        ${item.source_question_id}, ${item.type}, ${item.prompt}, ${item.points}, ${item.status}, now())
      ON CONFLICT (bank_id, source_question_id)
        WHERE source_question_id IS NOT NULL DO NOTHING`);

    for (const option of norm.options.filter(candidate => candidate.question_source_id === item.source_question_id)) {
      queries.push(sql`INSERT INTO question_options
        (id, question_id, label, text, is_correct, sort_order, created_at)
        VALUES (gen_random_uuid(),
          (SELECT id FROM questions WHERE bank_id = (${bankRef}) AND source_question_id = ${item.source_question_id}),
          ${option.label}, ${option.text}, ${option.is_correct}, ${option.sort_order}, now())
        ON CONFLICT (question_id, sort_order) DO NOTHING`);
    }

    const key = norm.answerKeys.find(candidate => candidate.question_source_id === item.source_question_id);
    if (key) {
      queries.push(sql`INSERT INTO question_answer_keys
        (id, question_id, answer, explanation, created_at)
        VALUES (gen_random_uuid(),
          (SELECT id FROM questions WHERE bank_id = (${bankRef}) AND source_question_id = ${item.source_question_id}),
          ${JSON.stringify(key.answer)}, ${key.explanation}, now())
        ON CONFLICT (question_id) DO NOTHING`);
    }
  }

  queries.push(sql`UPDATE question_banks
    SET total_sessions = ${norm.sessions.length}, total_questions = ${norm.totalQuestions}
    WHERE source_package = ${sourcePackage}
      AND source_bank_id = ${bankId}
      AND package_version = ${bankVersion}`);

  // Import history is idempotent for a package filename/version/content hash.
  queries.push(sql`INSERT INTO content_imports
    (id, package_name, package_version, status, total_questions, total_sessions, imported_questions, report, created_at)
    SELECT gen_random_uuid(), ${sourcePackage}, ${bankVersion}, 'COMPLETED',
      ${norm.totalQuestions}, ${norm.sessions.length}, ${norm.totalQuestions},
      ${JSON.stringify({ bank_id: bankId, source_sha256: pkg.sha256 })}::jsonb, now()
    WHERE NOT EXISTS (
      SELECT 1 FROM content_imports ci
      WHERE ci.package_name = ${sourcePackage}
        AND ci.package_version = ${bankVersion}
        AND ci.report->>'source_sha256' = ${pkg.sha256}
    )`);

  return queries;
}

export async function importPackageAtomically(sql, norm, pkg) {
  const queries = buildPackageImportQueries(sql, norm, pkg);
  return sql.transaction(queries, { isolationLevel: 'Serializable' });
}
