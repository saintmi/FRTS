import { describe, expect, it } from 'vitest';
import { splitStatements } from '../scripts/lib/sql-splitter.js';

describe('migration SQL statement splitter', () => {
  it('keeps semicolons inside single-quoted strings', () => {
    expect(splitStatements("INSERT INTO t(v) VALUES ('a;b'); SELECT 1;")).toEqual([
      "INSERT INTO t(v) VALUES ('a;b')",
      'SELECT 1',
    ]);
  });

  it('keeps semicolons inside tagged and untagged dollar-quoted bodies', () => {
    const sql = [
      'CREATE FUNCTION f() RETURNS void AS $$ BEGIN PERFORM 1; PERFORM 2; END; $$ LANGUAGE plpgsql;',
      'CREATE FUNCTION g() RETURNS text AS $body$ BEGIN RETURN \'x;y\'; END; $body$ LANGUAGE plpgsql;',
      'SELECT 3;',
    ].join('\n');
    const statements = splitStatements(sql);
    expect(statements).toHaveLength(3);
    expect(statements[0]).toContain('PERFORM 1; PERFORM 2;');
    expect(statements[0]).toContain('END; $$ LANGUAGE');
    expect(statements[1]).toContain("RETURN 'x;y';");
    expect(statements[1]).toContain('$body$ LANGUAGE');
    expect(statements[2]).toBe('SELECT 3');
  });

  it('ignores semicolons in line and block comments', () => {
    expect(splitStatements('SELECT 1 -- comment;\n; /* ; ignored */ SELECT 2;')).toEqual([
      'SELECT 1 -- comment;',
      '/* ; ignored */ SELECT 2',
    ]);
  });

  it('handles escaped single quotes and empty statements', () => {
    expect(splitStatements(";; SELECT 'it''s; fine'; ; SELECT 2;;")).toEqual([
      "SELECT 'it''s; fine'",
      'SELECT 2',
    ]);
  });
});
