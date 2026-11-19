# FRTS Product Master Specification

- **Status:** Authoritative product baseline
- **Version:** 1.0
- **Last updated:** 19 November 2026
- **Repository:** `saintmi/FRTS`
- **Branch policy:** Work directly on `main`; do not create feature branches unless the owner changes this policy.
- **Related specifications:** [Learning Intelligence](./LEARNING_INTELLIGENCE_SPEC.md), [Front CS & Integrated Tutoring](./FRONT_CS_INTEGRATED_TUTORING_ROADMAP.md)

> This is the highest-level product authority for FRTS. It defines what the product is intended to do. It does not claim that every requirement below is already implemented.

## 1. Product vision

FRTS is an English learning platform that connects structured learning content, classroom delivery, student practice, server-verified assessment, progress evidence, teacher intervention, and (in later phases) assisted customer service and integrated tutoring.

The product must create value through its own structured learning data and instructional workflow. It must not compete primarily by duplicating generic chat interfaces already available elsewhere.

## 2. Product goals

1. Deliver approved English learning modules and assignments reliably to enrolled students.
2. Preserve traceability from a learning activity to its source bank, version, session, stimuli, questions, and answer keys.
3. Record student attempts and answers with secure server-side scoring and idempotent submission.
4. Give teachers actionable, evidence-based insight into individual and class learning needs.
5. Help teachers select remediation, reinforcement, and enrichment actions without surrendering professional judgment to an LLM.
6. Give administrators tools to manage users, classes, content quality, platform operations, and usage.
7. Build a path toward a unified tutoring service and customer-service assistant without coupling it to academic scoring.

## 3. Non-goals and explicit boundaries

- FRTS is not a generic chatbot wrapper.
- LLM must not be called for every answer, click, or routine score calculation.
- LLM must not be the source of truth for score, correctness, mastery, attendance, or completion.
- LLM must not silently change official answer keys, assessment content, learner records, class membership, or publication status.
- LLM-generated recommendations are advisory and require teacher review before instructional action where appropriate.
- Front CS must not access private student learning records unless a separately authorized, consented workflow explicitly permits it.
- No production database reset, destructive migration, or bulk data rewrite is implied by this product specification.

## 4. Primary roles and responsibilities

### Student
- Access only their enrolled classes and published/assigned learning materials.
- Complete learning activities and submit responses.
- Review their own progress and formative vocabulary feedback when available.
- Cannot access other students' data, teacher answer keys, administrative controls, or teacher-only reports.

### Teacher
- Create and manage classes they own.
- Invite students and assign approved materials.
- Review attempts, class progress, vocabulary recall, and evidence-backed learning analysis.
- Decide and record instructional follow-up; AI recommendations remain suggestions.

### Administrator
- Manage platform users, classes, content review/publication, imports, operational reporting, and policy configuration.
- Review platform-level usage and audit records.
- Access academic data only for legitimate platform administration and authorized purposes.

### Future Front CS operator / service assistant
- Handle public program and enrollment questions, lead qualification, service routing, and handoff.
- Must not inherit teacher/admin permissions merely because it uses an LLM.

## 5. Core product domains

1. **Identity and access:** accounts, sessions, roles, ownership, membership, authorization.
2. **Classroom operations:** classes, invitations, membership, assignments, schedules.
3. **Learning content:** question banks, sessions, stimuli, questions, answer keys, HTML modules, review, approval, versioning.
4. **Learning execution:** attempts, answers, formative events, submission receipts, scoring.
5. **Learning intelligence:** evidence aggregation, progress indicators, learning gaps, teacher review, intervention tracking, summaries.
6. **Administration and governance:** user/content management, audit logs, imports, operational reporting.
7. **AI services:** provider-neutral orchestration, narrowly scoped analysis jobs, prompt/version governance, cost and privacy controls.
8. **Future service operations:** Front CS, enrollment support, tutoring intake, scheduling and handoff.

## 6. Canonical learning workflow

1. Admin imports or creates content with source identity and version.
2. Content remains in a review-required or draft state until reviewed.
3. Admin validates question identity, stimulus relationships, answer-key coverage, and content quality.
4. Admin approves and publishes eligible modules; approval and publication remain separate decisions.
5. Teacher assigns an approved module to a class.
6. Student opens the assigned module and completes it.
7. Student submits answers; server validates question identity and scores against private answer keys.
8. Formative vocabulary evidence is stored separately from official reading/assessment score.
9. Reporting aggregates verified attempts and formative evidence.
10. Learning Intelligence derives indicators and, when justified, creates a bounded LLM analysis.
11. Teacher reviews findings and chooses follow-up actions.
12. Later attempts provide evidence to evaluate whether the intervention helped.

## 7. Product principles

- **Evidence before interpretation:** derived metrics must be reproducible from stored records.
- **Deterministic core:** scoring, access control, eligibility, progress calculations, and workflow state transitions are application/database responsibilities.
- **LLM as interpreter, not authority:** the model explains evidence and drafts recommendations; it does not invent or certify facts.
- **Traceability:** every displayed insight links to its evidence window, data timestamp, cohort/class scope, and analysis version.
- **Privacy by default:** send only the minimum necessary, preferably aggregated or pseudonymized evidence.
- **Teacher agency:** show uncertainty, allow dismiss/edit/accept, and record teacher decisions separately from model output.
- **Cost-aware execution:** batch, cache, deduplicate, cap, and schedule analyses.
- **Accessible UX:** responsive, readable, keyboard-operable, clear loading/error/empty states.
- **Incremental delivery:** preserve existing workflows and Neon data; prefer additive migrations and contract tests.
- **No false completion claims:** planned, coded, built, deployed, and accepted are distinct statuses.

## 8. Learning Intelligence product definition

Learning Intelligence is the primary AI investment in the current roadmap. It transforms verified learning evidence into understandable teacher-facing insights.

### Required capabilities
- Student progress timeline.
- Assignment/session performance overview.
- Skill- and question-tag-level performance when reliable tags exist.
- Vocabulary recall and retention trend, explicitly separated from official reading score.
- Class-level patterns and students needing teacher attention.
- Evidence-linked explanations and bounded recommendations.
- Teacher review, feedback, and intervention tracking.
- Analysis history with freshness and provenance.
- Usage/cost metadata and configurable limits.

### Prohibited behavior
- Model-generated grade or answer correctness replacing server scoring.
- Claims of mastery without a defined evidence threshold.
- Inference from missing data as if it were failure.
- Ranking students in ways unsupported by pedagogical policy.
- Sending answer keys or unnecessary identifiable student data to the model.

Detailed contract: [Learning Intelligence Specification](./LEARNING_INTELLIGENCE_SPEC.md).

## 9. LLM strategy and provider architecture

- Provider selection is server-side and provider-agnostic.
- Existing OpenAI-compatible gateway adapter is an integration detail, not a product dependency.
- Feature orchestration must expose explicit capabilities, schemas, prompt versions, output validation, and timeouts.
- LLM invocation is limited to approved use cases such as evidence interpretation and future Front CS.
- Deterministic calculations happen before the LLM call.
- Persist model/provider, prompt version, input/output token usage when supplied, latency, status, and cost estimate; do not persist unnecessary raw prompt content.
- Require feature-level quotas, per-role access, budget ceilings, and kill switches before general availability.
- No student-facing free chat is a current priority.

## 10. Front CS and integrated tutoring boundary

Front CS is a future service channel, distinct from academic Learning Intelligence. It may answer public questions, explain programs, guide enrollment, collect consented intake information, and route users to human staff. Integrated tutoring is a later product phase that may use placement and learner records only after explicit authorization and suitable safeguards.

See [Front CS & Integrated Tutoring Roadmap](./FRONT_CS_INTEGRATED_TUTORING_ROADMAP.md).

## 11. Current technical baseline (repository evidence, not a guarantee of production health)

- Frontend: React 18, TypeScript, Vite.
- API: Vercel serverless API with a large catch-all dispatcher in `api/[[...slug]].ts`.
- Database: Neon PostgreSQL through server-side `@neondatabase/serverless`.
- Authentication: JWT session cookie, httpOnly, role-based server-side checks.
- Content: HTML modules with checksums/version records; canonical bank/session/question identity fields are present through migrations.
- Assessment: attempts, attempt_answers, attempt_events, submission_receipts; scoring is performed server-side.
- Reports: `/api/reports` and `/api/vocabulary-progress` are present in the API dispatcher.
- LLM: authenticated `/api/llm/chat` generic chat route and role-aware UI were added. This implementation is a technical starting point, not the target product experience.

The precise current state must be checked in code and CI and recorded in [Implementation Status](./IMPLEMENTATION_STATUS.md). Historical reports may refer to earlier schema counts, deployments, or test runs.

## 12. Roadmap priorities

### P0 — Product foundation and evidence reliability
- Establish documentation hierarchy and keep implementation status current.
- Verify assignment → attempt → scoring → reporting data integrity.
- Confirm access isolation for student, teacher, and admin.
- Verify vocabulary formative evidence and canonical source traceability.
- Resolve CI/build/test blockers before adding broad functionality.

### P1 — Learning Intelligence foundation
- Define deterministic metrics and evidence contracts.
- Build teacher-facing student and class analysis screens.
- Add analysis snapshots/history and teacher review workflow.
- Add a bounded LLM analysis service with strict structured output validation.
- Add usage ledger, quotas, caching, and operational controls.
- Validate insights against known fixtures and teacher review.

### P2 — Instructional intervention loop
- Record teacher-selected interventions and follow-up.
- Compare pre/post evidence without asserting causation.
- Add targeted remediation/enrichment workflows.
- Add parent-readable progress reports with explicit teacher approval and privacy policy.

### P3 — Front CS
- Public FAQ/knowledge base and service information.
- Lead intake, consent, contact preference, human handoff, and admin console.
- Analytics for unresolved questions and service quality.
- No access to student academic records by default.

### P4 — Integrated tutoring
- Authorized learner context, placement, tutoring plan, scheduling, and human escalation.
- Clear separation between automated practice, teacher-led tutoring, and service support.
- Pilot and evaluate before wider rollout.

## 13. Definition of done for every feature

A feature is complete only when all relevant items are documented and verified:
1. User problem, intended roles, permissions, and exclusions.
2. User journeys, UI states, validation, empty/loading/error states.
3. Business rules and edge cases.
4. API request/response contract and authorization.
5. Database schema/migration and rollback/compatibility considerations.
6. Privacy, retention, audit, and security impact.
7. LLM use (if any), prompt/schema version, token/cost guardrails, fallback behavior.
8. Unit, integration, negative authorization, and end-to-end tests.
9. CI/build/lint evidence and deployment environment evidence.
10. Implementation status, changed files, commit SHA, and known gaps.

## 14. Decision log

| Date | Decision | Rationale |
|---|---|---|
| 2026-11-19 | Learning Intelligence replaces generic student chatbot as the primary LLM priority. | More differentiated value; avoids unnecessary repeated token cost. |
| 2026-11-19 | Front CS is a separate future service module, with integrated tutoring later. | Separates public service workflows from protected academic data and teacher workflows. |
| 2026-11-19 | Provider-agnostic LLM architecture remains. | Avoid vendor lock-in and keep provider credentials server-side. |
| 2026-11-19 | Product Master Specification is the top-level product authority. | Existing documents are implementation/audit/feature-specific and do not provide a unified product definition. |

## 15. Open decisions requiring evidence or product owner approval

- Exact mastery thresholds and minimum evidence counts.
- Which question/skill tags are sufficiently complete for skill-level analytics.
- Student/parent visibility and consent/retention policy for AI-assisted reports.
- Analysis refresh cadence and maximum spend per class/student/month.
- Whether Front CS will support WhatsApp, web chat, or both.
- Human support operating hours, service-level expectations, and escalation ownership.
- Tutoring enrollment, payment, scheduling, and placement policies.

Do not silently invent these policies during implementation. Propose measurable defaults and record approval before enforcement.
