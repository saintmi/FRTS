import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import crypto from 'node:crypto';
import { execSync } from 'node:child_process';
import { neon } from '@neondatabase/serverless';
import { selectCanonicalBankJson, validateBankSource } from './lib/question-bank-validation.js';
import { importPackageAtomically } from './lib/package-importer.js';

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

const IMPORTS_DIR = path.resolve(process.cwd(), 'content', 'imports');
const DRY_RUN = process.argv.includes('--dry-run');
const packageArgIndex = process.argv.indexOf('--package');
const packageArg = packageArgIndex >= 0 ? process.argv[packageArgIndex + 1] : null;
const versionArgIndex = process.argv.indexOf('--version');
const packageVersionArg = versionArgIndex >= 0 ? process.argv[versionArgIndex + 1] : null;
if (packageArgIndex >= 0 && (!packageArg || path.basename(packageArg) !== packageArg || !packageArg.toLowerCase().endsWith('.zip'))) {
  throw new Error('--package requires a ZIP filename located inside content/imports; paths are not accepted.');
}

const PACKAGES = [
  { file: 'FRTS_Batch_01_Audit_and_Revised_Artifacts_v0.2(2).zip', bankVersion: '0.2' },
  { file: 'FRTS_Batch_02_Audit_and_Revised_Package_v0.2(2).zip', bankVersion: '0.2' },
  { file: 'FRTS_Week_09-12_Audit_and_Revised_Package_v0.3(2).zip', bankVersion: '0.3' },
  { file: 'FRTS_Week_13-19_Audit_and_Revised_Package_v0.5(1).zip', bankVersion: '0.5' },
];

function extractZip(zipPath, destDir) {
  fs.mkdirSync(destDir, { recursive: true });
  execSync(`powershell -NoProfile -Command "Expand-Archive -LiteralPath '${zipPath}' -DestinationPath '${destDir}' -Force"`, { stdio: 'pipe' });
}

function findBankJson(dir) {
  const matches = [];
  function walk(d) {
    for (const entry of fs.readdirSync(d, { withFileTypes: true })) {
      const full = path.join(d, entry.name);
      if (entry.isDirectory()) { walk(full); continue; }
      if (entry.name.toLowerCase().endsWith('.json') && entry.name.toLowerCase().includes('question_bank')) matches.push(full);
    }
  }
  walk(dir);
  return selectCanonicalBankJson(matches);
}

function mapBankStatus(raw) {
  const s = (raw || '').toUpperCase();
  if (s.includes('APPROVED') || s.includes('PUBLISHED')) return 'APPROVED';
  if (s.includes('ARCHIVED')) return 'ARCHIVED';
  if (s.includes('REVIEW')) return 'REVIEW_REQUIRED';
  return 'IMPORTED';
}

function normalizeBank(bankRaw, sourcePackage, packageVersion) {
  const bank = {
    source_bank_id: bankRaw.bank_id,
    package_version: bankRaw.bank_version || packageVersion,
    name: bankRaw.program || sourcePackage,
    status: mapBankStatus(bankRaw.status),
    raw_status: bankRaw.status,
    source_package: sourcePackage,
  };
  const sessions = [], stimuli = [], questions = [], options = [], answerKeys = [];
  let totalQuestions = 0;
  for (const s of bankRaw.sessions || []) {
    totalQuestions += (s.questions || []).length;
    sessions.push({
      source_session_id: s.session_id,
      week: s.week != null ? Number(s.week) : null,
      session_no: s.session_number != null ? Number(s.session_number) : null,
      title: s.title || null,
      total_questions: (s.questions || []).length,
    });
    for (const st of s.stimuli || []) {
      stimuli.push({ source_stimulus_id: st.id, session_id: s.session_id, content: st.text || null, content_type: st.genre || null });
    }
    for (const q of s.questions || []) {
      const student = q.student || {};
      const teacher = q.teacher_only || {};
      const correctValue = teacher.correct_value;
      questions.push({
        source_question_id: q.id,
        session_id: s.session_id,
        type: q.type || 'multiple_choice',
        prompt: student.question || null,
        points: 1,
        status: 'DRAFT',
        stimulus_id: q.stimulus_id || null,
      });
      (student.options || []).forEach((opt, i) => {
        options.push({
          question_source_id: q.id,
          label: opt.value != null ? String(opt.value) : null,
          text: opt.label || null,
          is_correct: String(opt.value ?? '').trim().toUpperCase() === String(correctValue ?? '').trim().toUpperCase(),
          sort_order: i,
        });
      });
      if (correctValue != null) {
        answerKeys.push({
          question_source_id: q.id,
          answer: { correct_value: correctValue, correct_answer: teacher.correct_answer || null, explanation: teacher.explanation || null },
          explanation: teacher.explanation || null,
        });
      }
    }
  }
  return { bank, sessions, stimuli, questions, options, answerKeys, totalQuestions };
}

async function main() {
  const env = loadEnv();
  const sql = neon(env.DATABASE_URL);
  const report = { packages: [], total_sessions: 0, total_questions: 0, imported_questions: 0, skipped: 0, errors: [] };

  const activePackages = packageArg
    ? [{ file: packageArg, bankVersion: packageVersionArg || '0.4' }]
    : PACKAGES;

  for (const pkg of activePackages) {
    const zipPath = path.join(IMPORTS_DIR, pkg.file);
    if (!fs.existsSync(zipPath)) {
      report.errors.push({ package: pkg.file, error: 'File not found' });
      report.packages.push({ package: pkg.file, status: 'MISSING' });
      continue;
    }
    const tmpDir = path.resolve(os.tmpdir(), 'frts-import-' + crypto.randomBytes(4).toString('hex'));
    try {
      extractZip(zipPath, tmpDir);
      const bankJson = findBankJson(tmpDir);
      if (!bankJson) {
        report.errors.push({ package: pkg.file, error: 'No question bank JSON found' });
        report.packages.push({ package: pkg.file, status: 'NO_JSON' });
        continue;
      }
      const bankRaw = JSON.parse(stripBom(fs.readFileSync(bankJson, 'utf8')));
      const sourceCounts = validateBankSource(bankRaw, packageVersionArg || pkg.bankVersion);
      const archiveSha256 = crypto.createHash('sha256').update(fs.readFileSync(zipPath)).digest('hex');
      const norm = normalizeBank(bankRaw, pkg.file, packageVersionArg || pkg.bankVersion);

      if (DRY_RUN) {
        report.packages.push({ package: pkg.file, status: 'DRY_RUN', bank_id: norm.bank.source_bank_id, bank_version: norm.bank.package_version, sha256: archiveSha256, ...sourceCounts });
        report.total_sessions += norm.sessions.length;
        report.total_questions += norm.questions.length;
        continue;
      }

      // Package writes are committed as one transaction. Existing rows are
      // compared against the source; any conflict aborts the entire package.
      let bankRow = await sql`SELECT id, name, status, total_questions, total_sessions
        FROM question_banks WHERE source_package = ${pkg.file}
          AND source_bank_id = ${norm.bank.source_bank_id}
          AND package_version = ${norm.bank.package_version}`;
      if (bankRow[0]) {
        if (String(bankRow[0].name) !== String(norm.bank.name) ||
            String(bankRow[0].status) !== String(norm.bank.status)) {
          throw new Error('Import conflict: existing question bank metadata differs from source.');
        }
      } else {
        bankRow = await sql`INSERT INTO question_banks
          (id, name, source_package, source_bank_id, package_version, status, total_questions, total_sessions, created_at)
          VALUES (gen_random_uuid(), ${norm.bank.name}, ${pkg.file}, ${norm.bank.source_bank_id}, ${norm.bank.package_version}, ${norm.bank.status}, 0, 0, now())
          RETURNING id, name, status, total_questions, total_sessions`;
      }
      const bankId = bankRow[0].id;
      const pkgMeta = { file: pkg.file, sha256: archiveSha256 };
      await importPackageAtomically(sql, norm, pkgMeta);
      const bankSessions = norm.sessions.length;
      const bankQuestions = norm.questions.length;

      report.packages.push({ package: pkg.file, status: 'IMPORTED', bank_id: norm.bank.source_bank_id, bank_version: norm.bank.package_version, sha256: archiveSha256, sessions: bankSessions, questions: bankQuestions });
      report.total_sessions += bankSessions;
      report.total_questions += norm.totalQuestions;
      report.imported_questions += bankQuestions;
    } catch (e) {
      report.errors.push({ package: pkg.file, error: String(e.message) });
      report.packages.push({ package: pkg.file, status: 'ERROR', error: String(e.message) });
    } finally {
      fs.rmSync(tmpDir, { recursive: true, force: true });
    }
  }

  console.log('IMPORT REPORT:');
  console.log(JSON.stringify(report, null, 2));
  process.exit(report.errors.length ? 1 : 0);
}

main().catch((e) => { console.error(e); process.exit(1); });
