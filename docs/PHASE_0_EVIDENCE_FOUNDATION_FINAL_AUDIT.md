# FRTS Phase 0 — Evidence Foundation Final Audit & Backtest Report

- **Audit date:** 19 November 2026
- **Repository:** `saintmi/FRTS`
- **Branch:** `main`
- **Audited baseline commit:** `90c7cff40f43beb84a2e8a68d1ca920bed47bdaf`
- **Master design:** `docs/FRTS_MASTER_DESIGN_v1.1.md`
- **Phase status:** `IMPLEMENTATION_AUDIT_COMPLETE — ACCEPTANCE_BLOCKED`
- **Data seed:** Batch 1 Vocabulary-First, candidate v0.6.1; bank identity declared as `FRTS-B1-W1-4`

## 1. Executive decision

Phase 0 has been audited against the repository, its migrations, API workflow, CI configuration, Batch 1 integration contract, and the supplied Batch 1 synchronization/backtest report.

**Phase 0 is not accepted as complete.** The available evidence is sufficient to define safe initial content handling and identify concrete integrity risks, but not to certify the full evidence foundation. In particular, an initial project-name search used the wrong name and did not find the database; this was corrected on 19 November 2026. The connected Neon project is **les-tka-regency**. Read-only database inspection has now been performed on its sole/default **production** branch. The canonical v0.4 source archive and complete v0.6.1 candidate package are still unavailable, and no isolated test branch exists in the project. Database inventory is now evidenced, but migration tests, write-path backtests, role-isolation tests, and end-to-end attempt-to-report reconciliation remain unverified.

No production database migration or content import was executed. No official scoring was enabled for unkeyed items. The Batch 1 candidate must remain review-only/formative until the gates in this report are met.

## 2. Scope and evidence inspected

### Repository evidence
- `api/[[...slug]].ts`
- `migrations/001_initial.sql` through `migrations/005_html_module_source_bank_version.sql`
- `scripts/import-questions.js`
- `tests/workflow.test.ts`
- `.github/workflows/ci.yml`
- `content/imports/README.md`
- `docs/BATCH_01_VOCABULARY_FIRST_INTEGRATION.md`
- `docs/FRTS_MASTER_DESIGN_v1.1.md`

### Batch 1 evidence
- `SYNCHRONIZATION_AND_BACKTEST_REPORT.md`, prepared 19 November 2026.
- Student Offline PDF and Teacher Answer Key Audit PDF. These identify Batch 1 Weeks 1–4 as legacy v0.2 with 8 sessions and 96 questions; they do not establish authoritative keys for the additional 104 v0.6 questions.
- `FRTS_Batch_01_Teacher_Key_v0.5.json` was previously surfaced with mixed-key status and is not accepted as complete authoritative scoring data without exact per-question reconciliation.

The candidate ZIP and canonical v0.4 source ZIP were not accessible for direct re-extraction in this audit. The supplied report's package-level results are therefore cited as prior test evidence, not represented as tests rerun in this audit. Neon was subsequently identified as les-tka-regency; see Section 11 for live read-only database evidence.

## 3. Batch 1 data disposition

The supplied synchronization report records the following structural results:

| Check | Reported result | Disposition |
|---|---:|---|
| Sessions | 8 unique | PASS (reported) |
| Questions | 200; 25/session | PASS (reported) |
| Stimuli | 120; 15/session | PASS (reported) |
| Vocabulary cards | 80; 10/session | PASS (reported) |
| NEW / RECYCLED | 4 + 6/session | Structural PASS only |
| Text-derived vocabulary candidates | 24 | Structural PASS; academic review open |
| Duplicate question IDs | 0 | PASS (reported) |
| Question-to-stimulus references | all local | PASS (reported) |
| A/B/C/D option structure | exactly once each | PASS (reported) |
| Student-side key leakage | none detected | PASS (reported) |
| Chromium smoke test | 8/8 modules | PASS (reported; limited scope) |

The report also explicitly records: no complete cross-browser/mobile/offline persistence test; no app/API/Neon synchronization; offline export status remains `UNVERIFIED`.

### Initial content policy
- Load the eight Batch 1 sessions only as **review-required learning content** until their exact source identity and academic approvals are verified.
- Vocabulary recall is formative and must remain separate from official reading-comprehension scoring.
- Unknown vocabulary responses must be recorded for review, not silently treated as incorrect.
- No answer keys, teacher explanations, textual answer evidence, or teacher-only payloads may be sent to student HTML or student-facing APIs.
- Only questions with an approved, exact, server-side answer key may contribute to official scores.
- Never infer a missing answer key from a student option pattern, LLM output, or the legacy v0.2 PDF.

## 4. Repository and workflow findings

### F0-01 — Test coverage does not exercise the evidence lifecycle
**Severity:** BLOCKER

The current `tests/workflow.test.ts` covers ping, unknown route, unauthenticated rejection, and current-session rejection. It does not prove the authenticated lifecycle from assignment → attempt → answer submission → receipt → report/vocabulary aggregation, nor student/teacher/admin row-level scope.

**Resolution required:** Add deterministic integration fixtures and test the complete lifecycle against an isolated test database. Include duplicate/concurrent submissions, ownership boundaries, missing-key handling, formative vocabulary separation, and report denominator/freshness behavior. Do not substitute route-level 401 tests for workflow acceptance.

### F0-02 — Submission state transition has a concurrency window
**Severity:** BLOCKER

The attempt submission handler reads the attempt and checks `status === 'in_progress'` before executing a transaction containing answer inserts, attempt update, and receipt insert. Two concurrent requests with different receipt IDs can both pass the pre-transaction state check. The transaction does not visibly perform a conditional state transition/row lock as part of the same atomic operation.

**Resolution required:** Refactor submission into a single atomic database operation/transaction that locks the attempt row (or conditionally updates only `in_progress` and checks affected rows), validates idempotency, inserts answers/events/receipt, and finalizes status. Add concurrent integration tests proving exactly one submission wins and no duplicate answers or receipts are created. Preserve the current production data; use an additive migration only if constraints/indexes are required.

### F0-03 — Audit failures are swallowed
**Severity:** HIGH

`writeAudit()` catches all database errors and discards them. Important events such as attempt submission and content changes can therefore succeed without a durable audit record.

**Resolution required:** Define which events require durable audit. For security-sensitive and evidence-changing operations, write the audit row in the same transaction as the state change or fail the operation if the audit insert fails. Best-effort logging may remain only for explicitly non-critical telemetry. Add failure-injection tests.

### F0-04 — Source relationships are not fully protected by schema constraints
**Severity:** HIGH

The initial schema uses independent foreign keys for question bank, session, and stimulus. The reviewed schema excerpt does not establish a composite constraint guaranteeing that a question's `session_id` belongs to the same `bank_id`, or that its `stimulus_id` belongs to that same session. The canonical HTML validator checks source IDs and text at application level, but application validation alone is not a substitute for database integrity.

**Resolution required:** First run read-only duplicate/orphan/mismatch queries on the target Neon database. If clean, introduce additive composite unique keys and composite foreign keys (or equivalent validated constraints) so bank/session and question/stimulus ownership cannot diverge. Do not run the migration until the real target project and existing data have been verified.

### F0-05 — Retake policy is not implemented as a configurable contract
**Severity:** HIGH / DECISION REQUIRED

The initial `attempts` schema has `UNIQUE (assignment_id, student_id)`, which permits one attempt per student per assignment. This may be intentional, but it conflicts with unrestricted retakes and can prevent a new attempt after a prior submission.

**Resolution required:** Owner must choose one explicit policy: one attempt only, teacher-authorized retake, or multiple attempts with attempt_number/active-attempt rules. Then encode it in API, schema, reporting denominator, and tests. Do not remove the uniqueness constraint before this decision.

### F0-06 — Canonical HTML approval gate is stricter than draft review, but needs live validation
**Severity:** MEDIUM

The API's canonical module validator checks bank/version/session identity, exact question and stimulus ID sets, question-to-stimulus links, stimulus text, and answer-key coverage. This is a useful safeguard. Its actual behavior against the current Batch 1 package and Neon records remains unverified because neither exact archive nor target database was available.

**Resolution required:** Replay positive and negative fixtures for every mismatch code, including missing keys, duplicate IDs, wrong bank version, wrong session, wrong stimulus text, and wrong question-stimulus link.

### F0-07 — Importer can admit inconsistent or partial source data
**Severity:** BLOCKER before Batch 1 import

Static review of `scripts/import-questions.js` found:
- `findBankJson()` silently selects the last matching JSON file if multiple question-bank JSON files exist.
- The script does not enforce the declared bank ID and bank version against an expected identity before import.
- Dry-run reports counts but does not perform a comprehensive structural/academic validation.
- Import writes occur as a sequence of independent SQL calls; there is no enclosing transaction for the full bank import, so an error can leave a partial bank.
- Existing questions/options/keys are inserted only when absent; changed source content can leave stale database rows without an explicit conflict report.
- Importer package defaults do not list the current Vocabulary-First package; the manual override exists but is not enough to make the source safe by itself.

**Resolution required:** Harden importer before any production import:
1. Require exactly one canonical bank JSON file or an explicit path selector.
2. Assert `bank_id`, bank version, expected session count, expected question count, and source package identity.
3. Validate unique IDs, session ownership, stimulus references, A–D option structure, answer-key coverage, and student/teacher payload separation before opening a DB connection.
4. Produce a dry-run manifest with SHA-256, exact counts, missing-key list, and validation findings.
5. Import in one transaction (or staged import with atomic promotion).
6. Treat existing content conflicts as hard errors; never silently leave stale rows.
7. Default imported content to `REVIEW_REQUIRED`/draft unless explicit approved provenance is present.
8. Add tests for multiple bank JSON files, wrong version, duplicate IDs, missing key, orphan stimulus, transaction rollback, and idempotent re-import.

### F0-08 — Report/role scope requires authenticated database tests
**Severity:** BLOCKER

Static route review shows student and teacher report paths are intended to filter by session identity and teacher-owned classes. However, current tests only prove unauthenticated requests are rejected. No live evidence confirms that a teacher cannot query another teacher's class, a student cannot access another student's attempt/report, or admin access is appropriately bounded and audited.

**Resolution required:** Add seeded cross-tenant fixtures and assert both positive and negative access for every report, attempt, vocabulary, assignment, and class endpoint.

### F0-09 — Evidence and metric definitions are not yet a verified contract
**Severity:** HIGH

The current design requires deterministic metrics, evidence freshness, denominators, and separation of official score from formative vocabulary recall. The repo does not yet provide tested acceptance evidence for the full metric dictionary and edge cases.

**Resolution required:** Publish a metric contract before Phase 1: eligible attempts, submitted/verified status, score/max_score denominator, missing/late/invalid attempts, retake handling, vocabulary response/self-assessment classification, minimum sample size, date window/timezone, and freshness. Test zero denominators, null timestamps, partial submissions, stale evidence, and duplicate events.

## 5. Prior Batch 1 candidate blockers retained

| Blocker | Finding | Safe disposition / resolution |
|---|---|---|
| B1 | Canonical source archive v0.4 absent | Recover exact archive and compare all 200 questions/120 stimuli/80 cards to source; record archive SHA-256. v0.2 PDFs are not substitutes. |
| B2 | 104 of 200 questions lack authoritative keys in supplied evidence | Recover approved teacher-only key or obtain teacher/owner-approved independent keys with evidence/rationale. Until then exclude those items from official score. |
| B3 | 24 text-derived vocabulary candidates remain `REVIEW_REQUIRED` | Teacher reviews contextual meaning, POS, examples, pre-teaching status, accepted variants; persist reviewer and decision. |
| B4 | 48 RECYCLED labels lack prior-session provenance | Add explicit source term ID, first-introduced session, prior exposure/session references, and reuse policy. Reclassify unproven items as NEW/UNVERIFIED rather than assuming retrieval history. |
| B5 | Q13–Q25 repeat templates across eight sessions | Run item-level independent academic review: stimulus dependency, distractor plausibility, cognitive demand, answer-pattern leakage, duplicate/near-duplicate similarity. Rework or retire weak items; don't auto-approve based on template count alone. |
| B6 | Standalone HTML is not app-integrated | Implement authenticated attempt sync and server receipt/scoring, then test retry/offline/conflict/reopen behavior. Until then exports stay `UNVERIFIED`. |
| B7 | Generator depends on external v0.4 ZIP and vocabulary standard | Pin source assets by hash, document exact paths/tool versions, include non-sensitive build scripts/standards, and prove clean-room rebuild. Keep teacher keys and private ZIPs out of public Git. |

## 6. Backtest matrix

| Test layer | Evidence available | Result |
|---|---|---|
| Batch 1 archive/JSON/ID structure | Prior report only | PASS (reported; not rerun here) |
| Batch 1 browser smoke | Prior Chromium 8/8 report | PASS (reported; limited smoke scope) |
| Student key leakage | Prior report | PASS (reported) |
| Canonical v0.4-to-v0.6.1 full source comparison | Source ZIP unavailable | BLOCKED |
| Complete 200-item official answer-key coverage | 96 legacy keys only; 104 unresolved | FAIL / BLOCKED |
| Vocabulary candidate academic review | No signed teacher decisions | BLOCKED |
| Recycled provenance | Missing in payload | FAIL |
| Repeated-template adjudication | Not independently adjudicated | BLOCKED |
| Authenticated app/Neon synchronization | Neon database inventory available; no authenticated app flow replay | NOT TESTED |
| Offline persistence/reopen/IndexedDB failure | Not in prior smoke scope | NOT TESTED |
| API route auth rejection | Current unit test file | COVERED |
| Attempt → receipt → report E2E | No integration fixture/live DB | NOT TESTED |
| Concurrent submission/idempotency | Static race risk found | FAIL / BLOCKED |
| Durable audit failure handling | Best-effort catch found | FAIL |
| DB bank/session/stimulus constraints | Production schema inspected; relational data preflight still incomplete | PARTIAL / BLOCKED |
| Role isolation for real records | No cross-role fixture/live DB | NOT TESTED |
| CI | Existing workflow defines lint/build/test; no current run was triggered by this audit | NOT VERIFIED IN THIS AUDIT |

## 7. Required backtest suite before acceptance

Run on an isolated Neon test branch/database, never on production first:

1. Apply migrations from a clean database and compare schema ledger.
2. Import Batch 1 in dry-run; verify source SHA, bank identity/version, 8 sessions, 200 questions, 120 stimuli, answer-key coverage, and every relation.
3. Run import twice; verify idempotency and unchanged row counts/content hashes.
4. Inject a deliberate bad row/package and prove the import rolls back without partial records.
5. Create student A/student B, teacher A/teacher B, and admin fixtures with separate classes.
6. Complete an assigned attempt as student A; verify answer rows, receipt, official score, and vocabulary formative event.
7. Retry same submission with same idempotency key; verify same receipt/result and no duplicate rows.
8. Submit concurrently with different keys; verify one state transition and no duplicate answer/receipt records.
9. Verify student B cannot read student A's attempt/report; teacher B cannot read teacher A's class; teacher A can read only owned class; admin behavior matches explicit policy.
10. Verify unkeyed questions cannot produce official score and do not become artificial zeroes.
11. Verify report aggregates only eligible verified attempts and keeps vocabulary recall separate.
12. Force audit insert failure; verify security-sensitive mutation does not silently succeed without its required audit event.
13. Test offline export/reopen/IndexedDB unavailable; all unsynced attempts remain clearly `UNVERIFIED`.
14. Run full CI and attach exact commit, workflow run, job logs, test counts, and artifacts.

## 8. Release and data-safety decisions

- Neon project les-tka-regency is connected and identified (project ID super-dew-05104749). The only listed branch is the default production branch; no isolated test branch was present at inspection. Read-only inventory/preflight queries were run there; no writes or migrations were performed.
- No migration, destructive operation, content import, or production data rewrite was performed.
- The private teacher key and canonical ZIP archives must remain outside the public repository.
- The existing `UNIQUE (assignment_id, student_id)` attempt policy is not changed until owner decision.
- Do not publish a Phase 0 completion version merely because this report exists.
- Keep `docs/FRTS_MASTER_DESIGN_v1.1.md` as the current master until all Phase 0 acceptance gates pass. The immutable v1.0 baseline and v1.1 must not be edited.

## 9. Closure checklist

Phase 0 may be marked COMPLETE only after all are true:

- [ ] Canonical Batch 1 v0.4 archive and v0.6.1 candidate recovered, hashed, and reconciled.
- [ ] 200/200 items have an approved answer-key disposition; no unapproved key is used for official scoring.
- [ ] 24 vocabulary candidates reviewed and recorded by an authorized English teacher.
- [ ] Recycled vocabulary provenance is explicit and auditable.
- [ ] Q13–Q25 and duplicate/near-duplicate item groups have independent academic decisions.
- [ ] Importer hardening and unit tests pass.
- [ ] Atomic/idempotent submission and durable audit behavior pass integration/concurrency tests.
- [ ] Bank/session/stimulus integrity is enforced and existing Neon data passes preflight.
- [ ] Student/teacher/admin scope tests pass against isolated database fixtures.
- [ ] Attempt-to-report and vocabulary formative separation E2E pass.
- [ ] Offline/persistence behavior is verified or explicitly deferred from P0 by owner with a safe status contract.
- [x] Correct Neon target is connected and identified; read-only production inventory/preflight completed.
- [ ] Create/use an isolated Neon test branch and run migration/import/write-path tests there.
- [ ] CI run for the accepted commit is green with logs retained.
- [ ] Owner accepts the metric dictionary and retake policy.

## 10. Final conclusion

**Phase 0 audit and evidence-gap identification: COMPLETE.**  
**Phase 0 product acceptance: NOT COMPLETE — BLOCKED BY EXTERNAL SOURCE/ACADEMIC APPROVAL AND LIVE DATABASE/E2E EVIDENCE.**

This is a final audit report of the evidence currently available, not a false declaration that Phase 0 passed. The next safe work is to recover the two Batch 1 source archives, connect the intended Neon test project, harden importer/submission/audit paths, and execute the full isolated backtest suite. Until those are complete, Batch 1 may seed draft/formative learning activity only; it must not be represented as an approved scored production bank.


## 11. Neon project identity and live read-only database evidence (correction)

The earlier statement that no Neon FRTS project was discoverable was caused by searching for the wrong project name. The owner clarified that the Neon project is **Les TKA Regency**. A full project listing then confirmed the exact Neon project:

| Property | Verified value |
|---|---|
| Neon display name | **les-tka-regency** |
| Project ID | **super-dew-05104749** |
| Region | AWS **ap-southeast-1** |
| PostgreSQL major version (project setting) | 18 |
| Runtime PostgreSQL version (SQL query) | PostgreSQL 18.7 |
| Default database | **neondb** |
| Additional database visible | **postgres** |
| Active/default branch | **production** |
| Branch ID | **br-proud-king-aom8fazl** |
| Branch state | **ready** |
| Branch created | 17 November 2026 |
| Project permission reported | ADMIN |
| Neon console | https://console.neon.tech/app/projects/super-dew-05104749/branches/br-proud-king-aom8fazl |

The application tables are in schema **public** in database **neondb**. The branch inventory also shows Neon Auth schemas (**auth**, **neon_auth**) and the FRTS application tables. Only one branch (**production**) was returned by the branch listing at inspection time; no isolated test branch was available. This is why the following SQL checks were read-only and no migration/import or synthetic write test was run against production.

### 11.1 Connection verification

A read-only SQL query returned:
- current_database() = **neondb**
- current_user = **neondb_owner**
- current_schema() = **public**
- version() = **PostgreSQL 18.7 (84da7d8)**

### 11.2 Migration ledger

The live public.schema_migrations table contains seven rows:

| Ledger version | Applied at (UTC) |
|---|---|
| 001_initial | 2026-11-17 10:34:41.932 |
| 001_initial.sql | 2026-11-17 10:34:42.010 |
| 002_question_bank_source | 2026-11-17 10:49:45.622 |
| 002_question_bank_source.sql | 2026-11-17 10:49:45.694 |
| 003_html_module_source_session | 2026-11-18 16:33:22.637 |
| 004_html_module_source_bank | 2026-11-18 16:33:22.637 |
| 005_html_module_source_bank_version | 2026-11-18 16:33:22.637 |

**Ledger observation:** both extensionless and .sql-suffixed identifiers exist for migrations 001 and 002. This may reflect the migration runner's filename normalization/history; it is not automatically proof of duplicate DDL execution. Reconcile the runner's migration key logic and the exact SQL files before changing the ledger. Do not delete ledger rows or replay migrations based on names alone.

### 11.3 Live row-count snapshot

Read-only counts returned from the production branch, database neondb:

| Table | Rows |
|---|---:|
| question_banks | 4 |
| learning_sessions | 38 |
| questions | 764 |
| stimuli | 100 |
| question_options | 3,056 |
| question_answer_keys | 764 |
| attempts | 13 |
| attempt_answers | 5 |
| submission_receipts | 7 |
| audit_logs | 0 |

These are inventory counts only, not evidence that every row is academically approved, relationally consistent, or associated with a completed student workflow. In particular, audit_logs currently has zero rows at this snapshot; determine whether this is expected for the current test activity and verify the API's audit behavior before drawing a production-integrity conclusion.

### 11.4 Actual question-bank inventory

The four rows in public.question_banks are:

| Source bank ID | Package version | Status | Declared questions | Declared sessions | Source package |
|---|---:|---|---:|---:|---|
| FRTS-B1-W1-4 | 0.2 | REVIEW_REQUIRED | 96 | 8 | FRTS_Batch_01_Audit_and_Revised_Artifacts_v0.2(2).zip |
| FRTS-B2-W5-8 | 0.2 | REVIEW_REQUIRED | 96 | 8 | FRTS_Batch_02_Audit_and_Revised_Package_v0.2(2).zip |
| FRTS-B3-W9-12 | 0.3 | REVIEW_REQUIRED | 132 | 8 | FRTS_Week_09-12_Audit_and_Revised_Package_v0.3(2).zip |
| FRTS-W13-19-INTERACTIVE-001 | 0.5 | IMPORTED | 440 | 14 | FRTS_Week_13-19_Audit_and_Revised_Package_v0.5(1).zip |

**Important Batch 1 reconciliation:** the live database currently contains the legacy Batch 1 bank v0.2 with 96 questions and 8 sessions. It does **not** show the declared Batch 1 Vocabulary-First v0.6/v0.6.1 package as an imported bank. The prior candidate report's 200-question structural results must not be confused with the current live Batch 1 database rows. The live question bank's REVIEW_REQUIRED status is consistent with keeping it out of official scoring pending review.

### 11.5 What this live check proves—and does not prove

**Proven by live read-only inspection:**
- The Neon connection is available and targets the project named les-tka-regency.
- The target is PostgreSQL 18.7, database neondb, default branch production.
- The FRTS application schema and core tables exist.
- Seven migration-ledger entries are present.
- Four question banks and their declared metadata are present.
- Current row counts are recorded above.

**Not yet proven:**
- Whether every question/session/stimulus relation is consistent across all rows.
- Whether all 764 answer keys are correct, teacher-approved, or complete in the academic sense.
- Whether attempt submissions are atomic under concurrent requests.
- Whether audit rows are written for all required events.
- Whether role-based access works across separate students/classes/teachers.
- Whether the current Batch 1 v0.6.1 HTML package can synchronize to this database.
- Whether clean migrations and importer rollback/idempotency work on a fresh isolated branch.
- Whether the full attempt → receipt → report flow passes end-to-end.

### 11.6 Next safe database backtests

1. Create or designate a Neon test branch from production; do not run migration experiments or synthetic attempts on the production branch.
2. On that test branch, run read-only duplicate/orphan/mismatch checks for bank/session/stimulus/question/options/answer-key relations.
3. Compare migration ledger identifiers with the repository migration runner's normalization rules.
4. Reconcile the live Batch 1 v0.2 rows against its exact source ZIP.
5. Import Batch 1 v0.6.1 only after recovering the exact candidate and canonical v0.4 source archives, validating them, and ensuring the importer is transactional.
6. Run authenticated role, submission idempotency/concurrency, durable audit, and report aggregation tests using isolated fixtures.
7. Capture the test branch ID, SQL outputs, commit SHA, CI run, and test counts in the P0 acceptance evidence.

No production writes, DDL, migration, content import, or data deletion were executed for this correction. All Neon SQL statements used for this section were read-only SELECT/catalog inspection.


## 12. Isolated Neon test branch created for P0 backtests

Following the owner's explicit instruction that all implementation work be tested separately and integrated into the main branch only after PASS, an isolated Neon branch and a matching GitHub working branch have been created.

### 12.1 Neon branch

| Property | Value |
|---|---|
| Project | les-tka-regency |
| Project ID | super-dew-05104749 |
| Parent branch | production |
| Parent branch ID | br-proud-king-aom8fazl |
| Test branch | p0-evidence-backtest |
| Test branch ID | br-divine-mode-ao6yapik |
| State | ready |
| Parent snapshot LSN | 0/2494C20 |
| Database | neondb |
| Console | https://console.neon.tech/app/projects/super-dew-05104749/branches/br-divine-mode-ao6yapik |

The branch was created from production data. An initial attempt to set a custom suspend timeout was rejected by account policy; the branch was then created successfully without overriding that setting. The test branch is not default and is not production.

### 12.2 GitHub working branch

| Property | Value |
|---|---|
| Repository | saintmi/FRTS |
| Working branch | p0/evidence-backtest |
| Base | main |

Code and migration changes for this work are to be committed to this working branch. After the relevant test suite and CI pass, changes will be integrated into main through a reviewed pull request. A failing or partially tested change will not be merged.

### 12.3 Initial isolated data-integrity backtest

Read-only checks were run against the new Neon test branch, database neondb. The following checks returned zero failures:

| Check | Failures | Result |
|---|---:|---|
| Learning sessions referencing missing banks | 0 | PASS |
| Questions whose bank differs from their session bank | 0 | PASS |
| Questions referencing missing sessions | 0 | PASS |
| Questions whose stimulus belongs to another session | 0 | PASS |
| Questions referencing missing stimuli | 0 | PASS |
| Questions missing an answer-key row | 0 | PASS |
| Questions without exactly four options | 0 | PASS |
| Questions without exactly one each of A/B/C/D | 0 | PASS |

These are data-state checks, not yet schema-enforced guarantees. The existing schema still has independent foreign keys for question bank, session, and stimulus. Additional constraints and their migration require implementation and validation on this test branch.

### 12.4 Backtest boundary

No INSERT, UPDATE, DELETE, DDL, migration, or content import was performed in this initial run. Production remains untouched. This initial PASS covers only the listed relational data checks on the cloned test snapshot; it does not close the submission concurrency, audit durability, authenticated role-isolation, importer transactionality, academic key approval, or complete Batch 1 acceptance blockers.

The required integration rule is now explicit: do not merge code or migration changes into main until targeted tests, regression tests, and CI are PASS. Once merged, apply any approved database migration to production only through the separately verified release step, not as a side effect of merging code.


## 13. Iterative backtest — 19 November 2026 (Neon test branch)

**Environment:** Neon project `les-tka-regency`, branch `p0-evidence-backtest` (`br-divine-mode-ao6yapik`), database `neondb`, PostgreSQL 18.7. All SQL in this section was read-only. Production branch and GitHub `main` were not modified by these checks.

### Migration runner reconciliation
Inspected `scripts/migrate.js` and migrations 001–005. The runner sorts `.sql` files, derives a version by removing the extension, and skips a migration if either the filename (e.g. `001_initial.sql`) or derived version (e.g. `001_initial`) exists in `schema_migrations`. It then inserts the derived version after applying each file. Migrations 001 and 002 also insert their own derived version. The live ledger contains both filename and derived-version rows for 001 and 002; this is consistent with legacy filename-form entries plus the runner/SQL version-form entries, and is not evidence that the DDL ran twice. The runner's dual-form skip logic handles both. Do not delete ledger rows or rerun migrations to “clean up” this history.

**Remaining migration-runner risk:** statements in a migration are executed one by one, outside an explicit transaction. If a later statement fails, earlier statements may already have committed while the migration is not recorded as applied. This is a genuine partial-migration recovery risk. It must be addressed and tested on an isolated database before any new production migration. Existing migrations 001–005 were not rerun.

### Additional read-only database backtest

| Check | Result | Assessment |
|---|---:|---|
| Attempt status inventory | 6 `in_progress`, 7 `submitted` | Observed, no assertion of correctness |
| Attempts with missing assignment | 0 | PASS |
| Attempts with missing student | 0 | PASS |
| Submitted attempts without receipt | 0 | PASS |
| Receipt attached to non-submitted attempt | 0 | PASS |
| Attempt with multiple receipts | 0 | PASS |
| Duplicate `(bank_id, source_question_id)` | 0 | PASS |
| Answers whose question bank differs from assignment HTML bank/version (where source identity exists) | 0 | PASS |
| Batch 1 v0.2 | 8 sessions / 96 questions / 16 stimuli / 96 keyed | Existing legacy data only |
| Batch 2 v0.2 | 8 / 96 / 16 / 96 keyed | Existing data |
| Batch 3 v0.3 | 8 / 132 / 22 / 132 keyed | Existing data |
| Interactive v0.5 | 14 / 440 / 46 / 440 keyed | Existing data |

These checks validate current rows only. They do not prove transaction safety, answer-key academic correctness, role isolation, or the unimported Batch 1 v0.6 candidate.

### Confirmed code-level blockers from targeted inspection

1. **Submission race remains BLOCKER.** In `api/[[...slug]].ts` around the attempt submission handler (approximately lines 683–735), the handler reads the attempt and checks `status === 'in_progress'` before building a transaction. The transaction later inserts answer rows, updates the attempt to `submitted`, and inserts a receipt, but the update is not conditional on the prior state and does not visibly lock the attempt row as part of the transaction. Concurrent requests with distinct receipt IDs can both pass the pre-check. A read-only data scan showing no duplicate receipts in existing data does not disprove this race.
2. **Audit durability remains HIGH.** `writeAudit()` catches and suppresses every insert failure. Attempt submission calls it after the submission transaction, so a committed submission can lack its audit record. Critical audit writes should be in the same transaction as the business state change or the business operation must fail when the required audit cannot be persisted.
3. **Importer atomicity remains BLOCKER before any import.** `scripts/import-questions.js` issues many independent SQL calls and has no package-wide transaction. It can leave partial data if a later insert fails. It also selects the last matching bank JSON instead of requiring exactly one, and silently leaves existing options/keys unchanged when the source differs. Do not run this importer against production or treat dry-run counts as full validation.
4. **Migration atomicity remains HIGH before new migrations.** `scripts/migrate.js` executes statements individually and exits on first error; it does not wrap a migration plus ledger insert in one transaction. A migration can therefore be partially applied without a ledger entry.

### Backtest disposition
- **Current data preflight:** 8/8 earlier integrity checks plus the additional checks above returned zero detected row-level violations.
- **P0 acceptance:** NOT PASS. The code-level blockers above are still open, authenticated role-scope/lifecycle tests have not been run, and the content evidence blockers in Sections 3 and 7 remain.
- **No remediation is claimed in this iteration.** This iteration adds verified diagnostics and confirms where code changes are required. It does not justify a “100% final” declaration.
- **Safety:** no SQL writes, DDL, migrations, imports, or production data changes were executed in this iteration.
- **Next acceptance loop:** implement atomic submission with concurrency/idempotency tests; make critical audit durable; make migration/import execution atomic and source-manifest validated; add authenticated role-isolation and end-to-end lifecycle tests; rerun the complete regression suite and branch CI. Only after every acceptance gate passes should a PR be merged to `main`. Production DB rollout remains a separate controlled step.


## 14. Remediation iteration — migration atomicity

**Code change:** `scripts/migrate.js` now constructs a Neon transaction containing all statements for one migration plus the corresponding `schema_migrations` ledger insert. A statement failure is caught at the transaction boundary and the migration is reported as rolled back; the in-memory applied set is advanced only after the transaction succeeds. This addresses the previously identified partial-migration/ledger divergence risk, subject to runtime verification against the pinned Neon driver.

**CI change:** `.github/workflows/ci.yml` now runs the existing lint/build/test job for pull requests targeting `main`, in addition to pushes to `main` and manual dispatch. This makes branch acceptance evidence available before merge.

**Verification status:** Source-level change committed to `p0/evidence-backtest`. Runtime migration rollback test and CI run have not yet been observed. No migration was executed on Neon in this iteration. Do not treat this remediation as PASS until a disposable test migration proves that a deliberately failing statement rolls back earlier statements and leaves the ledger unchanged, and a successful migration commits both DDL and ledger together.

## 15. Iteration — submission guard, CI, and parallel Neon integrity backtest

**Code revision:** `api/[[...slug]].ts`, commit `56f2ff3d882016fed798e5d33c9c95617f30454b`.

The attempt submission path now begins its write transaction by locking the attempt row (`SELECT ... FOR UPDATE`) and conditionally claiming the `in_progress` state as `submitting`. Answer inserts, optional formative vocabulary event, final transition to `submitted`, receipt, and the `ATTEMPT_SUBMITTED` audit row are then guarded and executed in that transaction. A request that cannot finalize returns a conflict (or the prior receipt response for an idempotent retry). This removes the former post-commit best-effort audit call from the submission path.

**Verification boundary:** this is a source-level concurrency remediation, not yet a runtime PASS. A two-client concurrent API integration test and failure-injection test are still required to prove exactly-one-winner semantics with the deployed Neon driver. The general `writeAudit()` helper remains best-effort for other audited operations; those workflows are not closed by this change.

### Parallel read-only Neon backtest

Environment: `les-tka-regency` / `p0-evidence-backtest` / `neondb`. Ten independent checks were run in parallel. All returned `failures = 0`:

| Check | Failures |
|---|---:|
| Question bank/session ownership mismatch | 0 |
| Question/stimulus session mismatch | 0 |
| Duplicate source question IDs within a bank | 0 |
| Missing answer-key rows | 0 |
| Question option count other than four | 0 |
| A/B/C/D labels not present exactly once | 0 |
| Submitted attempts without receipt | 0 |
| Receipt attached to non-submitted attempt | 0 |
| Attempts with multiple receipts | 0 |
| Attempt answer linked to a different source bank/session than its assignment | 0 |

These checks describe the current cloned data only; they do not establish schema-level prevention or transaction behavior. No production SQL was run.

### CI result

GitHub Actions PR run `44519279563` on head `56f2ff3d882016fed798e5d33c9c95617f30454b` completed successfully: dependency installation, lint, TypeScript/Vite build, and Vitest all passed.

### Remaining acceptance blockers

- Add real concurrent submission and idempotency tests, plus audit failure injection.
- Verify migration transaction rollback and successful ledger commit on a disposable test migration.
- Harden importer: exact-one canonical JSON selection, identity/version assertions, full structural preflight and manifest, conflict detection, and atomic package import; add rollback/idempotency tests.
- Add authenticated role-isolation and full attempt/report lifecycle integration tests.
- Complete Batch 1 canonical source, answer-key, vocabulary, recycled provenance, item-quality, and app synchronization acceptance.

**Disposition:** P0 remains `ACCEPTANCE_BLOCKED`. CI PASS and ten zero-row-failure integrity queries do not constitute 100% product acceptance. No production branch writes, imports, migrations, or merges were performed.


## 16. Owner confirmation — Batch 1 academic materials

On 19 November 2026, the owner confirmed that Batch 1 academic materials had been checked and manually validated, with no requested content changes. This is recorded as **owner manual validation**, not as an independent automated or external academic audit. No Batch 1 questions, answer keys, vocabulary items, HTML learning materials, or academic source files were changed in response to this confirmation.

This confirmation closes the need to repeat the same academic-content review in the current remediation loop unless new evidence or a specific defect is raised. It does **not** close the separate technical acceptance gates: importer atomicity and conflict detection, runtime scoring/submission behavior, durable audit writes, authenticated role isolation, complete learner/teacher/admin lifecycle tests, and verified migration transaction behavior.

The owner-approved academic state must be preserved during technical remediation. All remaining changes in this loop are limited to platform code, database transaction safety on isolated test infrastructure, and technical tests. The production Neon branch remains protected; no production import or migration is authorized by this confirmation.

## 17. CI result — question-bank preflight extraction

The GitHub Actions run `44521441780` on branch `p0/evidence-backtest`, head `df0e7bc5bef0dd71df24f8131648d69d178bedfc`, completed successfully. Dependency installation, lint, TypeScript/Vite build, and Vitest all passed.

The run verifies the newly extracted question-bank source preflight helper and its unit tests at CI level. It does not prove a full ZIP import, package-wide transaction rollback, source-manifest authorization, or runtime compatibility against the Neon database. The importer remains blocked from production use until those tests pass.



## 18. CI result — importer transaction hardening (19 November 2026)

Latest branch run `44528087604` completed successfully for commit `9a07527ad816a4fe1a58b76030dc3fbda96c420d`: dependency installation, lint, TypeScript/Vite build, and Vitest all passed. The test suite covers question-bank source preflight, SQL statement splitting, migration transaction construction/failure propagation, required audit error propagation, package importer transaction callback, importer conflict abort path, and API smoke/unauthenticated route checks.

A test-only fixture-count assertion was corrected after CI exposed that the importer performs 16 SQL operations for the current one-question fixture. The final assertion now checks that the importer actually issues multiple DB operations while remaining inside one transaction callback. This is unit-level evidence, not a real import against Neon.

### Importer status and safety boundary

The package importer has been switched to a single transaction callback for the complete package write. Within that transaction it resolves existing and newly inserted session/stimulus/question IDs, compares existing session metadata, stimulus content, question metadata, options, and answer keys with the source, and aborts on mismatches rather than silently retaining stale rows. This path remains **NOT APPROVED FOR PRODUCTION IMPORT** until a disposable Neon end-to-end run verifies schema compatibility, successful import, second-run idempotency, conflict rollback, and row counts. No package import has been run against either Neon branch in this iteration.

### Migration runtime evidence boundary

On disposable child branch `br-billowing-moon-ao18x47o`, a successful multi-statement transaction persisted a probe table and two rows. A separate transaction that created a table, inserted one row, then deliberately violated a primary key rolled back; catalog check confirmed that the table did not exist afterwards. This proves Neon/Postgres transactional rollback behavior for the connector transaction operation. It does not yet execute the repository's Node `@neondatabase/serverless` migration runner against a disposable schema, so runtime acceptance of `scripts/migrate.js` remains open.

### Remaining blockers (not closed by this CI pass)

- Real Neon runtime execution of the Node migration runner with failure injection and ledger assertion.
- Real two-client concurrent submission/idempotency test; failure injection on the submission audit row.
- Migrate all critical mutation+audit writes into the same transaction (the generic helper now throws rather than suppresses audit errors, but separate post-commit audit writes can still leave the business mutation committed if audit insertion fails).
- Real disposable Neon importer success/idempotency/conflict rollback tests and package integrity verification. Source manifest/hash allowlist still needs explicit governance before importing a package.
- Authenticated role-isolation and end-to-end student/teacher/admin workflow tests.
- No production migration, package import, merge, or main-branch write has been performed.


## 19. Disposable Neon migration SQL execution — all existing migrations (19 November 2026)

To continue runtime validation without production access, migration SQL files 001–005 were fetched from the test branch, split into individual SQL statements using the repository's SQL statement-splitting approach, and run against the disposable child branch `p0-migration-runtime-test-20261119` (`br-billowing-moon-ao18x47o`). For each migration, all statements and a dedicated ledger probe insert were submitted in one Neon transaction. Result:

| Migration | SQL statements | Transaction result entries | Result |
|---|---:|---:|---|
| 001_initial | 52 | 53 | PASS |
| 002_question_bank_source | 3 | 4 | PASS |
| 003_html_module_source_session | 2 | 3 | PASS |
| 004_html_module_source_bank | 2 | 3 | PASS |
| 005_html_module_source_bank_version | 2 | 3 | PASS |

A read-back query confirmed all five dedicated ledger probe rows were present. A separate injected duplicate-primary-key transaction had already demonstrated full rollback, including rollback of a table created earlier in the same transaction.

**Scope:** This is database-level runtime evidence for the SQL statements against a disposable clone, not proof that the `scripts/migrate.js` Node process, installed `@neondatabase/serverless` version, `sql.query()` array overload, and its exact transaction result ordering were executed end-to-end. Repository unit tests cover the migration builder and error propagation; the real Node migration CLI still requires a runtime integration harness with the actual serverless driver and a disposable connection string. No migration was run against the test branch parent or production.


## 20. Disposable Neon concurrent submit and audit rollback evidence (19 November 2026)

On disposable child branch `br-billowing-moon-ao18x47o`, two independent transaction calls were started concurrently against one isolated attempt fixture. Both transactions first locked the attempt row; the first held the lock briefly, claimed `in_progress → submitting`, finalized `submitted`, and wrote a receipt and `ATTEMPT_SUBMITTED` audit row. The competing transaction then acquired the lock but its conditional claim returned no row, so it did not finalize or create a second receipt/audit event. Read-back: status `submitted`, exactly 1 receipt, exactly 1 submit audit event. This is direct DB concurrency evidence for the row-lock/conditional-claim pattern.

A separate isolated attempt fixture injected an audit failure by inserting an `audit_logs.actor_id` that violates the users FK after the attempt update and receipt insert had been staged in the same transaction. The transaction failed with SQLSTATE `23503`; read-back confirmed attempt status remained `in_progress`, receipt count `0`, audit count `0`. This proves rollback of the business mutation and receipt when the audit write fails inside the same transaction.

**Scope boundary:** These tests validate the database transaction pattern, not two authenticated HTTP requests through the deployed Vercel/API handler. API-level auth, score calculation, question validation, duplicate response semantics, and network retry behavior still require an HTTP integration test using a disposable `DATABASE_URL`. No production branch was used.

## 21. Critical mutation/audit transaction refactor

The following API mutation paths now execute business writes and audit inserts in one `sqlTransaction` batch: user create/update, class create/update, invite create/deactivate, HTML module upload (including version row), HTML module metadata/status update, publish/unpublish, and assignment create. The generic `writeAudit` helper no longer suppresses audit failures. Submission already writes finalization, receipt, and audit in one transaction. CI run `44532378300` passed on commit `86789a0fee293fe20ec7a098e8684a3e82966aee` after the refactor. The three remaining `writeAudit` calls are for LLM request telemetry and are not core business mutations; their policy still needs explicit review.
