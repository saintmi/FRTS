import crypto from 'node:crypto';

function stableJson(value) {
  if (Array.isArray(value)) return '[' + value.map(stableJson).join(',') + ']';
  if (value && typeof value === 'object') {
    return '{' + Object.keys(value).sort().map(key => JSON.stringify(key) + ':' + stableJson(value[key])).join(',') + '}';
  }
  return JSON.stringify(value);
}

function same(a, b) { return stableJson(a) === stableJson(b); }

function assertSame(label, existing, incoming) {
  if (!same(existing, incoming)) {
    throw new Error('Import conflict: existing ' + label + ' differs from the canonical source. Refusing to overwrite or leave stale data.');
  }
}

export function buildPackageImportTransaction(sql, bankId, norm, pkg) {
  const queries = [];
  const sessionIdSql = new Map();
  const stimulusIdSql = new Map();
  const questionIdSql = new Map();

  // Existing bank identity is selected under the transaction's snapshot.
  queries.push(sql`SELECT id, name, status, total_questions, total_sessions FROM question_banks
    WHERE id = ${bankId} FOR UPDATE`);

  for (const session of norm.sessions) {
    const id = crypto.randomUUID();
    sessionIdSql.set(session.source_session_id, id);
    queries.push(sql`INSERT INTO learning_sessions
      (id, bank_id, source_session_id, week, session_no, title, total_questions, created_at)
      VALUES (${id}, ${bankId}, ${session.source_session_id}, ${session.week}, ${session.session_no}, ${session.title}, ${session.total_questions}, now())
      ON CONFLICT (bank_id, source_session_id) DO NOTHING`);
  }

  for (const stimulus of norm.stimuli) {
    const id = crypto.randomUUID();
    stimulusIdSql.set(stimulus.source_stimulus_id, id);
    const sessionId = sessionIdSql.get(stimulus.session_id);
    if (!sessionId) throw new Error('Import preflight: unknown stimulus session ' + stimulus.session_id);
    queries.push(sql`INSERT INTO stimuli (id, session_id, source_stimulus_id, content, content_type, created_at)
      VALUES (${id}, ${sessionId}, ${stimulus.source_stimulus_id}, ${stimulus.content}, ${stimulus.content_type}, now())
      ON CONFLICT (session_id, source_stimulus_id) DO NOTHING`);
  }

  for (const question of norm.questions) {
    const id = crypto.randomUUID();
    questionIdSql.set(question.source_question_id, id);
    const sessionId = sessionIdSql.get(question.session_id);
    const stimulusId = question.stimulus_id ? stimulusIdSql.get(question.stimulus_id) : null;
    if (!sessionId) throw new Error('Import preflight: unknown question session ' + question.session_id);
    if (question.stimulus_id && !stimulusId) throw new Error('Import preflight: unknown question stimulus ' + question.stimulus_id);
    queries.push(sql`INSERT INTO questions (id, bank_id, session_id, stimulus_id, source_question_id, type, prompt, points, status, created_at)
      VALUES (${id}, ${bankId}, ${sessionId}, ${stimulusId}, ${question.source_question_id}, ${question.type}, ${question.prompt}, ${question.points}, ${question.status}, now())
      ON CONFLICT (bank_id, source_question_id) DO NOTHING`);
    for (const option of norm.options.filter(item => item.question_source_id === question.source_question_id)) {
      const optionId = crypto.randomUUID();
      queries.push(sql`INSERT INTO question_options (id, question_id, label, text, is_correct, sort_order, created_at)
        VALUES (${optionId}, ${id}, ${option.label}, ${option.text}, ${option.is_correct}, ${option.sort_order}, now())
        ON CONFLICT (question_id, sort_order) DO NOTHING`);
    }
    const key = norm.answerKeys.find(item => item.question_source_id === question.source_question_id);
    if (key) {
      queries.push(sql`INSERT INTO question_answer_keys (id, question_id, answer, explanation, created_at)
        VALUES (${crypto.randomUUID()}, ${id}, ${JSON.stringify(key.answer)}, ${key.explanation}, now())
        ON CONFLICT (question_id) DO NOTHING`);
    }
  }

  // The importer now uses a separate read-only preflight of existing records
  // to detect conflicts before calling this builder. This single transaction
  // makes the package writes and its completion ledger atomic.
  queries.push(sql`UPDATE question_banks SET total_sessions = ${norm.sessions.length},
      total_questions = ${norm.totalQuestions} WHERE id = ${bankId}`);
  queries.push(sql`INSERT INTO content_imports
    (id, package_name, package_version, status, total_questions, total_sessions, imported_questions, report, created_at)
    VALUES (${crypto.randomUUID()}, ${pkg.file}, ${norm.bank.package_version}, 'COMPLETED',
      ${norm.totalQuestions}, ${norm.sessions.length}, ${norm.totalQuestions},
      ${JSON.stringify({ bank_id: norm.bank.source_bank_id, package_version: norm.bank.package_version, source_sha256: pkg.sha256 })}, now())`);
  return { queries, sessionIdSql, stimulusIdSql, questionIdSql };
}

export { assertSame };
