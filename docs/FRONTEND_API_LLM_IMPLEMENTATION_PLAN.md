# FRTS Frontend, API, and AI Implementation Plan

> **Supersedes the earlier generic-chatbot-first direction.** This file is a technical execution plan subordinate to [FRTS Product Master Specification](./FRTS_PRODUCT_MASTER_SPEC.md). Product requirements and AI priorities are governed by that master document and [Learning Intelligence Specification](./LEARNING_INTELLIGENCE_SPEC.md).

## Decisions
- Repository: `saintmi/FRTS`; work on `main` only under the current repository policy.
- Preserve Neon data and existing class, assignment, content, and scoring workflows.
- LLM provider remains agnostic; provider credentials and routing stay server-side.
- Primary current AI investment: **Learning Intelligence**, not general-purpose student chat.
- Future Front CS is a separate service domain; see [Front CS roadmap](./FRONT_CS_INTEGRATED_TUTORING_ROADMAP.md).
- No production migration or enablement without reviewed migration, backup/rollback plan, and acceptance evidence.

## Product acceptance journeys
1. Teacher creates a class, invites students, assigns approved learning content, and sees class membership.
2. Student joins a class, sees only enrolled classes and published assignments, completes an activity, and submits answers.
3. Server verifies source identity/key coverage and scores official answers; formative vocabulary evidence remains separate.
4. Teacher reviews deterministic student/class metrics with evidence provenance.
5. Teacher requests or reuses a cached Learning Intelligence analysis; AI observations cite evidence and remain advisory.
6. Teacher accepts, edits, or dismisses suggestions and records instructional interventions.
7. Admin reviews content, manages platform users and classes, and monitors AI usage/cost controls.
8. Future Front CS answers from approved service knowledge and routes requests to a human without academic-data access by default.

## AI capability policy
### Current
- Deterministic metrics and progress calculations in application/database code.
- LLM only for bounded explanation, pattern summaries, and teacher-facing action suggestions based on server-built evidence.
- Cache by evidence fingerprint and analysis/prompt version.
- Log provider/model, prompt version, role, latency, usage, status, and cost estimate; avoid raw student text in routine logs.
- Strict structured output validation; unsupported evidence references are rejected.
- Teacher review required for instructional recommendations and parent-facing drafts.

### Not current priority
- General-purpose student chat, free-form tutor, per-answer AI calls, and unbounded multi-turn history.
- Automatic scoring, mastery decisions, answer-key generation/publishing without review, or autonomous changes to student records.

### Future
- Front CS: retrieval-grounded FAQ, lead intake with consent, handoff and queue management.
- Integrated tutoring: authorized learner context, tutor workflows, placement and scheduling only after policy approval.

## Implementation sequence
1. Verify current CI/build/test state and reconcile stale documentation with code.
2. Audit `/api/reports`, `/api/vocabulary-progress`, attempt events, tags, and source identity; write metric dictionary and fixture coverage.
3. Define additive schema/API contracts for Learning Intelligence; review privacy, indexes, retention, quotas, and rollback.
4. Implement deterministic student/class analytics and strict role/scope authorization.
5. Build teacher analytics UX with evidence drill-down, sample sizes, freshness, and unavailable/partial states.
6. Implement analysis persistence, evidence fingerprints, caching, deduplication, usage ledger, quotas, and kill switch.
7. Add provider-neutral structured LLM analysis adapter and output validation.
8. Add teacher recommendation review and intervention tracking.
9. Run unit, integration, negative authorization, privacy, cost, and browser E2E acceptance.
10. Only after Learning Intelligence pilot acceptance, plan Front CS foundation and human handoff; integrated tutoring follows separately.

## Technical principles
- The current API dispatcher is a large catch-all. Extract route handlers incrementally only when it improves maintainability and testability; do not rewrite the API wholesale.
- Every endpoint must enforce role and ownership in the server, not only in the UI.
- Every new schema change must be additive where feasible and accompanied by migration, test, and rollback notes.
- Preserve content provenance and private answer-key boundaries.
- LLM outage or quota exhaustion must not break deterministic learning dashboards or assessment submission.
- Never send secrets, answer keys, or unnecessary identifiable learner information to an external model.

## Provider configuration (legacy generic route)
The existing `/api/llm/chat` and related environment configuration are retained as technical integration history. They are not the primary product workflow. Keep them disabled/restricted or remove student-facing entry points when the product implementation is migrated, without breaking existing authenticated APIs until a controlled deprecation is approved.

Environment variable names documented in [LLM Provider Configuration](./LLM_PROVIDER_CONFIGURATION.md) remain server-only. Do not commit real credentials. Verify actual provider/model availability and Preview secrets before any live model acceptance test.

## Required documentation updates per implementation
Every PR/commit that implements a feature must update:
- Feature specification and API contract.
- Data model/migration and rollback notes if schema changes.
- Security/privacy and role matrix.
- Tests and actual results.
- `docs/IMPLEMENTATION_STATUS.md` with changed paths, commit SHA, CI run, test evidence, known gaps, and deployment state.

## Release gate
No feature is called complete based on code presence alone. Required evidence: lint, TypeScript/build, unit/integration tests, negative authorization tests, browser E2E, Preview smoke tests, and a production rollout decision. Record failures and pre-existing failures separately; do not relabel them as passes.
