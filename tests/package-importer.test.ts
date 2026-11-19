import { describe, expect, it, vi } from 'vitest';
import { importPackageAtomically } from '../scripts/lib/package-importer.js';

function makeSqlStub(responses = []) {
  const calls = [];
  const tx = vi.fn(async (callback) => {
    const tagged = (strings, ...values) => {
      calls.push({ sql: strings.join('?'), values });
      return responses.shift() || [];
    };
    return callback(tagged);
  });
  return { sql: Object.assign(() => [], { transaction: tx }), calls, tx };
}

const norm = {
  bank: { source_bank_id: 'B1', package_version: '1' },
  sessions: [{ source_session_id: 'S1', week: 1, session_no: 1, title: 'Session 1', total_questions: 1 }],
  stimuli: [{ source_stimulus_id: 'ST1', session_id: 'S1', content: 'Passage', content_type: 'text' }],
  questions: [{ source_question_id: 'Q1', session_id: 'S1', stimulus_id: 'ST1', type: 'multiple_choice', prompt: 'Choose', points: 1, status: 'DRAFT' }],
  options: [
    { question_source_id: 'Q1', label: 'A', text: 'a', is_correct: true, sort_order: 0 },
    { question_source_id: 'Q1', label: 'B', text: 'b', is_correct: false, sort_order: 1 },
    { question_source_id: 'Q1', label: 'C', text: 'c', is_correct: false, sort_order: 2 },
    { question_source_id: 'Q1', label: 'D', text: 'd', is_correct: false, sort_order: 3 },
  ],
  answerKeys: [{ question_source_id: 'Q1', answer: { correct_value: 'A' }, explanation: 'Because A' }],
  totalQuestions: 1,
};

describe('atomic package importer', () => {
  it('runs all package writes through one transaction callback', async () => {
    const session = { id: 'session-1', week: 1, session_no: 1, title: 'Session 1', total_questions: 1 };
    const stimulus = { id: 'stimulus-1', content: 'Passage', content_type: 'text' };
    const question = { id: 'question-1', session_id: 'session-1', stimulus_id: 'stimulus-1', type: 'multiple_choice', prompt: 'Choose', points: 1, status: 'DRAFT' };
    const optionRows = norm.options.map(({question_source_id, ...o}) => o);
    const key = { answer: { correct_value: 'A' }, explanation: 'Because A' };
    const stub = makeSqlStub([
      [{id:'bank-1'}],
      [], // new session
      [], // new stimulus
      [], // new question
      [], // options absent
      [], // key absent
    ]);
    const result = await importPackageAtomically(stub.sql,'bank-1',norm,{file:'b.zip',sha256:'abc'});
    expect(stub.tx).toHaveBeenCalledOnce();
    expect(result).toMatchObject({bank_id:'bank-1',sessions:1,questions:1});
    expect(stub.calls.length).toBeGreaterThan(5);
  });

  it('aborts when an existing session conflicts with the canonical package', async () => {
    const stub = makeSqlStub([
      [{ id: 'bank-1' }],
      [{ id: 'session-old', week: 1, session_no: 1, title: 'Different title', total_questions: 1 }],
    ]);
    await expect(importPackageAtomically(stub.sql, 'bank-1', norm, { file: 'b.zip', sha256: 'abc' }))
      .rejects.toThrow(/existing session differs/);
    expect(stub.tx).toHaveBeenCalledOnce();
    expect(stub.calls).toHaveLength(2);
  });
});
