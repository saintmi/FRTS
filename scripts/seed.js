import fs from 'node:fs';
import path from 'node:path';
import { neon } from '@neondatabase/serverless';
import bcrypt from 'bcryptjs';

function stripBom(s) { return s.replace(/^\uFEFF/, ''); }

function loadEnv() {
  const envPath = path.resolve(process.cwd(), '.env');
  const fileEnv = fs.existsSync(envPath) ? Object.fromEntries(
    stripBom(fs.readFileSync(envPath, 'utf8'))
      .split('\n')
      .map(line => line.match(/^([^=]+)=(.*)$/))
      .filter(Boolean)
      .map(match => [match[1].trim(), match[2].trim()])
  ) : {};
  return { ...fileEnv, ...process.env };
}

async function main() {
  if (!process.argv.includes('--apply')) {
    throw new Error('Seed dihentikan. Tinjau database target dan jalankan ulang dengan --apply secara eksplisit.');
  }

  const env = loadEnv();
  const databaseUrl = env.DATABASE_URL_UNPOOLED || env.DATABASE_URL;
  if (!databaseUrl) throw new Error('DATABASE_URL atau DATABASE_URL_UNPOOLED wajib diisi.');
  if (env.NODE_ENV === 'production' && env.ALLOW_PRODUCTION_SEED !== 'true') {
    throw new Error('Seed ke environment production ditolak. Jangan aktifkan tanpa prosedur khusus.');
  }

  const users = [
    { role: 'ADMIN', email: env.FRTS_SEED_ADMIN_EMAIL, password: env.FRTS_SEED_ADMIN_PASSWORD, full_name: env.FRTS_SEED_ADMIN_NAME || 'Administrator' },
    { role: 'TEACHER', email: env.FRTS_SEED_TEACHER_EMAIL, password: env.FRTS_SEED_TEACHER_PASSWORD, full_name: env.FRTS_SEED_TEACHER_NAME || 'Guru Utama' },
    { role: 'STUDENT', email: env.FRTS_SEED_STUDENT_EMAIL, password: env.FRTS_SEED_STUDENT_PASSWORD, full_name: env.FRTS_SEED_STUDENT_NAME || 'Siswa Contoh' },
  ].filter(user => user.email || user.password);

  if (users.length === 0) {
    throw new Error('Tidak ada akun seed. Isi variabel FRTS_SEED_<ROLE>_EMAIL dan FRTS_SEED_<ROLE>_PASSWORD secara eksplisit.');
  }

  for (const user of users) {
    if (!user.email || !user.password || user.password.length < 12) {
      throw new Error('Setiap akun seed harus memiliki email dan password minimal 12 karakter.');
    }
    const email = user.email.trim().toLowerCase();
    const passwordHash = await bcrypt.hash(user.password, 12);
    const inserted = await sql`INSERT INTO users (id, email, password_hash, role, is_active, email_verified)
      VALUES (gen_random_uuid(), ${email}, ${passwordHash}, ${user.role}, true, true)
      ON CONFLICT (email) DO NOTHING
      RETURNING id`;
    const row = inserted[0] || (await sql`SELECT id FROM users WHERE email = ${email}`)[0];
    if (!row) throw new Error('Gagal memastikan akun seed: ' + email);
    await sql`INSERT INTO user_profiles (id, user_id, full_name)
      VALUES (gen_random_uuid(), ${row.id}, ${user.full_name})
      ON CONFLICT (user_id) DO NOTHING`;
    console.log('SEED', user.role, email, inserted[0] ? 'CREATED' : 'EXISTS');
  }
}

const env = loadEnv();
const databaseUrl = env.DATABASE_URL_UNPOOLED || env.DATABASE_URL;
if (!databaseUrl) throw new Error('DATABASE_URL atau DATABASE_URL_UNPOOLED wajib diisi.');
const sql = neon(databaseUrl);

main().catch(error => {
  console.error('Seed gagal:', error.message);
  process.exitCode = 1;
});
