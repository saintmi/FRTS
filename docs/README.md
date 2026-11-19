# FRTS Documentation Index

**Repository:** `saintmi/FRTS`  
**Development branch:** `main`

## The single core product/design document

<badge>Current</badge>

**[FRTS Master Product & System Design v1.1](./FRTS_MASTER_DESIGN_v1.1.md)**

This is the only evolving source of truth for product requirements, system design, Learning Intelligence, Front CS, integrated tutoring, phase gates, and design decisions.

**[FRTS Product Master Specification v1.0](./FRTS_PRODUCT_MASTER_SPEC.md)** is the immutable initial baseline. It must never be edited. Version 1.1 consolidates and extends it; subsequent completed phases create v1.2, v1.3, and so on, each as a new file. Never overwrite prior versions.

## Supporting evidence and implementation records

These documents support implementation or record historical evidence. They do not define a competing product roadmap:

- `IMPLEMENTATION_STATUS.md` — historical implementation snapshot; update status only with current verifiable evidence.
- `PRODUCT_COMPLETION_STATUS.md` — historical completion snapshot.
- `PRODUCTION_READINESS_AUDIT.md` — dated audit snapshot; re-audit before release decisions.
- `FRONTEND_API_LLM_IMPLEMENTATION_PLAN.md` — subordinate technical execution notes; product scope must follow the current master design.
- `LLM_PROVIDER_CONFIGURATION.md` — legacy provider/chat integration reference.
- `BATCH_01_VOCABULARY_FIRST_INTEGRATION.md` — batch-specific content integration record.

## Mandatory documentation governance

1. The current master version is the only product/design authority.
2. Do not edit v1.0 or any previously released master version.
3. At each phase completion, create the next version file from the prior version; do not overwrite.
4. Update this index to point to exactly one current master version.
5. Record scope, UI, roles, API, schema/migrations, LLM/prompt/cost, privacy/security, tests, CI, Preview/E2E evidence, commit SHA, and known gaps in the new version.
6. Do not mark a phase complete until its acceptance criteria pass. Code presence alone is not completion.
7. Keep secrets, private answer keys, and sensitive student data out of Git.
