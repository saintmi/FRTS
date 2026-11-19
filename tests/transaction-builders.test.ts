import { describe, expect, it, vi } from 'vitest';
import { buildMigrationTransaction, getFinalizedResultIndex } from '../scripts/lib/transaction-builders.js';

describe('migration transaction builder', () => {
  it('includes all statements and the ledger insert in one transaction list', () => {
    const sql = Object.assign(
      (strings, ...values) => ({ strings: [...strings], values }),
      { query: (statement) => ({ statement }) },
    );
    const queries = buildMigrationTransaction(sql, ['CREATE TABLE x(id int)', 'ALTER TABLE x ADD COLUMN y int'], 'test_001');
    expect(queries).toHaveLength(3);
    expect(queries[0].statement).toBe('CREATE TABLE x(id int)');
    expect(queries[1].statement).toBe('ALTER TABLE x ADD COLUMN y int');
    expect(queries[2].strings.join('?')).toContain('schema_migrations');
    expect(queries[2].values).toEqual(['test_001']);
  });
});

describe('submission transaction result addressing', () => {
  it('addresses the finalization result before receipt and audit writes', () => {
    expect(getFinalizedResultIndex(5)).toBe(2);
    expect(getFinalizedResultIndex(3)).toBe(0);
  });
});
