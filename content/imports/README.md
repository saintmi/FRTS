# Private content imports

This directory is reserved for local-only source archives used by the question-bank importer.

**Do not commit ZIP files, teacher answer payloads, answer keys, or answer guides from this directory.** The repository is public. Git ignores all files under this directory except this README.

For the revised Batch 1 bank:
1. Place `FRTS_Batch_01_Question_Bank_Package_v0.4.zip` in this directory on the canonical local checkout.
2. Run a dry run first:
   `npm run import -- --package FRTS_Batch_01_Question_Bank_Package_v0.4.zip --version 0.4 --dry-run`
3. Check the report: it must show 8 sessions and 200 questions.
4. Confirm the extracted JSON identifies `bank_id = FRTS-B1-W1-4` and `bank_version = 0.4`.
5. Confirm that the local `.env` points to the intended Neon branch/database before importing.
6. Only after confirming the target database, run the same command without `--dry-run`.

The ZIP contains teacher-only answer data. Keep it local and never upload it to GitHub, Vercel static assets, or the student HTML payload.
