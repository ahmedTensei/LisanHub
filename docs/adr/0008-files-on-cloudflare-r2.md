# ADR 0008 — Every file in Cloudflare R2, Supabase for accounts and metadata

- **Status:** adopted (18 September 2026), implementing decision R13. Completes ADR 0005 (the storage abstraction) without replacing it.
- **Context:** Ahmed decided that account data is stored on Supabase and that plugin, lesson, course and every other file is stored on Cloudflare R2, and that Supabase holds no package file. ADR 0005 had already made this move a configuration change rather than a data change: the database keeps relative keys (`packages/<owner>/<uuid>.lisanpkg`), never addresses or bucket names.

## Decision

| Item | Choice |
| --- | --- |
| Provider | `R2StorageProvider` in `src/server/storage/r2-provider.ts` through the S3-compatible interface, with SigV4 signing from `aws4fetch` (MIT, a few kilobytes, no dependencies). `STORAGE_PROVIDER=r2` is the default; `memory` for the tests and for a session without an account |
| The two buckets | `lisanhub-public` (profile pictures and whatever is shown publicly) and `lisanhub` (private: packages, their assets and plugin definitions; created by Ahmed under this name). `npm run storage:verify` creates them when they do not exist; `R2_JURISDICTION` matches the jurisdiction of the two buckets (the default today, and `eu` is possible for two new buckets) |
| Integrity | Every upload carries the payload hash in the signature (`x-amz-content-sha256`), so the store rejects bytes that do not match it; writes are conditional (`If-None-Match: *`) unless replacement is requested, so an immutable version file is never overwritten by mistake |
| Public | If `R2_PUBLIC_BASE_URL` is set (a custom domain on the public bucket) picture addresses are built from it directly; otherwise the app serves them from `/api/media/<key>` with fixed headers (`immutable`, `nosniff`, `sandbox`), because every key carries a new identifier at every upload |
| Private | Never a public address. A package is read on the server only (`src/server/packages/store.ts`) and handed to the player asset by asset through `/api/packages/<item>/assets/<name>` after the actor check (`src/server/packages/access.ts`). No download and no export (R14) |
| Supabase | Migration `20260918000400_retire_supabase_storage.sql` drops the `storage.objects` policies and the functions `storage_object_owner` and `package_readable`, and refuses to run if either bucket holds any object. The empty buckets are not deleted from SQL (Supabase refuses direct writes to the storage tables); they are removed once with the CLI command in `docs/SETUP.md`, and `npm run db:verify` accepts them being gone or empty and closed |

## Plugin definitions (added on 19 September 2026)

At Ahmed's request that Supabase hold no plugin or learning content, the plugin definition itself moved to files (migration `20260919000100_plugin_definitions_in_storage.sql`):

| File | Key | Who writes it |
| --- | --- | --- |
| The studio draft | `plugins/<owner_id>/<plugin_row_id>-draft.lisanplugin.json` | Every save in the studio rewrites it (`writeDraft`) then updates `plugins.draft_key/draft_sha256` |
| A submitted or published version | `plugins/<owner_id>/<file_id>.lisanplugin.json` (immutable) | `submitPluginVersion` writes the file first, then calls `submit_plugin_version(p_plugin, p_version, p_schema_version, p_definition_key, p_sha256, p_note)` |
| The two core plugins | `plugins/core/<plugin_id>-<version>.lisanplugin.json` | `npm run core:plugins:upload` from `plugins/core/*.lisanplugin.json`; the seeding migration writes the key and the hash only |

- `src/server/plugins/store.ts` reads the file and verifies that the hash of the canonical JSON equals the row's hash before any use (catalogue, player, package validation, administration review); a missing or altered file = an unavailable plugin, never an unpinned definition. An in-process cache keyed by the hash.
- The function `submit_plugin_version` rejects a key outside the plugin owner's folder, and the trigger `plugins_guard` rejects a `draft_key` outside the owner's folder.
- `tests/db/plugins.test.ts` proves that the plugin tables carry no JSONB column other than the translated disable message, and that the audit trail holds no definition body (migration `20260919000200` stripped the snapshots captured before the move).

## A note on the browser built into the Claude app

The built-in browser blocks any `iframe` with `sandbox="allow-scripts"` and without `allow-same-origin` (`ERR_BLOCKED_BY_CLIENT`), so the sandboxed player does not show in it. Ordinary browsers (Brave, Chrome, Firefox) display it. To verify the player inside that browser, `/play?parent=<origin>` is opened as a top-level page and a `render` message is posted to it through `postMessage` (the same guard checks pass because `window.parent === window`).

## What changed in the security model

In ADR 0005 the RLS policies on `storage.objects` enforced ownership from the key path even on a direct call to the storage API. R2 knows nothing about members, so **the server became the only gatekeeper**: no request reaches R2 except from an action or a route that has checked the actor and the RLS on the metadata rows (`content_items`, `profiles`). The R2 keys never leave the server, are never printed and never committed; `.env.example` documents the names only.

## Tests

- `src/server/storage/r2-provider.test.ts`: the shape of the signed requests, conditional writes, the mapping of store codes to platform codes, public and private addresses, and that a signed address does not carry the secret key.
- `tests/db/storage.test.ts`: no storage policy or function after the migration, the two former buckets neither accept nor show anything, and no `url`/`bucket` column in the database.
- `npm run storage:verify`: creates the two buckets when missing, then writes/reads/deletes a probe object in each on the real account.

## Consequences

- Moving to another S3 provider (MinIO locally, for example) is `R2_ENDPOINT` only.
- Personal data (pictures) passes through the server when there is no custom domain; once the domain is added it is served from Cloudflare directly without a code change.
- Code plugin bundles (the maturity phase) will be stored in the private bucket with the same logic that stores the declarative definitions today.
