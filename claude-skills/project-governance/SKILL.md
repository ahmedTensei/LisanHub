---
name: project-governance
description: Governs implementation decisions for this language-learning platform. Use when planning, changing, reviewing, or adding product or technical functionality, especially when the request could affect scope, roadmap, architecture, permissions, data, or business rules.
---

# Project Governance

Treat the current project specification supplied in the repository as the primary product source of truth. Do not silently replace its terminology, decisions, roadmap stages, exclusions, or unresolved questions with generic assumptions.

## Decision classification

Before implementing a non-trivial change, classify the relevant requirement as one of:
- Confirmed/current requirement
- MVP / Stage 1
- Later roadmap stage
- Future possibility/reference only
- Undecided / requires an explicit decision
- Explicitly excluded

Never promote a future idea into MVP. Never turn an undecided item into a decision by inference. Never treat a reference-only idea as a commitment.

## Important product boundaries

- The platform is a centralized service; community-generated educational content is the open/community aspect. Do not describe the software itself as open-source unless the project specification explicitly changes that.
- The learning experience is intentionally flexible; there is no single mandatory curriculum.
- Educational content is defined around a language pair (comfortable/native language -> target language).
- A dialect is metadata/tagging and preference, not a separate language identity.
- UI/interface languages and learning/content languages are separate concepts.
- Community interaction is based on chats, groups, discovery, content collaboration, and marketplace; do not introduce a traditional permanent forum/feed unless explicitly requested.
- The current specification is the authority for storage, monetization, KYC, marketplace, and roadmap decisions; do not resurrect superseded assumptions from older conversations.

## Change control

For a major change:
1. Identify affected bounded contexts and invariants.
2. Check the current specification for conflicts.
3. Explain any ambiguity before making a new product decision.
4. Prefer an RFC/ADR for architectural or cross-context changes.
5. Identify data-model, authorization, API, migration, testing, and operational consequences.
6. Keep implementation scope aligned with the requested roadmap stage.

## Output behavior

When proposing a feature, state:
- Which existing requirement it implements.
- Which roadmap stage it belongs to.
- What it changes.
- What it deliberately does not change.
- Any unresolved decision that must remain unresolved.

Do not add speculative features merely because they are common in similar products.
