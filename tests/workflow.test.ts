import { describe, it, expect, beforeAll } from 'vitest';
import fs from 'fs';
import path from 'path';
import loginHandler from '../api/auth/login.ts';
import meHandler from '../api/auth/me.ts';
import logoutHandler from '../api/auth/logout.ts';
import classesIndex from '../api/classes/index.ts';
import inviteHandler from '../api/classes/[id]/invite.ts';
import joinByCode from '../api/classes/join-by-code.ts';
import htmlIndex from '../api/html/index.ts';
import attemptDetail from '../api/attempts/[id]/index.ts';
import submitHandler from '../api/attempts/[id]/submit.ts';
import attemptsIndex from '../api/attempts/index.ts';
import assignmentsIndex from '../api/assignments/index.ts';
import htmlDetail from '../api/html/[id]/index.ts';
import publishHandler from '../api/html/[id]/publish.ts';
import reportsIndex from '../api/reports/index.ts';
import { sql } from '../lib/db.ts';

const BASE = 'http://localhost';
function stripBom(s: string) { return s.replace(/^\uFEFF/, ''); }
function loadEnv() {
  const raw = fs.readFileSync(path.resolve(process.cwd(), '.env'), 'utf8');
  const env: Record<string,string> = {};
  for (const line of stripBom(raw).split('\n')) {
    const m = line.match(/^([^=]+)=(.*)$/);
    if (m) env[m[1].trim()] = m[2].trim();
  }
  for (const [k, v] of Object.entries(env)) process.env[k] = process.env[k] || v;
}
loadEnv();

function req(method: string, url: string, body?: any, cookie?: string): Request {
  const headers: Record<string, string> = {};
  if (cookie) headers['Cookie'] = cookie;
  const init: RequestInit = { method, headers };
  if (body !== undefined) {
    if (body instanceof FormData) {
      init.body = body;
    } else if (typeof body === 'string') {
      init.body = body;
    } else {
      headers['Content-Type'] = 'application/json';
      init.body = JSON.stringify(body);
    }
  }
  return new Request(BASE + url, init);
}

function cookieOf(res: Response): string | undefined {
  return res.headers.get('set-cookie') || undefined;
}

async function jres(res: Response): Promise<any> {
  return res.json();
}

let teacherCookie: string | undefined;
let studentCookie: string | undefined;
let classId: string;
let inviteCode: string;
let htmlId: string;
let assignmentId: string;
let questionId: string;
let correctValue: string;
let attemptId: string;

beforeAll(async () => {
  const t = await sql`SELECT id FROM users WHERE email='teacher@frts.local'`;
  const s = await sql`SELECT id FROM users WHERE email='student@frts.local'`;
  const a = await sql`SELECT id FROM users WHERE email='admin@frts.local'`;
  if (!t[0] || !s[0] || !a[0]) throw new Error('Seed users not found. Run scripts/seed.js first.');
  const q = await sql`SELECT q.id FROM questions q JOIN question_answer_keys ak ON ak.question_id = q.id LIMIT 1`;
  questionId = q[0].id;
  const key = await sql`SELECT answer FROM question_answer_keys WHERE question_id = ${questionId}`;
  correctValue = key[0].answer.correct_value;
});

describe('FRTS workflow', () => {
  it('login teacher + student', async () => {
    const r1 = await loginHandler(req('POST', '/api/auth/login', { email: 'teacher@frts.local', password: 'Teacher123!' }));
    expect(r1.status).toBe(200);
    teacherCookie = cookieOf(r1);
    const d1 = await jres(r1);
    expect(d1.user.role).toBe('TEACHER');

    const r2 = await loginHandler(req('POST', '/api/auth/login', { email: 'student@frts.local', password: 'Student123!' }));
    expect(r2.status).toBe(200);
    studentCookie = cookieOf(r2);
  });

  it('teacher creates class', async () => {
    const res = await classesIndex(req('POST', '/api/classes', { name: 'Kelas FRTS Uji', description: 'Kelas uji coba workflow' }, teacherCookie));
    expect(res.status).toBe(201);
    const d = await jres(res);
    classId = d.class.id;
    expect(d.class.name).toBe('Kelas FRTS Uji');
  });

  it('student cannot create class', async () => {
    const res = await classesIndex(req('POST', '/api/classes', { name: 'Ilegal' }, studentCookie));
    expect(res.status).toBe(403);
  });

  it('teacher generates invite code', async () => {
    const res = await inviteHandler(req('POST', `/api/classes/${classId}/invite`, { max_uses: 5, expires_in_days: 30 }, teacherCookie));
    expect(res.status).toBe(201);
    const d = await jres(res);
    inviteCode = d.invite.code;
    expect(inviteCode).toBeTruthy();
  });

  it('student joins class by code', async () => {
    const res = await joinByCode(req('POST', '/api/classes/join-by-code', { code: inviteCode }, studentCookie));
    expect(res.status).toBe(201);
    const d = await jres(res);
    expect(d.class.id).toBe(classId);
  });

  it('student cannot join same class twice', async () => {
    const res = await joinByCode(req('POST', '/api/classes/join-by-code', { code: inviteCode }, studentCookie));
    expect(res.status).toBe(400);
  });

  it('invalid code rejected', async () => {
    const res = await joinByCode(req('POST', '/api/classes/join-by-code', { code: 'INVALID' }, studentCookie));
    expect(res.status).toBe(404);
  });

  it('teacher uploads HTML', async () => {
    const form = new FormData();
    const html = '<!DOCTYPE html><html><body><h1>Latihan</h1><p>Isi materi latihan FRTS.</p></body></html>';
    form.append('file', new Blob([html], { type: 'text/html' }), 'latihan.html');
    form.append('title', 'Latihan Membaca');
    form.append('description', 'Deskripsi latihan');
    const res = await htmlIndex(req('POST', '/api/html', form, teacherCookie));
    expect(res.status).toBe(201);
    const d = await jres(res);
    htmlId = d.html_module.id;
    expect(d.html_module.checksum).toBeTruthy();
  });

  it('teacher publishes HTML', async () => {
    const res = await publishHandler(req('POST', `/api/html/${htmlId}/publish`, { is_published: true }, teacherCookie));
    expect(res.status).toBe(200);
    const d = await jres(res);
    expect(d.html_module.is_published).toBe(true);
  });

  it('non-html upload rejected', async () => {
    const form = new FormData();
    form.append('file', new Blob(['not html'], { type: 'text/plain' }), 'x.txt');
    const res = await htmlIndex(req('POST', '/api/html', form, teacherCookie));
    expect(res.status).toBe(400);
  });

  it('teacher assigns HTML to class', async () => {
    const res = await assignmentsIndex(req('POST', '/api/assignments', {
      class_id: classId, html_module_id: htmlId, title: 'Tugas Membaca',
    }, teacherCookie));
    expect(res.status).toBe(201);
    const d = await jres(res);
    assignmentId = d.assignment.id;
  });

  it('student sees own assignment', async () => {
    const res = await assignmentsIndex(req('GET', '/api/assignments', undefined, studentCookie));
    expect(res.status).toBe(200);
    const d = await jres(res);
    expect(d.assignments.some((a: any) => a.id === assignmentId)).toBe(true);
  });

  it('student creates attempt', async () => {
    const res = await attemptsIndex(req('POST', '/api/attempts', { assignment_id: assignmentId }, studentCookie));
    expect(res.status).toBe(201);
    const d = await jres(res);
    attemptId = d.attempt.id;
    expect(d.attempt.status).toBe('in_progress');
  });

  it('student submits correct answer and server scores', async () => {
    const res = await submitHandler(req('POST', `/api/attempts/${attemptId}/submit`, {
      answers: [{ question_id: questionId, answer: correctValue }],
      idempotency_key: attemptId,
    }, studentCookie));
    expect(res.status).toBe(200);
    const d = await jres(res);
    expect(d.attempt.status).toBe('submitted');
    expect(d.attempt.score).toBe(1);
    expect(d.attempt.max_score).toBe(1);
    expect(d.receipt_id).toBe(attemptId);
  });

  it('duplicate submission is idempotent', async () => {
    const res = await submitHandler(req('POST', `/api/attempts/${attemptId}/submit`, {
      answers: [{ question_id: questionId, answer: correctValue }],
      idempotency_key: attemptId,
    }, studentCookie));
    expect(res.status).toBe(200);
    const d = await jres(res);
    expect(d.duplicate).toBe(true);
  });

  it('teacher sees result via report', async () => {
    const res = await reportsIndex(req('GET', `/api/reports?class_id=${classId}`, undefined, teacherCookie));
    expect(res.status).toBe(200);
    const d = await jres(res);
    expect(d.results.some((r: any) => r.attempt_id === attemptId)).toBe(true);
  });

  it('student cannot create class (authorization)', async () => {
    const res = await classesIndex(req('POST', '/api/classes', { name: 'X' }, studentCookie));
    expect(res.status).toBe(403);
  });

  it('me endpoint returns current user', async () => {
    const res = await meHandler(req('GET', '/api/auth/me', undefined, teacherCookie));
    expect(res.status).toBe(200);
    const d = await jres(res);
    expect(d.user.email).toBe('teacher@frts.local');
  });

  it('HTML metadata delivery works for student', async () => {
    const res = await htmlDetail(req('GET', `/api/html/${htmlId}?format=json`, undefined, studentCookie));
    expect(res.status).toBe(200);
    const d = await res.json();
    expect(d.id).toBe(htmlId);
  });

  it('logout clears session', async () => {
    const res = await logoutHandler(req('POST', '/api/auth/logout', {}, teacherCookie));
    expect(res.status).toBe(200);
    const me = await meHandler(req('GET', '/api/auth/me', undefined, undefined));
    expect(me.status).toBe(401);
  });
});
