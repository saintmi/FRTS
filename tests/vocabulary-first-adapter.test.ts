import { describe, expect, it } from 'vitest';
import { normalizeVocabularyFirstBank } from '../scripts/lib/vocabulary-first-adapter.js';

function fixture() {
  const sessions = [];
  const legacy_official_keys = [];
  const new_proposed_keys = [];
  for (let s = 1; s <= 8; s++) {
    const session_id = 'W' + s + '-ONLINE-01';
    const stimuli = Array.from({ length: 15 }, (_, i) => ({
      id: 'W' + s + 'S' + (i + 1) + '-T1',
      genre: 'Informational',
      text: 'Stimulus ' + s + '-' + i,
    }));
    const questions = Array.from({ length: 25 }, (_, i) => {
      const id = 'W' + s + 'S1-Q' + String(i + 1).padStart(2, '0');
      const stimulus_id = stimuli[i % stimuli.length].id;
      const question = {
        id,
        type: 'single_select',
        stimulus_id,
        student: {
          question: 'Question ' + id,
          options: [
            { value: 'A', label: 'Option A' },
            { value: 'B', label: 'Option B' },
            { value: 'C', label: 'Option C' },
            { value: 'D', label: 'Option D' },
          ],
        },
      };
      const key = {
        question_id: id,
        session_id,
        stimulus_id,
        correct_option: 'B',
        answer_text: 'Option B',
        evidence_quote: 'Evidence',
        rationale: 'Rationale',
        key_status: i < 12
          ? 'OFFICIAL_SOURCE_KEY_PRESERVED'
          : 'PROPOSED_NEW_KEY_TEACHER_APPROVAL_REQUIRED',
      };
      if (i < 12) legacy_official_keys.push(key);
      else new_proposed_keys.push({
        ...key,
        authoring_status: 'NEWLY_AUTHORED_OR_REVISED_V0.6.1',
      });
      return question;
    });
    sessions.push({
      session_id,
      week: s,
      session_number: 1,
      title: 'Session ' + s,
      stimuli,
      questions,
    });
  }
  return {
    student: {
      program: 'FRTS Batch 1',
      bank_id: 'FRTS-B1-W1-4',
      bank_version: '0.6.1',
      status: 'V0.6.1_REVISED_CANDIDATE_FOR_INDEPENDENT_AUDIT_AND_TEACHER_REVIEW',
      sessions,
    },
    teacher: {
      bank_id: 'FRTS-B1-W1-4',
      bank_version: '0.6.1',
      legacy_official_keys,
      new_proposed_keys,
    },
  };
}

describe('Batch 1 Vocabulary-First v0.6.1 adapter', () => {
  it('normalizes all 8 sessions, 200 questions and 120 stimuli', () => {
    const { student, teacher } = fixture();
    const result = normalizeVocabularyFirstBank(student, teacher, 'batch1.zip');
    expect(result.sessions).toHaveLength(8);
    expect(result.questions).toHaveLength(200);
    expect(result.stimuli).toHaveLength(120);
    expect(result.totalQuestions).toBe(200);
    expect(result.bank.status).toBe('REVIEW_REQUIRED');
  });

  it('imports only the 96 source-verified keys into official answer keys', () => {
    const { student, teacher } = fixture();
    const result = normalizeVocabularyFirstBank(student, teacher, 'batch1.zip');
    expect(result.answerKeys).toHaveLength(96);
    expect(result.options.filter(option => option.is_correct)).toHaveLength(96);
    expect(result.answerKeys.every(key => key.answer.key_status === 'OFFICIAL_SOURCE_KEY_PRESERVED')).toBe(true);
  });

  it('keeps all 104 proposed keys outside official scoring and records their disposition', () => {
    const { student, teacher } = fixture();
    const result = normalizeVocabularyFirstBank(student, teacher, 'batch1.zip');
    expect(result.keyDisposition.proposed_keys_excluded_from_official_scoring).toBe(104);
    expect(result.keyDisposition.proposed_question_ids).toHaveLength(104);
    expect(result.keyDisposition.import_mode).toBe('REVIEW_ONLY_NO_PROPOSED_OFFICIAL_SCORING');
    expect(result.keyDisposition.proposed_key_status).toBe('PROPOSED_NEW_KEY_TEACHER_APPROVAL_REQUIRED');
    expect(result.questions.every(question => question.status === 'DRAFT')).toBe(true);
  });

  it('rejects missing, duplicate, mismatched, or unapproved key records', () => {
    const { student, teacher } = fixture();
    teacher.new_proposed_keys.pop();
    expect(() => normalizeVocabularyFirstBank(student, teacher, 'batch1.zip'))
      .toThrow(/expected exactly 104 proposed keys/);
  });

  it('rejects a key whose session/stimulus or correct option does not match the student item', () => {
    const { student, teacher } = fixture();
    teacher.legacy_official_keys[0].correct_option = 'Z';
    expect(() => normalizeVocabularyFirstBank(student, teacher, 'batch1.zip'))
      .toThrow(/invalid correct_option/);
  });
});
