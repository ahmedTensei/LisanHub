# LisanHub — Claude Code Skills (v2)

Project-scoped Claude Code skills for the community-driven language learning platform.

## Installation

This archive already contains the correct folder structure. Copy the `.claude` folder into the **root of your project repository**:

    <your-project>/
      .claude/
        skills/
          project-governance/SKILL.md
          mvp-scope/SKILL.md
          architecture-guardian/SKILL.md
          roles-permissions/SKILL.md
          learning-platform/SKILL.md
          learning-exercise-engine/SKILL.md
          ugc-content-system/SKILL.md
          content-lineage/SKILL.md
          community-chat-system/SKILL.md
          monetization-marketplace/SKILL.md
          search-discovery/SKILL.md
          trust-moderation/SKILL.md
          i18n-rtl/SKILL.md
          platform-security/SKILL.md
          plugin-architecture/SKILL.md
          api-data-architecture/SKILL.md
          testing-quality/SKILL.md

Claude Code discovers project skills automatically from `.claude/skills/<name>/SKILL.md`.

## The 17 skills

**Governance and scope**
- `project-governance` — classifies every request against the specification; prevents scope drift.
- `mvp-scope` — guards the first-release boundary; lists what is deferred.

**Architecture**
- `architecture-guardian` — bounded contexts, module boundaries, dependency direction.
- `api-data-architecture` — stable APIs, data ownership, provider abstractions, migrations.
- `plugin-architecture` — the plugin contract, the portable content package, the sandboxed player, who may publish a plugin (decision R7; added locally, not part of v2.1).

**Domain**
- `roles-permissions` — the full role model and the capability-based authorization rules.
- `learning-platform` — language pairs, levels, learner experience.
- `learning-exercise-engine` — reusable exercise engine and evaluation.
- `ugc-content-system` — community content, ownership, creator tooling, review.
- `content-lineage` — copying, derivation, attribution, provenance.
- `community-chat-system` — chats, groups, partner matching, community discovery.
- `monetization-marketplace` — the commercial layer, paid content, subscriptions, KYC.
- `search-discovery` — unified search, filters, ranking.
- `trust-moderation` — reputation, verification, reports, moderation.
- `i18n-rtl` — multilingual architecture, RTL, dialect metadata.

**Engineering quality**
- `platform-security` — authorization, hostile UGC, executable-content sandboxing.
- `testing-quality` — invariant-focused testing discipline.

## First checks after installing

1. Start Claude Code from the project root.
2. Run `/skills` and confirm all 17 appear.
3. Ask Claude to read the project specification and summarise which skills apply before any major change.

## Important

- Keep the current project specification documents in the repository where Claude Code can read them. The specification is the product authority; these skills encode its structural constraints.
- The commercial rules live in a **separate business specification document**. The `monetization-marketplace` skill mirrors its structure but the document itself remains authoritative.
- These skills deliberately do **not** convert future roadmap ideas into current requirements.
- When a skill and the specification disagree, the specification wins — and the skill should be updated.

## Local changes (v2.1-lisanhub, 17 September 2026)

- Applied owner decision R2: the platform stays entirely free until a final stage that combines subscriptions, payments and legal preparation. Updated `mvp-scope` (Commercial and Deferred sections) and `monetization-marketplace` (current-stage notice and Sequencing).

## Changes in v2.1

- Resolved the progress-persistence conflict: account and learning progress are now stored server-side free for every user; only offline downloads and heavy-content sync are paid. Updated `monetization-marketplace` and `mvp-scope` to match the revised specification.
- Added `CLAUDE.md` documenting the resolved decision so it is not reopened.

## Changes in v2

- Fixed the administrative rank names to match the specification exactly (Moderator, Administrator, Super Administrator, Platform Owner).
- Added the critical local-copy vs public-publication boundary: a Student can never publish anything to the community.
- Added personal upward-only lineage visibility (no sibling derivation tree).
- Added four new skills: `roles-permissions`, `community-chat-system`, `monetization-marketplace`, `mvp-scope`.
- Added CEFR sub-levels (A1.1–C2), skill-based exercise classification, and the specified learner conveniences.
- Added creator tooling, the graduated review ladder, the lightweight quality tag, and the outdated-expression report type.
