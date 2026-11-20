export function selectCanonicalBankJson(matches) {
  if (!Array.isArray(matches) || matches.length !== 1) {
    throw new Error(`Expected exactly one canonical question_bank JSON; found ${Array.isArray(matches) ? matches.length : 0}.`);
  }
  return matches[0];
}

export function validateBankSource(bankRaw, expectedVersion) {
  const errors = [];
  if (!bankRaw || typeof bankRaw !== 'object' || Array.isArray(bankRaw)) {
    throw new Error('Source preflight failed: bank source must be an object');
  }
  if (typeof bankRaw.bank_id !== 'string' || !bankRaw.bank_id.trim()) errors.push('bank_id is required');
  if (!expectedVersion) errors.push('expected package version is required');
  if (String(bankRaw.bank_version || '') !== String(expectedVersion || '')) {
    errors.push(`bank_version mismatch: expected ${expectedVersion}, got ${bankRaw.bank_version}`);
  }
  if (!Array.isArray(bankRaw.sessions) || bankRaw.sessions.length === 0) errors.push('sessions must be a non-empty array');

  const sessionIds = new Set();
  const questionIds = new Set();
  const stimulusIds = new Set();
  for (const session of Array.isArray(bankRaw.sessions) ? bankRaw.sessions : []) {
    const sessionId = String(session?.session_id || '');
    if (!sessionId || sessionIds.has(sessionId)) errors.push(`missing or duplicate session_id: ${sessionId}`);
    sessionIds.add(sessionId);
    if (!Array.isArray(session?.questions) || session.questions.length === 0) errors.push(`session ${sessionId} must contain questions`);
    if (session?.stimuli != null && !Array.isArray(session.stimuli)) errors.push(`session ${sessionId} stimuli must be an array`);
    const localStimuli = new Set();
    for (const stimulus of Array.isArray(session?.stimuli) ? session.stimuli : []) {
      const id = String(stimulus?.id || '');
      if (!id || stimulusIds.has(id)) errors.push(`missing or duplicate stimulus id: ${id}`);
      stimulusIds.add(id);
      localStimuli.add(id);
      if (typeof stimulus?.text !== 'string' || !stimulus.text.trim()) errors.push(`stimulus text missing: ${id}`);
    }
    for (const question of Array.isArray(session?.questions) ? session.questions : []) {
      const id = String(question?.id || '');
      if (!id || questionIds.has(id)) errors.push(`missing or duplicate question id: ${id}`);
      questionIds.add(id);
      if (question?.stimulus_id && !localStimuli.has(String(question.stimulus_id))) errors.push(`question ${id} references a missing stimulus in session ${sessionId}`);
      const options = question?.student?.options;
      const labels = Array.isArray(options) ? options.map(option => String(option?.value || '').trim().toUpperCase()) : [];
      if (labels.length !== 4 || ['A', 'B', 'C', 'D'].some(label => labels.filter(value => value === label).length !== 1)) {
        errors.push(`question ${id} must have exactly one A/B/C/D option`);
      }
      const correctValue = String(question?.teacher_only?.correct_value ?? '').trim().toUpperCase();
      if (!correctValue || !labels.includes(correctValue)) errors.push(`question ${id} has no valid teacher_only.correct_value`);
      if (typeof question?.student?.question !== 'string' || !question.student.question.trim()) errors.push(`question ${id} has no student-facing prompt`);
    }
  }
  if (errors.length) throw new Error('Source preflight failed: ' + errors.slice(0, 30).join('; '));
  return {
    bank_id: bankRaw.bank_id,
    bank_version: String(bankRaw.bank_version),
    sessions: sessionIds.size,
    questions: questionIds.size,
    stimuli: stimulusIds.size,
  };
}
