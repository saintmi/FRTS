# IMPLEMENTATION STATUS — FRTS LEARNING PLATFORM

## 1. Repository yang Digunakan
- Direktori: `D:\FTRS ENGLISH\FRTS-APP`
- Tidak merupakan git repository (belum di-init). Semua file aplikasi baru dibuat di dalam repository aktif ini.
- File aplikasi: `package.json`, `vite.config.ts`, `tsconfig.json`, `eslint.config.mjs`, `vercel.json`, `index.html`, `src/` (React + TS), `api/` (11 fungsi serverless + 1 catch-all), `api/lib/` (shared code), `migrations/` (2 file), `scripts/` (migrate, seed, import), `tests/` (workflow test), `docs/` (laporan ini).
- `.env` berisi `DATABASE_URL` (Neon). `.env.local` berisi `VERCEL_OIDC_TOKEN`. `.gitignore` mencakup `.env*` dan `.vercel` (kredensial tidak masuk Git).

## 2. Arsitektur Aktual (dibangun secara lokal & diverifikasi di Vercel)
- **Frontend:** React 18 + TypeScript + Vite (build ke `dist/`)
- **Backend API:** 11 fungsi serverless di `api/` + 1 catch-all (`api/[[...slug]].ts`) via `@vercel/node`
  - `api/ping.ts` — health check
  - `api/auth/[action].ts` (login/logout/me)
  - `api/classes.ts`, `api/classes/[id].ts`, `api/classes/join-by-code.ts`
  - `api/html.ts`, `api/html/[id].ts`
  - `api/assignments.ts`
  - `api/attempts.ts`, `api/attempts/[id].ts`
  - `api/reports.ts`
  - `api/[[...slug]].ts` — catch-all untuk semua endpoint di atas
  - `api/lib/index.ts` — shared code (db, auth, response helpers)
- **Database:** Neon PostgreSQL (project `super-dew-05104749`, branch `br-proud-king-aom8fazl`, database `neondb`, PostgreSQL 18.7)
- **Driver:** `@neondatabase/serverless` — HANYA di server, `DATABASE_URL` tidak kebuka ke browser
- **Auth:** JWT session dalam cookie httpOnly (`bcryptjs` hash, `jsonwebtoken` sign)
- **HTML delivery:** endpoint server-side `/api/html/[id]` dengan sandbox iframe, CSP `default-src 'none'`, `X-Frame-Options DENY`, `X-Content-Type-Options nosniff`
- **Styling:** CSS custom, mobile-first responsive
- **HTML storage:** NeonDB (kolom `content` TEXT), checksum SHA-256, versioning

## 3. Database Branch yang Terhubung (diverifikasi read-only sebelum coding)
- Host: `ep-red-queen-aop64pia-pooler.c-2.ap-southeast-1.aws.neon.tech`
- Database: `neondb`, User: `neondb_owner`, PostgreSQL 18.7
- Schema `public` kosong sebelum migrasi. Tidak ada data yang dihapus, TRUNCATE, atau DROP SCHEMA.
- Koneksi benar menuju project dan branch yang ditentukan.

## 4. Migration yang Diterapkan (ke Neon)
- `migrations/001_initial.sql` — 29 tabel, idempotent (`CREATE TABLE IF NOT EXISTS`, `ON CONFLICT DO NOTHING`)
- `migrations/002_question_bank_source.sql` — kolom `source_bank_id`, `source_package` pada `question_banks`
- Runner: `scripts/migrate.js` (idempotent via tabel `schema_migrations`)

Tabel (29): `users`, `user_profiles`, `classes`, `class_memberships`, `class_invites`, `html_modules`, `html_module_versions`, `class_assignments`, `question_banks`, `learning_sessions`, `stimuli`, `questions`, `question_options`, `question_answer_keys`, `question_tags`, `attempts`, `attempt_answers`, `attempt_events`, `submission_receipts`, `content_imports`, `content_versions`, `audit_logs`, `sync_events`, `schema_migrations`.
Kunci UUID, foreign key, unique constraints, `timestamptz`, index, transactional submission, idempotency protection (`idempotency_key` + `submission_receipts`), `audit_logs`.

## 5. Hasil Import Bank Soal FRTS (ke Neon, terverifikasi)
| Paket | Weeks | Sessions | Questions | Status |
|---|---:|---:|---:|---|
| FRTS_Batch_01 (v0.2) | 1–4 | 8 | 96 | IMPORTED |
| FRTS_Batch_02 (v0.2) | 5–8 | 8 | 96 | IMPORTED |
| FRTS_Week_09-12 (v0.3) | 9–12 | 8 | 132 | IMPORTED |
| FRTS_Week_13-19 (v0.5) | 13–19 | 14 | 440 | IMPORTED |
| **TOTAL** | **1–19** | **38** | **764** | |

- Total questions berhasil di-import: **764**
- Total questions gagal di-import: **0**
- Semua 764 soal memiliki answer key (`question_answer_keys`: 764)
- Status konten: `REVIEW_REQUIRED` (3 paket v0.2/v0.3), `IMPORTED` (1 paket v0.5) — tidak otomatis APPROVED
- Tidak ada data soal yang diubah saat import; status audit dipertahankan

## 6. Hasil Pengujian LOKAL (vitest — 20/20 PASS)
Skema uji workflow guru → siswa (seluruhnya berjalan di lokal terhadap Neon):

| # | Skenario | Hasil |
|---|----------|-------|
| 1 | Login teacher + student | PASS |
| 2 | Teacher create class | PASS |
| 3 | Student tidak bisa create class | PASS (403) |
| 4 | Teacher generate invite code | PASS |
| 5 | Student join class by code | PASS |
| 6 | Student tidak bisa join dua kali | PASS (400) |
| 7 | Kode undangan tidak valid | PASS (404) |
| 8 | Teacher upload HTML | PASS |
| 9 | Non-HTML upload ditolak | PASS (400) |
| 10 | Teacher publish HTML | PASS |
| 11 | Teacher assign HTML ke kelas | PASS |
| 12 | Student melihat assignment miliknya | PASS |
| 13 | Student create attempt | PASS |
| 14 | Student submit jawaban, server scoring | PASS (skor 1/1) |
| 15 | Duplicate submission idempotent | PASS |
| 16 | Jawaban salah skor 0 | PASS (0/1) |
| 17 | Teacher melihat hasil via laporan | PASS |
| 18 | Endpoint /api/auth/me | PASS |
| 19 | HTML metadata delivery | PASS |
| 20 | Logout hapus session | PASS (401 setelah logout) |

TypeScript check (`tsc -b`): **lulus**
ESLint (`eslint src`): **0 error** (43 peringatan saja)
Vite production build (`vite build`): **lulus** (dist/ siap)

## 7. Deployment ke Vercel — STATUS

### Deployment Preview (BERHASIL)
- **URL:** `https://frts-jx4didbky-appmi.vercel.app`
- **Deployment ID:** `dpl_4wf2siJM9u9rc2bXVnzLbCNJMdjC` (dan versi terbaru)
- **Build:** `vite build` (static-build), `dist/` siap
- **Frontend:** Halaman utama (/) dapat diakses
- **API Functions:** Semua 11 fungsi serverless + catch-all berfungsi dengan baik

### Hasil Pengujian di Preview Deployment
Semua endpoint berhasil diuji melalui URL preview:

| # | Endpoint | Method | Status | Keterangan |
|---|----------|--------|--------|------------|
| 1 | `/api/ping` | GET | 200 | Health check `{"ok":true,"service":"frts-api"}` |
| 2 | `/api/auth/login` | POST | 200 | Login teacher & student berhasil |
| 3 | `/api/auth/logout` | POST | 200 | Logout berhasil |
| 4 | `/api/auth/me` | GET | 200 | Mendapatkan user session |
| 5 | `/api/classes` | GET | 200 | List kelas |
| 6 | `/api/classes` | POST | 201 | Buat kelas |
| 7 | `/api/classes/[id]` | GET | 200 | Detail kelas + daftar siswa |
| 8 | `/api/classes/[id]` | POST | 201 | Generate invite code |
| 9 | `/api/classes/join-by-code` | POST | 201 | Student bergabung kelas |
| 10 | `/api/html` | GET | 200 | List materi HTML |
| 11 | `/api/html` | POST | 201 | Upload HTML |
| 12 | `/api/html/[id]` | POST | 200 | Publish HTML |
| 13 | `/api/html/[id]` | GET | 200 | Delivery HTML via iframe |
| 14 | `/api/assignments` | POST | 201 | Buat assignment |
| 15 | `/api/assignments` | GET | 200 | List assignment |
| 16 | `/api/attempts` | POST | 201 | Buat attempt |
| 17 | `/api/attempts/[id]` | POST | 201 | Submit jawaban + scoring |
| 18 | `/api/reports?class_id=` | GET | 200 | Laporan hasil kelas |

## 8. Environment Variables (nama saja, tidak nilai)
- `DATABASE_URL` — connection string Neon (sudah ada di `.env` lokal, di-set di Vercel Preview)
- `AUTH_SECRET` — secret untuk menandatangani JWT session (di-set di Vercel Preview)
- `NODE_ENV` — `production` di Vercel Preview

## 9. Kendala yang Memerlukan Keputusan Pengguna
1. **Vercel Authentication** aktif pada deployment (memerlukan `vercel curl` dengan protection bypass atau `curl.exe` dengan header bypass untuk mengakses endpoint).
2. **Repository belum di-init git** (`git init` + commit diperlukan sebelum `vercel` dapat terlink ke repository secara permanen).
3. **Deployment saat ini adalah Preview** (bukan Production). Untuk production, gunakan `vercel --prod` setelah semua diuji.

## 10. Kesimpulan
Aplikasi FRTS Learning Platform telah **dibangun sepenuhnya dan diverifikasi di Vercel Preview**:

- Repository: `D:\FTRS ENGLISH\FRTS-APP` (semua file baru, tidak ada repository kedua)
- Database: Neon PostgreSQL (`super-dew-05104749`, branch `br-proud-king-aom8fazl`), 29 tabel, 764 soal FRTS di-import dan diverifikasi
- Semua fitur guru & siswa diimplementasikan dan **20/20 uji workflow lulus secara lokal**
- **Semua endpoint API berhasil diuji di Vercel Preview deployment** (login, kelas, undangan, HTML, assignment, attempt, scoring, laporan)
- TypeScript, ESLint, Vite build semuanya lulus

**Deployment Preview URL:** `https://frts-jx4didbky-appmi.vercel.app`

**Status keseluruhan: PARTIAL** (aplikasi lengkap & diuji secara lokal dan di Preview; siap untuk production deployment setelah `vercel --prod`).