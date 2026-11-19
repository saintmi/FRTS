import { describe, expect, it, vi } from 'vitest';
import { buildPackageImportQueries, importPackageAtomically } from '../scripts/lib/package-importer.js';

const norm = {
  bank: { source_bank_id: 'BANK-1', package_version: '1.0', name: 'Demo Bank', status: 'IMPORTED' },
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

function makeSqlStub() {
  const tag = vi.fn((strings, ...values) => ({ strings: [...strings], values }));
  tag.transaction = vi.fn().mockResolvedValue([]);
  return tag;
}

describe('atomic package importer', () => {
  it('submits an array of parameterized statements in one serializable transaction', async () => {
    const sql = makeSqlStub();
    const queries = buildPackageImportQueries(sql, norm, { file: 'demo.zip', sha256: 'abc123' });
    expect(Array.isArray(queries)).toBe(true);
    expect(queries.length).toBeGreaterThan(10);
    expect(queries.every(query => Array.isArray(query.strings) && Array.isArray(query.values))).toBe(true);

    await importPackageAtomically(sql, norm, { file: 'demo.zip', sha256: 'abc123' });
    expect(sql.transaction).toHaveBeenCalledOnce();
    const [sentQueries, options] = sql.transaction.mock.calls[0];
    expect(Array.isArray(sentQueries)).toBe(true);
    expect(sentQueries.length).toBe(queries.length);
    expect(options).toEqual({ isolationLevel: 'Serializable' });
  });

  it('includes conflict preflight and uses natural-key subqueries for child rows', () => {
    const sql = makeSqlStub();
    const queries = buildPackageImportQueries(sql, norm, { file: 'demo.zip', sha256: 'abc123' });
    const source = queries.map(query => query.strings.join('?')).join('\n');
    expect(source).toContain('bank_preflight');
    expect(source).toContain('session_preflight');
    expect(source).toContain('stimulus_preflight');
    expect(source).toContain('question_preflight');
    expect(source).toContain('options_preflight');
    expect(source).toContain('answer_key_preflight');
    expect(source).toContain('ON CONFLICT');
    expect(source).toContain('content_imports');
    expect(source).toContain('source_sha256');
    expect(source).not.toContain('[object Promise]');
  });
});
