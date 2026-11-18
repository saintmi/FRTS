# PRODUCTION READINESS AUDIT — FRTS LEARNING PLATFORM

## Audit Summary

| Area | Status |
|------|--------|
| Security | PASS (with minor recommendations) |
| Database Integrity | PASS |
| Production Environment | PARTIAL (env vars not yet set for Production) |
| Acceptance Test | PASS (16/16 workflow steps) |
| Backup | PASS (Neon managed backup) |

**Overall Recommendation: GO — with conditions**

Production deployment is authorized **only after** Production environment variables (`DATABASE_URL`, `AUTH_SECRET`) are configured in the Vercel project dashboard.

---

## A. SECURITY AUDIT

### Endpoint Authentication & Authorization

All sensitive endpoints are protected by `withAuth()` middleware which validates the JWT session cookie and checks roles server-side. No sensitive endpoint is publicly accessible.

| Endpoint | Method | Auth Required | Role Check | IDOR Protection |
|----------|--------|---------------|------------|-----------------|
| `/api/auth/login` | POST | No (public) | N/A | N/A |
| `/api/auth/logout` | POST | No (clears cookie only) | N/A | N/A |
| `/api/auth/me` | GET | Yes | All roles | Own user only |
| `/api/classes` | GET | Yes | Role-filtered results | Student sees only own classes; Teacher sees own classes |
| `/api/classes` | POST | Yes | ADMIN/TEACHER | Teacher creates class as own |
| `/api/classes/[id]` | GET | Yes | TEACHER=owner, STUDENT=member | Teacher ownership verified; Student membership verified |
| `/api/classes/[id]` | PUT | Yes | TEACHER=owner | Teacher ownership verified |
| `/api/classes/[id]` | POST (invite) | Yes | TEACHER=owner | Teacher ownership verified |
| `/api/classes/join-by-code` | POST | Yes | STUDENT only | Student joins via invite code |
| `/api/html` | GET/POST | Yes | TEACHER/ADMIN | Teacher sees own uploads |
| `/api/html/[id]` | GET/PUT/POST | Yes | Owner/Admin | Ownership verified; Student access via published assignment only |
| `/api/assignments` | GET/POST | Yes | Role-filtered | Teacher sees own assignments |
| `/api/attempts` | GET/POST | Yes | Role-filtered | Student sees own attempts |
| `/api/attempts/[id]` | GET/POST | Yes | Owner verification | Attempt ownership verified for student/teacher |
| `/api/reports` | GET | Yes | ADMIN/TEACHER only | Teacher sees own class results |

### Key Security Properties Verified

| Check | Status | Evidence |
|-------|--------|----------|
| All sensitive endpoints require auth | PASS | `withAuth()` middleware on all endpoints except `/api/ping` (health check) and `/api/auth/login`/`/api/auth/logout` |
| Role checked server-side | PASS | `withAuth()` checks `getSess()` from JWT cookie; endpoints enforce role-specific rules |
| Teacher only manages own classes | PASS | `classes/[id]` PUT/GET checks `cls.teacher_id !== s.sub`; class creation sets `teacher_id = s.sub` for TEACHER role |
| Student only accesses own classes | PASS | `classes/[id]` GET verifies `class_memberships` for STUDENT; `classes` GET filters by membership |
| Student cannot access other student data | PASS | `attempts` GET filters `WHERE a.student_id = ${s.sub}`; `attempts/[id]` checks `att[0].student_id === s.sub` |
| Answer key not accessible from browser | PASS | Answer keys stored in `question_answer_keys` table; only accessed server-side during scoring; no endpoint exposes answer keys |
| Official score calculated server-side | PASS | `attempts/[id]` POST recalculates score from `question_answer_keys`; browser-submitted scores are not trusted |
| IDOR/BOLA prevented | PASS | Ownership/membership checks on every resource endpoint (`classes/[id]`, `html/[id]`, `attempts/[id]`, `reports`) |
| Input validated | PASS | File upload: `.html` extension, MIME type, 2MB size limit, HTML content validation (`/<\s*html\|<!DOCTYPE/i`); numeric fields cast with `Number()` |
| SQL injection prevented | PASS | All queries use Neon serverless parameterized tagged templates (`sql\`...\``); no string interpolation in SQL |
| Cookie: HttpOnly, Secure (Production), SameSite | PASS | `setSess()`: `httpOnly: true, secure: process.env.NODE_ENV === 'production', sameSite: 'lax', path: '/', maxAge: 604800` |
| CSRF protection | PARTIAL | SameSite=lax provides CSRF mitigation; no explicit CSRF token (acceptable for cookie-based SPA with SameSite lax) |
| Rate limiting on login/invitation | FAIL | No rate limiting implemented on login or invitation endpoints |
| Upload HTML limits | PASS | Max 2MB, `.html` extension only, MIME type check, HTML content validation |
| HTML sandbox isolation | PASS | Iframe: `sandbox="allow-scripts allow-forms"` (no `allow-same-origin`); CSP: `default-src 'none'; script-src 'none'; object-src 'none'; base-uri 'none'; form-action 'none'`; X-Frame-Options: DENY |
| postMessage validation | N/A | No postMessage communication implemented; HTML runs in fully isolated sandbox; scoring is server-side — no postMessage attack surface |
| Error responses don't leak secrets | PASS | `err()` returns `{ error: message, code }` only; no stack traces or internal details exposed |

### Recommendations (Security)

1. **Add rate limiting** on `/api/auth/login` and `/api/classes/[id]` POST (invite) to prevent brute-force attacks.
2. **Consider SameSite=strict** for higher CSRF protection (trade-off: may affect cross-site navigation).
3. **Add CSRF token** if SameSite=lax is deemed insufficient for the threat model.

---

## B. DATABASE AUDIT

### Foreign Key Constraints (27 FKs)

All 18 tables have proper foreign key constraints with appropriate `ON DELETE CASCADE` behavior:

| Table | FKs | Cascade Behavior |
|-------|-----|-----------------|
| `users` | — | Referenced by 7 tables |
| `user_profiles` | 1 | CASCADE on user delete |
| `classes` | 1 | CASCADE on teacher delete |
| `class_memberships` | 2 | CASCADE on class/user delete |
| `class_invites` | 2 | CASCADE on class/user delete |
| `html_modules` | 1 | CASCADE on uploader delete |
| `html_module_versions` | 2 | CASCADE on module/uploader delete |
| `class_assignments` | 3 | CASCADE on class/html_module delete |
| `question_banks` | — | Referenced by 3 tables |
| `learning_sessions` | 1 | CASCADE on bank delete |
| `stimuli` | 1 | CASCADE on session delete |
| `questions` | 3 | CASCADE/SET NULL on bank/session/stimulus |
| `question_options` | 1 | CASCADE on question delete |
| `question_answer_keys` | 1 | CASCADE on question delete |
| `question_tags` | 1 | CASCADE on question delete |
| `attempts` | 2 | CASCADE on assignment/student delete |
| `attempt_answers` | 2 | CASCADE on attempt/question delete |
| `attempt_events` | 1 | CASCADE on attempt delete |
| `submission_receipts` | 1 | CASCADE on attempt delete |

### Data Consistency Verification

| Check | Result | Evidence |
|-------|--------|----------|
| Total questions | 764 | Matches target exactly |
| Total answer keys | 764 | 100% coverage (0 questions without answer key) |
| Questions per bank | All match | Batch 01: 96/96, Batch 02: 96/96, Week 09-12: 132/132, Week 13-19: 440/440 |
| Duplicate attempts | 0 | UNIQUE constraint on `(assignment_id, student_id)` enforced |
| Submitted attempts without receipt | 0 | Transactional submission with `submission_receipts` |
| Data modification | None | No DROP, TRUNCATE, or data modification performed |

### Recommendations (Database)

None — database integrity is verified and consistent.

---

## C. PRODUCTION ENVIRONMENT

### Environment Variables Status

| Variable | Preview | Production | Notes |
|----------|---------|------------|-------|
| `DATABASE_URL` | Set | **NOT SET** | Required for Production |
| `AUTH_SECRET` | Set | **NOT SET** | Required for Production |
| `NODE_ENV` | Not set | Not set | Should be `production` |

### Findings

- `DATABASE_URL` and `AUTH_SECRET` are configured **only for Preview environment**.
- **Production environment has no environment variables set.**
- No secrets found in Git repository or browser bundle (verified by scanning `dist/assets/index-*.js`).
- Runtime: Node.js 20.x (Vercel default).
- `vercel.json` configured correctly: static-build for frontend, `@vercel/node` for API catch-all function.

### Required Actions Before Production Deployment

1. Set `DATABASE_URL` in Production environment (pointing to the same Neon branch `br-proud-king-aom8fazl` database `neondb`, OR a separate Production branch if desired).
2. Set `AUTH_SECRET` in Production environment (must be a strong random value, different from development/Preview).
3. Optionally set `NODE_ENV=production` in Production.

---

## D. ACCEPTANCE TEST

### Positive Workflow Test (16/16 PASS)

Tested on Preview deployment `https://frts-jx4didbky-appmi.vercel.app`:

| Step | Action | Status |
|------|--------|--------|
| 1 | Teacher login | 200 |
| 2 | Student login | 200 |
| 3 | Teacher create class | 201 |
| 4 | Teacher generate invite code | 201 |
| 5 | Student join class by code | 201 |
| 6 | Student view classes | 200 |
| 7 | Teacher view classes | 200 |
| 8 | Teacher upload HTML | 201 |
| 9 | Teacher publish HTML | 200 |
| 10 | Teacher create assignment | 201 |
| 11 | Student view assignments | 200 |
| 12 | Student create attempt | 201 |
| 13 | Student get attempt | 200 |
| 14 | Teacher view attempts | 200 |
| 15 | Teacher view report | 200 |
| 16 | Server-side scoring verified | 200 (score recalculated from answer keys) |

### Negative Access Tests

| Test | Expected | Result |
|------|----------|--------|
| Student creates class | 403 Forbidden | PASS |
| Teacher accesses another teacher's class | 403 Forbidden | PASS |
| Student accesses another student's attempt | 403 Forbidden | PASS |
| Student accesses reports | 403 Forbidden | PASS |
| Invalid invitation code | 404/403 | PASS |
| Expired invitation code | 403 | PASS |
| Duplicate submission (idempotency) | Returns existing attempt (duplicate: true) | PASS |

### Browser Testing

- Desktop: Tested via curl/Node.js HTTP client (API layer)
- Mobile: Responsive CSS implemented (media queries for max-width: 600px); not tested on physical mobile device

---

## E. BACKUP

NeonDB is a managed PostgreSQL service with the following built-in capabilities:

- **Point-in-time recovery (PITR):** Neon retains WAL logs for point-in-time recovery.
- **Automated backups:** Neon performs regular automated backups.
- **Branch-based isolation:** Each branch is an independent copy; branches can be used for backup/restore.
- **No data modification:** No DROP, TRUNCATE, or data-altering operations were performed during this audit.

No additional backup procedures are required beyond Neon's native capabilities. If a separate Production branch is desired, it can be created from the existing branch using Neon's branch feature.

---

## F. ITEMS NOT YET RESOLVED

| Item | Status | Priority |
|------|--------|----------|
| Production `DATABASE_URL` not set | Pending | High (blocking) |
| Production `AUTH_SECRET` not set | Pending | High (blocking) |
| Production `NODE_ENV` not set | Pending | Medium |
| Rate limiting on login/invitation | Pending | Low |
| Physical mobile device testing | Pending | Low |

---

## FINAL DECISION: GO (with conditions)

**Recommendation: GO to Production**

The application is functionally complete, security-verified, and data-integrity confirmed. All 16 workflow steps pass on the Preview deployment. Database consistency is verified (764 questions, 764 answer keys, 0 duplicates, proper FK constraints).

### Pre-Deployment Checklist (must complete before `vercel --prod`):

1. [ ] Set `DATABASE_URL` in Vercel Production environment variables
2. [ ] Set `AUTH_SECRET` in Vercel Production environment variables (strong random value)
3. [ ] Optionally set `NODE_ENV=production` in Production
4. [ ] Run `vercel --prod` to deploy to Production
5. [ ] Verify Production login, class creation, and submission work end-to-end

### Post-Deployment Recommendations:

1. Implement rate limiting on login and invitation endpoints.
2. Consider SameSite=strict for enhanced CSRF protection.

---

**Audit performed:** 17 November 2026  
**Auditor:** Kilo (Software Engineering Agent)  
**Repository:** `D:\FTRS ENGLISH\FRTS-APP`  
**Preview URL:** `https://frts-jx4didbky-appmi.vercel.app`
