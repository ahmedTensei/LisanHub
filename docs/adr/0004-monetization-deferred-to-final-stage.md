# ADR 0004 — Deferring subscriptions and payments to the last phase

- **Status:** adopted (17 September 2026), applying decision R2.

## Context

The specification activates one paid service from the first release (offline access and heavy-content sync). Ahmed decided to build a complete free platform first, collect user feedback and improve, then subscriptions and payments with the legal preparation in the last phase.

## Decision

1. Removed from the initial migration: the types `entitlement_product` and `entitlement_source`, the tables `entitlements` and `personal_heavy_content`, the function `has_active_entitlement`, the settings `founding.benefit_days` and `trial.offline_sync_days`, and the flags `offline_sync`, `marketplace` and `executable_content`.
2. The module `src/modules/entitlements` was removed. `npm run setup` deletes it automatically from older copies.
3. The table `product_feedback` and the module `src/modules/feedback` were added to collect users' feedback about the platform.
4. The field `content_items.is_paid` stays (always `false`) because the rule that paid content cannot be derived is part of the ownership model from day one.
5. The database test "no subscription, payment or entitlement tables" prevents phase C from leaking into what precedes it.

## The design kept for phase C

- `entitlements(id, user_id, product, source, starts_at, ends_at, granted_by, created_at)`, the first product `offline_heavy_sync`, and the sources: `founding_member`, `trial`, `referral`, `paid`, `admin_grant`. The client never writes to it; reading is for the owner and the administration.
- `has_active_entitlement(user, product)`: active if it has started and not ended.
- `personal_heavy_content(id, user_id, kind, source_item_id, body, client_updated_at, updated_at)` with RLS that requires an active subscription; never indexed and seen by nobody but its owner.
- Editable settings: the duration of the founders' benefit (365 days proposed in the specification), and the duration of the free trial (a week, for example).
- The order of phase C: legal preparation (company, terms, privacy, ANPDP, content licence) ← the payment provider (Q4) ← the subscription to the paid service ← later the marketplace and KYC.

## Consequences

- The first users get every feature of phases A and B free.
- The value of the future subscription rests on offline access and heavy-content sync, and is measured in phase B through user feedback before it is built.
