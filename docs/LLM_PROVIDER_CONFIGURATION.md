> **Legacy integration reference.** This documents the initial generic chat endpoint and its historical role/feature catalogue. It is not the current product AI specification. Current AI priorities, permitted use cases, and cost/privacy requirements are defined in [FRTS Product Master Specification](./FRTS_PRODUCT_MASTER_SPEC.md) and [Learning Intelligence Specification](./LEARNING_INTELLIGENCE_SPEC.md). Do not expand the student chatbot catalogue without updating and obtaining approval for the product specifications.

# FRTS LLM Provider Configuration

FRTS uses a provider-neutral chat contract. The first deployment adapter uses Vercel AI Gateway's OpenAI-compatible Chat Completions endpoint. The application sends one model identifier and one server-side credential; model/provider changes do not require frontend changes.

## Required server environment variables

Set these in Vercel Preview first, then Production after acceptance testing:

- `LLM_API_KEY`: AI Gateway API key. Keep server-only; never prefix with `VITE_`.
- `LLM_MODEL`: provider/model identifier supported by the configured gateway, e.g. a model selected from the live catalog. Do not assume a model slug without checking the catalog.
- `LLM_BASE_URL`: optional. Defaults to `https://ai-gateway.vercel.sh/v1`.
- `LLM_MAX_OUTPUT_TOKENS`: optional integer; defaults to 1600 and is capped at 3000.
- `LLM_SYSTEM_POLICY`: optional deployment policy appended to the feature-specific prompt.

The API calls `POST {LLM_BASE_URL}/chat/completions` from the server. The browser calls only `POST /api/llm/chat` with the authenticated session cookie.

## Supported feature IDs and roles

| Feature | Roles |
|---|---|
| tutor | STUDENT, TEACHER, ADMIN |
| reading_coach | STUDENT, TEACHER, ADMIN |
| vocabulary_coach | STUDENT, TEACHER, ADMIN |
| explain_answer | STUDENT, TEACHER, ADMIN |
| writing_feedback | STUDENT, TEACHER, ADMIN |
| practice_generator | TEACHER, ADMIN |
| teacher_copilot | TEACHER, ADMIN |
| question_generator | TEACHER, ADMIN |
| html_generator | TEACHER, ADMIN |
| differentiation | TEACHER, ADMIN |
| class_insights | TEACHER, ADMIN |
| content_reviewer | TEACHER, ADMIN |
| platform_insights | ADMIN |

## API contract

`POST /api/llm/chat`

Request:
```json
{
  "feature": "reading_coach",
  "messages": [
    { "role": "user", "content": "Bantu saya menemukan gagasan utama." }
  ],
  "context": "Optional text or learning context"
}
```

Response:
```json
{
  "answer": "…",
  "feature": "reading_coach",
  "model": "provider/model",
  "usage": {}
}
```

The endpoint requires authentication, validates feature access by role, limits each request to 20 messages, truncates message/context sizes, sets a server-side feature policy, and logs feature/model/usage metadata without writing the conversation text to the audit log. Provider credentials never reach the browser.

## Important limitations of this first increment

- This first adapter currently uses the Chat Completions-compatible surface. Native provider-specific capabilities (for example, some file, audio, image, or tool APIs) need separate adapters and capability checks.
- The first UI is a unified text workspace. It does not yet provide streaming tokens, persistent conversation history, retrieval-grounded class content, or tool execution.
- Context is user-supplied in this increment; it is not automatically loaded from student records or answer keys.
- Generated questions, keys, and HTML are suggestions only. Teacher review is mandatory before publication.
- Rate limiting, per-user budgets, consent/retention controls, and a dedicated usage ledger remain required before broad production enablement.
- LLM route behavior must be verified in Preview with valid secrets and a real selected model before calling the feature operational.

## Deployment checklist

1. Configure required secrets in Vercel Preview only.
2. Verify the configured model is available to the gateway account.
3. Test each role against allowed and forbidden feature IDs.
4. Test missing secrets, provider timeout, invalid model, empty response, and usage logging.
5. Review cost/usage and implement quotas before opening the AI workspace to all students.
6. Promote the same configuration policy to Production only after Preview acceptance.
