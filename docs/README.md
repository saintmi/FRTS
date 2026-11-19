# FRTS Documentation Index

**Repository:** `saintmi/FRTS`  
**Default development branch:** `main`

This directory is the documentation source of truth for product intent, technical contracts, implementation status, and acceptance evidence.

## Authority hierarchy

1. **[FRTS Product Master Specification](./FRTS_PRODUCT_MASTER_SPEC.md)** — highest-level product authority: purpose, users, product boundaries, workflows, architecture principles, and roadmap priorities.
2. **[Learning Intelligence Specification](./LEARNING_INTELLIGENCE_SPEC.md)** — detailed functional and technical design for evidence-based learner analysis and teacher-facing recommendations.
3. **[Front CS and Integrated Tutoring Roadmap](./FRONT_CS_INTEGRATED_TUTORING_ROADMAP.md)** — future-facing customer-service and integrated tutoring design; not authorization to implement all future capabilities now.
4. **[Implementation Status](./IMPLEMENTATION_STATUS.md)** — what is actually present and verified in the repository. This is status evidence, not product intent.
5. **[Production Readiness Audit](./PRODUCTION_READINESS_AUDIT.md)** — dated audit snapshot. Re-audit before relying on it for a release decision.
6. **[Frontend/API/LLM Implementation Plan](./FRONTEND_API_LLM_IMPLEMENTATION_PLAN.md)** and **[LLM Provider Configuration](./LLM_PROVIDER_CONFIGURATION.md)** — technical history/contracts for the initial generic LLM integration; subordinate to the product master and Learning Intelligence specification.
7. **[Vocabulary-First Batch 1 Integration](./BATCH_01_VOCABULARY_FIRST_INTEGRATION.md)** — canonical integration guidance for that content batch only.

## Documentation rules

- Product decisions belong in the Product Master Specification first.
- Feature requirements and acceptance criteria belong in the corresponding feature specification.
- API/schema changes must update the relevant technical contract and migration documentation in the same change.
- Every implementation change must update `IMPLEMENTATION_STATUS.md` with commit/file references and real test evidence.
- Never convert a planned or partially implemented item into PASS/complete without verifiable tests.
- Dated audit reports remain historical snapshots. Add a new audit rather than silently rewriting historical evidence.
- Keep secrets, private teacher answer packages, and student-sensitive payloads out of this public repository.
- When documents conflict, this hierarchy applies; record the resolution in the master specification's decision log.

## Current product direction

FRTS prioritizes a dependable English-learning workflow and **Learning Intelligence** over a general-purpose student chatbot. LLM calls should be sparse, evidence-grounded, auditable, and cost-controlled. **Front CS / Integrated Tutoring** is a separately staged future capability.
