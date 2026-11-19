/**
 * Adapter for the Batch 1 Vocabulary-First v0.6.1 package.
 *
 * Student-facing question data and teacher-only keys are separate source files.
 * Only source-verified legacy keys enter question_answer_keys. Proposed keys
 * remain excluded from official scoring and are recorded in import metadata.
 */
const EXPECTED = Object.freeze({
  bankId: 'FRTS-B1-W1-4',
  version: '0.6.1',
  sessions: 8,
  questions: 200,
  stimuli: 120,
  officialKeys: 96,
  proposedKeys: 104,
});

function fail(errors) {
  throw new Error('Vocabulary-First v0.6.1 source preflight failed: ' + errors.slice(0, 40).join('; '));
}

function normalizeKeySet(records, expectedStatus, label, errors, questionIndex) {
  if (!Array.isArray(records)) {
    errors.push(label + ' must be an array');
    return new Map();
  }
  const result = new Map();
  for (const record of records) {
    const id = String(record?.question_id || '');
    if (!id || result.has(id)) {
      errors.push(label + ' contains a missing or duplicate question_id: ' + id);
      continue;
    }
    result.set(id, record);
    if (record.key_status !== expectedStatus) {
      errors.push(label + ' has unexpected key_status for ' + id);
    }
    const source = questionIndex.get(id);
    if (!source) {
      errors.push(label + ' references unknown question ' + id);
      continue;
    }
    if (record.session_id !== source.session_id) {
      errors.push(label + ' session mismatch for ' + id);
    }
    if ((record.stimulus_id || null) !== (source.stimulus_id || null)) {
      errors.push(label + ' stimulus mismatch for ' + id);
    }
    const answer = String(record.correct_option || '').trim().toUpperCase();
    const options = source.question.student?.options || [];
    if (!['A', 'B', 'C', 'D'].includes(answer) ||
        options.filter(option => String(option?.value || '').trim().toUpperCase() === answer).length !== 1) {
      errors.push(label + ' has an invalid correct_option for ' + id);
    }
  }
  return result;
}

export function normalizeVocabularyFirstBank(studentBank, teacherKeys, sourcePackage, expectedVersion = EXPECTED.version) {
  const errors = [];
  if (!studentBank || typeof studentBank !== 'object' || Array.isArray(studentBank)) {
    throw new Error('Student bank JSON must be an object');
  }
  if (!teacherKeys || typeof teacherKeys !== 'object' || Array.isArray(teacherKeys)) {
    throw new Error('Teacher key JSON must be an object');
  }
  if (studentBank.bank_id !== EXPECTED.bankId || teacherKeys.bank_id !== EXPECTED.bankId) {
    errors.push('bank_id must match ' + EXPECTED.bankId + ' in both source files');
  }
  if (String(studentBank.bank_version) !== expectedVersion ||
      String(teacherKeys.bank_version) !== expectedVersion) {
    errors.push('both source files must use bank_version ' + expectedVersion);
  }
  if (String(studentBank.bank_version) !== String(teacherKeys.bank_version)) {
    errors.push('student/teacher bank_version mismatch');
  }
  if (!Array.isArray(studentBank.sessions) || studentBank.sessions.length !== EXPECTED.sessions) {
    errors.push('expected exactly ' + EXPECTED.sessions + ' sessions');
  }

  const sessions = [];
  const stimuli = [];
  const questions = [];
  const options = [];
  const questionIndex = new Map();
  const stimulusIdsBySession = new Map();
  const seenSessions = new Set();
  const seenStimuli = new Set();

  for (const session of Array.isArray(studentBank.sessions) ? studentBank.sessions : []) {
    const sessionId = String(session?.session_id || '');
    if (!sessionId || seenSessions.has(sessionId)) errors.push('missing or duplicate session_id: ' + sessionId);
    seenSessions.add(sessionId);
    if (!Array.isArray(session?.questions) || session.questions.length !== 25) {
      errors.push('session ' + sessionId + ' must contain exactly 25 questions');
    }
    if (!Array.isArray(session?.stimuli)) errors.push('session ' + sessionId + ' stimuli must be an array');

    const localStimuli = new Set();
    for (const stimulus of Array.isArray(session?.stimuli) ? session.stimuli : []) {
      const id = String(stimulus?.id || '');
      if (!id || seenStimuli.has(id)) errors.push('missing or duplicate stimulus id: ' + id);
      seenStimuli.add(id);
      localStimuli.add(id);
      if (typeof stimulus?.text !== 'string' || !stimulus.text.trim()) errors.push('missing stimulus text: ' + id);
      stimuli.push({
        source_stimulus_id: id,
        session_id: sessionId,
        content: stimulus?.text || null,
        content_type: stimulus?.genre || null,
      });
    }
    stimulusIdsBySession.set(sessionId, localStimuli);

    sessions.push({
      source_session_id: sessionId,
      week: session.week != null ? Number(session.week) : null,
      session_no: session.session_number != null ? Number(session.session_number) : null,
      title: session.title || null,
      total_questions: Array.isArray(session.questions) ? session.questions.length : 0,
    });

    for (const question of Array.isArray(session?.questions) ? session.questions : []) {
      const id = String(question?.id || '');
      if (!id || questionIndex.has(id)) errors.push('missing or duplicate question id: ' + id);
      if (question?.stimulus_id && !localStimuli.has(String(question.stimulus_id))) {
        errors.push('question ' + id + ' references a stimulus outside session ' + sessionId);
      }
      const questionOptions = question?.student?.options;
      const labels = Array.isArray(questionOptions)
        ? questionOptions.map(option => String(option?.value || '').trim().toUpperCase())
        : [];
      if (labels.length !== 4 || ['A', 'B', 'C', 'D'].some(label => labels.filter(value => value === label).length !== 1)) {
        errors.push('question ' + id + ' must have exactly one A/B/C/D option');
      }
      if (typeof question?.student?.question !== 'string' || !question.student.question.trim()) {
        errors.push('question ' + id + ' has no student-facing prompt');
      }
      questionIndex.set(id, { session_id: sessionId, stimulus_id: question?.stimulus_id || null, question });
      questions.push({
        source_question_id: id,
        session_id: sessionId,
        type: question.type || 'multiple_choice',
        prompt: question.student?.question || null,
        points: 1,
        status: 'DRAFT',
        stimulus_id: question.stimulus_id || null,
      });
      (Array.isArray(questionOptions) ? questionOptions : []).forEach((option, index) => {
        options.push({
          question_source_id: id,
          label: option?.value != null ? String(option.value) : null,
          text: option?.label || null,
          is_correct: false,
          sort_order: index,
        });
      });
    }
  }

  if (sessions.length !== EXPECTED.sessions) errors.push('session count mismatch');
  if (questions.length !== EXPECTED.questions) errors.push('expected exactly ' + EXPECTED.questions + ' questions');
  if (stimuli.length !== EXPECTED.stimuli) errors.push('expected exactly ' + EXPECTED.stimuli + ' stimuli');

  const official = normalizeKeySet(
    teacherKeys.legacy_official_keys, 'OFFICIAL_SOURCE_KEY_PRESERVED',
    'legacy_official_keys', errors, questionIndex
  );
  const proposed = normalizeKeySet(
    teacherKeys.new_proposed_keys, 'PROPOSED_NEW_KEY_TEACHER_APPROVAL_REQUIRED',
    'new_proposed_keys', errors, questionIndex
  );
  if (official.size !== EXPECTED.officialKeys) errors.push('expected exactly ' + EXPECTED.officialKeys + ' legacy official keys');
  if (proposed.size !== EXPECTED.proposedKeys) errors.push('expected exactly ' + EXPECTED.proposedKeys + ' proposed keys');
  for (const id of official.keys()) if (proposed.has(id)) errors.push('question appears in both key sets: ' + id);
  if (official.size + proposed.size !== questions.length) errors.push('every question must have exactly one key disposition');

  for (const [id, key] of official) {
    const answer = String(key.correct_option).trim().toUpperCase();
    const option = options.find(item => item.question_source_id === id && item.label?.toUpperCase() === answer);
    if (option) option.is_correct = true;
  }

  if (errors.length) fail(errors);

  const answerKeys = [...official.entries()].map(([id, key]) => ({
    question_source_id: id,
    answer: {
      correct_value: String(key.correct_option).trim().toUpperCase(),
      correct_answer: key.answer_text || null,
      evidence_quote: key.evidence_quote || null,
      rationale: key.rationale || null,
      key_status: 'OFFICIAL_SOURCE_KEY_PRESERVED',
      source_reference: key.source_reference || null,
    },
    explanation: key.rationale || null,
  }));

  return {
    bank: {
      source_bank_id: studentBank.bank_id,
      package_version: String(studentBank.bank_version),
      name: studentBank.program || 'FRTS Batch 1 Vocabulary-First',
      status: 'REVIEW_REQUIRED',
      raw_status: studentBank.status,
      source_package: sourcePackage,
    },
    sessions,
    stimuli,
    questions,
    options,
    answerKeys,
    totalQuestions: questions.length,
    keyDisposition: {
      official_source_keys: official.size,
      proposed_keys_excluded_from_official_scoring: proposed.size,
      proposed_question_ids: [...proposed.keys()],
      proposed_key_status: 'PROPOSED_NEW_KEY_TEACHER_APPROVAL_REQUIRED',
      import_mode: 'REVIEW_ONLY_NO_PROPOSED_OFFICIAL_SCORING',
    },
  };
}

export const vocabularyFirstExpectedCounts = EXPECTED;
