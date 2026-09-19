# ADR 0005 — Isolating the storage service and relative file keys

- **Status:** adopted at Ahmed's request (17 September 2026). **Updated on 18 September 2026:** the actual provider became Cloudflare R2 (R13, ADR 0008), and Supabase Storage is retired; what follows remains true for the interface and the keys, and what concerns the `storage.objects` policies no longer applies.
- **Context:** the platform will upload and serve files (lesson pictures and avatars in S2, audio later, personal data export). The provider at the time was Supabase Storage, but the team might move to Cloudflare R2 or S3 in the future for cost or hosting reasons (Q12). The `api-data-architecture` skill treats storage as a boundary that must be replaceable.

## Decision

1. **One storage interface:** feature code deals only with `StorageProvider` (`src/modules/storage/provider.ts`): `upload`, `remove`, `publicUrl`, `signedUrl`. No feature imports a provider SDK directly.
2. **The provider is chosen by configuration:** `src/server/storage/index.ts` reads `STORAGE_PROVIDER` (`supabase` was the default, `memory` for the tests, `s3` reserved for R2/S3/MinIO) and the bucket names `STORAGE_BUCKET_PUBLIC` and `STORAGE_BUCKET_PRIVATE`. Moving to a new provider = adding one provider file and changing environment variables.
3. **Two logical stores:** `public` (public assets with a stable link, such as lesson pictures) and `private` (readable only through a short-lived signed link, such as export files). Each store maps to one bucket at the provider.
4. **The database keeps a relative key only, never a link:** the column is named `*_key` (or a `{ store, key }` reference inside JSON) in the form `avatars/<owner_id>/<uuid>.webp` — no leading slash, lowercase, no `..`. The link is derived at read time through the provider. Moving the files therefore needs no row update.
   - A test in `tests/db/rls.test.ts` fails if a column named `url` or ending in `_url` appears in the public schema.
   - `src/modules/storage/keys.ts` is the only source for building and checking keys; every key carries its owner's identifier in the path so that ownership policies can be written on `storage.objects` later.
5. **The buckets and their policies existed since S1** (migration `20260917000500_storage_buckets.sql`): `media-public` (public, 10 MB, pictures and audio) and `media-private` (private, 50 MB, + JSON). The `storage.objects` policies read the owner identifier from the second segment of the key: writing inside the user's folder only, public reading for the public bucket, and the private one for its owner and oversight. Tested in `tests/db/storage.test.ts` through a simulation of the `storage` schema in `tests/db/supabase-stub.sql`.

## Consequences

- Adding a new file type = adding it to `EXTENSION_BY_CONTENT_TYPE` and an area to `STORAGE_AREAS`.
- The tests use `MemoryStorageProvider` without a network.
- Provider-specific image transformations (such as Supabase's) are treated as an optional improvement behind the same interface, not as a dependency.
- Not decided yet: size limits per area (they become `platform_settings` settings with S2; bucket limits are a structural ceiling only), the CDN policy, and an application-level file registry (a table indexing keys, owner and size) to be added with the first upload feature.
- Schema-readiness tests in `tests/db/rls.test.ts`: every public table has RLS and a primary key, user identifiers are `uuid`, and there are no link columns.
