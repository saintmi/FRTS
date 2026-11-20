import fs from 'node:fs';
import path from 'node:path';
import { neon } from '@neondatabase/serverless';
import { splitStatements } from './lib/sql-splitter.js';
import { applyMigrationAtomically } from './lib/transaction-builders.js';

function stripBom(s) { return s.replace(/^\uFEFF/, ''); }

function loadEnv() {
  const env = {};
  const envPath = path.resolve(process.cwd(), '.env');
  if (fs.existsSync(envPath)) {
    const raw = fs.readFileSync(envPath, 'utf8');
    for (const line of stripBom(raw).split('\n')) {
      const m = line.match(/^\s*([^#=\s]+)\s*=\s*(.*)\s*$/);
      if (m && process.env[m[1]] == null) {
        env[m[1]] = m[2].replace(/^(['"])(.*)\1$/, '$2').trim();
      }
    }
  }
  for (const [key, value] of Object.entries(process.env)) {
    if (value != null && env[key] == null) env[key] = value;
  }
  if (!env.DATABASE_URL) {
    throw new Error('DATABASE_URL is required (set it in the process environment or .env).');
  }
  return env;
}

// Split SQL text into individual statements, respecting $$, strings, comments.
async function main() {
  const env = loadEnv();
  const sql = neon(env.DATABASE_URL);
  const migrationsDir = path.resolve(process.cwd(), 'migrations');
  const files = fs.readdirSync(migrationsDir).filter(f => f.endsWith('.sql')).sort();

  await sql`CREATE TABLE IF NOT EXISTS schema_migrations (
    version TEXT PRIMARY KEY,
    applied_at TIMESTAMPTZ NOT NULL DEFAULT now()
  )`;

  const applied = await sql`SELECT version FROM schema_migrations`;
  const appliedSet = new Set(applied.map(r => r.version));

  for (const file of files) {
    const version = file.replace(/\.sql$/i, '');
    if (appliedSet.has(file) || appliedSet.has(version)) {
      console.log(`SKIP ${file} (already applied)`);
      continue;
    }
    const filePath = path.join(migrationsDir, file);
    const sqlText = fs.readFileSync(filePath, 'utf8');
    const statements = splitStatements(sqlText).filter(s => s.length > 0);
    console.log(`APPLY ${file} (${statements.length} statements) ...`);

    try {
      await applyMigrationAtomically(sql, statements, version);
    } catch (e) {
      console.error(`  ERROR in atomic migration ${file}:`, e.message);
      console.error('  MIGRATION ROLLED BACK; ledger was not advanced.');
      process.exit(1);
    }
    appliedSet.add(version);
    console.log(`OK ${file} (atomic)`);
  }

  const final = await sql`SELECT version FROM schema_migrations ORDER BY version`;
  console.log('Migrations applied:', final.map(r => r.version).join(', '));
  process.exit(0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
