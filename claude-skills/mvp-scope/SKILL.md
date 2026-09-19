---
name: mvp-scope
description: Guards the first-release scope and prevents deferred roadmap features from silently entering the MVP. Use before starting any new feature, when estimating work, or when a request sounds larger than the current stage.
---

# MVP Scope Guard

The specification defines a deliberately small first release whose purpose is to test the core idea with real users — not to build the full platform at once. Before implementing anything, check which side of this line the request falls on.

The long-term direction is a creator building a Duolingo-class course from plugins and packages (decision R12); the first release only lays the ground for it (plugins, packages, courses, then the learner experience in S3). The professional administration Ahmed described on 2026-09-18 (decision R17) is split: oversight pages and content moderation with a reason are in place now; the case system (assignment, handover, help, replacement, warnings) is **S4** and must not be started earlier.

## Included in the first release

**Roles** — Guest, Student, Content Creator and **Contributor** (decision R10: Contributors build plugins and templates in the standalone `/studio`, from S2). Verified Member is not activated yet, so a Contributor's plugin needs moderation review before it reaches the public catalogue.

**Content**
- **Every kind of learning is a plugin, from the first release (decision R7).** The plugin is built first, then the content and the curriculum for it. Content is a portable package file, rendered in the sandboxed player, never platform-specific rows. In phase A plugins are declarative (no code); Contributors author them in `/studio` and publish after review (R10), and Content Creators build packages on top. See `plugin-architecture`.
- Entirely free content: lessons, simple text exercises, vocabulary cards — all delivered as packages of the core plugins.
- No cap on language pairs from day one. A user may pick any pair even when no content exists for it yet, becoming the first to build that community. Keep the structure fully flexible for this.
- Copy-and-derive for free content active from the start — it is the primary mechanism for growing content without a large central team.
- Content review performed manually and directly by the founding team.
- The lightweight quality tag ("Reviewed by the Founding Team" vs "New Community Content") active from day one; it is cheap to build and protects new-learner trust without delaying publication.

**Learning experience**
- Basic browsing and search. No full smart recommendation engine required yet.
- Basic progress tracking. Not the complete statistics and motivation set.
- Full browsing freedom (no single mandatory path) applied from the start — this is a core design principle, not a later enhancement.

**Community**
- One basic group chat, or a very small number, rather than covering every language pair.
- Direct report/feedback-to-owner mechanism active from the start.

**Commercial — none (owner decision R2)**
- Server-side persistence of account and learning progress, free for every registered user, from day one.
- The platform is **entirely free** until the final stage. There are no subscriptions, payments, entitlements, trials, referral rewards, paid content or paid offline/sync in the first release or in the feedback-and-improvement stage. The specification's exception (paid offline access and sync from the first release) is superseded by decision R2 in `docs/decisions/resolved-decisions.md`.
- The installable web app (PWA) is allowed; offline downloads and heavy-content sync arrive with subscriptions in the final stage.
- Founding members still receive the permanent Founding Member badge; any commercial benefit attached to it is applied when subscriptions launch.

**Administration**
- Basic manual ability to hide or stop violating content. Not the full feature-flag system.

## Deferred — do not build these into the MVP

**Final stage only (commercial and legal preparation, decision R2):** subscriptions, payments and payment providers, entitlements, free trials and referral rewards, paid offline downloads and heavy-content sync, the formal commercial legal setup. Build none of these, and create no tables, APIs or UI for them, until Ahmed opens the final stage.

- The creator marketplace, course sales, and commissions.
- Verified Member status and KYC requirements.
- The Teacher rank with its formal requirements, and verified educational institutions.
- **Any executable code inside a plugin** — kept **completely disabled** until verification and the strict security review policies are mature. The plugin *architecture* is in the MVP (R7), and **declarative plugins authored by Contributors are in the MVP too** (R10, with review); what stays deferred is code inside plugins and unreviewed third-party publishing.
- Multiple group chats per language pair, and advanced study groups.
- Multiple storage plans and advanced creator analytics.
- Advanced platform administration (custom communication messages, scheduling, precise targeting, full emergency mode).

## Cold start

**No fake content (decision R8).** Seeding demo lessons, sample creators or invented activity to make the platform look alive is forbidden. The cold start is solved by recruiting real founding contributors and learners and by the owner authoring the first real content; everything a visitor sees is either real or an honest empty state.

The first release must ship alongside a deliberate cold-start plan, because a community platform launches empty: hand-picked founding contributors invited before public launch, a small but high-quality initial content set, founding learners giving direct feedback, and full transparency that the platform is in a trial stage.

Founding members receive a permanent Founding Member badge, plus the commercial benefit described in monetization-marketplace.

## Transition criterion

Opening the marketplace and the remaining deferred features must rest on actual evidence from the first release: founding contributors and learners staying active without artificial incentives, visible quality in content copied and derived by new users, and genuine demand from creators to earn from their work. Do not treat these features as automatically due after a period of time.

## Behaviour when a request exceeds scope

State plainly which stage the requested feature belongs to, what the MVP already covers in that area, and what a minimal in-scope version would look like. Do not quietly implement a deferred feature because it is convenient or because the surrounding code makes it easy.
