import { neon } from '@neondatabase/serverless';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import { parse, serialize } from 'cookie';
import crypto from 'crypto';

let databaseUrl: string | undefined;
function gdu(): string { if (databaseUrl) return databaseUrl; const u = process.env.DATABASE_URL; if (!u) throw new Error('DATABASE_URL not defined'); databaseUrl = u; return u; }
let client: any = null;
function c(): any { if (!client) client = neon(gdu()); return client; }
export function sql(strings: TemplateStringsArray, ...values: any[]): any { return c()(strings, ...values); }

const AUTH_SECRET = process.env.AUTH_SECRET;
const COOKIE_NAME = 'frts_session';
const COOKIE_MAX_AGE = 60 * 60 * 24 * 7;
interface Session { sub: string; email: string; role: string; }
async function hashPw(pw: string): Promise<string> { return bcrypt.hash(pw, 12); }
async function cmpPw(p: string, h: string): Promise<boolean> { return bcrypt.compare(p, h); }
function signSess(p: Session): string { if (!AUTH_SECRET) throw new Error('AUTH_SECRET is not configured'); return jwt.sign(p, AUTH_SECRET, { expiresIn: COOKIE_MAX_AGE }); }
function verSess(t: string): Session | null { if (!AUTH_SECRET) return null; try { return jwt.verify(t, AUTH_SECRET) as Session; } catch { return null; } }
function getSess(ch: string | null | undefined): Session | null { if (!ch) return null; const t = (parse(ch) as any)[COOKIE_NAME]; if (!t) return null; return verSess(t); }
function setSess(t: string): string { return serialize(COOKIE_NAME, t, { httpOnly: true, secure: process.env.NODE_ENV === 'production', sameSite: 'lax', path: '/', maxAge: COOKIE_MAX_AGE }); }
function clearSess(): string { return serialize(COOKIE_NAME, '', { httpOnly: true, secure: process.env.NODE_ENV === 'production', sameSite: 'lax', path: '/', maxAge: 0 }); }
function json(d: any, s = 200, i?: ResponseInit) { return new Response(JSON.stringify(d), { status: s, headers: { 'Content-Type': 'application/json', ...(i?.headers || {}) } }); }
function err(m: string, s = 400, c?: string) { return json({ error: m, code: c }, s); }
async function writeAudit(session: Session, action: string, entityType: string, entityId: string | null, metadata: any = {}) {
  try { await sql`INSERT INTO audit_logs (id, actor_id, actor_email, action, entity_type, entity_id, metadata, created_at) VALUES (gen_random_uuid(), ${session.sub}, ${session.email}, ${action}, ${entityType}, ${entityId}, ${JSON.stringify(metadata)}, now())`; }
  catch { /* audit failure must not interrupt core workflows */ }
}
async function getBody(req: Request): Promise<any> {
  const ct = req.headers.get('content-type') || '';
  if (ct.includes('application/json')) { const t = await req.text(); try { return JSON.parse(t); } catch { return {}; } }
  if (ct.includes('multipart/form-data')) { const fd = await req.formData(); const out: any = {}; fd.forEach((v, k) => { if (out[k] !== undefined) { if (!Array.isArray(out[k])) out[k] = [out[k]]; out[k].push(v); } else { out[k] = v; } }); return out; }
  const t = await req.text(); try { return JSON.parse(t); } catch { return t; } }
function deq(a: any, b: any): boolean {
  if (a === b) return true; if (a == null || b == null) return a === b; if (typeof a !== typeof b) return false;
  if (Array.isArray(a) && Array.isArray(b)) { if (a.length !== b.length) return false; return a.every((v, i) => deq(v, b[i])); }
  if (typeof a === 'object' && typeof b === 'object') { const ka = Object.keys(a), kb = Object.keys(b); if (ka.length !== kb.length) return false; return ka.every((k) => deq(a[k], b[k])); }
  return false;
}
function getUrl(req: Request): URL { return new URL(req.url, 'http://localhost'); }
function getId(req: Request): string { return getUrl(req).pathname.split('/').pop()!; }

export async function GET(req: Request): Promise<Response> { return dispatch(req); }
export async function POST(req: Request): Promise<Response> { return dispatch(req); }
export async function PUT(req: Request): Promise<Response> { return dispatch(req); }
export async function DELETE(req: Request): Promise<Response> { return dispatch(req); }
export async function PATCH(req: Request): Promise<Response> { return dispatch(req); }
export async function HEAD(req: Request): Promise<Response> { return dispatch(req); }
export async function OPTIONS(req: Request): Promise<Response> { return dispatch(req); }

async function dispatch(req: Request): Promise<Response> {
  const url = getUrl(req);
  const path = url.pathname;
  const method = req.method;
  if (!path.startsWith('/api/')) return err('Not found', 404);
  const segs = path.slice('/api/'.length).split('/').filter(Boolean);

  if (segs.length === 1 && segs[0] === 'ping' && method === 'GET') {
    return json({ ok: true, service: 'frts-api' }, 200);
  }

  if (segs.length === 2 && segs[0] === 'auth') {
    const action = segs[1];
    if (action === 'login' && method === 'POST') {
      if (!AUTH_SECRET) return err('Authentication is not configured', 500, 'AUTH_CONFIG_MISSING');
      const b = await getBody(req);
      const email: string = b?.email; const pw: string = b?.password;
      if (!email || !pw) return err('Email and password required', 400);
      const rows = await sql`SELECT id, email, password_hash, role, is_active FROM users WHERE email = ${email}`;
      const u = rows[0];
      if (!u) return err('Invalid credentials', 401, 'INVALID_CREDENTIALS');
      if (!u.is_active) return err('Account inactive', 403, 'INACTIVE');
      const ok = await cmpPw(pw, u.password_hash);
      if (!ok) return err('Invalid credentials', 401, 'INVALID_CREDENTIALS');
      const tok = signSess({ sub: u.id, email: u.email, role: u.role });
      const cookie = setSess(tok);
      return json({ user: { id: u.id, email: u.email, role: u.role } }, 200, { headers: { 'Set-Cookie': cookie } });
    }
    if (action === 'logout' && method === 'POST') {
      const cookie = clearSess();
      return json({ ok: true }, 200, { headers: { 'Set-Cookie': cookie } });
    }
    if (action === 'me' && method === 'GET') {
      return await withAuth(req, async (_r, s) => {
        const rows = await sql`SELECT id, email, role, is_active, email_verified FROM users WHERE id = ${s.sub}`;
        const u = rows[0];
        if (!u) return err('User not found', 404);
        const prof = await sql`SELECT full_name FROM user_profiles WHERE user_id = ${u.id}`;
        return json({ user: { id: u.id, email: u.email, role: u.role, is_active: u.is_active, email_verified: u.email_verified, full_name: prof[0]?.full_name || null, profile: prof[0] || null } });
      });
    }
    return err('Not found', 404);
  }


  if (segs[0] === 'users' && segs.length === 1) {
    if (method === 'GET') {
      return await withAuth(req, async (_r, s) => {
        const rows = await sql`
          SELECT u.id, u.email, u.role, u.is_active, u.email_verified, u.created_at, u.updated_at,
                 up.full_name, up.institution
          FROM users u LEFT JOIN user_profiles up ON up.user_id = u.id
          ORDER BY u.created_at DESC
        `;
        return json({ users: rows });
      }, ['ADMIN']);
    }
    if (method === 'POST') {
      return await withAuth(req, async (r, s) => {
        const b = await getBody(r);
        const email = String(b?.email || '').trim().toLowerCase();
        const password = String(b?.password || '');
        const role = String(b?.role || 'STUDENT').toUpperCase();
        const fullName = String(b?.full_name || '').trim();
        if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return err('Email tidak valid', 400, 'INVALID_EMAIL');
        if (password.length < 10) return err('Password minimal 10 karakter', 400, 'WEAK_PASSWORD');
        if (!['ADMIN', 'TEACHER', 'STUDENT'].includes(role)) return err('Role tidak valid', 400, 'INVALID_ROLE');
        const existing = await sql`SELECT id FROM users WHERE lower(email) = ${email}`;
        if (existing[0]) return err('Email sudah digunakan', 409, 'EMAIL_EXISTS');
        const passwordHash = await hashPw(password);
        const rows = await sql`
          INSERT INTO users (id, email, password_hash, role, is_active, email_verified, created_at, updated_at)
          VALUES (gen_random_uuid(), ${email}, ${passwordHash}, ${role}, true, false, now(), now())
          RETURNING id, email, role, is_active, email_verified, created_at
        `;
        const user = rows[0];
        await sql`
          INSERT INTO user_profiles (id, user_id, full_name, created_at, updated_at)
          VALUES (gen_random_uuid(), ${user.id}, ${fullName || null}, now(), now())
          ON CONFLICT (user_id) DO UPDATE SET full_name = EXCLUDED.full_name, updated_at = now()
        `;
        await writeAudit(s, 'USER_CREATED', 'user', user.id, { role, email });
        return json({ user: { ...user, full_name: fullName || null } }, 201);
      }, ['ADMIN']);
    }
    return err('Method not allowed', 405);
  }
  if (segs[0] === 'users' && segs.length === 2 && ['PUT', 'PATCH'].includes(method)) {
    const id = segs[1];
    return await withAuth(req, async (r, s) => {
      const b = await getBody(r);
      const role = b?.role !== undefined ? String(b.role).toUpperCase() : null;
      const email = b?.email !== undefined ? String(b.email).trim().toLowerCase() : null;
      const active = b?.is_active !== undefined ? Boolean(b.is_active) : null;
      const fullName = b?.full_name !== undefined ? String(b.full_name).trim() : undefined;
      if (role && !['ADMIN', 'TEACHER', 'STUDENT'].includes(role)) return err('Role tidak valid', 400, 'INVALID_ROLE');
      if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return err('Email tidak valid', 400, 'INVALID_EMAIL');
      if (id === s.sub && ((role && role !== 'ADMIN') || active === false)) return err('Anda tidak dapat menonaktifkan atau menurunkan role akun sendiri', 400, 'SELF_LOCKOUT');
      if (email) {
        const duplicate = await sql`SELECT id FROM users WHERE lower(email) = ${email} AND id <> ${id}`;
        if (duplicate[0]) return err('Email sudah digunakan', 409, 'EMAIL_EXISTS');
      }
      const rows = await sql`
        UPDATE users SET email = COALESCE(${email}, email), role = COALESCE(${role}, role),
        is_active = COALESCE(${active}, is_active), updated_at = now()
        WHERE id = ${id}
        RETURNING id, email, role, is_active, email_verified, updated_at
      `;
      if (!rows[0]) return err('User tidak ditemukan', 404);
      if (fullName !== undefined) {
        await sql`
          INSERT INTO user_profiles (id, user_id, full_name, created_at, updated_at)
          VALUES (gen_random_uuid(), ${id}, ${fullName || null}, now(), now())
          ON CONFLICT (user_id) DO UPDATE SET full_name = EXCLUDED.full_name, updated_at = now()
        `;
      }
      await writeAudit(s, 'USER_UPDATED', 'user', id, { role, email, is_active: active, full_name_changed: fullName !== undefined });
      return json({ user: rows[0] });
    }, ['ADMIN']);
  }

  if (segs.length === 1 && segs[0] === 'classes') {
    if (method === 'GET') {
      return await withAuth(req, async (_r, s) => {
        let rows: any[];
        if (s.role === 'ADMIN') {
          rows = await sql`SELECT c.id, c.name, c.description, c.is_active, c.created_at, u.email AS teacher_email, (SELECT count(*) FROM class_memberships cm WHERE cm.class_id = c.id AND cm.role='student') AS student_count FROM classes c JOIN users u ON u.id = c.teacher_id ORDER BY c.created_at DESC`;
        } else if (s.role === 'TEACHER') {
          rows = await sql`SELECT c.id, c.name, c.description, c.is_active, c.created_at, u.email AS teacher_email, (SELECT count(*) FROM class_memberships cm WHERE cm.class_id = c.id AND cm.role='student') AS student_count FROM classes c JOIN users u ON u.id = c.teacher_id WHERE c.teacher_id = ${s.sub} ORDER BY c.created_at DESC`;
        } else {
          rows = await sql`SELECT c.id, c.name, c.description, c.is_active, c.created_at, u.email AS teacher_email, (SELECT count(*) FROM class_memberships cm WHERE cm.class_id = c.id AND cm.role='student') AS student_count FROM classes c JOIN class_memberships cm ON cm.class_id = c.id AND cm.user_id = ${s.sub} JOIN users u ON u.id = c.teacher_id ORDER BY c.created_at DESC`;
        }
        return json({ classes: rows });
      });
    }
    if (method === 'POST') {
      return await withAuth(req, async (r, s) => {
        if (s.role !== 'ADMIN' && s.role !== 'TEACHER') return err('Forbidden', 403);
        const b = await getBody(r);
        const name: string = b?.name; const desc: string = b?.description;
        if (!name) return err('Name required', 400);
        const tid = s.role === 'ADMIN' ? (b?.teacher_id || s.sub) : s.sub;
        const rows = await sql`INSERT INTO classes (id, name, description, teacher_id) VALUES (gen_random_uuid(), ${name}, ${desc || null}, ${tid}) RETURNING id, name, description, teacher_id, is_active, created_at`;
        await writeAudit(s, 'CLASS_CREATED', 'class', rows[0].id, { name });
        return json({ class: rows[0] }, 201);
      });
    }
    return err('Method not allowed', 405);
  }

  if (segs.length === 2 && segs[0] === 'classes' && segs[1] !== 'join-by-code') {
    const id = segs[1];
    if (method === 'GET') {
      return await withAuth(req, async (_r, s) => {
        const rows = await sql`SELECT c.id, c.name, c.description, c.is_active, c.created_at, c.teacher_id, u.email AS teacher_email FROM classes c JOIN users u ON u.id = c.teacher_id WHERE c.id = ${id}`;
        const cls = rows[0];
        if (!cls) return err('Class not found', 404);
        if (s.role === 'TEACHER' && cls.teacher_id !== s.sub) return err('Forbidden', 403);
        if (s.role === 'STUDENT') { const m = await sql`SELECT 1 FROM class_memberships WHERE class_id = ${id} AND user_id = ${s.sub}`; if (!m[0]) return err('Forbidden', 403); }
        const members = await sql`SELECT cm.user_id, u.email, up.full_name, cm.role, cm.joined_at FROM class_memberships cm JOIN users u ON u.id = cm.user_id LEFT JOIN user_profiles up ON up.user_id = u.id WHERE cm.class_id = ${id} ORDER BY cm.joined_at`;
        const inviteRows = s.role === 'STUDENT' ? [] : await sql`SELECT id, code, max_uses, used_count, expires_at, is_active, created_at FROM class_invites WHERE class_id = ${id} ORDER BY created_at DESC LIMIT 1`;
        return json({ class: cls, members, invite: inviteRows[0] || null });
      });
    }
    if (method === 'PUT') {
      return await withAuth(req, async (r, s) => {
        if (s.role !== 'ADMIN' && s.role !== 'TEACHER') return err('Forbidden', 403);
        const ex = await sql`SELECT teacher_id FROM classes WHERE id = ${id}`;
        if (!ex[0]) return err('Class not found', 404);
        if (s.role === 'TEACHER' && ex[0].teacher_id !== s.sub) return err('Forbidden', 403);
        const b = await getBody(r);
        const name = b?.name !== undefined ? String(b.name).trim() : null;
        const description = b?.description !== undefined ? (String(b.description).trim() || null) : null;
        const isActive = b?.is_active !== undefined ? Boolean(b.is_active) : null;
        if (name === null && b?.description === undefined && isActive === null) return err('No fields', 400);
        if (name !== null && !name) return err('Nama kelas tidak boleh kosong', 400);
        const rows = await sql`UPDATE classes SET name = COALESCE(${name}, name), description = CASE WHEN ${b?.description !== undefined} THEN ${description} ELSE description END, is_active = COALESCE(${isActive}, is_active), updated_at = now() WHERE id = ${id} RETURNING id, name, description, is_active, updated_at`;
        await writeAudit(s, 'CLASS_UPDATED', 'class', id, { name_changed: name !== null, active_changed: isActive !== null });
        return json({ class: rows[0] });
      });
    }
    if (method === 'POST') {
      return await withAuth(req, async (r, s) => {
        if (s.role !== 'ADMIN' && s.role !== 'TEACHER') return err('Forbidden', 403);
        const ex = await sql`SELECT teacher_id FROM classes WHERE id = ${id}`;
        if (!ex[0]) return err('Class not found', 404);
        if (s.role === 'TEACHER' && ex[0].teacher_id !== s.sub) return err('Forbidden', 403);
        const b = await getBody(r);
        if (b?.action === 'invite') {
          const mu = b?.max_uses ? Number(b.max_uses) : null;
          const ed = b?.expires_in_days ? Number(b.expires_in_days) : null;
          const code = b?.code || cryptoRandBytes(4).toString('hex').slice(0, 8).toUpperCase();
          const ea = ed ? new Date(Date.now() + ed * 86400000).toISOString() : null;
          await sql`UPDATE class_invites SET is_active = false WHERE class_id = ${id} AND is_active = true`;
          const rows = await sql`INSERT INTO class_invites (id, class_id, code, max_uses, used_count, expires_at, is_active, created_by, created_at) VALUES (gen_random_uuid(), ${id}, ${code}, ${mu || null}, 0, ${ea || null}, true, ${s.sub}, now()) RETURNING id, code, max_uses, used_count, expires_at, is_active, created_at`;
          await writeAudit(s, 'CLASS_INVITE_CREATED', 'class', id, { max_uses: mu, expires_at: ea });
          return json({ invite: rows[0] }, 201);
        }
        return err('Not found', 404);
      });
    }
    return err('Method not allowed', 405);
  }

  if (segs.length === 2 && segs[0] === 'classes' && segs[1] === 'join-by-code' && method === 'POST') {
    return await withAuth(req, async (r, s) => {
      if (s.role !== 'STUDENT') return err('Only students can join', 403);
      const b = await getBody(r);
      const code: string = b?.code;
      if (!code) return err('Code required', 400);
      const ir = await sql`SELECT ci.*, c.id AS class_id, c.name AS class_name FROM class_invites ci JOIN classes c ON c.id = ci.class_id WHERE ci.code = ${code}`;
      const inv = ir[0];
      if (!inv) return err('Invalid code', 404, 'INVALID_CODE');
      if (!inv.is_active) return err('Code inactive', 403, 'INACTIVE_CODE');
      if (inv.expires_at && new Date(inv.expires_at) < new Date()) return err('Code expired', 403, 'EXPIRED_CODE');
      if (inv.max_uses !== null && inv.used_count >= inv.max_uses) return err('Limit reached', 403, 'LIMIT_REACHED');
      const cid = inv.class_id;
      const joined = await sql`
        WITH eligible_invite AS (
          SELECT ci.id, ci.class_id
          FROM class_invites ci
          WHERE ci.id = ${inv.id}
            AND ci.is_active = true
            AND (ci.expires_at IS NULL OR ci.expires_at > now())
            AND (ci.max_uses IS NULL OR ci.used_count < ci.max_uses)
            AND NOT EXISTS (SELECT 1 FROM class_memberships cm WHERE cm.class_id = ci.class_id AND cm.user_id = ${s.sub})
          FOR UPDATE
        ), inserted_membership AS (
          INSERT INTO class_memberships (id, class_id, user_id, role, joined_at)
          SELECT gen_random_uuid(), eligible_invite.class_id, ${s.sub}, 'student', now()
          FROM eligible_invite
          ON CONFLICT (class_id, user_id) DO NOTHING
          RETURNING class_id
        ), incremented_invite AS (
          UPDATE class_invites ci SET used_count = used_count + 1
          FROM inserted_membership im
          WHERE ci.id = ${inv.id} AND ci.class_id = im.class_id
          RETURNING ci.class_id
        )
        SELECT class_id FROM incremented_invite
      `;
      if (!joined[0]) {
        const alreadyMember = await sql`SELECT 1 FROM class_memberships WHERE class_id = ${cid} AND user_id = ${s.sub}`;
        if (alreadyMember[0]) return err('Already member', 400, 'ALREADY_MEMBER');
        const latestInvite = await sql`SELECT is_active, max_uses, used_count, expires_at FROM class_invites WHERE id = ${inv.id}`;
        if (!latestInvite[0] || !latestInvite[0].is_active) return err('Code inactive', 403, 'INACTIVE_CODE');
        if (latestInvite[0].expires_at && new Date(latestInvite[0].expires_at) < new Date()) return err('Code expired', 403, 'EXPIRED_CODE');
        if (latestInvite[0].max_uses !== null && latestInvite[0].used_count >= latestInvite[0].max_uses) return err('Limit reached', 403, 'LIMIT_REACHED');
        return err('Undangan tidak dapat digunakan. Muat ulang dan coba kembali.', 409, 'INVITE_CLAIM_FAILED');
      }
      return json({ ok: true, class: { id: cid, name: inv.class_name } }, 201);
    });
  }

  if (segs.length === 1 && segs[0] === 'html') {
    if (method === 'GET') {
      return await withAuth(req, async (r, s) => {
        const url = new URL(r.url);
        const week = url.searchParams.get('week');
        const session = url.searchParams.get('session');
        const status = url.searchParams.get('status');
        const search = url.searchParams.get('search');

        if (s.role === 'STUDENT') {
          const rows = await sql`
            SELECT hm.id, hm.title, hm.description, hm.version, hm.checksum, hm.status, hm.is_published, hm.uploaded_by, hm.created_at, hm.updated_at, hm.source_bank_id, hm.source_bank_version, hm.source_session_id, ls.week, ls.session_no, ls.title as session_title
            FROM html_modules hm
            LEFT JOIN learning_sessions ls ON hm.source_session_id = ls.source_session_id AND EXISTS (SELECT 1 FROM question_banks qb WHERE qb.id = ls.bank_id AND qb.source_bank_id = hm.source_bank_id AND qb.package_version = hm.source_bank_version)
            WHERE hm.is_published = true
              AND EXISTS (
                SELECT 1 FROM class_assignments ca
                JOIN class_memberships cm ON ca.class_id = cm.class_id AND cm.user_id = ${s.sub}
                WHERE ca.html_module_id = hm.id AND ca.is_active = true
              )
            ORDER BY ls.week, ls.session_no, hm.created_at DESC
          `;
          let filtered = rows;
          if (week) filtered = filtered.filter((r: any) => String(r.week) === week);
          if (session) filtered = filtered.filter((r: any) => String(r.session_no) === session);
          if (status) filtered = filtered.filter((r: any) => r.status === status);
          if (search) filtered = filtered.filter((r: any) => (r.title || '').toLowerCase().includes(search.toLowerCase()));
          return json({ html_modules: filtered });
        }

        const rows = await sql`
          SELECT hm.id, hm.title, hm.description, hm.version, hm.checksum, hm.status, hm.is_published, hm.uploaded_by, hm.created_at, hm.updated_at, hm.source_bank_id, hm.source_session_id, ls.week, ls.session_no, ls.title as session_title
          FROM html_modules hm
          LEFT JOIN learning_sessions ls ON hm.source_session_id = ls.source_session_id AND EXISTS (SELECT 1 FROM question_banks qb WHERE qb.id = ls.bank_id AND qb.source_bank_id = hm.source_bank_id)
          ORDER BY ls.week, ls.session_no, hm.created_at DESC
        `;
        let filtered = rows;
        if (week) filtered = filtered.filter((r: any) => String(r.week) === week);
        if (session) filtered = filtered.filter((r: any) => String(r.session_no) === session);
        if (status) filtered = filtered.filter((r: any) => r.status === status);
        if (search) filtered = filtered.filter((r: any) => (r.title || '').toLowerCase().includes(search.toLowerCase()));
        return json({ html_modules: filtered });
      });
    }
    if (method === 'POST') {
      return await withAuth(req, async (r, s) => {
        if (s.role !== 'TEACHER' && s.role !== 'ADMIN') return err('Forbidden', 403);
        const ct = r.headers.get('content-type') || '';
        if (!ct.includes('multipart/form-data')) return err('Expected multipart', 400);
        const form = await getBody(r);
        const file = form?.file as File;
        const title = form?.title as string;
        const desc = form?.description as string || null;
        const sourceSessionId = typeof form?.source_session_id === 'string' ? form.source_session_id.trim() : null;
        const sourceBankId = typeof form?.source_bank_id === 'string' ? form.source_bank_id.trim() : null;
        const sourceBankVersion = typeof form?.source_bank_version === 'string' ? form.source_bank_version.trim() : null;
        if (sourceSessionId && s.role !== 'ADMIN') return err('Import materi kanonis hanya untuk admin', 403);
        if (Boolean(sourceSessionId) !== Boolean(sourceBankId) || Boolean(sourceSessionId) !== Boolean(sourceBankVersion)) return err('source_bank_id, source_bank_version, dan source_session_id harus diberikan bersama', 400, 'SOURCE_IDENTITY_INCOMPLETE');
        if (!file) return err('No file', 400);
        if (!(file.name || '').toLowerCase().endsWith('.html')) return err('Only .html', 400);
        if (file.size > 2 * 1024 * 1024) return err('Too large', 400);
        const mime = file.type || '';
        if (mime && !mime.includes('html')) return err('Invalid MIME', 400);
        const ab = await file.arrayBuffer();
        let content = Buffer.from(ab).toString('utf8');
        if (!/<\s*html|<!DOCTYPE/i.test(content)) return err('Invalid HTML', 400);
        if (sourceSessionId) {
          const moduleDataMatch = content.match(/<script[^>]*id=["']moduleData["'][^>]*>([\s\S]*?)<\/script>/i);
          if (!moduleDataMatch) return err('Data modul HTML tidak ditemukan', 422, 'MODULE_DATA_MISSING');
          let moduleData: any;
          try { moduleData = JSON.parse(moduleDataMatch[1]); } catch { return err('Data modul HTML bukan JSON valid', 422, 'MODULE_DATA_INVALID'); }
          if (moduleData.session_id !== sourceSessionId) return err('ID sesi pada HTML tidak cocok dengan metadata upload', 422, 'SESSION_ID_MISMATCH');
          if (moduleData.bank_id && moduleData.bank_id !== sourceBankId) return err('ID bank pada HTML tidak cocok dengan metadata upload', 422, 'BANK_ID_MISMATCH');
          if (moduleData.bank_version && moduleData.bank_version !== sourceBankVersion) return err('Versi bank pada HTML tidak cocok dengan metadata upload', 422, 'BANK_VERSION_MISMATCH');
          moduleData.program = moduleData.program || 'FRTS';
          moduleData.bank_id = sourceBankId;
          moduleData.bank_version = sourceBankVersion;
          moduleData.status = 'REVIEW_REQUIRED';
          content = content.replace(moduleDataMatch[1], JSON.stringify(moduleData).replace(/</g, '\\u003c'));
          const bridgeMarker = "const blob=new Blob([JSON.stringify(report,null,2)]";
          if (!content.includes('function exportReport(){const report=') || !content.includes(bridgeMarker)) return err('Format laporan HTML tidak sesuai kontrak FRTS Vocabulary-First', 422, 'HTML_REPORT_CONTRACT_MISMATCH');
          content = content.replace(bridgeMarker, "if(window.parent!==window){window.parent.postMessage({type:'FRTS_ATTEMPT_REPORT',payload:report},'*');}const blob=new Blob([JSON.stringify(report,null,2)]");
          content = content.replace('Unduh laporan latihan (.json)', 'Kirim hasil ke portal / unduh salinan (.json)');
        }
        const checksum = crypto.createHash('sha256').update(content).digest('hex');
        if (sourceSessionId) {
          const existing = await sql`SELECT id FROM html_modules WHERE source_bank_id = ${sourceBankId} AND source_bank_version = ${sourceBankVersion} AND source_session_id = ${sourceSessionId} LIMIT 1`;
          if (existing[0]) return err('Sesi ini sudah terdaftar di bank HTML', 409, 'SESSION_ALREADY_IMPORTED');
        }
        const initialStatus = sourceSessionId ? 'REVIEW_REQUIRED' : 'DRAFT';
        const rows = await sql`INSERT INTO html_modules (id, title, description, version, content, checksum, uploaded_by, source_bank_id, source_bank_version, source_session_id, status, is_published, created_at, updated_at) VALUES (gen_random_uuid(), ${title || file.name}, ${desc}, 1, ${content}, ${checksum}, ${s.sub}, ${sourceBankId}, ${sourceBankVersion}, ${sourceSessionId}, ${initialStatus}, false, now(), now()) RETURNING id, title, description, version, checksum, status, is_published, source_bank_id, source_bank_version, source_session_id, created_at`;
        const mod = rows[0];
        await sql`INSERT INTO html_module_versions (id, module_id, version, content, checksum, uploaded_by, created_at) VALUES (gen_random_uuid(), ${mod.id}, 1, ${content}, ${checksum}, ${s.sub}, now())`;
        await writeAudit(s, 'HTML_MODULE_UPLOADED', 'html_module', mod.id, { title: mod.title, source_bank_id: sourceBankId, source_bank_version: sourceBankVersion, source_session_id: sourceSessionId, status: mod.status });
        return json({ html_module: mod }, 201);
      });
    }
    return err('Method not allowed', 405);
  }

  if (segs.length === 2 && segs[0] === 'html') {
    const id = segs[1];
    const format = url.searchParams.get('format');
    if (method === 'GET') {
      return await withAuth(req, async (_r, s) => {
        const mr = await sql`SELECT * FROM html_modules WHERE id = ${id}`;
        const mod = mr[0];
        if (!mod) return err('Not found', 404);
        let auth = false;
        if (s.role === 'ADMIN') auth = true;
        else if (s.role === 'TEACHER' && (mod.uploaded_by === s.sub || mod.status === 'APPROVED')) auth = true;
        else if (s.role === 'STUDENT') { const r = await sql`SELECT 1 FROM html_modules hm JOIN class_assignments ca ON ca.html_module_id = hm.id JOIN class_memberships cm ON cm.class_id = ca.class_id AND cm.user_id = ${s.sub} WHERE hm.id = ${id} AND hm.is_published = true AND ca.is_active = true`; auth = !!r[0]; }
        if (!auth) return err('Forbidden', 403);
        if (format === 'json') return json({ id: mod.id, title: mod.title, description: mod.description, version: mod.version, status: mod.status, is_published: mod.is_published, checksum: mod.checksum, source_bank_id: mod.source_bank_id, source_bank_version: mod.source_bank_version, source_session_id: mod.source_session_id });
        const h = new Headers();
        h.set('Content-Type', 'text/html; charset=utf-8');
        h.set('X-Content-Type-Options', 'nosniff');
        h.set('Content-Security-Policy', "default-src 'none'; script-src 'unsafe-inline'; style-src 'unsafe-inline'; img-src data: blob:; font-src data:; connect-src 'none'; object-src 'none'; base-uri 'none'; form-action 'none'; frame-ancestors 'self';");
        h.set('Cache-Control', 'no-store');
        return new Response(mod.content, { status: 200, headers: h });
      });
    }
    if (method === 'PUT') {
      return await withAuth(req, async (r, s) => {
        const mr = await sql`SELECT * FROM html_modules WHERE id = ${id}`;
        const mod = mr[0];
        if (!mod) return err('Not found', 404);
        if (s.role !== 'TEACHER' && s.role !== 'ADMIN') return err('Forbidden', 403);
        if (mod.uploaded_by !== s.sub && s.role !== 'ADMIN') return err('Forbidden', 403);
        const b = await getBody(r);
        const title = b?.title !== undefined ? String(b.title).trim() : null;
        const description = b?.description !== undefined ? (String(b.description).trim() || null) : null;
        const status = b?.status !== undefined ? String(b.status).toUpperCase() : null;
        if (title !== null && !title) return err('Judul tidak boleh kosong', 400);
        if (status && !['DRAFT', 'REVIEW_REQUIRED', 'APPROVED', 'ARCHIVED'].includes(status)) return err('Status konten tidak valid', 400);
        if (status && s.role !== 'ADMIN') return err('Hanya admin yang dapat mengubah status review', 403);
        if (title === null && b?.description === undefined && status === null) return err('No fields', 400);
        const rows = await sql`UPDATE html_modules SET title = COALESCE(${title}, title), description = CASE WHEN ${b?.description !== undefined} THEN ${description} ELSE description END, status = COALESCE(${status}, status), updated_at = now() WHERE id = ${id} RETURNING id, title, description, version, status, is_published, updated_at`;
        await writeAudit(s, status ? 'HTML_STATUS_UPDATED' : 'HTML_MODULE_UPDATED', 'html_module', id, { status });
        return json({ html_module: rows[0] });
      });
    }
    if (method === 'POST') {
      return await withAuth(req, async (r, s) => {
        const mod = await sql`SELECT uploaded_by, is_published FROM html_modules WHERE id = ${id}`;
        if (!mod[0]) return err('Not found', 404);
        if (s.role !== 'ADMIN' && mod[0].uploaded_by !== s.sub) return err('Forbidden', 403);
        const b = await getBody(r);
        if (b?.action === 'publish' || typeof b?.is_published === 'boolean') {
          const current = await sql`SELECT status FROM html_modules WHERE id = ${id}`;
          const ip = b?.is_published === true;
          if (ip && current[0]?.status !== 'APPROVED' && (await sql`SELECT source_session_id FROM html_modules WHERE id = ${id}`)[0]?.source_session_id) return err('Konten sesi kanonis harus disetujui admin sebelum dipublikasikan', 409, 'REVIEW_REQUIRED');
          const rows = await sql`UPDATE html_modules SET is_published = ${ip}, updated_at = now() WHERE id = ${id} RETURNING id, is_published, status`;
          await writeAudit(s, ip ? 'HTML_MODULE_PUBLISHED' : 'HTML_MODULE_UNPUBLISHED', 'html_module', id, {});
          return json({ html_module: rows[0] });
        }
        return err('Not found', 404);
      });
    }
    return err('Method not allowed', 405);
  }

  if (segs.length === 1 && segs[0] === 'assignments') {
    if (method === 'GET') {
      return await withAuth(req, async (_r, s) => {
        let rows: any[];
        if (s.role === 'ADMIN') {
          rows = await sql`SELECT ca.id, ca.title, ca.start_at, ca.due_at, ca.is_active, ca.created_at, c.id AS class_id, c.name AS class_name, hm.id AS html_module_id, hm.title AS html_title, hm.version, hm.status, hm.source_bank_id, hm.source_bank_version, hm.source_session_id, (SELECT count(*) FROM questions q JOIN learning_sessions ls ON ls.id = q.session_id JOIN question_banks qb ON qb.id = ls.bank_id WHERE qb.source_bank_id = hm.source_bank_id AND qb.package_version = hm.source_bank_version AND ls.source_session_id = hm.source_session_id) AS linked_question_count, (SELECT count(*) FROM attempts a WHERE a.assignment_id = ca.id) AS attempt_count FROM class_assignments ca JOIN classes c ON c.id = ca.class_id JOIN html_modules hm ON hm.id = ca.html_module_id ORDER BY ca.created_at DESC`;
        } else if (s.role === 'TEACHER') {
          rows = await sql`SELECT ca.id, ca.title, ca.start_at, ca.due_at, ca.is_active, ca.created_at, c.id AS class_id, c.name AS class_name, hm.id AS html_module_id, hm.title AS html_title, hm.version, hm.status, hm.source_bank_id, hm.source_session_id, (SELECT count(*) FROM questions q JOIN learning_sessions ls ON ls.id = q.session_id JOIN question_banks qb ON qb.id = ls.bank_id WHERE qb.source_bank_id = hm.source_bank_id AND ls.source_session_id = hm.source_session_id) AS linked_question_count, (SELECT count(*) FROM attempts a WHERE a.assignment_id = ca.id) AS attempt_count FROM class_assignments ca JOIN classes c ON c.id = ca.class_id AND c.teacher_id = ${s.sub} JOIN html_modules hm ON hm.id = ca.html_module_id ORDER BY ca.created_at DESC`;
        } else {
          rows = await sql`SELECT ca.id, ca.title, ca.start_at, ca.due_at, ca.is_active, ca.created_at, c.id AS class_id, c.name AS class_name, hm.id AS html_module_id, hm.title AS html_title, hm.version, hm.status, hm.source_bank_id, hm.source_bank_version, hm.source_session_id, (SELECT count(*) FROM questions q JOIN learning_sessions ls ON ls.id = q.session_id JOIN question_banks qb ON qb.id = ls.bank_id WHERE qb.source_bank_id = hm.source_bank_id AND qb.package_version = hm.source_bank_version AND ls.source_session_id = hm.source_session_id) AS linked_question_count, (SELECT count(*) FROM attempts a WHERE a.assignment_id = ca.id AND a.student_id = ${s.sub}) AS my_attempts FROM class_assignments ca JOIN classes c ON c.id = ca.class_id JOIN class_memberships cm ON cm.class_id = c.id AND cm.user_id = ${s.sub} JOIN html_modules hm ON hm.id = ca.html_module_id WHERE ca.is_active = true AND hm.is_published = true ORDER BY ca.created_at DESC`;
        }
        return json({ assignments: rows });
      });
    }
    if (method === 'POST') {
      return await withAuth(req, async (r, s) => {
        if (s.role !== 'TEACHER' && s.role !== 'ADMIN') return err('Forbidden', 403);
        const b = await getBody(r);
        const cid = b?.class_id; const hid = b?.html_module_id; const title = b?.title;
        const sa = b?.start_at || null; const da = b?.due_at || null;
        if (!cid || !hid || !title) return err('class_id, html_module_id, title required', 400);
        const cls = (await sql`SELECT teacher_id FROM classes WHERE id = ${cid}`)[0];
        if (!cls) return err('Class not found', 404);
        if (s.role === 'TEACHER' && cls.teacher_id !== s.sub) return err('Forbidden', 403);
        const hm = (await sql`SELECT id, status, is_published, source_bank_id, source_bank_version, source_session_id FROM html_modules WHERE id = ${hid}`)[0];
        if (!hm) return err('HTML module not found', 404);
        if (!hm.is_published) return err('Materi belum diterbitkan', 409, 'NOT_PUBLISHED');
        if (hm.source_session_id && hm.status !== 'APPROVED') return err('Materi masih menunggu review admin', 409, 'REVIEW_REQUIRED');
        if (hm.source_session_id) {
          const sessionInfo = await sql`SELECT ls.total_questions FROM learning_sessions ls JOIN question_banks qb ON qb.id = ls.bank_id WHERE ls.source_session_id = ${hm.source_session_id} AND qb.source_bank_id = ${hm.source_bank_id} AND qb.package_version = ${hm.source_bank_version} LIMIT 1`;
          const keyed = await sql`SELECT count(*)::int AS count FROM questions q JOIN learning_sessions ls ON ls.id = q.session_id JOIN question_banks qb ON qb.id = ls.bank_id JOIN question_answer_keys ak ON ak.question_id = q.id WHERE ls.source_session_id = ${hm.source_session_id} AND qb.source_bank_id = ${hm.source_bank_id} AND qb.package_version = ${hm.source_bank_version}`;
          const expected = Number(sessionInfo[0]?.total_questions || 0);
          if (!expected || Number(keyed[0]?.count || 0) !== expected) return err('Bank soal atau answer key untuk sesi HTML ini belum lengkap di Neon. Import dan verifikasi bank/kunci terlebih dahulu.', 409, 'QUESTION_KEY_COVERAGE_INCOMPLETE');
        }
        const vr = (await sql`SELECT id, version, content, checksum FROM html_module_versions WHERE module_id = ${hid} ORDER BY version DESC LIMIT 1`)[0];
        const rows = await sql`INSERT INTO class_assignments (id, class_id, html_module_id, html_module_version_id, title, start_at, due_at, is_active, created_by, created_at) VALUES (gen_random_uuid(), ${cid}, ${hid}, ${vr ? vr.id : null}, ${title}, ${sa || null}, ${da || null}, true, ${s.sub}, now()) RETURNING id, class_id, html_module_id, html_module_version_id, title, start_at, due_at, is_active, created_at`;
        await writeAudit(s, 'ASSIGNMENT_CREATED', 'assignment', rows[0].id, { class_id: cid, html_module_id: hid, title });
        return json({ assignment: rows[0] }, 201);
      });
    }
    return err('Method not allowed', 405);
  }

  if (segs.length === 1 && segs[0] === 'attempts') {
    if (method === 'GET') {
      return await withAuth(req, async (_r, s) => {
        let rows: any[];
        if (s.role === 'STUDENT') {
          rows = await sql`SELECT a.id, a.assignment_id, a.status, a.score, a.max_score, a.started_at, a.submitted_at, ca.title AS assignment_title, c.id AS class_id FROM attempts a JOIN class_assignments ca ON ca.id = a.assignment_id JOIN classes c ON c.id = ca.class_id WHERE a.student_id = ${s.sub} ORDER BY a.started_at DESC`;
        } else if (s.role === 'TEACHER') {
          rows = await sql`SELECT a.id, a.student_id, u.email AS student_email, up.full_name AS student_name, a.status, a.score, a.max_score, a.started_at, a.submitted_at, ca.title AS assignment_title FROM attempts a JOIN users u ON u.id = a.student_id LEFT JOIN user_profiles up ON up.user_id = u.id JOIN class_assignments ca ON ca.id = a.assignment_id JOIN classes c ON c.id = ca.class_id AND c.teacher_id = ${s.sub} ORDER BY a.started_at DESC`;
        } else {
          rows = await sql`SELECT * FROM attempts ORDER BY started_at DESC`;
        }
        return json({ attempts: rows });
      });
    }
    if (method === 'POST') {
      return await withAuth(req, async (r, s) => {
        if (s.role !== 'STUDENT') return err('Only students', 403);
        const b = await getBody(r);
        const aid = b?.assignment_id; const ik = b?.idempotency_key || cryptoRandBytes(4).toString('hex');
        if (!aid) return err('assignment_id required', 400);
        const asg = (await sql`SELECT ca.id, c.id AS class_id FROM class_assignments ca JOIN classes c ON c.id = ca.class_id WHERE ca.id = ${aid}`)[0];
        if (!asg) return err('Assignment not found', 404);
        const mem = await sql`SELECT 1 FROM class_memberships WHERE class_id = ${asg.class_id} AND user_id = ${s.sub}`;
        if (!mem[0]) return err('Not member', 403);
        const ex = await sql`SELECT id, status FROM attempts WHERE assignment_id = ${aid} AND student_id = ${s.sub}`;
        if (ex[0]) return json({ attempt: ex[0] });
        const rows = await sql`INSERT INTO attempts (id, assignment_id, student_id, status, idempotency_key, started_at) VALUES (gen_random_uuid(), ${aid}, ${s.sub}, 'in_progress', ${ik}, now()) RETURNING id, assignment_id, student_id, status, idempotency_key, started_at`;
        return json({ attempt: rows[0] }, 201);
      });
    }
    return err('Method not allowed', 405);
  }

  if (segs.length === 2 && segs[0] === 'attempts') {
    const id = segs[1];
    if (method === 'GET') {
      return await withAuth(req, async (_r, s) => {
        const att = await sql`SELECT a.*, ca.title AS assignment_title, c.id AS class_id FROM attempts a JOIN class_assignments ca ON ca.id = a.assignment_id JOIN classes c ON c.id = ca.class_id WHERE a.id = ${id}`;
        if (!att[0]) return err('Not found', 404);
        let ok = false;
        if (s.role === 'ADMIN') ok = true;
        else if (s.role === 'TEACHER') { const cls = await sql`SELECT teacher_id FROM classes WHERE id = ${att[0].class_id}`; ok = cls[0] && cls[0].teacher_id === s.sub; } else { ok = att[0].student_id === s.sub; }
        if (!ok) return err('Forbidden', 403);
        const ans = await sql`SELECT question_id, answer, is_correct, points_earned FROM attempt_answers WHERE attempt_id = ${id}`;
        return json({ attempt: att[0], answers: ans });
      });
    }
    if (method === 'POST') {
      return await withAuth(req, async (r, s) => {
        if (s.role !== 'STUDENT') return err('Only students', 403);
        const b = await getBody(r);
        const ans: any[] = b?.answers || [];
        const ik = b?.idempotency_key;
        const att = await sql`SELECT a.*, ca.due_at FROM attempts a JOIN class_assignments ca ON ca.id = a.assignment_id WHERE a.id = ${id}`;
        if (!att[0]) return err('Not found', 404);
        if (att[0].student_id !== s.sub) return err('Forbidden', 403);
        if (ik) { const rc = await sql`SELECT * FROM submission_receipts WHERE attempt_id = ${id} AND receipt_id = ${ik}`; if (rc[0]) { const f = await sql`SELECT score, max_score, status, submitted_at FROM attempts WHERE id = ${id}`; return json({ attempt: { id, score: f[0].score, max_score: f[0].max_score, status: f[0].status, submitted_at: f[0].submitted_at }, duplicate: true }); } }
        if (att[0].status !== 'in_progress') return err('Already submitted', 400);
        const moduleRow = await sql`SELECT hm.source_bank_id, hm.source_bank_version, hm.source_session_id FROM class_assignments ca JOIN html_modules hm ON hm.id = ca.html_module_id WHERE ca.id = ${att[0].assignment_id}`;
        const sourceSessionId = moduleRow[0]?.source_session_id || null;
        const sourceBankId = moduleRow[0]?.source_bank_id || null;
        const sourceBankVersion = moduleRow[0]?.source_bank_version || null;
        let sourceQuestionMap = new Map<string, any>();
        let legacyQuestionMap = new Map<string, any>();
        if (sourceSessionId) {
          const sourceQuestions = await sql`SELECT q.id, q.source_question_id, q.points, ak.answer FROM questions q JOIN learning_sessions ls ON ls.id = q.session_id JOIN question_banks qb ON qb.id = ls.bank_id LEFT JOIN question_answer_keys ak ON ak.question_id = q.id WHERE ls.source_session_id = ${sourceSessionId} AND qb.source_bank_id = ${sourceBankId} AND qb.package_version = ${sourceBankVersion} ORDER BY q.source_question_id`;
          const expected = await sql`SELECT ls.total_questions FROM learning_sessions ls JOIN question_banks qb ON qb.id = ls.bank_id WHERE ls.source_session_id = ${sourceSessionId} AND qb.source_bank_id = ${sourceBankId} AND qb.package_version = ${sourceBankVersion} LIMIT 1`;
          const expectedCount = Number(expected[0]?.total_questions || 0);
          if (!expectedCount || sourceQuestions.length !== expectedCount || sourceQuestions.some((q: any) => !q.answer)) return err('Bank soal atau answer key untuk sesi ini belum lengkap di server. Jawaban Anda tetap dapat disimpan sebagai laporan offline UNVERIFIED; nilai resmi belum tersedia.', 409, 'QUESTION_KEY_COVERAGE_INCOMPLETE');
          sourceQuestionMap = new Map(sourceQuestions.map((q: any) => [q.source_question_id, q]));
          if (ans.some((item: any) => !sourceQuestionMap.has(String(item.question_id)))) return err('ID soal yang dikirim tidak cocok dengan bank soal sesi ini. Hasil belum dinilai.', 409, 'QUESTION_ID_MISMATCH');
        } else {
          for (const item of ans) {
            const questionId = String(item.question_id || '');
            const row = (await sql`SELECT q.id, q.points, ak.answer FROM questions q LEFT JOIN question_answer_keys ak ON ak.question_id = q.id WHERE q.id::text = ${questionId} LIMIT 1`)[0];
            if (!row || !row.answer) return err('Soal atau answer key tidak ditemukan. Hasil belum dinilai.', 409, 'QUESTION_KEY_MISSING');
            legacyQuestionMap.set(questionId, row);
          }
        }
        let ts = 0, ms = sourceSessionId ? Array.from(sourceQuestionMap.values()).reduce((total: number, q: any) => total + Number(q.points || 0), 0) : 0; const ar: any[] = [];
        const transactionQueries: any[] = [];
        try {
          for (const an of ans) {
            const qid = String(an.question_id || ''); const av = an.answer;
            const q = sourceSessionId ? sourceQuestionMap.get(qid) : legacyQuestionMap.get(qid);
            if (!sourceSessionId) ms += Number(q.points || 0);
            let ic = false, pe = 0;
            const key = q.answer;
            const correctValue = key && typeof key === 'object' ? key.correct_value : key;
            ic = deq(av, key) || (correctValue !== undefined && (deq(av, { correct_value: correctValue }) || (av && (av.selected === correctValue || av.correct_value === correctValue || av.value === correctValue)) || av === correctValue));
            if (ic) pe = Number(q.points || 0);
            ts += pe;
            transactionQueries.push(sql`INSERT INTO attempt_answers (id, attempt_id, question_id, answer, is_correct, points_earned, created_at) VALUES (gen_random_uuid(), ${id}, ${q.id}, ${JSON.stringify(av)}, ${ic}, ${pe}, now())`);
            ar.push({ question_id: qid, is_correct: ic, points_earned: pe });
          }
          const rid = ik || cryptoRandBytes(4).toString('hex');
          const vocabularyPayload = { vocabulary_responses: b?.vocabulary_responses || {}, vocabulary_self_assessment: b?.vocabulary_self_assessment || {}, source_session_id: sourceSessionId, assessment_status: 'FORMATIVE_NOT_GRADED' };
          if (Object.keys(vocabularyPayload.vocabulary_responses).length || Object.keys(vocabularyPayload.vocabulary_self_assessment).length) transactionQueries.push(sql`INSERT INTO attempt_events (id, attempt_id, event_type, payload, created_at) VALUES (gen_random_uuid(), ${id}, 'VOCABULARY_RECALL_REPORT', ${JSON.stringify(vocabularyPayload)}, now())`);
          transactionQueries.push(sql`UPDATE attempts SET status = 'submitted', score = ${ts}, max_score = ${ms}, submitted_at = now() WHERE id = ${id}`);
          transactionQueries.push(sql`INSERT INTO submission_receipts (id, attempt_id, receipt_id, submitted_at) VALUES (gen_random_uuid(), ${id}, ${rid}, now())`);
          await sql.transaction(transactionQueries);
          await writeAudit(s, 'ATTEMPT_SUBMITTED', 'attempt', id, { source_session_id: sourceSessionId, score: ts, max_score: ms });
          return json({ attempt: { id, score: ts, max_score: ms, status: 'submitted', submitted_at: new Date().toISOString() }, answers: ar, receipt_id: rid });
        } catch (e) { throw e; }
      });
    }
    return err('Method not allowed', 405);
  }


  if (segs.length === 1 && segs[0] === 'audit' && method === 'GET') {
    return await withAuth(req, async (r, s) => {
      const url = new URL(r.url);
      const limit = Math.min(200, Math.max(1, Number(url.searchParams.get('limit') || 100)));
      const rows = await sql`
        SELECT id, actor_id, actor_email, action, entity_type, entity_id, metadata, created_at
        FROM audit_logs ORDER BY created_at DESC LIMIT ${limit}
      `;
      return json({ audit_logs: rows });
    }, ['ADMIN']);
  }

  if (segs.length === 1 && segs[0] === 'reports' && method === 'GET') {
    return await withAuth(req, async (r, s) => {
      if (s.role === 'STUDENT') return err('Forbidden', 403);
      const u = new URL(r.url, 'http://localhost');
      const cid = u.searchParams.get('class_id');
      const aid = u.searchParams.get('assignment_id');
      const csv = u.searchParams.get('export') === 'csv';
      const cesc = (v: any): string => { const s2 = v == null ? '' : String(v); if (/[",\n\r]/.test(s2)) return '"' + s2.replace(/"/g, '""') + '"'; return s2; };

      if (!cid && !aid) {
        if (s.role !== 'ADMIN') return err('class_id or assignment_id required', 400);
        const [users, classes, modules, assignments, attempts, imports, recent] = await Promise.all([
          sql`SELECT role, count(*)::int AS count FROM users GROUP BY role`,
          sql`SELECT count(*)::int AS count, count(*) FILTER (WHERE is_active)::int AS active FROM classes`,
          sql`SELECT status, count(*)::int AS count FROM html_modules GROUP BY status`,
          sql`SELECT count(*)::int AS count, count(*) FILTER (WHERE is_active)::int AS active FROM class_assignments`,
          sql`SELECT status, count(*)::int AS count FROM attempts GROUP BY status`,
          sql`SELECT package_name, package_version, status, total_questions, total_sessions, imported_questions, created_at FROM content_imports ORDER BY created_at DESC LIMIT 8`,
          sql`SELECT a.id AS attempt_id, a.status, a.score, a.max_score, a.submitted_at, ca.title AS assignment_title, c.name AS class_name, u.email AS student_email, up.full_name AS student_name FROM attempts a JOIN class_assignments ca ON ca.id = a.assignment_id JOIN classes c ON c.id = ca.class_id JOIN users u ON u.id = a.student_id LEFT JOIN user_profiles up ON up.user_id = u.id ORDER BY a.started_at DESC LIMIT 12`
        ]);
        return json({
          summary: { users, classes: classes[0] || { count: 0, active: 0 }, html_modules_by_status: modules, assignments: assignments[0] || { count: 0, active: 0 }, attempts_by_status: attempts },
          recent_imports: imports,
          recent_attempts: recent
        });
      }
      if (cid) {
        if (s.role === 'TEACHER') { const cls = await sql`SELECT teacher_id FROM classes WHERE id = ${cid}`; if (!cls[0] || cls[0].teacher_id !== s.sub) return err('Forbidden', 403); }
        const rows = await sql`SELECT a.id AS attempt_id, a.student_id, u.email AS student_email, up.full_name AS student_name, ca.title AS assignment_title, a.status, a.score, a.max_score, a.submitted_at FROM attempts a JOIN users u ON u.id = a.student_id LEFT JOIN user_profiles up ON up.user_id = u.id JOIN class_assignments ca ON ca.id = a.assignment_id WHERE ca.class_id = ${cid} ORDER BY a.submitted_at DESC NULLS LAST`;
        if (csv) {
          const hd = ['attempt_id','student_email','student_name','assignment_title','status','score','max_score','submitted_at'];
          const lines = [hd.map(cesc).join(',')];
          for (const row of rows) lines.push([row.attempt_id,row.student_email,row.student_name,row.assignment_title,row.status,row.score,row.max_score,row.submitted_at].map(cesc).join(','));
          return new Response(lines.join('\n'), { status: 200, headers: { 'Content-Type': 'text/csv', 'Content-Disposition': `attachment; filename=class_${cid}_results.csv` } });
        }
        return json({ results: rows });
      }
      if (aid) {
        if (s.role === 'TEACHER') { const asg = await sql`SELECT c.teacher_id FROM class_assignments ca JOIN classes c ON c.id=ca.class_id WHERE ca.id=${aid}`; if (!asg[0] || asg[0].teacher_id !== s.sub) return err('Forbidden', 403); }
        const rows = await sql`SELECT a.id, u.email AS student_email, up.full_name AS student_name, a.status, a.score, a.max_score, a.submitted_at FROM attempts a JOIN users u ON u.id = a.student_id LEFT JOIN user_profiles up ON up.user_id = u.id WHERE a.assignment_id = ${aid} ORDER BY a.submitted_at DESC NULLS LAST`;
        const tot = await sql`SELECT count(*) AS cnt FROM class_memberships WHERE class_id = (SELECT class_id FROM class_assignments WHERE id=${aid}) AND role='student'`;
        return json({ assignment_id: aid, total_students: Number(tot[0].cnt), submissions: rows.length, results: rows });
      }
      return err('class_id or assignment_id required', 400);
    });
  }

  return err('Not found', 404);
}

function cryptoRandBytes(n: number): Buffer { return Buffer.from(crypto.randomBytes(n)); }
async function withAuth(req: Request, handler: (req: Request, s: Session) => Promise<Response>, roles: string[] = ['ADMIN','TEACHER','STUDENT']): Promise<Response> {
  const s = getSess(req.headers.get('cookie'));
  if (!s) return err('Unauthorized', 401, 'UNAUTHORIZED');
  if (!roles.includes(s.role)) return err('Forbidden', 403, 'FORBIDDEN');
  return handler(req, s);
}
