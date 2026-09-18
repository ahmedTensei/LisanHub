# LisanHub — Project Instructions

Community-driven language learning platform.

## Source of truth

The project specification documents in this repository are the product authority. The skills in `.claude/skills/` encode their structural constraints. When a skill and the specification disagree, the specification wins and the skill should be updated to match.

Three specification documents exist:
- **Project Specification** — the product and platform itself, with no commercial content.
- **Business Model and Subscriptions** — all monetization, marketplace, and subscription rules.
- **Full Document** — both of the above merged, for when the complete picture is needed in one place.

## Resolved decisions

### Progress persistence versus paid sync (resolved)

Earlier there was an open conflict about whether learning progress should live on the server for all users or only for subscribers. **This is now decided.** The specification has been updated and the `monetization-marketplace` skill matches it. The rule is:

**Account and learning progress data is stored server-side for every registered user, free, with no subscription.** Completed lessons, spaced-repetition due dates, activity streak, level, and settings all persist and restore on any device at sign-in. This data is tiny and its storage cost is effectively zero.

**Offline downloads and syncing heavy personal content across devices is the paid service.** Copied lessons, edited card decks, and downloaded files fall here. Without a subscription this stays local to one device.

Consequence when a user changes devices without an active subscription: heavy personal content is not recoverable, but their progress and account return in full.

Manual export of personal data is always free, and progress persistence is never paywalled.

No further decision is pending on this topic. Do not reintroduce the older "everything local without a subscription" rule.

## Working rules

1. Read the relevant skills before implementing. Start with `project-governance` and `mvp-scope` for anything non-trivial.
2. Classify every request by roadmap stage before building. Never promote a deferred feature into the MVP.
3. Never let an undecided item become a decision by inference. Surface the gap instead.
4. Authorization goes through the capability layer, never inline role-name checks. See `roles-permissions`.
5. A Student can never publish anything to the community. Local personal copies and public publication are two distinct operations. See `ugc-content-system`.
