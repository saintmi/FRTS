import { describe, expect, it } from 'vitest';
import { selectCanonicalBankJson, validateBankSource } from '../scripts/lib/question-bank-validation.js';

const validBank = () => ({
  bank_id: 'BANK-1',
  bank_version: '0.4',
  sessions: [{
    session_id: 'S1',
    stimuli: [{ id: 'ST1', text: 'A short reading passage.' }],
    questions: [{
      id: 'Q1',
      stimulus_id: 'ST1',
      student: {
        question: 'Choose the correct answer.',
        options: [
          { value: 'A', label: 'Option A' },
          { value: 'B', label: 'Option B' },
          { value: 'C', label: 'Option C' },
          { value: 'D', label: 'Option D' },
        ],
      },
      teacher_only: { correct_value: 'B' },
    }],
  }],
});

describe('question bank source preflight', () => {
  it('accepts a structurally valid canonical bank and returns counts', () => {
    expect(validateBankSource(validBank(), '0.4')).toEqual({
      bank_id: 'BANK-1', bank_version: '0.4', sessions: 1, questions: 1, stimuli: 1,
    });
  });

  it('rejects zero or multiple canonical JSON candidates', () => {
    expect(() => selectCanonicalBankJson([])).toThrow(/found 0/);
    expect(() => selectCanonicalBankJson(['a.json', 'b.json'])).toThrow(/found 2/);
    expect(selectCanonicalBankJson(['canonical.json'])).toBe('canonical.json');
  });

  it('rejects a bank version mismatch', () => {
    expect(() => validateBankSource(validBank(), '0.5')).toThrow(/bank_version mismatch/);
  });

  it('rejects duplicate question identifiers', () => {
    const bank = validBank();
    bank.sessions[0].questions.push({ ...bank.sessions[0].questions[0] });
    expect(() => validateBankSource(bank, '0.4')).toThrow(/duplicate question id/);
  });

  it('rejects a stimulus reference that is not in the same session', () => {
    const bank = validBank();
    bank.sessions[0].questions[0].stimulus_id = 'MISSING';
    expect(() => validateBankSource(bank, '0.4')).toThrow(/missing stimulus/);
  });

  it('rejects incomplete option sets and invalid answer keys', () => {
    const bank = validBank();
    bank.sessions[0].questions[0].student.options.pop();
    expect(() => validateBankSource(bank, '0.4')).toThrow(/exactly one A\/B\/C\/D/);
    const second = validBank();
    second.sessions[0].questions[0].teacher_only.correct_value = 'Z';
    expect(() => validateBankSource(second, '0.4')).toThrow(/no valid teacher_only.correct_value/);
  });

  it('rejects empty student prompts and stimulus text', () => {
    const bank = validBank();
    bank.sessions[0].questions[0].student.question = ' ';
    expect(() => validateBankSource(bank, '0.4')).toThrow(/no student-facing prompt/);
  });
});
