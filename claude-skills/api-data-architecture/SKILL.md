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

## File storage (ADR 0005, ADR 0008 — decision R13)

- **Supabase holds accounts and metadata; Cloudflare R2 holds every file** (packages, package assets, profile pictures, plugin definitions — drafts, versions and the core plugins — and future plugin bundles). No table holds a plugin document or learning content: rows name files by key and pin them by sha256. Supabase Storage is retired: no bucket, no storage policy, and `npm run db:verify` checks the old buckets are gone or inert. Never write a file to Supabase again.
- Feature code talks to `StorageProvider` (`src/modules/storage`) only; the provider is chosen by `STORAGE_PROVIDER` (`r2` in every real environment, `memory` for tests and sessions without an account). The R2 provider (`src/server/storage/r2-provider.ts`, aws4fetch SigV4, signed payload hash, conditional writes) is the only place that knows the vendor. Never import a vendor storage SDK from a feature.
- The database stores a relative object key (`area/<owner_id>/<uuid>.<ext>`, column `*_key`), never a URL or a bucket name. URLs are derived at read time. A database test rejects any `url`/`bucket` column.
- Two logical stores: `public` (served at `/api/media/<key>` or from the bucket's own domain when `R2_PUBLIC_BASE_URL` is set) and `private` (bytes handed out by a route that checked the actor; never a public URL).
- **The server is the gatekeeper.** R2 knows nothing about members, so ownership is decided before every read and write in the application layer (`src/server/packages/access.ts`, the account actions), on top of row level security on the metadata rows. Any new file feature adds its access check there and a test for it.
- `npm run storage:verify` creates the buckets when missing and round-trips a probe object; `.env.example` documents the variables. Never print or commit a key.

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
