import crypto from 'node:crypto';

export async function importPackageAtomically(sql, bankId, norm, pkg) {
  return sql.transaction(async (tx) => {
    const banks = await tx`SELECT id, name, status, total_questions, total_sessions FROM question_banks WHERE id = ${bankId} FOR UPDATE`;
    if (!banks[0]) throw new Error('Import target bank not found');

    const sessionIds = new Map();
    for (const session of norm.sessions) {
      const found = await tx`SELECT id, week, session_no, title, total_questions FROM learning_sessions WHERE bank_id = ${bankId} AND source_session_id = ${session.source_session_id} FOR UPDATE`;
      if (found[0]) {
        if (Number(found[0].week ?? -1) !== Number(session.week ?? -1) ||
            Number(found[0].session_no ?? -1) !== Number(session.session_no ?? -1) ||
            String(found[0].title ?? '') !== String(session.title ?? '') ||
            Number(found[0].total_questions) !== Number(session.total_questions)) {
          throw new Error('Import conflict: existing session differs from source: ' + session.source_session_id);
        }
        sessionIds.set(session.source_session_id, found[0].id);
      } else {
        const inserted = await tx`INSERT INTO learning_sessions (id, bank_id, source_session_id, week, session_no, title, total_questions, created_at)
          VALUES (${crypto.randomUUID()}, ${bankId}, ${session.source_session_id}, ${session.week}, ${session.session_no}, ${session.title}, ${session.total_questions}, now()) RETURNING id`;
        sessionIds.set(session.source_session_id, inserted[0].id);
      }
    }

    const stimulusIds = new Map();
    for (const stimulus of norm.stimuli) {
      const sessionId = sessionIds.get(stimulus.session_id);
      if (!sessionId) throw new Error('Import preflight: unknown session for stimulus ' + stimulus.source_stimulus_id);
      const found = await tx`SELECT id, content, content_type FROM stimuli WHERE session_id = ${sessionId} AND source_stimulus_id = ${stimulus.source_stimulus_id} FOR UPDATE`;
      if (found[0]) {
        if (String(found[0].content ?? '') !== String(stimulus.content ?? '') ||
            String(found[0].content_type ?? '') !== String(stimulus.content_type ?? '')) {
          throw new Error('Import conflict: existing stimulus differs from source: ' + stimulus.source_stimulus_id);
        }
        stimulusIds.set(stimulus.source_stimulus_id, found[0].id);
      } else {
        const inserted = await tx`INSERT INTO stimuli (id, session_id, source_stimulus_id, content, content_type, created_at)
          VALUES (${crypto.randomUUID()}, ${sessionId}, ${stimulus.source_stimulus_id}, ${stimulus.content}, ${stimulus.content_type}, now()) RETURNING id`;
        stimulusIds.set(stimulus.source_stimulus_id, inserted[0].id);
      }
    }

    const questionIds = new Map();
    for (const question of norm.questions) {
      const sessionId = sessionIds.get(question.session_id);
      const stimulusId = question.stimulus_id ? stimulusIds.get(question.stimulus_id) : null;
      if (!sessionId) throw new Error('Import preflight: unknown session for question ' + question.source_question_id);
      if (question.stimulus_id && !stimulusId) throw new Error('Import preflight: unknown stimulus for question ' + question.source_question_id);
      const found = await tx`SELECT id, session_id, stimulus_id, type, prompt, points, status FROM questions WHERE bank_id = ${bankId} AND source_question_id = ${question.source_question_id} FOR UPDATE`;
      let qId;
      if (found[0]) {
        if (String(found[0].session_id) !== String(sessionId) ||
            String(found[0].stimulus_id ?? '') !== String(stimulusId ?? '') ||
            String(found[0].type) !== String(question.type) ||
            String(found[0].prompt ?? '') !== String(question.prompt ?? '') ||
            Number(found[0].points) !== Number(question.points) ||
            String(found[0].status) !== String(question.status)) {
          throw new Error('Import conflict: existing question differs from source: ' + question.source_question_id);
        }
        qId = found[0].id;
      } else {
        const inserted = await tx`INSERT INTO questions (id, bank_id, session_id, stimulus_id, source_question_id, type, prompt, points, status, created_at)
          VALUES (${crypto.randomUUID()}, ${bankId}, ${sessionId}, ${stimulusId}, ${question.source_question_id}, ${question.type}, ${question.prompt}, ${question.points}, ${question.status}, now()) RETURNING id`;
        qId = inserted[0].id;
      }
      questionIds.set(question.source_question_id, qId);

      const expectedOptions = norm.options.filter(option => option.question_source_id === question.source_question_id);
      const foundOptions = await tx`SELECT label, text, is_correct, sort_order FROM question_options WHERE question_id = ${qId} ORDER BY sort_order FOR UPDATE`;
      const expectedSort = expectedOptions.map(option => ({
        label: option.label, text: option.text, is_correct: option.is_correct, sort_order: option.sort_order,
      }));
      const actualSort = foundOptions.map(option => ({
        label: option.label, text: option.text, is_correct: option.is_correct, sort_order: Number(option.sort_order),
      }));
      if (foundOptions.length) {
        if (JSON.stringify(actualSort) !== JSON.stringify(expectedSort)) throw new Error('Import conflict: existing options differ from source for question ' + question.source_question_id);
      } else {
        for (const option of expectedOptions) await tx`INSERT INTO question_options
          (id, question_id, label, text, is_correct, sort_order, created_at)
          VALUES (${crypto.randomUUID()}, ${qId}, ${option.label}, ${option.text}, ${option.is_correct}, ${option.sort_order}, now())`;
      }

      const key = norm.answerKeys.find(item => item.question_source_id === question.source_question_id);
      const existingKey = await tx`SELECT answer, explanation FROM question_answer_keys WHERE question_id = ${qId} FOR UPDATE`;
      if (key) {
        if (existingKey[0]) {
          const existingAnswer = typeof existingKey[0].answer === 'string' ? JSON.parse(existingKey[0].answer) : existingKey[0].answer;
          if (JSON.stringify(existingAnswer) !== JSON.stringify(key.answer) ||
              String(existingKey[0].explanation ?? '') !== String(key.explanation ?? '')) {
            throw new Error('Import conflict: existing answer key differs from source for question ' + question.source_question_id);
          }
        } else {
          await tx`INSERT INTO question_answer_keys (id, question_id, answer, explanation, created_at)
            VALUES (${crypto.randomUUID()}, ${qId}, ${JSON.stringify(key.answer)}, ${key.explanation}, now())`;
        }
      } else if (existingKey[0]) {
        throw new Error('Import conflict: existing answer key has no corresponding source key for question ' + question.source_question_id);
      }
    }

    await tx`UPDATE question_banks SET total_sessions = ${norm.sessions.length}, total_questions = ${norm.totalQuestions} WHERE id = ${bankId}`;
    await tx`INSERT INTO content_imports (id, package_name, package_version, status, total_questions, total_sessions, imported_questions, report, created_at)
      VALUES (${crypto.randomUUID()}, ${pkg.file}, ${norm.bank.package_version}, 'COMPLETED', ${norm.totalQuestions}, ${norm.sessions.length}, ${norm.totalQuestions},
        ${JSON.stringify({ bank_id: norm.bank.source_bank_id, source_sha256: pkg.sha256 })}, now())`;
    return { bank_id: bankId, sessions: sessionIds.size, questions: questionIds.size };
  });
}
