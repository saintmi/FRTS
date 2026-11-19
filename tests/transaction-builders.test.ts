import { describe, expect, it, vi } from 'vitest';
import { applyMigrationAtomically, buildMigrationTransaction, getFinalizedResultIndex, withRequiredAudit } from '../scripts/lib/transaction-builders.js';

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

describe('atomic migration executor', () => {
  it('submits statements and ledger row to a single driver transaction', async () => {
    const transaction = vi.fn().mockResolvedValue([{ rows: [] }]);
    const sql = Object.assign(
      (strings, ...values) => ({ strings: [...strings], values }),
      { query: (statement) => ({ statement }), transaction },
    );
    await applyMigrationAtomically(sql, ['CREATE TABLE t(id int)', 'ALTER TABLE t ADD COLUMN x int'], 'test_002');
    expect(transaction).toHaveBeenCalledOnce();
    expect(transaction.mock.calls[0][0]).toHaveLength(3);
  });

  it('propagates transaction failure without reporting success', async () => {
    const transaction = vi.fn().mockRejectedValue(new Error('injected failure'));
    const sql = Object.assign((strings, ...values) => ({ strings: [...strings], values }), {
      query: (statement) => ({ statement }), transaction,
    });
    await expect(applyMigrationAtomically(sql, ['SELECT 1'], 'test_fail')).rejects.toThrow('injected failure');
  });
});

describe('required audit wrapper', () => {
  it('does not suppress audit persistence failure', async () => {
    const business = vi.fn().mockResolvedValue('changed');
    const audit = vi.fn().mockRejectedValue(new Error('audit unavailable'));
    await expect(withRequiredAudit(business, audit)).rejects.toThrow('audit unavailable');
    expect(business).toHaveBeenCalledOnce();
    expect(audit).toHaveBeenCalledOnce();
  });

  it('returns the business result only after audit success', async () => {
    const business = vi.fn().mockResolvedValue('changed');
    const audit = vi.fn().mockResolvedValue(undefined);
    await expect(withRequiredAudit(business, audit)).resolves.toBe('changed');
  });
});
