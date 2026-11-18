import fs from 'node:fs';
import path from 'node:path';
import { neon } from '@neondatabase/serverless';
import bcrypt from 'bcryptjs';

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

async function main() {
  const env = loadEnv();
  const sql = neon(env.DATABASE_URL);
  const users = [
    { email: 'admin@frts.local', password: 'Admin123!', role: 'ADMIN', full_name: 'Administrator' },
    { email: 'teacher@frts.local', password: 'Teacher123!', role: 'TEACHER', full_name: 'Guru Utama' },
    { email: 'student@frts.local', password: 'Student123!', role: 'STUDENT', full_name: 'Siswa Contoh' },
  ];
  for (const u of users) {
    const hash = await bcrypt.hash(u.password, 12);
    await sql`INSERT INTO users (id, email, password_hash, role, is_active, email_verified)
      VALUES (gen_random_uuid(), ${u.email}, ${hash}, ${u.role}, true, true)
      ON CONFLICT (email) DO UPDATE SET password_hash = EXCLUDED.password_hash, role = EXCLUDED.role, is_active = true`;
    const urow = (await sql`SELECT id FROM users WHERE email = ${u.email}`)[0];
    await sql`INSERT INTO user_profiles (id, user_id, full_name)
      VALUES (gen_random_uuid(), ${urow.id}, ${u.full_name})
      ON CONFLICT (user_id) DO UPDATE SET full_name = EXCLUDED.full_name`;
    console.log('SEED', u.role, u.email);
  }
  process.exit(0);
}
main().catch((e) => { console.error(e); process.exit(1); });
