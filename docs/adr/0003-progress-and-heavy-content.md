# ADR 0003 — Separating progress data from heavy personal content

- **Status:** adopted, applying decision R1. **The paid part is deferred to phase C by decision R2.**

## Decision

- Progress data lives in per-user tables (`progress`, `review_states`, `activity_days`) with "owner only" RLS and without any subscription condition. This is applied now.
- A student's local personal copies stay on their device, and are neither sent to the server nor indexed.
- In phase C only: a table for heavy content on the server conditioned on an active subscription, and an entitlements table the client cannot grant (its sources: founding member, trial, friend invitation, payment, administrative grant). The design is kept in ADR 0004.

## Consequences

- There are no commercial tables in the database before phase C, and an automated test prevents them from being added by mistake.
- The fate of the data after a subscription ends is an open decision (Q8).
