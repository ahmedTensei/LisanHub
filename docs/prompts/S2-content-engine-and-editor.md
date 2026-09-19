# Start prompt — stage S2: the plugin architecture, content packages and the sandboxed player

> **This file was rewritten after decisions R7 and R8 (17 September 2026), and updated on 18 September with the engine that creates plugins and templates.** There is no "built-in lesson editor" left in S2: the plugin is built first (with the studio), then the content and the curriculum for that plugin (with the editor), and the content is a separate file that runs in an isolated environment.
>
> How to use: in Claude Code, first run `npm run setup` (the skills changed and a new skill was added), then enable plan mode (Shift+Tab until "plan mode on" appears), then write:
> "Execute the instructions in docs/prompts/S2-content-engine-and-editor.md"

## Context

Read first: `CLAUDE.md`, then **`docs/adr/0006-learning-plugins-and-content-packages.md`** (the technical details of the decision), then `docs/decisions/resolved-decisions.md` (decisions **R8 and R7** first, then R6, R5, R4, R3, R2 and R1), then `docs/decisions/open-decisions.md` (Q17, Q18, Q19 and Q20 in particular), then `docs/mvp-roadmap.md` and `docs/adr/0005-storage-abstraction.md`.

Then the skills, in this order: **`plugin-architecture`** (the first reference for everything in this stage), `project-governance`, `mvp-scope`, `ugc-content-system`, `learning-exercise-engine`, `architecture-guardian`, `api-data-architecture`, `platform-security`, `i18n-rtl`, `testing-quality`. Read `content-lineage` and `search-discovery` for awareness only, so that you do not build anything that obstructs S3 and S4.

We are in **phase A (a complete free platform)**, S0 and S1 are done, and the task is **S2 only**.

## Before writing any code

1. `npm run setup`, then `npm run check`, then `npm run db:verify`. If something fails, fix it first and tell me why in one line.
2. **Do not ask me more than three questions**, each with two or three options and your clear recommendation, in simple Arabic, written so that I can answer "I agree with your recommendations" in one go. Do not ask me about matters the specification, the skills or ADR 0006 settle.
3. Write the plan in Arabic: the stages in the order below, the new files, the migrations, the tests, and what the user will see at the end. Then wait for my approval.
4. Everything that runs as a command, you run (`npm run db:push`, `db:types`, `db:verify`, `db:config:push`). Do not ask me for a manual step in the Supabase dashboard, and never ask for the `service_role` key.

## Two governing rules for the whole stage

**1. The plugin itself is untrusted, not only the content (R7 item 8).** We are building the foundation on which KYC and verification will be added in the last phase, and verification never weakens isolation:

- Platform code **imports no plugin file** and does not bundle it into the app; the plugin definition and its files are data and assets handed to the player document, pinned by a sha256 hash verified before loading.
- **No plugin logic runs in the platform process**, neither in the page nor on the server. **The authoritative evaluation is server-side** with the platform's evaluators, and the frame's result is for immediate display only: never stored, never trusted.
- One frame per activity, no shared globals and no messages between frames; a plugin sees neither another plugin nor its content.
- Capabilities are **zero**: no network, no storage, no camera or microphone, no upload, no clipboard.
- A kill switch per plugin and per version that works immediately without a deployment, and shows the learner a translated text without damaging packages.
- The player address comes from the `PLAYER_ORIGIN` setting (Q20), to be moved later to a subdomain without a code change.

**2. No fake content, ever (R8).** No lessons, packages, courses, members, ratings or filler text, anywhere: not in a migration, not in `seed.sql`, not in the interface. Migrations seed reference data only (languages, settings, feature flags, **plugin definitions** because a plugin is software, not content). Numbers come from a real query or are not shown. Empty states are explicit and translated ("There is no content for this pair yet — be the first to create it"), not fake cards. Test data stays in test files.

## Scope, in order of execution

Execute these blocks in order, with `npm run check` after every block.

> **The two authoring surfaces this stage builds, never merged:**
> **(a) The engine that creates plugins and templates** — a standalone page `/studio` **for Contributors** (not the administration area), which defines the *kind* of activity and its templates (block 6).
> **(b) The content editor** — for the content creator, which fills the *content* of a package on an existing plugin starting from a template (block 5).
> If either falls, the architecture falls: without (a) every new activity needs a developer, and without (b) there is no content at all.

### 1. The plugin contract (Plugin Contract v1)

- A module `src/modules/plugins` **framework-free and with tests**: the manifest schema (Zod) of the plugin contract as in ADR 0006, validation of `content_schema` (JSON Schema 2020-12), the description of the editor fields `authoring_fields`, and the scoring references to the platform's evaluators.
- **Reject** any plugin that declares a non-empty `capabilities_required`, disallowed assets, or a `plugin_id` that does not match the pattern.
- `plugin_versions` keeps **the sha256 hash of the definition**, and the player verifies it before use.
- **An architecture test**: fails if any file inside `src/` imports a plugin definition or a file from the plugin assets directory (access through data reads only).
- A new migration: `plugins` (with an owner column) and `plugin_versions` (append-only with a trigger, like `content_versions`), and a publication state (draft, pending review, published, disabled). RLS policies: **published ones are readable by everyone**, **a draft is read and written by its owner alone and by oversight**, nobody publishes a version without the `plugins.publish` capability, and disabling is for oversight and the owner (R10). And a platform-wide kill switch per plugin and per version.
- Tests in `tests/db`: a non-owner does not publish a plugin and does not edit a published version, and disabling hides the plugin from creation without damaging existing packages.

### 2. The `.lisanpkg` content package

- A module `src/modules/packages` **framework-free and with tests**: reading and writing the package (zip), `manifest.json`, `content.json` and `assets/`, computing the sha256 hash, and the full validation.
- **Every rejection case below must have a failing test**: exceeding the package size, exceeding the number of items, exceeding the number of assets or the size of an asset, an entry with `..`, an absolute path or a symbolic link, an asset whose real type does not match what the manifest declares, `content.json` not matching the plugin schema, a plugin or `schema_version` that does not exist, a mismatched hash.
- All the limits live in `platform_settings` through the `SETTING_FIELDS` catalogue, **no constants in the code**.
- Storage through `StorageProvider` with a key carrying the owner's identity (ADR 0005). The database stores neither the content nor a link.
- A new migration: columns on `content_items` (`plugin_id`, `plugin_version`, `package_key`, `package_sha256`, `items_count`) and on `content_versions` (the package key and its hash), with tests: every version points to a package, no column named `url` or ending in `_url`, and rollback is a pointer switch rather than writing content.
- **The item identifier (`item_id`) is stable** and is never regenerated on any edit, because progress and FSRS are tied to it. A test proves it.

### 3. The sandboxed player

- A route that serves the player document with strict headers: `Content-Security-Policy` with `default-src 'none'`, `connect-src 'none'` and `img-src blob:`, and no cookies.
- A component that wraps the player in an `iframe` with `sandbox="allow-scripts"` **without** `allow-same-origin`.
- A `postMessage` protocol with Zod schemas on both sides and an origin check: `render`, `check` and `reset` from the platform, and `ready`, `height`, `answer`, `result` and `error` from the player. Assets are passed as blobs, not as a link signed for the user.
- **No user data is sent to the player**: no identifier, e-mail, name, username, progress, review state, settings or session token. Write **a failing test** if any message type contains one of these fields.
- The same player is used for the preview inside the editor now, for the learner experience in S3, and for derived content in S4. One path, no privileged path for the core plugins.
- The score for immediate display is computed in the player, but **the authoritative evaluation is recomputed on the server** with the platform's evaluators before any save; **a result coming from the frame is never stored** (a test proves it), and progress and FSRS scheduling are on the server.
- **One frame per activity**, no shared state between two frames, no messages between frames.
- **The player address from the `PLAYER_ORIGIN` setting** (defaulting to the same origin for now), with a test for the document headers.
- **A kill switch per plugin and per version**: prevents creation and running immediately, shows a translated text, and damages no existing package (a test).

### 4. The first two core plugins

- `classic-exercises`: the four existing types (multiple choice, fill in the blank ignoring Arabic diacritics, matching, word ordering). **Do not delete `src/modules/exercises`**: it remains the platform's reference evaluators the plugin refers to, and only the rendering moves to the player.
- `vocab-cards`: a card with a front, a back, an optional example, an optional picture and tags.
- **They are created with the studio (block 6), not by writing JSON by hand**, then exported, and the two definition files are seeded in a migration as reference data, with their texts translated into ar, fr and en. Execute block 6 before seeding them, or create them temporarily then reproduce them with the studio and make sure the hash matches.

### 5. The editor generated from the schema

- A "my content" list filtered by state (draft, published, archived), plugin and language pair.
- Creating a package: choose the plugin ← the language pair from the creator's pairs ← a starter template from the plugin: **a ready skeleton with fields and hints** so the creator does not start from a blank page, without any composed sentences that look like a lesson (R8).
- Fields **are generated from `authoring_fields`**, not written by hand per type, with Zod validation and translated error messages.
- Several items inside the package: add, remove, reorder with keyboard-operable buttons.
- Metadata: title, summary, the dialect as a tag, CEFR and a sub-level, skills, normalised free tags.
- Several drafts at the same time (an unpublished package), a clear save, and a preview as a learner through the player.
- **The starter template is an empty skeleton with fields and hints**, not ready-made sentences that look like a lesson (R8). Every empty screen carries an explicit translated text, not fake cards.
- Publishing creates a version, a "change history" page shows the versions, and **rollback** to an earlier published version is an audited action in `audit_log`.
- Picture upload **inside the package** (no external link) with a required alternative text (alt).
- Permissions through `can()` and the policies only: the content creator (and the administrative ranks within their capabilities) creates and publishes; **the student sees no publishing path and does not publish**; the owner is unlimited (R6).

### 6. The engine that creates plugins and templates (Plugin Studio v1)

This is **the first authoring surface**, and without it every new activity kind needs a developer.

**Its place is a standalone page at `/studio`, not a section of `/admin`** (R10). The administration is the place of oversight; the studio is a place of building, with its own header, navigation and experience.

**Who enters it:** the **Contributor** (`contributor`), the verified contributor later, and the platform owner. This means **the Contributor role enters phase A in this block**:

- A page to become a Contributor like "become a content creator" (R4): the commitments explained, one confirmation verified on the server, and a database function like `become_content_creator()`. **A member does not combine Content Creator and Contributor** (specification), and going back is through support only.
- New capabilities in `src/modules/authorization`: `plugins.author` (every Contributor, on what they own), `plugins.publish` (direct for the verified member, after review for the others), `plugins.review` and `plugins.disable` (oversight and the owner).
- An owner column on `plugins`, and RLS policies: everyone reads what is published, the owner writes their own draft only, and nobody publishes a version without the capability.
- **A plugin review list in `/admin`**: publish request ← accept or reject with a translated reason ← auditing in `audit_log`. Immediate disabling stays with oversight.

- **Creating a plugin with a guided form, without writing code or SQL:** the identifier, the name and the description in every language, then the activities, then building the item structure from **the catalogue of field types**: short text, long text, list of items, single choice, multiple choice, matching pairs, ordering items, a blank inside a text, a picture with a required alternative text.
- **Automatic generation:** from this choice `content_schema` (JSON Schema) and `authoring_fields` are generated together, so the schema never drifts from the editor. Pasting a JSON Schema by hand is **an advanced exit** in a collapsed section, not the default path.
- **Scoring binding:** for every activity a reference evaluator is chosen from the platform's evaluators (`src/modules/exercises`) with its options (such as ignoring Arabic diacritics), and no scoring logic is written inside the plugin.
- **Templates inside the plugin definition** (`templates[]`): every template has a translated name and description and an item skeleton with empty fields and translated hints. **Not a single sentence of content** (R8). The template follows the plugin version and is exported with it.
- **The preview:** a temporary trial item the owner fills in the studio and shows in **the same sandboxed player**; **it is never saved in the database or in the store** (a test proves it).
- **Validation fails closed before saving:** any definition that does not match the contract (non-empty capabilities, a disallowed asset type, an invalid schema, a duplicate identifier, a template that does not match its schema) is rejected with a translated message that points to the field.
- **Publishing and versions:** draft ← publishing a version in `plugin_versions` (append-only + sha256 hash) ← a kill switch per version. No editing of a published version.
- **Export and import:** the plugin definition is a portable JSON file with a hash, exported and imported from the studio, so the plugin moves between environments without writing a new migration.
- **The studio tests itself:** create the two core plugins of block 4 with it, then export them, and seed the two resulting files in the migration (reference data, R8). **If the studio cannot express one of them, the gap is in the contract** — fix the contract rather than writing the plugin by hand around it.
- **Two new limits in `platform_settings`:** the number of templates per plugin, and the size of a plugin definition.
- Tests: the Student and the Content Creator do not open `/studio` (404); a Contributor does not edit another's plugin and does not publish to the catalogue without review; only oversight disables; a definition that breaks the contract is rejected; the preview item is written to no table and no store; export then import gives the same hash.

### 7. Courses and curricula

- Creating a course, adding packages to it and ordering them through `course_lessons.position`, and removing a package from the course without deleting it.
- Every package belongs to one plugin; a course may gather packages from different plugins.

## Out of scope

- Derivation, "create your copy", "translate this lesson" and the attribution chain (S4) — but write nothing that prevents them: the manifest carries a `provenance` field from now on.
- The learner experience, progress tracking and the search page (S3).
- **Importing packages from outside the platform** (Q17): authoring inside the platform only in S2.
- **Code inside plugins, and plugins authored by the community**: deferred until after verification and review (R7). The plugin is declarative for now.
- Search inside item text (Q19), audio, video and AI, ratings and reports as new interfaces (S4/S5), and chat (S5).
- Any subscription, payment or entitlement (phase C only, R2), and creating a Git repository.

## Definition of done

- **Create a complete new plugin from the studio without writing a line of code** (for example a "complete the dialogue" activity), with a template for it, publish its version, then create a package on it from the editor. This is the real test of the architecture.
- **Try the path from a Contributor account, not the owner's**: become a Contributor, build a plugin in `/studio`, request its publication, then accept it from `/admin` with an administrative account — then disable it and make sure existing packages were not damaged.
- Export a plugin definition and import it in the same project: the same hash and the same result.
- A content creator creates a package on the `classic-exercises` plugin with the four types and a picture with an alternative text, previews it as a learner inside the sandboxed frame, publishes it, edits it, then rolls back to the previous version.
- Creates a cards package on `vocab-cards`, then a course holding three packages and reorders them.
- The published package is **a downloadable file** carrying its manifest and its hash, and the platform accepts reading and running it again. (Cancelled by R14 the same day: no download, no export.)
- The student does not publish, not even by calling the database directly; a content creator does not edit another's package; and a draft is seen by nobody but its owner and oversight (tests).
- A non-owner does not publish a plugin (a test), and a package that breaks any limit or any validation rule is rejected with a clear message (a test per case).
- No user data field in any message to the player (a test), and the player works without a network.
- No import of plugin files in `src/`, no storage of a result coming from the frame, and the plugin definition hash is verified (tests).
- Disabling a plugin from the settings stops creation and running immediately with a translated message without damaging packages.
- **No content in any migration or in `seed.sql`** (a test fails on a content insert), and every empty screen explains the emptiness and invites creation in three languages.
- `npm run check`, `npm run build` and `npm run db:verify` pass, and the pages work in Arabic, French and English on desktop and phone.

## Way of working

- Small steps, and `npm run check` after every block.
- Every schema change = a new migration + a test in `tests/db`. Never edit an applied migration.
- Any undecided point: ask me rather than infer, and add it to `docs/decisions/open-decisions.md`.
- When done: update "Current state" and "Architecture map" in `CLAUDE.md`, the S2 section in `docs/mvp-roadmap.md`, `resolved-decisions.md` if a new decision appeared, and a new ADR if you chose an important technical alternative (the zip library or the JSON Schema validator, for example). Then `npm run db:push`, `db:types` and `db:verify`, and a compressed backup without `node_modules` and `.next` in `%USERPROFILE%\Documents\LisanHub-backups\` with a name that includes the date and the stage.
- Then summarise for me in Arabic: what was done, and a short numbered list I can try myself step by step.

## A small improvement (do it at the end of S2 if time remains)

The `IBM_Plex_Sans_Arabic` font is fetched from Google Fonts at build time, so `npm run build` fails in any environment without internet. Convert it to `next/font/local` with woff2 files kept in the project (the weights in use only), so the build becomes independent of the network.
