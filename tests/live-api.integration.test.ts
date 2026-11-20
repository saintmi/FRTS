import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { neon } from '@neondatabase/serverless';
import bcrypt from 'bcryptjs';
import { randomUUID } from 'node:crypto';

const enabled = process.env.FRTS_ALLOW_LIVE_BACKTEST === 'YES' &&
  Boolean(process.env.DATABASE_URL) &&
  process.env.FRTS_BACKTEST_DATABASE === 'frts_phase0_migration_test';

const suite = enabled ? describe : describe.skip;
const password = process.env.FRTS_BACKTEST_PASSWORD || 'FRTS-Backtest-Only-2026!x';
const secret = process.env.AUTH_SECRET || 'frts-disposable-live-backtest-secret-only';
let sql: ReturnType<typeof neon>;
let GET: (request: Request) => Promise<Response>;
let POST: (request: Request) => Promise<Response>;
let cookies: Record<string, string> = {};
let ids: Record<string, string> = {};
let assignmentId = '';
let questionId = '';

const identities = [
  { key: 'admin', email: 'admin@frts.test.invalid', role: 'ADMIN', name: 'Mock Administrator' },
  { key: 'teacherOne', email: 'teacher.one@frts.test.invalid', role: 'TEACHER', name: 'Mock Teacher One' },
  { key: 'teacherTwo', email: 'teacher.two@frts.test.invalid', role: 'TEACHER', name: 'Mock Teacher Two' },
  { key: 'studentOne', email: 'student.one@frts.test.invalid', role: 'STUDENT', name: 'Mock Student One' },
  { key: 'studentTwo', email: 'student.two@frts.test.invalid', role: 'STUDENT', name: 'Mock Student Two' },
] as const;

function request(path: string, method = 'GET', body?: unknown, cookie?: string) {
  return new Request('http://localhost' + path, {
    method,
    headers: {
      ...(body === undefined ? {} : { 'Content-Type': 'application/json' }),
      ...(cookie ? { cookie } : {}),
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
}

function cookieFrom(response: Response) {
  const value = response.headers.get('set-cookie');
  if (!value) throw new Error('Login did not return a session cookie');
  return value.split(';')[0];
}

suite('Live API backtest against disposable Neon database', () => {
  beforeAll(async () => {
    if (password.length < 12) throw new Error('FRTS_BACKTEST_PASSWORD must be at least 12 characters');
    sql = neon(process.env.DATABASE_URL!);
    const db = await sql`SELECT current_database() AS name`;
    if (db[0]?.name !== 'frts_phase0_migration_test') {
      throw new Error('Refusing live backtest: DATABASE_URL is not the exact disposable test database');
    }

    process.env.AUTH_SECRET = secret;
    process.env.NODE_ENV = 'test';
    const api = await import('../api/[[...slug]].ts');
    GET = api.GET;
    POST = api.POST;

    for (const user of identities) {
      const hash = await bcrypt.hash(password, 12);
      const rows = await sql`
        INSERT INTO users (email, password_hash, role, is_active, email_verified)
        VALUES (${user.email}, ${hash}, ${user.role}, true, true)
        ON CONFLICT (email) DO UPDATE SET
          password_hash = EXCLUDED.password_hash,
          role = EXCLUDED.role,
          is_active = true,
          email_verified = true,
          updated_at = now()
        RETURNING id
      `;
      ids[user.key] = rows[0].id;
      await sql`
        INSERT INTO user_profiles (user_id, full_name, institution)
        VALUES (${rows[0].id}, ${user.name}, 'FRTS Backtest Lab')
        ON CONFLICT (user_id) DO UPDATE SET full_name = EXCLUDED.full_name, institution = EXCLUDED.institution
      `;
    }

    const classOne = await sql`
      INSERT INTO classes (id, name, description, teacher_id)
      VALUES ('90000000-0000-4000-8000-000000000006', 'Backtest Class One', 'Disposable role-isolation fixture', ${ids.teacherOne})
      ON CONFLICT (id) DO UPDATE SET name = EXCLUDED.name, description = EXCLUDED.description, teacher_id = EXCLUDED.teacher_id
      RETURNING id
    `;
    const classTwo = await sql`
      INSERT INTO classes (id, name, description, teacher_id)
      VALUES ('90000000-0000-4000-8000-000000000007', 'Backtest Class Two', 'Disposable role-isolation fixture', ${ids.teacherTwo})
      ON CONFLICT (id) DO UPDATE SET name = EXCLUDED.name, description = EXCLUDED.description, teacher_id = EXCLUDED.teacher_id
      RETURNING id
    `;
    ids.classOne = classOne[0].id;
    ids.classTwo = classTwo[0].id;

    await sql`
      INSERT INTO class_memberships (class_id, user_id, role)
      VALUES (${ids.classOne}, ${ids.studentOne}, 'student'),
             (${ids.classTwo}, ${ids.studentTwo}, 'student')
      ON CONFLICT (class_id, user_id) DO NOTHING
    `;

    const bank = await sql`
      INSERT INTO question_banks (id, name, status, total_questions, total_sessions)
      VALUES ('90000000-0000-4000-8000-000000000008', 'P0 Live API Mock Bank', 'APPROVED', 1, 1)
      ON CONFLICT (id) DO UPDATE SET name = EXCLUDED.name, status = EXCLUDED.status, total_questions = 1, total_sessions = 1
      RETURNING id
    `;
    const session = await sql`
      INSERT INTO learning_sessions (id, bank_id, source_session_id, total_questions, title)
      VALUES ('90000000-0000-4000-8000-000000000009', ${bank[0].id}, NULL, 1, 'P0 Live API Mock Session')
      ON CONFLICT (id) DO UPDATE SET bank_id = EXCLUDED.bank_id, total_questions = 1, title = EXCLUDED.title
      RETURNING id
    `;
    const question = await sql`
      INSERT INTO questions (id, bank_id, session_id, type, prompt, points, status)
      VALUES ('90000000-0000-4000-8000-000000000010', ${bank[0].id}, ${session[0].id}, 'multiple_choice', 'Mock question for API backtest', 1, 'APPROVED')
      ON CONFLICT (id) DO UPDATE SET bank_id = EXCLUDED.bank_id, session_id = EXCLUDED.session_id, prompt = EXCLUDED.prompt, points = 1, status = 'APPROVED'
      RETURNING id
    `;
    questionId = question[0].id;
    await sql`
      INSERT INTO question_options (question_id, label, text, is_correct, sort_order)
      VALUES (${questionId}, 'A', 'Incorrect option', false, 0),
             (${questionId}, 'B', 'Correct option', true, 1)
      ON CONFLICT (question_id, sort_order) DO UPDATE SET label = EXCLUDED.label, text = EXCLUDED.text, is_correct = EXCLUDED.is_correct
    `;
    await sql`
      INSERT INTO question_answer_keys (question_id, answer, explanation)
      VALUES (${questionId}, ${JSON.stringify({ correct_value: 'B' })}::jsonb, 'Disposable test key')
      ON CONFLICT (question_id) DO UPDATE SET answer = EXCLUDED.answer
    `;

    const module = await sql`
      INSERT INTO html_modules (id, title, description, version, content, checksum, uploaded_by, status, is_published)
      VALUES ('90000000-0000-4000-8000-000000000011', 'P0 Live API Mock Module', 'Disposable integration fixture', 1, '<main>Mock lesson</main>', 'p0-live-api-mock', ${ids.admin}, 'APPROVED', true)
      ON CONFLICT (id) DO UPDATE SET title = EXCLUDED.title, description = EXCLUDED.description, content = EXCLUDED.content, checksum = EXCLUDED.checksum, uploaded_by = EXCLUDED.uploaded_by, status = 'APPROVED', is_published = true
      RETURNING id
    `;
    ids.module = module[0].id;

    for (const role of ['admin', 'teacherOne', 'teacherTwo', 'studentOne', 'studentTwo']) {
      const login = await POST(request('/api/auth/login', 'POST', {
        email: identities.find(user => user.key === role)!.email,
        password,
      }));
      expect(login.status).toBe(200);
      cookies[role] = cookieFrom(login);
    }

    const createAssignment = await POST(request('/api/assignments', 'POST', {
      class_id: ids.classOne,
      html_module_id: ids.module,
      title: 'P0 Live API Mock Assignment',
    }, cookies.teacherOne));
    expect(createAssignment.status).toBe(201);
    const assignment = await createAssignment.json();
    assignmentId = assignment.assignment.id;
  }, 60_000);

  it('authenticates all five mock identities and returns their actual role', async () => {
    for (const role of Object.keys(cookies)) {
      const response = await GET(request('/api/auth/me', 'GET', undefined, cookies[role]));
      expect(response.status).toBe(200);
      const body = await response.json();
      expect(body.user.role).toBe(identities.find(user => user.key === role)!.role);
    }
  });

  it('allows only admin to read the user directory', async () => {
    expect((await GET(request('/api/users', 'GET', undefined, cookies.admin))).status).toBe(200);
    expect((await GET(request('/api/users', 'GET', undefined, cookies.teacherOne))).status).toBe(403);
    expect((await GET(request('/api/users', 'GET', undefined, cookies.studentOne))).status).toBe(403);
  });

  it('isolates class lists and class detail by teacher ownership and student membership', async () => {
    const adminList = await (await GET(request('/api/classes', 'GET', undefined, cookies.admin))).json();
    const teacherList = await (await GET(request('/api/classes', 'GET', undefined, cookies.teacherOne))).json();
    const studentList = await (await GET(request('/api/classes', 'GET', undefined, cookies.studentOne))).json();
    expect(adminList.classes.some((item: any) => item.id === ids.classTwo)).toBe(true);
    expect(teacherList.classes.map((item: any) => item.id)).toContain(ids.classOne);
    expect(teacherList.classes.map((item: any) => item.id)).not.toContain(ids.classTwo);
    expect(studentList.classes.map((item: any) => item.id)).toEqual([ids.classOne]);
    expect((await GET(request('/api/classes/' + ids.classTwo, 'GET', undefined, cookies.teacherOne))).status).toBe(403);
    expect((await GET(request('/api/classes/' + ids.classTwo, 'GET', undefined, cookies.studentOne))).status).toBe(403);
  });

  it('isolates assignment and attempt visibility across roles', async () => {
    const teacherAssignments = await (await GET(request('/api/assignments', 'GET', undefined, cookies.teacherOne))).json();
    const studentAssignments = await (await GET(request('/api/assignments', 'GET', undefined, cookies.studentOne))).json();
    expect(teacherAssignments.assignments.map((item: any) => item.id)).toContain(assignmentId);
    expect(studentAssignments.assignments.map((item: any) => item.id)).toContain(assignmentId);
    expect((await GET(request('/api/assignments', 'GET', undefined, cookies.teacherTwo))).status).toBe(200);
    expect((await GET(request('/api/attempts', 'GET', undefined, cookies.studentTwo))).status).toBe(200);
  });

  it('allows only enrolled student to start an attempt', async () => {
    const denied = await POST(request('/api/attempts', 'POST', { assignment_id: assignmentId }, cookies.studentTwo));
    expect(denied.status).toBe(403);
    const allowed = await POST(request('/api/attempts', 'POST', { assignment_id: assignmentId }, cookies.studentOne));
    expect(allowed.status).toBe(201);
    const body = await allowed.json();
    ids.attempt = body.attempt.id;
    const ownAttempts = await (await GET(request('/api/attempts', 'GET', undefined, cookies.studentOne))).json();
    const otherAttempts = await (await GET(request('/api/attempts', 'GET', undefined, cookies.studentTwo))).json();
    const teacherAttempts = await (await GET(request('/api/attempts', 'GET', undefined, cookies.teacherOne))).json();
    const otherTeacherAttempts = await (await GET(request('/api/attempts', 'GET', undefined, cookies.teacherTwo))).json();
    expect(ownAttempts.attempts.map((item: any) => item.id)).toContain(ids.attempt);
    expect(otherAttempts.attempts.map((item: any) => item.id)).not.toContain(ids.attempt);
    expect(teacherAttempts.attempts.map((item: any) => item.id)).toContain(ids.attempt);
    expect(otherTeacherAttempts.attempts.map((item: any) => item.id)).not.toContain(ids.attempt);
  });

  it('serializes two concurrent authenticated submissions into one receipt and audit event', async () => {
    const submit = () => POST(request('/api/attempts/' + ids.attempt, 'POST', {
      answers: [{ question_id: questionId, answer: 'B' }],
      idempotency_key: 'p0-live-' + randomUUID(),
    }, cookies.studentOne));
    const responses = await Promise.all([submit(), submit()]);
    expect(responses.some(response => response.status === 200)).toBe(true);
    expect(responses.every(response => response.status === 200 || response.status === 409 || response.status === 400)).toBe(true);

    const [attempt] = await sql`SELECT status, score, max_score FROM attempts WHERE id = ${ids.attempt}`;
    const receipts = await sql`SELECT count(*)::int AS count FROM submission_receipts WHERE attempt_id = ${ids.attempt}`;
    const answers = await sql`SELECT count(*)::int AS count FROM attempt_answers WHERE attempt_id = ${ids.attempt}`;
    const audits = await sql`SELECT count(*)::int AS count FROM audit_logs WHERE entity_type = 'attempt' AND entity_id = ${ids.attempt} AND action = 'ATTEMPT_SUBMITTED'`;
    expect(attempt).toMatchObject({ status: 'submitted', score: 1, max_score: 1 });
    expect(receipts[0].count).toBe(1);
    expect(answers[0].count).toBe(1);
    expect(audits[0].count).toBe(1);
  }, 60_000);

  it('prevents teacher two from reading teacher one assignment results', async () => {
    const response = await GET(request('/api/reports?assignment_id=' + assignmentId, 'GET', undefined, cookies.teacherTwo));
    expect(response.status).toBe(403);
    const allowed = await GET(request('/api/reports?assignment_id=' + assignmentId, 'GET', undefined, cookies.teacherOne));
    expect(allowed.status).toBe(200);
  });
});
