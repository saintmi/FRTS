# FRTS Master Product & System Design

- **Status:** Current authoritative consolidated master document
- **Version:** 1.1
- **Last updated:** 19 November 2026
- **Repository:** `saintmi/FRTS`
- **Branch policy:** Work directly on `main`; do not create feature branches unless the owner changes this policy.
- **Immutable baseline:** [FRTS Product Master Specification v1.0](./FRTS_PRODUCT_MASTER_SPEC.md) (historical; do not edit)

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

Detailed requirements are consolidated in Section 16 of this document.

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

Detailed phased requirements are consolidated in Section 17 of this document.

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
| 2026-11-19 | Versioned FRTS Master Product & System Design is the sole evolving product/design authority. | Existing documents are implementation/audit/feature-specific and do not provide a unified product definition. |

## 15. Open decisions requiring evidence or product owner approval

- Exact mastery thresholds and minimum evidence counts.
- Which question/skill tags are sufficiently complete for skill-level analytics.
- Student/parent visibility and consent/retention policy for AI-assisted reports.
- Analysis refresh cadence and maximum spend per class/student/month.
- Whether Front CS will support WhatsApp, web chat, or both.
- Human support operating hours, service-level expectations, and escalation ownership.
- Tutoring enrollment, payment, scheduling, and placement policies.

Do not silently invent these policies during implementation. Propose measurable defaults and record approval before enforcement.


---

# 16. Learning Intelligence — Functional & Technical Design

#### 16.1 Purpose

Convert verified learner activity into evidence-backed insights that help teachers decide what to teach next. This is not an open-ended student chatbot.

#### 2. Users and permissions

| Capability | Student | Teacher (own class only) | Admin |
|---|---:|---:|---:|
| View own progress | Yes | — | Authorized support only |
| View individual evidence | Own only | Students in owned class | Platform administration |
| View class patterns | No | Owned classes | Yes |
| Request class analysis | No | Owned classes | Yes |
| Review/accept/dismiss recommendations | No | Owned classes | Authorized governance |
| View LLM usage metadata | No | Own permitted scope | Yes |
| Access raw answer keys | No | No by default | Content governance only |

Every API must enforce these rules server-side. Hiding a UI control is not authorization.

#### 3. Data sources and evidence hierarchy

#### Existing sources confirmed in repository
- `attempts`: assignment/student, status, score, max_score, start/submission timestamps.
- `attempt_answers`: question, response, correctness, points earned.
- `attempt_events`: formative event payloads, including `VOCABULARY_RECALL_REPORT`.
- `class_assignments`, `classes`, `class_memberships`: assignment and class scope.
- `html_modules`, `question_banks`, `learning_sessions`, `questions`, `question_tags`, `stimuli`: content provenance and available skill metadata.
- `user_profiles`: optional display name.

Do not assume every student/question has complete tags or every module has canonical source identity. Missing metadata must be shown as unavailable, not fabricated.

#### Evidence quality labels
- **VERIFIED:** server-scored submitted attempt with valid source/key coverage.
- **FORMATIVE:** self-report or vocabulary recall evidence not included in official score.
- **PARTIAL:** incomplete attempt, missing tag, unverified content, or insufficient coverage.
- **STALE:** analysis is older than the evidence it summarizes.
- **UNAVAILABLE:** no usable evidence.

Official score and vocabulary recall must remain separate dimensions.

#### 4. Deterministic metrics (no LLM)

The application computes all numeric indicators before any model call.

#### Assignment metrics
- Score percentage = `score / max_score * 100`, only when max_score > 0 and status is submitted.
- Completion state from attempt status and assignment availability.
- Submission timeliness from submitted_at versus due_at, if both exist.
- Attempt duration from started_at and submitted_at; flag implausible or missing values rather than guessing.

#### Learner progress
- Time-series of verified assignment scores, grouped by session/week where source metadata supports it.
- Completion rate with denominator explicitly defined as assignments available to that learner in the selected period.
- Skill accuracy only when question tags have adequate coverage and each answer is linked to a tagged question.
- Vocabulary recall trend from formative reports, with prompt/session/date and denominator shown.
- Retention is not inferred from one recall event; it requires repeated comparable observations across time.

#### Class metrics
- Assignment completion distribution.
- Class score distribution (only submitted, scoreable attempts).
- Question/skill difficulty patterns based on response evidence and adequate sample size.
- Vocabulary recall patterns separated from reading comprehension.
- Students needing review based on transparent rules, not opaque model ranking.

#### Initial configurable review flags (proposal; approve before production)
- Missing submission after due date.
- Score below teacher-configured threshold.
- Repeated errors on same skill/tag across at least two distinct activities.
- Vocabulary recall decline across at least two comparable observations.
- Insufficient evidence flag when sample size is too small.

Thresholds are teacher/platform configurable and must be displayed in the UI. Do not hard-code unapproved pedagogical thresholds as objective mastery.

#### 5. LLM role and structured output

LLM may:
- Explain a deterministic pattern in plain language.
- Summarize a class's common learning gaps.
- Suggest a small number of remedial/reinforcement/enrichment actions.
- Draft a teacher-facing parent update for teacher review.
- Identify uncertainty or request more evidence.

LLM must not:
- Recalculate or override scores.
- Declare official mastery or grade.
- Mark an answer correct/incorrect.
- Infer personal traits, diagnoses, motivation, or home circumstances.
- Recommend punitive action or rank students.
- Generate claims unsupported by the evidence bundle.

#### Input contract (conceptual)
```json
{
  "analysis_scope": "student|class",
  "scope_id": "authorized-scope-id",
  "evidence_window": {"from": "ISO-8601", "to": "ISO-8601"},
  "metrics": {},
  "evidence_quality": [],
  "content_metadata": [],
  "analysis_version": "li-v1"
}
```

The API resolves scope and constructs the evidence bundle server-side. The browser must not be trusted to supply another student's metrics.

#### Structured output contract (conceptual)
```json
{
  "summary": "string",
  "observations": [
    {
      "claim": "string",
      "evidence_refs": ["opaque-evidence-reference"],
      "confidence": "low|medium|high",
      "limitations": ["string"]
    }
  ],
  "recommended_actions": [
    {
      "action": "string",
      "reason": "string",
      "target_skill": "string|null",
      "suggested_activity_type": "string",
      "teacher_review_required": true
    }
  ],
  "questions_for_teacher": ["string"]
}
```

Validate output against a strict schema. Reject malformed output; never render arbitrary HTML. Every material observation must cite evidence references present in the server-built bundle. Confidence is explanatory uncertainty, not a statistical probability unless calibrated.

#### 6. User journeys

#### Teacher — individual learner
1. Open an owned class.
2. Select a student.
3. View deterministic progress cards and evidence timeline.
4. Open Learning Intelligence analysis; show date range, evidence count, quality labels, and last generated time.
5. If no fresh analysis exists, teacher may request one subject to quota; otherwise show cached result.
6. Review each observation with linked source evidence.
7. Accept, edit, or dismiss suggested actions.
8. Record chosen intervention and follow-up date.
9. Compare later evidence with the prior period.

#### Teacher — class overview
1. Open class analytics.
2. View completion, score distribution, vocabulary trends, and skill gaps with denominators/sample sizes.
3. Select a pattern to inspect underlying anonymized or authorized learner evidence.
4. Request a class-level narrative analysis.
5. Review recommendations before assigning remediation.

#### Student
- View personal progress and teacher-published feedback only.
- No general-purpose chat is required for this feature.
- No access to class-wide identifiable comparisons.

#### Admin
- Configure global feature enablement and budgets.
- Inspect model usage metadata, errors, cache rates, and audit trail.
- Do not browse raw student answer text without a legitimate authorized support purpose.

#### 7. API design (proposed; do not treat as implemented)

- `GET /api/learning-intelligence/student?student_id=...` — teacher/admin authorized summary; student self-view uses session identity.
- `GET /api/learning-intelligence/class?class_id=...` — deterministic class metrics.
- `POST /api/learning-intelligence/analyses` — request or retrieve cached analysis for authorized scope.
- `GET /api/learning-intelligence/analyses/:id` — analysis and provenance.
- `POST /api/learning-intelligence/analyses/:id/review` — accept/edit/dismiss recommendation.
- `POST /api/learning-intelligence/interventions` — record teacher-selected intervention.
- `GET /api/learning-intelligence/usage` — admin usage/cost metadata.

All endpoints require authentication, role/scope authorization, input validation, bounded pagination, and audit events. Route naming may be adjusted to repository conventions before implementation; update this contract first.

#### 8. Data model proposal (additive migrations only)

Proposed tables:
- `learning_analysis_runs`: scope type/id, evidence window, evidence fingerprint, analysis version, provider/model, prompt version, status, summary JSON, usage metadata, generated_at, expires_at.
- `learning_analysis_evidence`: analysis_id, opaque evidence reference, source table/type/id, evidence classification, safe excerpt/metric snapshot.
- `learning_recommendations`: analysis_id, action payload, status, teacher_id, reviewed_at, edited payload, dismissal reason.
- `learning_interventions`: class/student, recommendation reference (nullable), teacher_id, action, target skill, assigned_at, follow_up_at, status, notes.
- `llm_usage_ledger`: feature, provider, model, role, actor_id, scope hash, request fingerprint, input/output tokens, estimated cost, latency, status, created_at.

These are proposals only. Before migration, confirm indexes, foreign keys, retention, idempotency, uniqueness, tenant scope, and whether the existing `audit_logs` can cover some metadata. Avoid duplicating sensitive raw student content.

#### 9. Caching, scheduling, and cost controls

- Compute metrics locally/server-side without model calls.
- Build deterministic evidence fingerprint from scope, time window, relevant source IDs/updated timestamps, metric version, and prompt version.
- Reuse a successful analysis when fingerprint and versions match.
- Regenerate only when evidence changes, teacher explicitly requests refresh, or configured expiry passes.
- Debounce duplicate concurrent requests with a database uniqueness/locking strategy.
- Apply per-user, per-class, per-day and platform monthly budgets.
- Set maximum evidence items, prompt bytes, output tokens, timeout, and retry count.
- Never retry non-idempotent model requests blindly; use request fingerprint and status.
- Prefer scheduled/batched class summaries over per-answer calls.
- Show estimated cost/usage to admins; provide global and feature-level kill switches.
- If LLM unavailable or budget exhausted, deterministic dashboards remain fully usable.

#### 10. Privacy and security

- Build evidence server-side after authorization.
- Prefer aggregate metrics and opaque IDs; omit names/emails from model input unless specifically approved and necessary.
- Never send answer keys, password/auth data, session cookies, or private teacher content.
- Do not put raw student responses in routine logs.
- Define retention/deletion policy before enabling production AI analysis.
- Audit who requested, reviewed, exported, or shared an analysis.
- Prevent cross-class IDOR and enforce teacher ownership in every query.
- Apply output escaping and schema validation.

#### 11. UX requirements

Every screen must include:
- Clear scope and date range.
- Data freshness timestamp.
- Evidence count and quality status.
- Denominator/sample size for percentages.
- Difference between official score and formative vocabulary recall.
- Empty, insufficient-evidence, stale, loading, error, and quota-exhausted states.
- Evidence drill-down.
- Teacher review controls and an audit trail.
- Responsive layout and accessible labels.

Never use a colorful confidence badge as a substitute for explaining evidence.

#### 12. Test and acceptance plan

#### Unit
- Metric calculations, denominator, date boundaries, zero max_score, missing dates.
- Evidence classification and fingerprint stability.
- Output schema validation and unsupported evidence reference rejection.

#### Integration
- Student can only retrieve own summary.
- Teacher can only access owned classes and members.
- Admin scope rules.
- No answer key or unnecessary PII in model payload.
- Cache hit on identical evidence; invalidation on changed evidence.
- Concurrent duplicate requests create one active analysis.
- Usage ledger records success, timeout, malformed output, quota denial.
- LLM outage leaves deterministic dashboard functional.

#### End-to-end
- Seed fixtures with known strengths/gaps.
- Teacher views correct metrics, requests analysis, sees grounded observations.
- Teacher edits/accepts/dismisses recommendation.
- Intervention is recorded and later compared with a subsequent evidence window.
- Verify no cross-student/class leakage.

#### Acceptance gates
- All numeric values match deterministic SQL/application calculations.
- Every AI claim has at least one valid evidence reference or is explicitly labeled a hypothesis/question.
- No model output changes score/mastery/content state.
- Quota and kill switch are tested.
- CI build, lint, unit, integration and E2E are green before production enablement.

#### 13. Delivery sequence

1. Audit current report and vocabulary-progress response contracts and test fixtures.
2. Define metric dictionary and evidence classification.
3. Add deterministic summary API and tests.
4. Build teacher individual/class analytics UI.
5. Add analysis persistence, cache fingerprint and usage ledger.
6. Add provider-neutral structured analysis adapter and strict output validation.
7. Add teacher review and intervention loop.
8. Run privacy/security/cost acceptance.
9. Enable only in Preview/pilot; Production requires explicit acceptance.

#### 14. Open decisions

- Teacher-configurable score thresholds and minimum sample size.
- Official skill taxonomy and tag coverage requirements.
- Retention period for analyses and raw evidence snapshots.
- Whether and when student/parent-facing AI narratives are allowed.
- Budget thresholds and model selection policy.


---

# 17. Front CS & Integrated Tutoring — Future Product Design

#### 17.1 Purpose and separation

Front CS is a service assistant for prospective students, parents, and existing customers. Its purpose is to explain FRTS programs, answer service questions, qualify inquiries, and route users to a human.

It is separate from Learning Intelligence:
- Front CS uses public/service knowledge and consented lead information.
- Learning Intelligence uses protected academic evidence and teacher authorization.
- The two modules must not share permissions implicitly.
- A Front CS conversation must never reveal student scores, attendance, teacher notes, or class membership.

#### 2. Phased capability

#### CS-0 — Service knowledge foundation
- Approved FAQ and program catalog.
- Tuition/fee and schedule information with effective dates.
- Service area, contact channels, policies, refund/cancellation and enrollment requirements.
- Content owner, review date, source, version, expiry.
- If information is missing or expired, assistant says it cannot confirm and offers human handoff.

#### CS-1 — Front CS assistant
- Web entry point with clear AI disclosure.
- Intent detection: program information, pricing, schedule, placement, enrollment, technical support, existing customer, complaint.
- Retrieval-grounded answers from approved service content.
- Ask only for minimum details needed to route inquiry.
- Capture name/contact only after notice and consent.
- Human handoff with conversation summary, intent, unresolved questions, and consent state.
- Safe fallback for emergencies, complaints, payment disputes, and unsupported requests.

#### CS-2 — Lead and enrollment workflow
- Lead record and status pipeline.
- Contact preference and consent timestamp/source.
- Follow-up task and assigned staff.
- Placement consultation request.
- Enrollment status synchronization only through authorized APIs.
- Duplicate lead detection and opt-out handling.

#### CS-3 — Omnichannel operations
- Optional WhatsApp or other channel integration after provider, policy, and cost selection.
- Conversation continuity across channels only with identity verification and consent.
- Business-hours messaging and human escalation SLA.
- Admin dashboard for queue, assignment, unresolved intents, and quality review.

#### IT-0 — Integrated tutoring discovery
- Define service types, tutor roles, placement process, class/lesson formats, schedule, pricing, cancellation, and safeguarding policies.
- Define what data may be shared from FRTS learning records and obtain appropriate consent.
- Define human accountability and escalation.

#### IT-1 — Authorized learner intake
- Link a verified account to a tutoring inquiry.
- Retrieve only approved placement/progress summaries.
- Student/parent can review what will be shared.
- Teacher/tutor can correct context and add goals.

#### IT-2 — Tutoring support
- Suggest lesson plans and practice based on authorized evidence.
- Tutor remains responsible for learning plan and progress review.
- Scheduling and payment remain deterministic integrations, never model-invented.
- Human handoff for safeguarding, complaints, and exceptions.

#### 3. Knowledge and response architecture

1. Maintain a curated service knowledge base with version and owner.
2. Retrieve only approved, current passages.
3. Require answer citations/source IDs internally and render source links where appropriate.
4. Refuse to invent prices, schedules, availability, guarantees, or policy terms.
5. Ask a clarifying question when multiple programs or services are plausible.
6. Provide human contact path when retrieval confidence is low or the user asks for a person.
7. Store minimal conversation metadata; retention of transcripts requires a separately approved policy.

#### 4. Data model proposal (future)

- `service_knowledge_documents`: content, category, source, version, approval, valid_from, valid_until, owner.
- `service_conversations`: channel, session reference, intent, status, consent state, created_at.
- `service_messages`: conversation reference, role, safe content, timestamps, retention class.
- `service_leads`: minimal contact fields, consent source/time, status, assigned staff, opt-out.
- `service_handoffs`: conversation/lead, destination team, summary, urgency, accepted_at, resolution.
- `service_tasks`: owner, due_at, status, linked lead/handoff.
- `tutoring_intakes`: verified learner link, requested service, consented academic summary reference, status.
- `tutoring_plans`: human-approved goals, tutor, cadence, review date, status.

No schema migration should be made until data protection, consent, access, retention, and operational ownership are approved.

#### 5. LLM policy and cost controls

- Provider-agnostic orchestration; server-side credentials only.
- Retrieval-grounded generation; no unrestricted general-purpose assistant.
- Cache stable FAQ answers where safe.
- Short context, low output cap, intent-specific prompts, bounded retrieval.
- Use deterministic workflow/API calls for lead creation, scheduling, enrollment, payments, and account actions.
- Human confirmation for consequential actions.
- Rate limits, abuse protection, per-channel budgets, per-conversation limits, and global kill switch.
- No model call for static FAQ pages or deterministic status lookup where ordinary application code is sufficient.

#### 6. Security and privacy

- Public CS has no access to academic tables by default.
- Existing customer identity must be verified before account-specific support.
- Collect personal data only after explicit notice and consent.
- Provide opt-out and deletion/retention process.
- Protect against prompt injection in retrieved documents and user messages.
- Validate all tool actions against server-side authorization and business rules.
- Keep service staff roles separate from ADMIN/TEACHER/STUDENT roles.
- Audit access to leads, conversations, and handoffs.

#### 7. Acceptance criteria

- Every factual program answer traces to an approved, current knowledge source.
- Outdated/missing source triggers safe fallback and handoff.
- Public user cannot retrieve private student/class data.
- Lead creation requires explicit consent and validates contact fields.
- Human handoff preserves context without exposing unrelated data.
- Unsubscribe/opt-out is enforced.
- Cost/rate limits and kill switch work.
- E2E tests cover anonymous, consented lead, verified existing customer, unsupported request, prompt injection, and handoff.

#### 8. Decisions required before build

- Official program/fee/schedule source owner.
- Service hours, support channels, and escalation SLA.
- Consent language, privacy notice, retention and deletion policy.
- Human team roles and queue ownership.
- Lead CRM system or FRTS-native lead management.
- WhatsApp provider and messaging costs, if selected.
- Tutoring service model, pricing, placement, safeguarding, and scheduling policy.


---

# 18. Document Versioning & Change Control

This is the **only evolving core product/design document** for FRTS. Supporting technical implementation notes, test reports, migration notes, and historical audits may exist, but they do not create competing product specifications.

## 18.1 Immutable version policy
- Never edit or overwrite a released master version.
- At the completion of each approved development phase, create a new file: `docs/FRTS_MASTER_DESIGN_vX.Y.md`.
- Copy the previous version, incorporate only accepted phase outcomes and approved design changes, update the version/date, and append a change log entry.
- The previous version remains in Git unchanged as an immutable snapshot.
- The documentation index must point to exactly one current version. Older versions are historical snapshots.
- A phase is not complete merely because code was committed. Its acceptance gates and evidence must be met before the next master version is issued.

## 18.2 Required phase completion record
Each version must record:
1. Phase name, scope, start/completion date.
2. Requirements delivered and deliberately deferred.
3. UI workflows and role/permission changes.
4. API contracts and request/response behavior.
5. Database migrations, indexes, constraints, and rollback notes.
6. LLM provider/model/prompt/schema versions, usage and cost controls where relevant.
7. Security, privacy, retention, and audit decisions.
8. Tests run with exact counts/results and CI run/commit references.
9. Preview/E2E evidence and known limitations.
10. Decisions changed from the previous version and rationale.

## 18.3 Change log
| Version | Date | Change | Status |
|---|---|---|---|
| 1.0 | 2026-11-19 | Initial product baseline; preserved unchanged in Git. | Immutable baseline |
| 1.1 | 2026-11-19 | Consolidated Learning Intelligence and Front CS/Integrated Tutoring functional and technical designs into the single master document; established immutable phase-versioning rules. | Current design baseline |

## 18.4 Phase gates
- **Phase 0 — Evidence foundation:** audit current attempts, reports, vocabulary events, source provenance, role isolation, and CI. Publish next version only after evidence and metric definitions are accepted.
- **Phase 1 — Deterministic Learning Intelligence:** deliver server-computed individual/class metrics, evidence quality, freshness, and teacher UX. LLM not required for this gate.
- **Phase 2 — Bounded AI analysis:** persist analysis snapshots, evidence references, cache/deduplicate requests, usage ledger, quotas, kill switch, and validated structured output.
- **Phase 3 — Teacher intervention loop:** recommendation review, intervention records, follow-up evidence comparison.
- **Phase 4 — Front CS:** approved service knowledge, consented lead intake, human handoff and queue operations.
- **Phase 5 — Integrated tutoring:** authorized learner intake, human-approved tutoring plans, scheduling/payment integrations and safeguarding.

Each phase may be split into subphases only if the new version clearly records the scope and acceptance criteria. Do not skip a phase gate by labeling a partial implementation complete.
