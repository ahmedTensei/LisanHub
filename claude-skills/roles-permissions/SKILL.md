---
name: roles-permissions
description: Authoritative reference for the platform role model - Guest, Student, Content Creator, Contributor, Teacher, Verified Member, organizations, and the four administrative ranks. Use when implementing authentication, authorization, role selection, capabilities, or any permission check.
---

# Roles and Permissions

The system keeps six concepts permanently independent. Never collapse them into one another:

| Concept | Meaning |
|---|---|
| Role | responsibility |
| Capability | the ability to perform a specific action |
| Ownership | who may edit a given item |
| Verification | legal/identity trust |
| Reputation | accumulated contribution |
| Trust score | variable reliability |

Authorization is decided by capabilities and policies — never by reading a role name inline in business logic, and never by reputation or verification status.

## Primary roles — exactly one per user

**Guest** — not signed in; browses public content only.

**Student** — any signed-in user, by default.
- Can study, track progress, save content, rate, comment, create and join study groups, report violating content, and send improvement feedback directly to a content creator.
- Can **never** publish or share any content with the community.
- May copy and edit free content, but strictly as a local personal copy on their own device (see ugc-content-system).

**Content Creator** — creates lessons, courses, tests, vocabulary and grammar cards, reading/listening sets, flashcards, learning paths, articles, and educational resources. Edits only their own content and copies they derived.

**Contributor** — creates extensions, learning packages, developer tools, new exercise types, and integrations. Edits only their own contributions.

**Hard rule:** a user cannot hold Content Creator and Contributor at the same time. One path only.

## Teacher

A separate rank from Content Creator, reserved for real verified educators. Never granted automatically.

- Requires proof of teaching qualifications, educational certificates, proof of employer, or an institutional recommendation.
- Possible tiers: Verified Teacher, Certified Teacher, University Professor, School Teacher, Language Instructor.
- Grants **no moderation powers**. It grants education-specific privileges only: publishing official content and official learning paths, participating in curriculum review, guiding content creators, issuing educational recommendations.
- A verified teacher may define virtual "office hours" during which they are directly available to student questions through chat.

## Verified Member — a trust layer, not a role

Can sit on top of any primary role, or on an entire organization. Obtained through formal identity verification (KYC) plus manual administrative review.

- Grants a visible verification badge and higher priority in search results.
- Grants **no administrative or moderation capability whatsoever**.
- Verification and reputation are fully independent: a member can stay verified even if their reputation drops, until administration explicitly revokes verification.
- Its commercial privileges (selling, receiving payouts) belong to the monetization-marketplace skill and the separate business specification.

## Organizations and educational institutions

Schools, institutes, and companies pass a distinct institutional verification process. Institution-specific capabilities include:
- a group progress dashboard covering all their students at once;
- an institution-private learning path, visible only to their students and not published publicly;
- joining via a single institutional code or link rather than individual invitations;
- a periodic automatic activity summary for the institution's administrator;
- an officially recommended list curated from the platform's public content;
- an Observer account for a supervisor who tracks student progress without teaching.

## Administrative ranks

Exactly four ranks may edit content they do not own:

1. **Moderator** — first rank able to edit any content; steps in when a creator does not respond to repeated justified reports. Can edit, hide, restore content, and handle the moderation queue.
2. **Administrator** — all moderator powers, plus user management, role approvals, category and featured-content management, general platform settings.
3. **Super Administrator** — full system management including managing administrators and platform-wide settings.
4. **Platform Owner** — granted to no one else. Platform ownership transfer, licensing, core settings, platform-wide feature toggles.

Every other role — Student, Content Creator, Contributor, Teacher, even Verified Member — is limited to its own content.

## Role progression

Guest → Student → (Content Creator or Contributor) → optionally Verified Member → Moderator → Administrator → Super Administrator → Platform Owner.

This shows possible paths, not mandatory steps. A user may remain a Student indefinitely, or become a Content Creator and never request verification. Administrative ranks are assigned directly by administration and do not require being verified or a creator first.

## Ownership rule

Every content item always has a clear owner plus an audit record of who created, edited, published, or deleted it and when. Default: a user edits only what they own. The only exception is the four administrative ranks above.

## Implementation guidance

- Resolve permissions through a capability/policy layer, not by string-comparing role names in feature code.
- Enforce every ownership and authorization rule on the server; client-side checks are presentation only.
- Adding a new role must not require touching unrelated feature code.
- Never let reputation, trust score, badges, verification, Teacher status, or Contributor status widen edit rights.
