---
name: ugc-content-system
description: Governs community-created educational content, creator ownership, review, ratings, reports, publishing, copying, and collaboration. Use whenever implementing content creation or community content workflows.
---

# UGC Content System

Community-created educational content is a core part of the platform.

**Decision R7 — content is a package built for a plugin.** There is no built-in lesson type. A creator picks a plugin, authors a package (a portable `.lisanpkg` file validated against that plugin's schema), and the platform stores metadata plus the file. Everything below — ownership, the local-copy/publication boundary, the lifecycle, versions and rollback — applies to **packages**. Copying and derivation are file copies plus a provenance record. Read `plugin-architecture` before implementing any authoring, publishing or copying flow.

**Decision R8 — no fake content, ever.** The platform ships with zero content. No demo lessons or packages, no placeholder creators, no invented ratings or reviews, no filler text. Empty states state plainly that nothing exists yet and invite the first contribution; counters and quality signals appear only when a real query produces them. The cold start is solved by real people authoring real content, never by seeding.

## Ownership

Every published content item must have a clear owner and audit history covering creation, modification, publication, and deletion.

Default rule:
- users modify their own content;
- users may modify derived copies they own;
- administrative editing of other users' content is restricted to the explicitly authorized administrative ranks.

Do not grant editing rights merely because a user has reputation, verification, creator status, or contributor status.

## Local copy versus public publication

This is a hard boundary in the current specification and a frequent source of implementation errors.

- **Publishing to the community** (indexed in search/discovery, has its own public page, attributed to an owner) requires the Content Creator role. A Student can never publish or share any content with the community — not original content, and not a modified copy of someone else's content.
- **Local personal copies** are different. A Student may copy and edit eligible free content, but the result stays entirely local to that user's device for personal use. It must never appear to another user and must never be indexed by search or discovery.
- Holding a local derived copy does not change the user's primary role. A Student stays a Student until they explicitly choose the Content Creator role.

When implementing copy/derive features, model these as two distinct operations with different authorization checks. Do not implement a single "copy" action that silently publishes.

## Creator and contributor distinction

Keep these paths separate:
- Creator: creates educational content.
- Contributor: creates technical additions, packages, developer tools, new exercise types, integrations, or similar extensions.

The specification states that a user cannot simultaneously choose Creator and Contributor.

Do not merge these concepts for convenience.

## Content lifecycle

Model explicit states as appropriate:
- draft
- submitted/reviewable
- published
- archived
- removed/deleted

Do not make publication equivalent to creation.

## Creator tooling

The specification requires these authoring affordances:
- a quick-start template so a new lesson does not begin as a blank page
- a learner-perspective preview showing exactly what the learner will see, before publishing
- multiple simultaneous drafts
- an optional public wish-list on the creator's profile announcing planned future topics
- struggle-point analytics showing precisely where learners stop or repeatedly fail inside a lesson
- a vacation/paused-maintenance marker so a creator who steps away does not appear to be silently ignoring accumulated reports
- an edit history with rollback to a previous published version

## Review model

Review responsibility evolves as the platform matures rather than being one fixed mechanism:
1. early on, the founding team reviews published content manually and directly;
2. as the community grows, review shifts to community signals (ratings, reports, direct feedback);
3. when finer judgement is needed, weight the assessments of members with higher trust and reputation — without creating a formal reviewer rank.

Text-based educational content publishes without strict prior administrative approval. Executable content (code, interactive extensions) never publishes automatically — see platform-security.

A lightweight, non-blocking quality tag accompanies each item ("Reviewed by the Founding Team", "New Community Content", "Community Trusted"). It is advisory only and must never delay or block publication.

Free content staying published is not unconditional: administration may reduce visibility of low-quality, duplicate, or repeatedly and justifiably reported content, or remove it when necessary.

## Reporting types

Distinguish a plain error report from an **outdated expression** report — an expression that was correct when published but has since fallen out of common use. This is an aging signal, not a mistake, and should not be handled identically.

Users may also mark the precise sentence or word a report refers to, instead of leaving a general comment on an entire lesson.

## Community quality

Support the specified mechanisms:
- ratings
- comments/feedback where applicable
- reporting mistakes or abuse
- review
- trust/reputation signals
- derivation/copying
- attribution
- content history

Reputation is a community signal; it does not automatically grant authorization.

## Licensing and legal boundaries

Respect the specification's distinction between:
- platform rights to store/display/transmit content,
- creator ownership of intellectual property,
- explicit licensing for freely reusable content,
- contractual protection for paid content,
- copyright reports and disputes.

Do not invent a universal irrevocable license.

## Deletion

If source content is deleted, do not automatically destroy derived copies when the specification permits them to remain. Preserve provenance/attribution according to the lineage rules.

## Anti-patterns

Do not build:
- a centralized company-authored curriculum as the only content source;
- forum-style permanent posts as the default community model;
- global edit access for ordinary creators;
- hidden ownership transfers;
- untraceable content copies.
