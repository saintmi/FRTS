import fs from 'node:fs';
import path from 'node:path';
import { neon } from '@neondatabase/serverless';

function stripBom(s) { return s.replace(/^\uFEFF/, ''); }

function loadEnv() {
  const raw = fs.readFileSync(path.resolve(process.cwd(), '.env'), 'utf8');
  const env = {};
  for (const line of stripBom(raw).split('\n')) {
    const m = line.match(/^([^=]+)=(.*)$/);
    if (m) env[m[1].trim()] = m[2].trim();
  }
  return env;
}

// Split SQL text into individual statements, respecting $$, strings, comments.
function splitStatements(sqlText) {
  const stmts = [];
  let buf = '';
  let i = 0;
  const n = sqlText.length;
  let inSingleQuote = false;
  let inDollar = false;
  let dollarTag = '';
  let inLineComment = false;
  let inBlockComment = false;

  while (i < n) {
    const ch = sqlText[i];
    const next = sqlText[i + 1];

    if (inLineComment) {
      buf += ch;
      if (ch === '\n') { inLineComment = false; }
      i++;
      continue;
    }
    if (inBlockComment) {
      buf += ch;
      if (ch === '*' && next === '/') { inBlockComment = false; buf += sqlText[++i]; i++; continue; }
      i++;
      continue;
    }
    if (inSingleQuote) {
      buf += ch;
      if (ch === "'") {
        if (sqlText[i + 1] === "'") { buf += sqlText[++i]; i++; continue; }
        inSingleQuote = false;
      }
      i++;
      continue;
    }
    if (inDollar) {
      buf += ch;
      // check for closing $tag$
      if (ch === '$') {
        const candidate = sqlText.slice(i);
        const m = candidate.match(/^(\$\w*\$)/);
        if (m && m[1] === '$' + dollarTag + '$') {
          buf += sqlText.slice(i, i + m[1].length);
          i += m[1].length;
          inDollar = false;
          continue;
        }
      }
      i++;
      continue;
    }

    // not in any string/comment
    if (ch === '-' && next === '-') { inLineComment = true; buf += ch; i++; continue; }
    if (ch === '/' && next === '*') { inBlockComment = true; buf += ch; buf += sqlText[++i]; i++; continue; }
    if (ch === "'") { inSingleQuote = true; buf += ch; i++; continue; }
    if (ch === '$') {
      const m = sqlText.slice(i).match(/^(\$\w*\$)/);
      if (m) {
        inDollar = true;
        dollarTag = m[1].slice(1, -1);
        buf += m[1];
        i += m[1].length;
        continue;
      }
      buf += ch; i++; continue;
    }

    if (ch === ';') {
      const trimmed = buf.trim();
      if (trimmed) stmts.push(trimmed);
      buf = '';
      i++;
      continue;
    }
    buf += ch;
    i++;
  }
  const trimmed = buf.trim();
  if (trimmed) stmts.push(trimmed);
  return stmts;
}

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
    // Older runs may have recorded either the filename (with .sql) or the
    // explicit version inserted by the migration SQL. Recognize both forms.
    if (appliedSet.has(file) || appliedSet.has(version)) {
      console.log(`SKIP ${file} (already applied)`);
      continue;
    }
    const filePath = path.join(migrationsDir, file);
    const sqlText = fs.readFileSync(filePath, 'utf8');
    const statements = splitStatements(sqlText).filter(s => s.length > 0);
    console.log(`APPLY ${file} (${statements.length} statements) ...`);
    for (const stmt of statements) {
      try {
        // strip leading/trailing, execute via tagged template
        await sql.query(stmt);
      } catch (e) {
        console.error(`  ERROR in ${file}:`, e.message);
        console.error(`  STATEMENT: ${stmt.slice(0, 200)}`);
        process.exit(1);
      }
    }
    await sql`INSERT INTO schema_migrations (version) VALUES (${version}) ON CONFLICT (version) DO NOTHING`;
    console.log(`OK ${file}`);
  }

  const final = await sql`SELECT version FROM schema_migrations ORDER BY version`;
  console.log('Migrations applied:', final.map(r => r.version).join(', '));
  process.exit(0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
