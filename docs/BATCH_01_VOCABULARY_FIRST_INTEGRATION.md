# FRTS — Batch 1 Vocabulary-First v0.6.1 Integration Guide

## Canonical source and identity

Repository: `saintmi/FRTS`

Student learning package: `FRTS_Batch_01_Vocabulary_First_v0.6.1_EXTERNAL_AUDIT_CANDIDATE.zip`

Question-bank package: `FRTS_Batch_01_Bank_Soal_v0.6.1_CLAUDE_AUDIT_CANDIDATE.zip`

Bank identity: `FRTS-B1-W1-4`  
Bank version: `0.6.1`

The question-bank ZIP contains separate source files:
- `data/FRTS_Batch_01_Student_Bank_v0.6.1.json`
- `teacher/FRTS_Batch_01_Teacher_Key_v0.6.1.json`

The student package and teacher-key package are not interchangeable. Do not combine them into student-facing payloads. Keep teacher ZIPs and key JSON files outside the public Git repository.

## Import behavior and key policy

The v0.6.1 adapter validates both source files as one bank and requires:
- 8 sessions, 200 unique questions, 120 unique stimuli;
- unique question/session/stimulus IDs and same-session stimulus references;
- exactly one A/B/C/D option per question;
- exactly 96 `OFFICIAL_SOURCE_KEY_PRESERVED` records and 104 `PROPOSED_NEW_KEY_TEACHER_APPROVAL_REQUIRED` records;
- complete, disjoint key coverage of all 200 question IDs;
- matching session/stimulus identity and a valid option for every teacher key.

The adapter imports only the 96 source-verified keys into the official answer-key table. The 104 proposed keys are excluded from official scoring. Their question IDs, count, status, and review-only disposition are retained in the private content-import report. All imported questions remain `DRAFT`; the bank remains `REVIEW_REQUIRED`.

The adapter does not grant academic approval, publish content, or turn proposed keys into official keys. Any later approval of proposed keys requires a separate authorized review process and explicit implementation.

## Safe dry-run

Copy the exact ZIP into the ignored local `content/imports/` directory on the admin workstation. Do not commit the ZIP, teacher key, extracted teacher files, or approval manifest.

Run:

```bash
node scripts/import-questions.js --package FRTS_Batch_01_Bank_Soal_v0.6.1_CLAUDE_AUDIT_CANDIDATE.zip --dry-run
```

The dry-run performs source validation and reports archive SHA-256, bank identity/version, counts, and key disposition without opening a database write transaction.

A non-dry-run import additionally requires `content/imports/approved-package-manifest.json` with an explicit exact-file SHA-256, bank identity/version, `approval_status: "APPROVED"`, `approved_by`, and `approved_at`. Do not create this approval entry automatically. The archive's candidate status and the user's manual validation of learning content are not, by themselves, a technical import authorization or approval of all proposed answer keys.

## HTML/module review sequence

1. Extract the student learning ZIP on the admin workstation.
2. Select the eight HTML sessions from Weeks 1–4 in **Bank Konten HTML**.
3. Import the HTML modules as `REVIEW_REQUIRED`.
4. Review module identity, question IDs, stimulus IDs, question-to-stimulus links, stimulus text, vocabulary cards, and formative recall configuration.
5. Admin preview and approval are separate from publication.
6. Before a teacher can assign a canonical module, the API must verify exact bank ID/version/session and the expected source question/stimulus relationships. Official scoring additionally requires an approved server-side answer key.

## Vocabulary answer policy

Vocabulary recall is formative and separate from Reading Comprehension scoring. Accepted equivalents and unknown-answer review behavior must not silently convert an unknown response into an incorrect official reading score.

## Official reading scoring dependency

Only questions with an approved, exact, server-side answer key may contribute to official Reading Comprehension scores. The 104 proposed v0.6.1 keys remain excluded. If a key or source relationship is missing or mismatched, the API must return a reviewable/unverified state rather than assign an artificial zero.

## Database and deployment boundary

- Apply migrations only in order and only on a disposable test branch during backtesting.
- Never run import, migration, or destructive schema operations against production as part of this integration guide.
- The exact Node migration CLI and authenticated HTTP lifecycle still require isolated runtime acceptance before Phase 0 closure.
- Production deployment and Neon migrations require a separate approved release procedure.

## Security boundary

- Student HTML and student APIs must never expose teacher answer payloads, rationales, or evidence quotes.
- Teacher-only packages remain in ignored local `content/imports/`.
- Admin HTML import creates review-required content only.
- Database import is atomic; conflicts are hard errors, not silent source overwrites.
- No production migration, content import, or data rewrite is authorized by this guide.
