# FRTS Frontend, API Routing, and LLM Implementation Plan

## Decisions
- Repository: saintmi/FRTS
- Target branch: main only. No feature branches.
- LLM architecture: provider-agnostic. The first adapter targets the OpenAI-compatible API surface exposed by Vercel AI Gateway; model routing is configured server-side by environment variables. A future adapter can implement native provider APIs without changing the UI or feature contracts.
- Never expose provider credentials to the browser.
- Preserve current Neon schema/data and existing class/assignment workflows.

## Product acceptance journeys
1. Teacher creates a class, creates an invite, shares code/link, and sees members.
2. Student joins by invite, sees only their enrolled classes and published assignments.
3. Teacher adds an HTML module from the library or uploads HTML, assigns it to a class, and students can open the published module inside an isolated sandbox.
4. Student submits an attempt; score is computed server-side; teacher sees class progress and reports.
5. Admin manages users, classes, content review, and platform reports.
6. All roles can access only the AI tools permitted for their role; prompts and data are scoped to the current user/class/assignment.

## LLM feature catalogue
- Student: AI Tutor, Reading Coach, Vocabulary Coach, answer explanation, adaptive practice, writing feedback.
- Teacher: Teacher Copilot, question/stimulus generator, HTML lesson generator, differentiation/remedial recommendations, class insights, content reviewer.
- Admin: AI platform insights and usage overview.
- AI output is advisory. It must not silently alter official answer keys, publish content, grade high-stakes assessments, or reveal private answer keys.
- Require teacher review before generated HTML/questions are published.
- Store provider/model, role, feature, latency, token usage, and outcome metadata for audit and cost controls. Do not store unnecessary sensitive student text.

## Implementation sequence
1. Inspect existing React routes, API dispatcher, auth, class, HTML, assignment, attempt, and report contracts.
2. Add a role-aware LLM API contract and provider adapter behind the server API.
3. Add a unified role-aware AI workspace in the frontend.
4. Improve class detail UX with shareable invite link and add-material/assignment flow.
5. Verify all API paths, role restrictions, HTML sandbox policy, and end-to-end browser behavior.
6. Run build, lint, and tests; deploy Preview and run positive and negative acceptance tests before production.

## Environment configuration
- LLM_API_KEY: server-only provider/gateway credential.
- LLM_BASE_URL: server-only OpenAI-compatible API base URL (default Vercel AI Gateway).
- LLM_MODEL: server-selected model identifier.
- LLM_MAX_OUTPUT_TOKENS: output cap.
- Optional LLM_SYSTEM_POLICY: deployment-specific safety policy.
- Never add real credentials to Git.

## Current known gaps from repository inspection
- No LLM routes or LLM UI were found in the inspected source.
- Class/invite, HTML, assignment, attempt, and report endpoints already exist; their complete end-to-end browser experience still requires verification.
- Admin content/user management screens exist; mobile/device and accessibility testing remain necessary.
- The current API is a large catch-all dispatcher. Future work should extract route handlers incrementally with contract tests rather than rewrite all routes at once.
