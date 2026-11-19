# FRTS Front CS & Integrated Tutoring Roadmap

- **Status:** Future design; not part of the current Learning Intelligence release
- **Version:** 1.0
- **Last updated:** 19 November 2026
- **Parent authority:** [FRTS Product Master Specification](./FRTS_PRODUCT_MASTER_SPEC.md)

## 1. Purpose and separation

Front CS is a service assistant for prospective students, parents, and existing customers. Its purpose is to explain FRTS programs, answer service questions, qualify inquiries, and route users to a human.

It is separate from Learning Intelligence:
- Front CS uses public/service knowledge and consented lead information.
- Learning Intelligence uses protected academic evidence and teacher authorization.
- The two modules must not share permissions implicitly.
- A Front CS conversation must never reveal student scores, attendance, teacher notes, or class membership.

## 2. Phased capability

### CS-0 — Service knowledge foundation
- Approved FAQ and program catalog.
- Tuition/fee and schedule information with effective dates.
- Service area, contact channels, policies, refund/cancellation and enrollment requirements.
- Content owner, review date, source, version, expiry.
- If information is missing or expired, assistant says it cannot confirm and offers human handoff.

### CS-1 — Front CS assistant
- Web entry point with clear AI disclosure.
- Intent detection: program information, pricing, schedule, placement, enrollment, technical support, existing customer, complaint.
- Retrieval-grounded answers from approved service content.
- Ask only for minimum details needed to route inquiry.
- Capture name/contact only after notice and consent.
- Human handoff with conversation summary, intent, unresolved questions, and consent state.
- Safe fallback for emergencies, complaints, payment disputes, and unsupported requests.

### CS-2 — Lead and enrollment workflow
- Lead record and status pipeline.
- Contact preference and consent timestamp/source.
- Follow-up task and assigned staff.
- Placement consultation request.
- Enrollment status synchronization only through authorized APIs.
- Duplicate lead detection and opt-out handling.

### CS-3 — Omnichannel operations
- Optional WhatsApp or other channel integration after provider, policy, and cost selection.
- Conversation continuity across channels only with identity verification and consent.
- Business-hours messaging and human escalation SLA.
- Admin dashboard for queue, assignment, unresolved intents, and quality review.

### IT-0 — Integrated tutoring discovery
- Define service types, tutor roles, placement process, class/lesson formats, schedule, pricing, cancellation, and safeguarding policies.
- Define what data may be shared from FRTS learning records and obtain appropriate consent.
- Define human accountability and escalation.

### IT-1 — Authorized learner intake
- Link a verified account to a tutoring inquiry.
- Retrieve only approved placement/progress summaries.
- Student/parent can review what will be shared.
- Teacher/tutor can correct context and add goals.

### IT-2 — Tutoring support
- Suggest lesson plans and practice based on authorized evidence.
- Tutor remains responsible for learning plan and progress review.
- Scheduling and payment remain deterministic integrations, never model-invented.
- Human handoff for safeguarding, complaints, and exceptions.

## 3. Knowledge and response architecture

1. Maintain a curated service knowledge base with version and owner.
2. Retrieve only approved, current passages.
3. Require answer citations/source IDs internally and render source links where appropriate.
4. Refuse to invent prices, schedules, availability, guarantees, or policy terms.
5. Ask a clarifying question when multiple programs or services are plausible.
6. Provide human contact path when retrieval confidence is low or the user asks for a person.
7. Store minimal conversation metadata; retention of transcripts requires a separately approved policy.

## 4. Data model proposal (future)

- `service_knowledge_documents`: content, category, source, version, approval, valid_from, valid_until, owner.
- `service_conversations`: channel, session reference, intent, status, consent state, created_at.
- `service_messages`: conversation reference, role, safe content, timestamps, retention class.
- `service_leads`: minimal contact fields, consent source/time, status, assigned staff, opt-out.
- `service_handoffs`: conversation/lead, destination team, summary, urgency, accepted_at, resolution.
- `service_tasks`: owner, due_at, status, linked lead/handoff.
- `tutoring_intakes`: verified learner link, requested service, consented academic summary reference, status.
- `tutoring_plans`: human-approved goals, tutor, cadence, review date, status.

No schema migration should be made until data protection, consent, access, retention, and operational ownership are approved.

## 5. LLM policy and cost controls

- Provider-agnostic orchestration; server-side credentials only.
- Retrieval-grounded generation; no unrestricted general-purpose assistant.
- Cache stable FAQ answers where safe.
- Short context, low output cap, intent-specific prompts, bounded retrieval.
- Use deterministic workflow/API calls for lead creation, scheduling, enrollment, payments, and account actions.
- Human confirmation for consequential actions.
- Rate limits, abuse protection, per-channel budgets, per-conversation limits, and global kill switch.
- No model call for static FAQ pages or deterministic status lookup where ordinary application code is sufficient.

## 6. Security and privacy

- Public CS has no access to academic tables by default.
- Existing customer identity must be verified before account-specific support.
- Collect personal data only after explicit notice and consent.
- Provide opt-out and deletion/retention process.
- Protect against prompt injection in retrieved documents and user messages.
- Validate all tool actions against server-side authorization and business rules.
- Keep service staff roles separate from ADMIN/TEACHER/STUDENT roles.
- Audit access to leads, conversations, and handoffs.

## 7. Acceptance criteria

- Every factual program answer traces to an approved, current knowledge source.
- Outdated/missing source triggers safe fallback and handoff.
- Public user cannot retrieve private student/class data.
- Lead creation requires explicit consent and validates contact fields.
- Human handoff preserves context without exposing unrelated data.
- Unsubscribe/opt-out is enforced.
- Cost/rate limits and kill switch work.
- E2E tests cover anonymous, consented lead, verified existing customer, unsupported request, prompt injection, and handoff.

## 8. Decisions required before build

- Official program/fee/schedule source owner.
- Service hours, support channels, and escalation SLA.
- Consent language, privacy notice, retention and deletion policy.
- Human team roles and queue ownership.
- Lead CRM system or FRTS-native lead management.
- WhatsApp provider and messaging costs, if selected.
- Tutoring service model, pricing, placement, safeguarding, and scheduling policy.
