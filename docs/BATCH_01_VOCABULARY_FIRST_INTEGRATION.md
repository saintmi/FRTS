# FRTS — Batch 1 Vocabulary-First v0.6 Integration Guide

## Canonical source

Local project directory: `D:\\FTRS ENGLISH\\FRTS-APP`

GitHub repository: `saintmi/FRTS`

Batch 1 vocabulary-first HTML package: `FRTS_Batch_01_Vocabulary_First_v0.6.zip`

Canonical question bank package for scoring: `FRTS_Batch_01_Question_Bank_Package_v0.4.zip`

Bank identity: `FRTS-B1-W1-4`

## Import sequence

1. Extract the Vocabulary-First v0.6 ZIP on the admin workstation.
2. In the Admin dashboard, open **Bank Konten HTML**.
3. Select exactly 8 HTML files from `sessions/week-01` through `sessions/week-04`.
4. Import the eight sessions. The server stamps the bank identity and sets each HTML module to `REVIEW_REQUIRED`.
5. Review the text, stimulus/question relationships, vocabulary cards, recall prompts, and the accepted synonyms.
6. Admin approves modules individually. Approval and publication are separate actions.
7. Before a teacher can assign a canonical module, the API checks that the exact source bank/session exists in Neon and that all expected question answer keys are available.

## Vocabulary answer policy

Vocabulary recall is formative and separate from Reading Comprehension scoring. The student HTML includes first-letter and length hints, Indonesian/English directions, and accepted equivalents. A response not included in the accepted-answer list must not be silently marked wrong; it should be flagged for review.

## Official reading scoring dependency

The student HTML does not contain reading answer keys. Official reading scoring is only enabled when the matching bank ID, session ID, question IDs, and complete server-side answer-key coverage are present in Neon. If the check fails, the API returns a reviewable/unverified status rather than assigning an artificial zero.

## Required local database tasks

Apply migrations in order:
- `003_html_module_source_session.sql`
- `004_html_module_source_bank.sql`

Import the v0.4 Batch 1 question-bank package using the local-only procedure in `content/imports/README.md`. Do not upload teacher payloads or ZIP source archives to the public repository.

## Security boundary

- Student HTML and student APIs must never expose teacher answer payloads.
- Teacher-only packages remain in the ignored local `content/imports/` directory.
- The Admin dashboard HTML import creates review-required content only.
- Production deployment and Neon migrations require a separate approved deployment step.
