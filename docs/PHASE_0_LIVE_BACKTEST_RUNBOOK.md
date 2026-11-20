# FRTS Phase 0 — Live Backtest Runbook

## Safety boundary

The opt-in live suite is permitted only against the disposable Neon database named exactly `frts_phase0_migration_test`. Never set these variables against production or the normal application database. The suite refuses to run unless all three gates are present:
- `FRTS_ALLOW_LIVE_BACKTEST=YES`
- `FRTS_BACKTEST_DATABASE=frts_phase0_migration_test`
- `DATABASE_URL` points to a database whose `current_database()` is exactly `frts_phase0_migration_test`.

The test creates/upserts five mock identities, two mock classes, a mock module, one mock question with one answer key, and an assignment. These records are test fixtures, not real learners or production content. They are deliberately retained for repeatable manual inspection.

## Mock accounts

The suite creates:
- `admin@frts.test.invalid` — ADMIN
- `teacher.one@frts.test.invalid` — TEACHER (owns Backtest Class One)
- `teacher.two@frts.test.invalid` — TEACHER (owns Backtest Class Two)
- `student.one@frts.test.invalid` — STUDENT (member of Class One)
- `student.two@frts.test.invalid` — STUDENT (member of Class Two)

Set `FRTS_BACKTEST_PASSWORD` to a private test-only password of at least 12 characters. Do not reuse a production password. The default value is a disposable test-only credential and must not be reused outside this database.

## Run commands

On a checkout of the test branch, after `npm ci`:

```powershell
$env:FRTS_ALLOW_LIVE_BACKTEST = "YES"
$env:FRTS_BACKTEST_DATABASE = "frts_phase0_migration_test"
$env:FRTS_BACKTEST_PASSWORD = "set-a-private-test-only-password"
$env:AUTH_SECRET = "set-a-private-disposable-test-secret"
$env:DATABASE_URL = "the Neon connection string for the disposable test database"
npm run test:integration
```

The suite uses the real API route handlers and real Neon database, and authenticates each mock role through `/api/auth/login`. It tests admin-only user directory access, teacher ownership isolation, student membership isolation, assignment visibility, attempt creation authorization, concurrent submission, and exactly-one receipt/answer/audit outcome.

The default CI suite does not require database credentials; the live suite is skipped unless all explicit opt-in variables are supplied. A skipped live suite is not an acceptance PASS.

## Migration backtest

The fresh disposable database `frts_phase0_migration_test` has been created separately from the pre-existing test branch. Migrations 001–006 were executed in per-migration transactions against this empty database. A deliberate failing transaction verified DDL/DML rollback: the probe table did not exist after rollback. Reapplying migration 006 succeeded and retained exactly six unique indexes without duplicate physical indexes.

The Neon SQL migration test validates migration statements and transaction semantics, but it is not a substitute for executing the Node CLI `scripts/migrate.js` itself. That final runner execution must be completed in an environment with the locked npm dependencies installed and a connection string for this disposable database.

## Import backtest

Batch 1 v0.6.1 package import must be run as a dry-run first. Non-dry-run import requires the exact archive SHA-256 and bank identity/version in the local-only `content/imports/approved-package-manifest.json`. Never commit the ZIP, teacher JSON, answer keys, or approval manifest to the public repository. The 104 proposed keys remain excluded from official scoring regardless of package import approval.


## Execute the Node migration CLI against an empty database

A second empty database, `frts_phase0_cli_test`, has been created on the same disposable Neon branch specifically for the actual CLI path. It is separate from the manually SQL-validated `frts_phase0_migration_test` database used by the authenticated API suite.

On the admin workstation, set `DATABASE_URL` to the Neon connection string for `frts_phase0_cli_test` and run:

```powershell
npm ci
npm run migrate
```

Expected result: APPLY 001 through 006, each reported atomic, followed by the six ordered migration versions. Then verify the ledger and expected unique indexes through Neon SQL. Do not point this command at the production database.

## Execute the exact Batch 1 importer dry-run

Place the already validated `FRTS_Batch_01_Bank_Soal_v0.6.1_CLAUDE_AUDIT_CANDIDATE.zip` in the ignored local `content/imports/` directory. The importer dry-run no longer loads the Neon driver or requires `DATABASE_URL`.

```powershell
npm run import -- --package FRTS_Batch_01_Bank_Soal_v0.6.1_CLAUDE_AUDIT_CANDIDATE.zip --dry-run
```

Expected counts: 8 sessions, 200 questions, 120 stimuli, 96 official source keys, 104 proposed keys excluded from official scoring. A dry-run is not an import and does not authorize the import manifest.
