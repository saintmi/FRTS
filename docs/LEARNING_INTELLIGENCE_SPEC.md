# FRTS Learning Intelligence — Functional & Technical Specification

- **Status:** Design baseline; implementation must be tracked separately
- **Version:** 1.0
- **Last updated:** 19 November 2026
- **Parent authority:** [FRTS Product Master Specification](./FRTS_PRODUCT_MASTER_SPEC.md)

## 1. Purpose

Convert verified learner activity into evidence-backed insights that help teachers decide what to teach next. This is not an open-ended student chatbot.

## 2. Users and permissions

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

## 3. Data sources and evidence hierarchy

### Existing sources confirmed in repository
- `attempts`: assignment/student, status, score, max_score, start/submission timestamps.
- `attempt_answers`: question, response, correctness, points earned.
- `attempt_events`: formative event payloads, including `VOCABULARY_RECALL_REPORT`.
- `class_assignments`, `classes`, `class_memberships`: assignment and class scope.
- `html_modules`, `question_banks`, `learning_sessions`, `questions`, `question_tags`, `stimuli`: content provenance and available skill metadata.
- `user_profiles`: optional display name.

Do not assume every student/question has complete tags or every module has canonical source identity. Missing metadata must be shown as unavailable, not fabricated.

### Evidence quality labels
- **VERIFIED:** server-scored submitted attempt with valid source/key coverage.
- **FORMATIVE:** self-report or vocabulary recall evidence not included in official score.
- **PARTIAL:** incomplete attempt, missing tag, unverified content, or insufficient coverage.
- **STALE:** analysis is older than the evidence it summarizes.
- **UNAVAILABLE:** no usable evidence.

Official score and vocabulary recall must remain separate dimensions.

## 4. Deterministic metrics (no LLM)

The application computes all numeric indicators before any model call.

### Assignment metrics
- Score percentage = `score / max_score * 100`, only when max_score > 0 and status is submitted.
- Completion state from attempt status and assignment availability.
- Submission timeliness from submitted_at versus due_at, if both exist.
- Attempt duration from started_at and submitted_at; flag implausible or missing values rather than guessing.

### Learner progress
- Time-series of verified assignment scores, grouped by session/week where source metadata supports it.
- Completion rate with denominator explicitly defined as assignments available to that learner in the selected period.
- Skill accuracy only when question tags have adequate coverage and each answer is linked to a tagged question.
- Vocabulary recall trend from formative reports, with prompt/session/date and denominator shown.
- Retention is not inferred from one recall event; it requires repeated comparable observations across time.

### Class metrics
- Assignment completion distribution.
- Class score distribution (only submitted, scoreable attempts).
- Question/skill difficulty patterns based on response evidence and adequate sample size.
- Vocabulary recall patterns separated from reading comprehension.
- Students needing review based on transparent rules, not opaque model ranking.

### Initial configurable review flags (proposal; approve before production)
- Missing submission after due date.
- Score below teacher-configured threshold.
- Repeated errors on same skill/tag across at least two distinct activities.
- Vocabulary recall decline across at least two comparable observations.
- Insufficient evidence flag when sample size is too small.

Thresholds are teacher/platform configurable and must be displayed in the UI. Do not hard-code unapproved pedagogical thresholds as objective mastery.

## 5. LLM role and structured output

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

### Input contract (conceptual)
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

### Structured output contract (conceptual)
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

## 6. User journeys

### Teacher — individual learner
1. Open an owned class.
2. Select a student.
3. View deterministic progress cards and evidence timeline.
4. Open Learning Intelligence analysis; show date range, evidence count, quality labels, and last generated time.
5. If no fresh analysis exists, teacher may request one subject to quota; otherwise show cached result.
6. Review each observation with linked source evidence.
7. Accept, edit, or dismiss suggested actions.
8. Record chosen intervention and follow-up date.
9. Compare later evidence with the prior period.

### Teacher — class overview
1. Open class analytics.
2. View completion, score distribution, vocabulary trends, and skill gaps with denominators/sample sizes.
3. Select a pattern to inspect underlying anonymized or authorized learner evidence.
4. Request a class-level narrative analysis.
5. Review recommendations before assigning remediation.

### Student
- View personal progress and teacher-published feedback only.
- No general-purpose chat is required for this feature.
- No access to class-wide identifiable comparisons.

### Admin
- Configure global feature enablement and budgets.
- Inspect model usage metadata, errors, cache rates, and audit trail.
- Do not browse raw student answer text without a legitimate authorized support purpose.

## 7. API design (proposed; do not treat as implemented)

- `GET /api/learning-intelligence/student?student_id=...` — teacher/admin authorized summary; student self-view uses session identity.
- `GET /api/learning-intelligence/class?class_id=...` — deterministic class metrics.
- `POST /api/learning-intelligence/analyses` — request or retrieve cached analysis for authorized scope.
- `GET /api/learning-intelligence/analyses/:id` — analysis and provenance.
- `POST /api/learning-intelligence/analyses/:id/review` — accept/edit/dismiss recommendation.
- `POST /api/learning-intelligence/interventions` — record teacher-selected intervention.
- `GET /api/learning-intelligence/usage` — admin usage/cost metadata.

All endpoints require authentication, role/scope authorization, input validation, bounded pagination, and audit events. Route naming may be adjusted to repository conventions before implementation; update this contract first.

## 8. Data model proposal (additive migrations only)

Proposed tables:
- `learning_analysis_runs`: scope type/id, evidence window, evidence fingerprint, analysis version, provider/model, prompt version, status, summary JSON, usage metadata, generated_at, expires_at.
- `learning_analysis_evidence`: analysis_id, opaque evidence reference, source table/type/id, evidence classification, safe excerpt/metric snapshot.
- `learning_recommendations`: analysis_id, action payload, status, teacher_id, reviewed_at, edited payload, dismissal reason.
- `learning_interventions`: class/student, recommendation reference (nullable), teacher_id, action, target skill, assigned_at, follow_up_at, status, notes.
- `llm_usage_ledger`: feature, provider, model, role, actor_id, scope hash, request fingerprint, input/output tokens, estimated cost, latency, status, created_at.

These are proposals only. Before migration, confirm indexes, foreign keys, retention, idempotency, uniqueness, tenant scope, and whether the existing `audit_logs` can cover some metadata. Avoid duplicating sensitive raw student content.

## 9. Caching, scheduling, and cost controls

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

## 10. Privacy and security

- Build evidence server-side after authorization.
- Prefer aggregate metrics and opaque IDs; omit names/emails from model input unless specifically approved and necessary.
- Never send answer keys, password/auth data, session cookies, or private teacher content.
- Do not put raw student responses in routine logs.
- Define retention/deletion policy before enabling production AI analysis.
- Audit who requested, reviewed, exported, or shared an analysis.
- Prevent cross-class IDOR and enforce teacher ownership in every query.
- Apply output escaping and schema validation.

## 11. UX requirements

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

## 12. Test and acceptance plan

### Unit
- Metric calculations, denominator, date boundaries, zero max_score, missing dates.
- Evidence classification and fingerprint stability.
- Output schema validation and unsupported evidence reference rejection.

### Integration
- Student can only retrieve own summary.
- Teacher can only access owned classes and members.
- Admin scope rules.
- No answer key or unnecessary PII in model payload.
- Cache hit on identical evidence; invalidation on changed evidence.
- Concurrent duplicate requests create one active analysis.
- Usage ledger records success, timeout, malformed output, quota denial.
- LLM outage leaves deterministic dashboard functional.

### End-to-end
- Seed fixtures with known strengths/gaps.
- Teacher views correct metrics, requests analysis, sees grounded observations.
- Teacher edits/accepts/dismisses recommendation.
- Intervention is recorded and later compared with a subsequent evidence window.
- Verify no cross-student/class leakage.

### Acceptance gates
- All numeric values match deterministic SQL/application calculations.
- Every AI claim has at least one valid evidence reference or is explicitly labeled a hypothesis/question.
- No model output changes score/mastery/content state.
- Quota and kill switch are tested.
- CI build, lint, unit, integration and E2E are green before production enablement.

## 13. Delivery sequence

1. Audit current report and vocabulary-progress response contracts and test fixtures.
2. Define metric dictionary and evidence classification.
3. Add deterministic summary API and tests.
4. Build teacher individual/class analytics UI.
5. Add analysis persistence, cache fingerprint and usage ledger.
6. Add provider-neutral structured analysis adapter and strict output validation.
7. Add teacher review and intervention loop.
8. Run privacy/security/cost acceptance.
9. Enable only in Preview/pilot; Production requires explicit acceptance.

## 14. Open decisions

- Teacher-configurable score thresholds and minimum sample size.
- Official skill taxonomy and tag coverage requirements.
- Retention period for analyses and raw evidence snapshots.
- Whether and when student/parent-facing AI narratives are allowed.
- Budget thresholds and model selection policy.
