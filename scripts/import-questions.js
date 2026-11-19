import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import crypto from 'node:crypto';
import { execSync } from 'node:child_process';
import { normalizeVocabularyFirstBank } from './lib/vocabulary-first-adapter.js';
import { neon } from '@neondatabase/serverless';
import { selectCanonicalBankJson, validateBankSource } from './lib/question-bank-validation.js';
import { importPackageAtomically } from './lib/package-importer.js';

function stripBom(s) { return s.replace(/^\uFEFF/, ''); }
function loadEnv() {
  // CI/deployment environments inject secrets directly; local development may
  // still use .env. Explicit process environment values always take precedence.
  const env = { ...process.env };
  const envPath = path.resolve(process.cwd(), '.env');
  if (fs.existsSync(envPath)) {
    const raw = fs.readFileSync(envPath, 'utf8');
    for (const line of stripBom(raw).split('\n')) {
      const m = line.match(/^\s*([^#=\s]+)\s*=\s*(.*)\s*$/);
      if (m && env[m[1]] === undefined) env[m[1]] = m[2].replace(/^(['"])(.*)\1$/, '$2');
    }
  }
  if (!env.DATABASE_URL) throw new Error('DATABASE_URL is required (set it in the environment or .env).');
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
  if (process.platform === 'win32') {
    execSync(`powershell -NoProfile -Command "Expand-Archive -LiteralPath '${zipPath}' -DestinationPath '${destDir}' -Force"`, { stdio: 'pipe' });
  } else {
    execSync('unzip', ['-q', zipPath, '-d', destDir], { stdio: 'pipe' });
  }
}

function findUniqueFile(dir, basename) {
  const matches = [];
  function walk(d) {
    for (const entry of fs.readdirSync(d, { withFileTypes: true })) {
      const full = path.join(d, entry.name);
      if (entry.isDirectory()) walk(full);
      else if (entry.name === basename) matches.push(full);
    }
  }
  walk(dir);
  if (matches.length !== 1) throw new Error('Expected exactly one ' + basename + '; found ' + matches.length + '.');
  return matches[0];
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

function assertApprovedPackage(manifestPath, packageFile, sha256, bankId, bankVersion) {
  if (!fs.existsSync(manifestPath)) {
    throw new Error('Approved package manifest is missing. Create content/imports/approved-package-manifest.json before any non-dry-run import.');
  }
  const manifest = JSON.parse(stripBom(fs.readFileSync(manifestPath, 'utf8')));
  const approval = manifest?.packages?.[packageFile];
  if (!approval || approval.approval_status !== 'APPROVED') {
    throw new Error('Package is not explicitly approved in the package manifest: ' + packageFile);
  }
  if (String(approval.sha256 || '').toLowerCase() !== sha256.toLowerCase()) {
    throw new Error('Package SHA-256 does not match the approved manifest: ' + packageFile);
  }
  if (String(approval.bank_id || '') !== String(bankId) ||
      String(approval.bank_version || '') !== String(bankVersion)) {
    throw new Error('Bank identity/version does not match the approved manifest: ' + packageFile);
  }
  if (!approval.approved_by || !approval.approved_at) {
    throw new Error('Manifest approval must include approved_by and approved_at: ' + packageFile);
  }
  return approval;
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
    ? [{ file: packageArg, bankVersion: packageVersionArg || (packageArg.includes('v0.6.1') ? '0.6.1' : '0.4') }]
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
      const archiveSha256 = crypto.createHash('sha256').update(fs.readFileSync(zipPath)).digest('hex');
      let norm;
      let sourceCounts;
      const studentBankPath = findUniqueFile(tmpDir, 'FRTS_Batch_01_Student_Bank_v0.6.1.json');
      const teacherKeysPath = findUniqueFile(tmpDir, 'FRTS_Batch_01_Teacher_Key_v0.6.1.json');
      if (studentBankPath && teacherKeysPath) {
        const studentBank = JSON.parse(stripBom(fs.readFileSync(studentBankPath, 'utf8')));
        const teacherKeys = JSON.parse(stripBom(fs.readFileSync(teacherKeysPath, 'utf8')));
        norm = normalizeVocabularyFirstBank(studentBank, teacherKeys, pkg.file, packageVersionArg || pkg.bankVersion);
        sourceCounts = {
          bank_id: norm.bank.source_bank_id,
          bank_version: norm.bank.package_version,
          sessions: norm.sessions.length,
          questions: norm.questions.length,
          stimuli: norm.stimuli.length,
          official_source_keys: norm.keyDisposition.official_source_keys,
          proposed_keys_excluded_from_official_scoring: norm.keyDisposition.proposed_keys_excluded_from_official_scoring,
        };
      } else {
        const bankJson = findBankJson(tmpDir);
        if (!bankJson) throw new Error('No supported question bank source files found');
        const bankRaw = JSON.parse(stripBom(fs.readFileSync(bankJson, 'utf8')));
        sourceCounts = validateBankSource(bankRaw, packageVersionArg || pkg.bankVersion);
        norm = normalizeBank(bankRaw, pkg.file, packageVersionArg || pkg.bankVersion);
      }

      if (DRY_RUN) {
        report.packages.push({ package: pkg.file, status: 'DRY_RUN', bank_id: norm.bank.source_bank_id, bank_version: norm.bank.package_version, sha256: archiveSha256, ...sourceCounts });
        report.total_sessions += norm.sessions.length;
        report.total_questions += norm.questions.length;
        continue;
      }

      // A non-dry-run import is permitted only when owner-approved exact
      // package bytes and source bank identity are allowlisted.
      const manifestPath = path.join(IMPORTS_DIR, 'approved-package-manifest.json');
      assertApprovedPackage(
        manifestPath,
        pkg.file,
        archiveSha256,
        norm.bank.source_bank_id,
        norm.bank.package_version
      );
      const pkgMeta = { file: pkg.file, sha256: archiveSha256, keyDisposition: norm.keyDisposition || null };
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
