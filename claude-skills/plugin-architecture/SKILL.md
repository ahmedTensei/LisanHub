---
name: plugin-architecture
description: Governs the plugin-first architecture for all learning content — the plugin contract, the portable content package format, the sandboxed player and its message bridge, and who may publish a plugin. Use whenever implementing, extending or reviewing anything that renders, authors, evaluates, stores, copies or exports learning content.
---

# Plugin Architecture (decision R7)

The platform contains **no built-in kind of learning**. For every kind of learning activity, the **plugin** is built first; the content and the curriculum are then built **for that plugin**. Content is a **separate file** the platform recognises, and it is rendered and evaluated in a **sandbox that can never reach user data**. Reason: copying and derivation (see `content-lineage`) become file operations, and offline sync in the final phase becomes possible at all.

This supersedes the specification's placement of plugins in the maturity phase. The specification's other rule stands: **executable content never publishes automatically**.

## Three layers — never collapse them

1. **Plugin** — defines a *kind* of activity: the activities it provides, the JSON Schema of its content, its authoring fields, its scoring rules, its own UI strings per locale.
2. **Package** — one self-contained content file built *for* one plugin (a lesson, a card deck, a drill).
3. **Curriculum** — an ordered set of packages inside a course; each package belongs to exactly one plugin.

The platform owns identity, capabilities, progress, search, moderation and lineage. It owns no kind of learning.

## Plugin contract v1 — declarative in phase A

Fields: `plugin_id` (slug), `version` (semver), `schema_version` (integer), `activities[]`, `content_schema` (JSON Schema 2020-12), `authoring_fields` (editor field descriptors with translated labels), `scoring` (references the platform's reference evaluators), `assets_allowed` (`image` only for now), `capabilities_required` (**must be empty**).

- No user-supplied code in phase A. A plugin that declares any required capability is rejected.
- The contract does not change when code plugins are opened later, so nothing about the architecture moves at that point.
- Adding a new activity kind means shipping a plugin, **never** adding a branch to platform rendering code.

## Package format `.lisanpkg` (a single zip)

- `manifest.json` — `format: "lisanhub.package/1"`, `package_id`, `version`, `plugin: { id, compatible_versions }`, `schema_version`, `language_pair { source, target, dialect? }`, `cefr`, `skills[]`, `tags[]`, `title`, `summary`, `license`, `author { user_id, username, display_name }`, `provenance` (on derivation: `{ package_id, version, sha256, author }`), `items_count`, `created_at`, `sha256`.
- `content.json` — the items. **Every item carries a stable `item_id`**, because progress and spaced repetition are keyed to it. Never renumber items on edit.
- `assets/…` — relative paths only. No absolute URLs, no network references inside a package.

Storage and indexing:

- The package file is stored through `StorageProvider` (ADR 0005) under a key that carries the owner id; the database stores **metadata, the package key, its sha256 and the plugin reference** — never the content itself, never a URL.
- Each row in `content_versions` points at a package key and hash, so rollback is a pointer change.
- Search in phase A covers metadata only (title, summary, tags, level, language pair). Indexing item text is a separate, later decision.

## Two authoring surfaces — never merge them

1. **Plugin Studio** — a **standalone page at `/studio`, not a section of `/admin`** (decision R10), open to **Contributors**, verified contributors and the platform owner: creates and versions **plugins and their templates** from inside the platform, with no code and no SQL. A guided form picks from a catalogue of field types (short text, long text, item list, single/multiple choice, matching pairs, ordering, blank-in-text, image with alt text) and **generates** `content_schema` and `authoring_fields`; pasting raw JSON Schema is an advanced escape hatch, not the default path. Draft → contract validation (fail closed) → preview in the **same sandboxed player** with a throwaway item that is never persisted → publish an append-only version with its sha256 → kill switch. **Members never import or export plugins or packages** (decision R14): content and plugins move through the community, inside the platform. The only file format is internal — the core plugins are written by `scripts/core-plugins.ts` to `plugins/core/*.lisanplugin.json`, seeded by a generated migration (keys and hashes only) and uploaded to the store by `npm run core:plugins:upload`. **A definition is a file in the store, never a document in the database** (decision R13): the studio draft and every submitted version are `.lisanplugin.json` objects under the owner's folder, rows carry `draft_key`/`definition_key` with a sha256, and `src/server/plugins/store.ts` verifies the hash on every read.
2. **Content editor** (content creators): builds a **package** for an existing plugin, starting from one of that plugin's templates, with fields generated from `authoring_fields`.

A template is part of the plugin definition (`templates[]`): translated name and description plus an empty structure with hint labels — **never sample sentences** (R8). Templates follow the plugin's version.

Who may do what in the studio (R10): every Contributor authors, edits and previews **their own** plugins and templates; **publishing to the public catalogue** goes through a publish request and moderation review in phase A, and becomes direct for a **verified** contributor once verification exists; **disabling or hiding** a plugin stays with moderation and the owner. Each plugin has an owner and is attributed to them. A member is either a Content Creator or a Contributor, never both, and switching is an explicit, server-verified step.

The studio never accepts code while plugins are declarative; code plugins stay closed until verification and security review.

Dogfood rule: the core plugins are produced **by the studio pipeline** (`scripts/core-plugins.ts`), then written to `plugins/core/`. If the studio cannot express a core plugin, the contract is incomplete — do not hand-write the plugin around it.

Names and descriptions (decision R16): the **English** name and description of a plugin, an activity and a field are required; Arabic and French are optional translations that fall back to English. The same rule names packages and courses (`title` in Latin script, `translations` for the rest).

Every package belongs to exactly one language pair and a course holds packages of its own pair only (decision R15, enforced by a trigger); learners of one pair never meet material of another.

## Validation before a package is accepted — all of these must fail closed

Validation lives in a framework-free module with tests, and runs server-side on every save and on publish:

- size over the configured limit; item count over the configured limit; asset count or single-asset size over the limit (all of these are `platform_settings`, never constants);
- any entry with `..`, an absolute path, a symlink, or a path outside the package root;
- an asset whose real content type does not match what the manifest claims (sniff the bytes, not the extension);
- `content.json` that does not validate against the plugin's `content_schema`;
- a manifest declaring a plugin or `schema_version` that does not exist, or a required capability;
- a sha256 that does not match the package contents.

## Isolation — structural, not a setting

- Rendering and evaluation happen inside an `iframe` with `sandbox="allow-scripts"` and **without** `allow-same-origin` (opaque origin: no cookies, no storage, no access to the platform page), with a strict CSP (`default-src 'none'`, `connect-src 'none'`, `img-src blob:`).
- The bridge is `postMessage` with a small, Zod-validated message set: platform → player `render` / `check` / `reset`; player → platform `ready` / `height` / `answer` / `result` / `error`.
- **No user data crosses the bridge**: no user id, email, display name, username, locale preference beyond the rendering locale, progress, review state, settings or session token. A message carrying such a field is a bug that a test must catch.
- Progress, streaks and FSRS scheduling are computed and stored by the platform. A plugin never learns who is answering, or how they answered before.
- One code path: the same sandboxed player serves the editor preview, the learner experience and derived content. There is no privileged "internal" path for core plugins.

### The plugin is untrusted too, not only the content

Isolation covers the plugin itself — including the plugins we write. This is the foundation that later verification is added *on top of*, not a stand-in for it.

- **Platform code never imports a plugin file.** No `import`, no bundling into the app. A plugin's definition and files are data and assets handed to the player document, and each version is pinned by sha256 that the player verifies before use (plus `integrity` for standalone files once code plugins open).
- **No plugin logic runs in the platform process** — not in the platform's page, not in the server process. The **authoritative score is computed server-side** by the platform's reference evaluators from `content.json` and the learner's answer. A result reported by the frame is for instant feedback only: never stored, never trusted. When code plugins open, server-side evaluation runs in an isolated worker with time and memory limits, no network and no filesystem — or stays advisory.
- **One frame per activity.** Two plugins never share a frame, state or memory, and the opaque origin keeps one plugin out of another's storage. No shared globals, no frame-to-frame messages.
- **Zero capabilities:** no network, storage, camera, microphone, file upload or clipboard. Every future capability is declared in the contract and mediated by a platform broker that checks and limits it — never by opening a permission inside the frame.
- **A kill switch per plugin and per version** takes effect immediately without a deployment: it blocks authoring and playback, shows the learner a clear translated message, and damages no existing package.
- **The player origin comes from configuration** (`PLAYER_ORIGIN`), so the player can move to its own subdomain before launch (open decision Q20) with no code change.
- **Verification never weakens the sandbox.** KYC and verified status in the final phase grant publishing rights, reputation and legal accountability — never runtime trust, never extra capabilities, never an exemption from the frame. Reject any request for a "trusted plugin" fast path.

## No fake content (decision R8)

- Never seed demo or sample packages, lessons, courses, members, ratings or filler text — not in migrations, not in `seed.sql`, not in fixtures that reach the hosted project. Reference data only: languages, settings, feature flags, and core **plugin definitions** (a plugin is software, not content).
- A starter template is an empty skeleton with hint labels, never ready-made sentences that read like a real lesson.
- Numbers shown anywhere come from a real query or are not shown. Build an honest, translated empty state ("nothing here yet — be the first") instead of placeholder cards.
- Test fixtures live in test files only.

## Publishing and ownership

- **Phase A: only the platform owner publishes plugins** (`plugins` / append-only `plugin_versions`, RLS: read for everyone, write for the owner). The community builds packages and curricula on top of them.
- Community plugins — code plugins above all — open only after verification and review (final phase or later), under `platform-security`.
- Package ownership follows the platform's normal ownership rule: owners edit their own packages; only the four administrative ranks touch other people's content; a Student never publishes a package to the community, though a Student may hold a local personal copy.

## Versioning

- `plugin_versions` is append-only. A published package must keep working: a new plugin version may not break it.
- A breaking change to the content shape is a new `schema_version` with a declared migration path, not an edit of the old schema.
- A package declares the plugin version range it was authored against; the player refuses a package it cannot satisfy and says so in the UI, in all three locales.

## Anti-patterns — reject these in review

- A new activity kind implemented as a `switch` in a React component or a server action.
- Defining a plugin or a template by hand-editing a migration or SQL instead of the studio, once the studio exists.
- A template that ships example sentences, or a preview item that gets persisted as content.
- Content stored as platform-specific rows with no exportable file, or a "package" that is really a database join.
- Passing the actor, the session, the progress row or a signed URL scoped to the user into the player.
- Rendering content outside the sandbox "just for the preview", or for first-party plugins.
- Item ids regenerated on save, which silently resets learners' progress.
- Importing a plugin file into platform code, or bundling a plugin's runtime into the app bundle.
- Storing or trusting a score the frame reported, instead of re-evaluating server-side.
- A "trusted"/"first-party" plugin path that skips the sandbox, the hash check or the capability rules.
- Seeding demo packages or fabricating counts to make a screen look populated (R8).
- Size, count or moderation limits written as constants instead of `platform_settings`.
