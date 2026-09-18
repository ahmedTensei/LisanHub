---
name: monetization-marketplace
description: Governs all commercial functionality - the two revenue layers, marketplace selling, paid-content protection, commissions, subscriptions, payouts, offline/sync as a paid service, and KYC requirements. Use whenever implementing anything involving money, paid access, or selling.
---

# Monetization and Marketplace

> **Current stage: nothing in this skill is built yet.** By owner decision R2 (`docs/decisions/resolved-decisions.md`) the platform is entirely free until a final stage that combines subscriptions, payments and the legal preparation. Until Ahmed opens that stage, do not create subscription, payment, entitlement, trial, referral-reward or paid-content code, tables or UI. The rules below describe how that final stage must be built, and two of them already apply today: progress persistence is free, and manual export is free.

The commercial model lives in a separate business specification document. Treat that document as authoritative; this skill encodes its structural rules so implementation does not drift.

## Two independent revenue layers

Never merge these; they have completely different logic and different authorization.

**1. Paid platform tools** — optional extras the platform itself sells to any learner (offline access and data sync, advanced statistics, extra review tools). Unrelated to who created the content. Requires **no** verification to purchase.

**2. Creator marketplace** — verified content creators selling paid content (courses, packages, resources) to learners.

The free learning experience stays primarily built on free community content. Payment generally buys convenience or optional premium content — it is never a precondition for learning a language on the platform.

## The golden eligibility rule

- Anyone can learn for free.
- Any user who chooses the Content Creator role can publish free content and derive from others' free content, with no fee and no prior verification. A Student publishes nothing at all.
- **Only a Verified Member** (individual or verified organization) can generate actual revenue or withdraw funds. This is final and has no exception.

Enforce payout eligibility as an explicit capability check, never as a role-name comparison.

## Paid content protection

Unlike free content, paid content published in the marketplace can **never** be copied or derived by any other user — not as a local personal copy, and not for publication. This protection is the foundation of the commercial model and must be enforced both technically and administratively.

A paid-content owner may expose a partial free preview (a first lesson, a limited portion of a resource) before purchase. The previewed portion is still not copyable or derivable.

When a very new user engages with relatively expensive paid content, a gentle prompt may suggest trying the free preview or comparing available content first — without blocking a direct purchase.

## Commission and sales models

- Platform commission ranges from 5% to 15% per sale, adjustable by administration according to seller type, product type, or promotional period.
- Different rates may apply to individuals, verified creators, organizations, educational institutions, or future partnership programs.
- Supported models: one-time purchase; monthly subscription chosen by the seller; and later annual subscription, free trial, cancellation with access until the paid period ends, auto-renewal, coupons, bundles, multiple price plans per product, shareable institutional subscriptions.
- **Monthly subscription products** require an extra administrative quality review before publication, beyond the normal check, to confirm the content delivers ongoing value that justifies recurring payment.
- Small earnings accumulate automatically to a reasonable minimum threshold before an actual payout is issued, reducing per-transaction processing cost.

## Progress versus heavy personal content

These are two different kinds of data with different size, cost, and policy. Conflating them is a design error.

**Account and progress data** — completed lessons, spaced-repetition due dates, activity streak, level, settings. A few kilobytes; storage cost is effectively zero.

**Heavy personal content** — copied lessons, edited card decks, files downloaded for offline use. Megabytes or more; real storage cost.

### Account and progress data is always free

Account and progress data is stored server-side for every registered user, free and with no subscription. Signing in from any device restores the learner's progress, streak, and level exactly as they left it.

This is deliberate. Losing months of progress because a learner changed phones is severe experience damage for near-zero cost saving, and it contradicts the principle that an account preserves the learner's journey. Never gate progress persistence behind a subscription.

### Offline access and heavy-content sync is the paid service

Downloading content for offline use, and syncing heavy personal content across more than one device, are together a single paid service. A learner studying online without downloading content pays nothing.

- Without an active subscription, heavy personal content stays local to the device it was created on, with no server-side backup.
- If a user subscribes and later lapses, they retain access to that content **on the same device**.
- If they switch devices while no subscription is active, that heavy content cannot be recovered on the new device. Their learning progress and account, however, return to them in full.

**Fairness invariant:** manual export of personal data (progress, cards, notes) to a file on the user's own device is always free and always available without any subscription. What is paid for is automated convenience for heavy content, never ownership of the user's own data and never preservation of their learning journey. Never implement a paywall that blocks manual export or progress persistence.

## Growth mechanics

- **Referral** — inviting a friend who actually joins and uses the platform grants both parties extra free days of the offline/sync service.
- **Free trial** — non-subscribers can trial offline/sync free for a limited period before committing.
- **Founding members** — contributors and learners joining within a limited launch window receive a full year of the paid features free, plus a permanent Founding Member badge. This window is time-limited by design; do not extend it to every new user.

## KYC

Identity verification is required **only** when a user wants to: sell content, withdraw earnings, create a formal organization, or request Verified Member status.

An ordinary student and a free content creator need no verification at all. Do not introduce a verification gate anywhere else — it directly harms signup conversion and contradicts the specification.

## Configurable, not hard-coded

Every commercial value — commission rates, price limits, eligibility conditions, verification requirements, payout thresholds — must be adjustable from the administration dashboard without a code change.

## Deliberately undecided

The following are expected parts of any payment model but are **not yet decided**. Do not invent an implementation and present it as the product decision; surface the gap instead:
- refund policy
- payment dispute handling
- payment failure handling
- exact payout schedule/frequency
- multi-currency and regional pricing
- taxes and payment-related legal obligations by seller/buyer country

## Sequencing

1. **Now, until the final stage:** a complete free platform, then user feedback and improvement. No commercial features at all (decision R2). Progress persistence and manual export are free, as always.
2. **Final stage, first:** legal and commercial preparation, then paid platform tools — offline access and heavy-content sync as a subscription, with trials, referral rewards and the founding members' benefit.
3. **Final stage, later:** the creator marketplace, commissions, payouts and KYC, after the transition criterion in mvp-scope is met.

The specification originally allowed the paid offline/sync tool in the first release; decision R2 moves it to the final stage.
