import crypto from 'node:crypto';

export function makePackageImportQueryPlan(bankId, norm, pkg) {
  const plan = [];
  const sessionIds = new Map(norm.sessions.map(item => [item.source_session_id, crypto.randomUUID()]));
  const stimulusIds = new Map(norm.stimuli.map(item => [item.source_stimulus_id, crypto.randomUUID()]));
  const questionIds = new Map(norm.questions.map(item => [item.source_question_id, crypto.randomUUID()]));

  plan.push({ strings: ['SELECT id FROM question_banks WHERE id = ', ' FOR UPDATE'], values: [bankId] });
  for (const session of norm.sessions) {
    plan.push({
      strings: ['SELECT id, week, session_no, title, total_questions FROM learning_sessions WHERE bank_id = ', ' AND source_session_id = ', ' FOR UPDATE'],
      values: [bankId, session.source_session_id],
    });
  }
  for (const stimulus of norm.stimuli) {
    plan.push({
      strings: ['SELECT id, content, content_type FROM stimuli WHERE session_id = (SELECT id FROM learning_sessions WHERE bank_id = ', ' AND source_session_id = ', ') AND source_stimulus_id = ', ' FOR UPDATE'],
      values: [bankId, stimulus.session_id, stimulus.source_stimulus_id],
    });
  }
  for (const question of norm.questions) {
    plan.push({
      strings: ['SELECT id, session_id, stimulus_id, type, prompt, points, status FROM questions WHERE bank_id = ', ' AND source_question_id = ', ' FOR UPDATE'],
      values: [bankId, question.source_question_id],
    });
    plan.push({
      strings: ['SELECT label, text, is_correct, sort_order FROM question_options WHERE question_id = (SELECT id FROM questions WHERE bank_id = ', ' AND source_question_id = ', ') ORDER BY sort_order FOR UPDATE'],
      values: [bankId, question.source_question_id],
    });
    plan.push({
      strings: ['SELECT answer, explanation FROM question_answer_keys WHERE question_id = (SELECT id FROM questions WHERE bank_id = ', ' AND source_question_id = ', ') FOR UPDATE'],
      values: [bankId, question.source_question_id],
    });
  }
  // Data writes are generated using database-resolved IDs in a later pass.
  // The importer refuses to write if identity/conflict preflight finds any mismatch.
  plan.push({
    strings: ['SELECT ', '::int AS expected_session_count, ', '::int AS expected_question_count'],
    values: [norm.sessions.length, norm.questions.length],
  });
  return plan;
}
