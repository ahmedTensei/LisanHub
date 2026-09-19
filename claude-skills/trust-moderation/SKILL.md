---
name: trust-moderation
description: Implements reputation, ratings, verification, reports, moderation, abuse handling, and trust signals without turning reputation into authorization.
---

# Trust, Reputation, and Moderation

## Separate trust from permission

Reputation, ratings, verification badges, and trust signals are not authorization.

Authorization must be determined by explicit capabilities/policies.

## Reputation

The specification describes reputation as a community signal influenced by useful contributions such as:
- high-quality content
- useful accepted translations/derivations
- helpful comments
- community votes
- educational contributions

Do not let reputation directly grant edit-any-content or administrative capabilities.

## Roles and ownership

The current specification reserves editing of other users' content to exactly four administrative ranks:
- Moderator
- Administrator
- Super Administrator
- Platform Owner

All other users remain restricted to their own content or eligible derived copies.

Do not broaden this rule because a user is verified, a teacher, a contributor, or highly reputable. Administrative ranks are assigned directly by the platform administration; they are not earned through reputation, verification, or content-creation history.

## Reports

Reports should have:
- reporter
- target
- reason/category
- evidence/context where appropriate
- status
- timestamps
- moderation decision
- audit trail

Separate reporting from final moderation action.

## The administration area is search-first and case-based (decision R17)

- The owner and super administrators oversee everything; every other rank works on **cases**: a report, a support request, a publish request, or an item/member assigned to them. A moderator opens the case, sees exactly what it is about (the item with its preview, the member with their account state and content, the derivation chain if any) and acts from there. No page lists all content or all members to a rank that does not hold `admin.oversee_all`.
- **Case lifecycle (S4):** open → assigned (by a top rank) or accepted (by the moderator) → in progress → handed over (transfer, help request from a colleague, reassignment after no response, member's request for another moderator) → closed with a decision. Each step is a row in an audit trail with who, when and why; a case is never edited by someone it is not assigned to unless one of those transitions happened.
- **Actions on content are reversible and explained:** hide with a reason the owner reads (already: `moderate_content_item()`, `content_items.moderation_note`), restore, warning to the owner (S4, needs the notification channel — open decision Q24), request an edit; deletion is never the first tool.
- **Previews are part of moderation:** a reviewer sees a plugin run in the sandboxed player before approving it, and sees a package as the learner would before deciding on a report.

## Personal safety

Support personal mute/block behavior where specified, in addition to platform moderation.

## Verification

Verification must be explicit and policy-driven. Do not fabricate identity or native-speaker verification. KYC requirements belong to the documented business/legal stage where they are actually required.

## Moderation quality

Avoid irreversible destructive actions when a reversible state such as hidden, restricted, quarantined, or archived is sufficient.

Every significant moderation action should be auditable.

## No forum drift

Do not introduce a permanent forum/feed moderation system; the current community model is centered on chats/groups, discovery, collaboration, and marketplace.
