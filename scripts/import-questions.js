import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import crypto from 'node:crypto';
import { execSync } from 'node:child_process';
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
  if (matches.length !== 1) {
    throw new Error(`Expected exactly one canonical question_bank JSON; found ${matches.length}.`);
  }
  return matches[0];
}

function validateBankSource(bankRaw, expectedVersion) {
  const errors = [];
  if (!bankRaw || typeof bankRaw !== 'object' || !bankRaw.bank_id) errors.push('bank_id is required');
  if (String(bankRaw?.bank_version || expectedVersion) !== String(expectedVersion)) errors.push(`bank_version mismatch: expected ${expectedVersion}, got ${bankRaw?.bank_version}`);
  if (!Array.isArray(bankRaw?.sessions) || bankRaw.sessions.length === 0) errors.push('sessions must be a non-empty array');
  const sessionIds = new Set(), questionIds = new Set(), stimulusIds = new Set();
  for (const session of bankRaw?.sessions || []) {
    if (!session?.session_id || sessionIds.has(String(session.session_id))) errors.push(`missing or duplicate session_id: ${session?.session_id}`);
    sessionIds.add(String(session?.session_id || ''));
    const localStimuli = new Set();
    for (const stimulus of session?.stimuli || []) {
      const id = String(stimulus?.id || '');
      if (!id || stimulusIds.has(id)) errors.push(`missing or duplicate stimulus id: ${id}`);
      stimulusIds.add(id); localStimuli.add(id);
      if (typeof stimulus?.text !== 'string' || !stimulus.text.trim()) errors.push(`stimulus text missing: ${id}`);
    }
    for (const question of session?.questions || []) {
      const id = String(question?.id || '');
      if (!id || questionIds.has(id)) errors.push(`missing or duplicate question id: ${id}`);
      questionIds.add(id);
      if (question?.stimulus_id && !localStimuli.has(String(question.stimulus_id))) errors.push(`question ${id} references a missing stimulus in session ${session.session_id}`);
      const options = question?.student?.options || [];
      const labels = options.map(option => String(option?.value || '').toUpperCase());
      if (labels.length !== 4 || ['A','B','C','D'].some(label => labels.filter(value => value === label).length !== 1)) errors.push(`question ${id} must have exactly one A/B/C/D option`);
      const correctValue = question?.teacher_only?.correct_value;
      if (correctValue == null || !labels.includes(String(correctValue).toUpperCase())) errors.push(`question ${id} has no valid teacher_only.correct_value`);
      if (!question?.student || typeof question.student.question !== 'string' || !question.student.question.trim()) errors.push(`question ${id} has no student-facing prompt`);
    }
  }
  if (errors.length) throw new Error('Source preflight failed: ' + errors.slice(0, 30).join('; '));
  return { sessions: sessionIds.size, questions: questionIds.size, stimuli: stimulusIds.size };
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
          is_correct: opt.value === correctValue,
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

      // Upsert bank (idempotent)
      let bankRow = await sql`SELECT id FROM question_banks WHERE source_package = ${pkg.file} AND source_bank_id = ${norm.bank.source_bank_id} AND package_version = ${norm.bank.package_version}`;
      if (!bankRow[0]) {
        const ins = await sql`INSERT INTO question_banks (id, name, source_package, source_bank_id, package_version, status, total_questions, total_sessions, created_at)
          VALUES (gen_random_uuid(), ${norm.bank.name}, ${norm.bank.source_package}, ${norm.bank.source_bank_id}, ${norm.bank.package_version}, ${norm.bank.status}, ${norm.totalQuestions}, 0, now())
          RETURNING id`;
        bankRow = ins;
      }
      const bankId = bankRow[0].id;

      let bankSessions = 0, bankQuestions = 0;
      const sessionMap = new Map();
      for (const s of norm.sessions) {
        let sr = await sql`SELECT id FROM learning_sessions WHERE bank_id = ${bankId} AND source_session_id = ${s.source_session_id}`;
        if (!sr[0]) {
          const ins = await sql`INSERT INTO learning_sessions (id, bank_id, source_session_id, week, session_no, title, total_questions, created_at)
            VALUES (gen_random_uuid(), ${bankId}, ${s.source_session_id}, ${s.week}, ${s.session_no}, ${s.title}, ${s.total_questions}, now()) RETURNING id`;
          sr = ins;
        }
        sessionMap.set(s.source_session_id, sr[0].id);
        bankSessions++;
      }
      const stimulusMap = new Map();
      for (const st of norm.stimuli) {
        const sid = sessionMap.get(st.session_id);
        if (!sid) continue;
        let sr = await sql`SELECT id FROM stimuli WHERE session_id = ${sid} AND source_stimulus_id = ${st.source_stimulus_id}`;
        if (!sr[0]) {
          const ins = await sql`INSERT INTO stimuli (id, session_id, source_stimulus_id, content, content_type, created_at)
            VALUES (gen_random_uuid(), ${sid}, ${st.source_stimulus_id}, ${st.content}, ${st.content_type}, now()) RETURNING id`;
          sr = ins;
        }
        stimulusMap.set(st.source_stimulus_id, sr[0].id);
      }
      for (const q of norm.questions) {
        const sid = sessionMap.get(q.session_id);
        let qr = await sql`SELECT id FROM questions WHERE bank_id = ${bankId} AND source_question_id = ${q.source_question_id}`;
        if (!qr[0]) {
          const stimId = q.stimulus_id ? stimulusMap.get(q.stimulus_id) : null;
          const ins = await sql`INSERT INTO questions (id, bank_id, session_id, stimulus_id, source_question_id, type, prompt, points, status, created_at)
            VALUES (gen_random_uuid(), ${bankId}, ${sid || null}, ${stimId || null}, ${q.source_question_id}, ${q.type}, ${q.prompt}, ${q.points}, ${q.status}, now()) RETURNING id`;
          qr = ins;
        }
        const qId = qr[0].id;
        bankQuestions++;
        for (const o of norm.options.filter(x => x.question_source_id === q.source_question_id)) {
          let or = await sql`SELECT id FROM question_options WHERE question_id = ${qId} AND sort_order = ${o.sort_order}`;
          if (!or[0]) {
            await sql`INSERT INTO question_options (id, question_id, label, text, is_correct, sort_order, created_at)
              VALUES (gen_random_uuid(), ${qId}, ${o.label}, ${o.text}, ${o.is_correct}, ${o.sort_order}, now())`;
          }
        }
        const key = norm.answerKeys.find(k => k.question_source_id === q.source_question_id);
        if (key) {
          let kr = await sql`SELECT id FROM question_answer_keys WHERE question_id = ${qId}`;
          if (!kr[0]) {
            await sql`INSERT INTO question_answer_keys (id, question_id, answer, explanation, created_at)
              VALUES (gen_random_uuid(), ${qId}, ${JSON.stringify(key.answer)}, ${key.explanation}, now())`;
          }
        }
      }

      await sql`UPDATE question_banks SET total_sessions = ${bankSessions}, total_questions = ${bankQuestions} WHERE id = ${bankId}`;
      await sql`INSERT INTO content_imports (id, package_name, package_version, status, total_questions, total_sessions, imported_questions, report, created_at)
        VALUES (gen_random_uuid(), ${pkg.file}, ${pkg.bankVersion}, 'COMPLETED', ${norm.totalQuestions}, ${bankSessions}, ${bankQuestions}, ${JSON.stringify({ sessions: norm.sessions.length, questions: norm.questions.length })}, now())`;

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
