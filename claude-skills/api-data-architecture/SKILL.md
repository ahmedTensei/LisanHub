---
name: api-data-architecture
description: Designs stable application APIs, data access boundaries, persistence models, provider abstractions, migrations, and replaceable infrastructure for the language-learning platform.
---

# API and Data Architecture

## Application boundaries

Keep UI concerns separate from:
- domain rules
- application services
- persistence
- external providers

UI components should call stable application APIs/services rather than directly implementing business rules.

## Data ownership

Each bounded context owns its authoritative data. Cross-context consumers should use explicit contracts rather than reaching into another context's tables/models as an undocumented shortcut.

## Provider abstractions

The project favors replaceable infrastructure/providers where appropriate.

Create provider interfaces when an external dependency is intended to be replaceable, such as:
- storage
- AI
- email
- search
- payment or payout providers when applicable

Do not create abstractions for every trivial library; abstraction should correspond to a meaningful replacement boundary.

## File storage (ADR 0005)

- Feature code talks to `StorageProvider` (`src/modules/storage`) only; the provider is chosen by `STORAGE_PROVIDER`. Never import a vendor storage SDK from a feature.
- The database and content bodies store a relative object key (`area/<owner_id>/<uuid>.<ext>`, column `*_key` or a `{ store, key }` ref), never a URL. URLs are derived at read time. A database test rejects any `url`/`*_url` column.
- Two logical stores: `public` (stable URLs) and `private` (signed URLs only).

## API design

APIs should:
- validate inputs
- enforce authorization
- return stable domain/application errors
- avoid exposing internal database structures
- use idempotency for operations that can be retried where needed
- make pagination/filtering explicit for collections
- avoid leaking hidden or unauthorized resources

## Database design

Prefer:
- explicit ownership
- stable identifiers
- timestamps/audit fields where required
- foreign-key/reference integrity
- unique constraints for business invariants
- indexes based on actual query patterns
- migrations that can be safely applied and rolled back or forward-fixed

Do not duplicate authoritative fields solely for convenience without defining synchronization semantics.

## Workflow integration

Multi-step operations such as publishing, moderation, payouts, derivation, or verification should use the application's workflow/process layer rather than duplicating orchestration in multiple endpoints.

## Migration discipline

For schema changes:
1. identify existing data;
2. define compatibility behavior;
3. migrate safely;
4. update readers/writers in the correct order;
5. test old and new states where a transition period exists.

## No accidental coupling

Do not let an API endpoint become the owner of a domain rule simply because it is the current caller. Domain invariants belong to the domain/application layer.
