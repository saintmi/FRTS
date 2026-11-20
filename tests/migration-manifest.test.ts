import { describe, expect, it } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';

const migrationsDir = path.resolve(process.cwd(), 'migrations');
const migrationFiles = fs.readdirSync(migrationsDir).filter(file => file.endsWith('.sql')).sort();

describe('migration manifest', () => {
  it('has exactly one migration for each numbered version', () => {
    const versions = migrationFiles.map(file => file.match(/^(\d{3})_/i)?.[1]).filter(Boolean);
    const duplicates = versions.filter((version, index) => versions.indexOf(version) !== index);
    expect(duplicates).toEqual([]);
  });

  it('consolidates the question-bank identity and receipt constraints into one 006 migration', () => {
    const files = migrationFiles.filter(file => file.startsWith('006_'));
    expect(files).toEqual(['006_question_bank_import_identity_constraints.sql']);
    const sql = fs.readFileSync(path.join(migrationsDir, files[0]), 'utf8');
    expect(sql).toContain('uq_question_banks_source_identity');
    expect(sql).toContain('uq_learning_sessions_source_identity');
    expect(sql).toContain('uq_stimuli_source_identity');
    expect(sql).toContain('uq_questions_source_identity');
    expect(sql).toContain('uq_question_options_position');
    expect(sql).toContain('uq_submission_receipts_attempt');
  });
});
