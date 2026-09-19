# ADR 0006 — Every kind of learning is a plugin, and content is a separate package that runs sandboxed

- **Status:** adopted by Ahmed's decision (17 September 2026), decision R7 in `docs/decisions/resolved-decisions.md`.
- **Context:** the specification treats lessons and exercises as content types the platform knows directly, and places plugins and executable content in the maturity phase after phase C. Ahmed decided to reverse the order: no kind of learning is built into the platform; the plugin is built first, then the content and curriculum for it, and the content is a completely separate file the platform recognises and runs in an isolated environment that reaches no user data. The stated goal: to make copying and deriving easy later (the `content-lineage` skill), which is also a necessary condition for offline sync in phase C.

## Decision

1. **Three separate layers, not one:**
   - **The plugin:** defines the *kind* of learning activity: the activities it offers, the data schema of its content (JSON Schema), the editing fields, the reference scoring rules, and its interface texts in every language.
   - **The package:** a standalone content file built *for* a specific plugin (a lesson, a set of cards, a drill…).
   - **The curriculum:** an ordering of packages inside a course, each package belonging to one plugin.
   The platform carries identity, permissions, progress, search and oversight — it carries no kind of learning.

2. **The plugin contract (Plugin Contract v1), declarative in phase A:** `plugin_id` (slug), `version` (semver), `schema_version` (integer), `activities[]`, `content_schema` (JSON Schema draft 2020-12), `authoring_fields` (a description of the editor fields with their translated texts), `scoring` (a reference to the platform's reference evaluators), `assets_allowed` (`image` only for now), `capabilities_required` (**must be empty**; any required capability means a plugin that is rejected in phase A). No user code at this stage, and the plugin contract itself does not change when code is opened later.

3. **The `.lisanpkg` package format** (a single zip file):
   - `manifest.json`: `format: "lisanhub.package/1"`, `package_id`, `version`, `plugin: { id, compatible_versions }`, `schema_version`, `language_pair { source, target, dialect? }`, `cefr`, `skills[]`, `tags[]`, `title`, `summary`, `license`, `author { user_id, username, display_name }`, `provenance` (on derivation: `{ package_id, version, sha256, author }`), `items_count`, `created_at`, `sha256`.
   - `content.json`: the content items, each with a stable identifier (`item_id`) because progress and FSRS are tied to it.
   - `assets/…`: relative paths only; no absolute links and no network references inside the package.
   - **Validation before acceptance** (in `src/modules/packages`, framework-free and with tests): package size and entry count, rejection of `..`, absolute paths and symbolic links, checking every asset's type from its content rather than its extension, then matching `content.json` against the plugin schema, then comparing the hash.

4. **The database indexes the content and does not store it:** `content_items` remains the metadata row (title, language pair, level, tags, state, ownership, attribution) and adds the plugin reference, the package key and its hash. Every version in `content_versions` points to a package key and a hash, so rollback becomes a pointer switch rather than rewriting data. Packages are stored through `StorageProvider` (ADR 0005) with a key that carries the owner's identity.

5. **Isolation is a structural condition, not a setting:** every rendering or evaluation of content happens inside an `iframe` with `sandbox="allow-scripts"` and **without** `allow-same-origin` (an opaque origin: no cookies, no local storage, no access to the platform page), under a strict CSP (`default-src 'none'`, `connect-src 'none'`, `img-src blob:`). Communication goes through `postMessage` with a small set of messages whose shape is validated with Zod:
   - Platform → player: `render` (the content item, the language, the direction), `check` (the learner's answer), `reset`.
   - Player → platform: `ready`, `height`, `answer`, `result` (a score and a detailed result), `error`.
   **No user data is sent to the player**: no identifier, e-mail, name, progress or settings. Progress computation and review scheduling (FSRS) stay on the server.

6. **One render path:** the same sandboxed player is used in the editor preview (S2), in the learner experience (S3) and for derived content (S4). No privileged "internal" path for the core plugins, so the architecture does not change when community plugins open.

7. **Publishing and ownership (amended by R10):** plugins are built by **Contributors** in `/studio`, and every plugin has an **owner** it is attributed to. RLS policies on `plugins` and the append-only `plugin_versions`: published ones are readable by everyone, a draft by its owner and oversight, publishing needs the `plugins.publish` capability (review in phase A, direct for verified members later), and disabling and hiding are for oversight and the platform owner. Content creators build packages and curricula on top of plugins. Community plugins — especially those containing code — open after verification and review (phase C or later), and the `platform-security` skill's rule stays in force: executable content is never published automatically.

8. **Version compatibility:** `plugin_versions` is append-only, and every package declares the range of compatible plugin versions and its `schema_version`. A new plugin version may never break a published package; if an incompatible change is needed it is a new `schema_version` with a declared migrator (Q18).

9. **The plugin itself is untrusted and isolated like the content:**
   - **Platform code never imports any plugin file** (no `import`, no bundling into the app). The plugin definition and its files are handed to the player document as data and assets, and every version is pinned by a sha256 hash the player verifies before loading (and by `integrity` for standalone files when code opens).
   - **No execution of plugin logic on the server.** The authoritative evaluation written into progress is computed by the server with the platform's reference evaluators from `content.json` and the learner's answer; the result coming from the frame is neither stored nor trusted, and is used for immediate display only. When code plugins open later, server-side evaluation runs in an isolated worker with time and memory limits and without network or file system, or remains indicative rather than authoritative.
   - **One frame per activity:** two plugins share neither a frame, nor state, nor memory, and the opaque origin prevents one plugin from reading another's storage. No shared globals and no messages between frames.
   - **A kill switch per plugin and per version** that works immediately without a deployment: it prevents creation and running, shows the learner a clear translated text, and damages no existing package.
   - **Zero capabilities:** no network, no storage, no camera or microphone, no file upload, no clipboard. Every future capability (audio, handwriting…) is declared in the contract and goes **through a broker inside the platform** that checks and limits, not through opening a permission inside the frame.
   - **A separate origin at launch (Q20):** the player address comes from a setting (`PLAYER_ORIGIN`) so it can move to a separate subdomain before the public launch without a code change.

10. **Verification does not weaken isolation:** KYC and verification in the last phase grant **publishing rights, reputation and legal responsibility**; they grant the plugin no additional capability and do not take it out of the frame. Any future request for "full trust for a verified plugin" is refused by this text.

11. **No demo content in any part of this architecture (R8):** no demonstration packages and no filler items in the migrations or in `seed.sql`. The core plugin definitions are seeded because a plugin is software, not content; packages are written by people. The starter template is an empty skeleton with hints.

12. **Two authoring surfaces, not one — and the engine that creates plugins and templates is part of the platform:**
    - **The Plugin Studio** — **a standalone page at `/studio`, not a section of `/admin`** (R10), entered by the **Contributor**, the verified contributor and the platform owner: it creates a new plugin **from inside the platform without writing code or SQL**. A guided form picks from a **catalogue of field types** (short text, long text, list of items, single/multiple choice, matching pairs, ordering items, a blank inside a text, a picture with an alternative text) and generates `content_schema` and `authoring_fields` automatically; pasting a JSON Schema by hand is an advanced exit, not the default path.
    - **Templates are part of the plugin definition** (`templates[]`): every template has a translated name and description and an item skeleton with empty fields and hints, **without a single sentence of content** (R8). A template is exported and imported with the plugin, and follows its version.
    - **The cycle:** a definition draft ← full validation against the contract (fails closed) ← a preview inside **the same sandboxed player** with a temporary trial item that **is never saved in the database** ← publishing a version in `plugin_versions` (append-only + sha256 hash) ← a kill switch.
    - **A plugin definition is a portable file** like the package: exported and imported as a JSON file with a hash, so a plugin moves between environments without a new migration, and what is seeded in the migrations remains **reference data** (R8).
    - **The studio neither runs nor accepts code** in phase A, and grants the plugin no capability.
    - **Permissions inside it (R10):** every Contributor builds, edits, previews and exports **what they own**; **publishing to the public catalogue** goes through a publish request and an oversight review in phase A, and becomes direct for the verified contributor when the verification rank is activated; **disabling and hiding** are for oversight and the owner alone. Every plugin has an owner it is attributed to.
    - **The content editor** (for content creators) remains the second surface: it builds a **package** on an existing plugin starting from one of its templates. The two are never merged: the first defines the *kind* of activity, the second fills its *content*.

## Consequences

- **A direct gain:** derivation and copying (S4) become a file copy + an attribution record; export, import and offline sync (phase C) work on files rather than scattered rows; and "a student makes a local copy" becomes a package download.
- **The current exercise engine** (`src/modules/exercises`, four tested types) is not thrown away: it becomes the first core plugin `classic-exercises`, and its evaluation stays in the platform as the reference evaluator the plugin refers to.
- **The editor is generated from the schema** (`authoring_fields`) instead of a hand-written editor per type: less polished at first, but every new plugin gets an editor without new interface code.
- **Search in phase A runs on metadata only** (title, summary, tags, level, language pair), not inside item text, because the content is a file. If internal search becomes necessary, items are unpacked into an index table later (Q19).
- **S2 costs one to two more weeks**: contract + package format + validator + sandboxed player + generated editor + the first plugin. There is no user data today, so the migration cost is zero if done now and large if delayed.
- **New limits need settings** in `platform_settings`, not constants: the maximum package size, the maximum number of items, the number of assets and the size of one asset, and the number of templates per plugin.
- **The studio tests itself:** the two core plugins (`classic-exercises` and `vocab-cards`) are created **with it** and then exported, so no "hand-written plugin" path remains without a real test. If the studio cannot produce them, the contract is incomplete, not the plugins.
- **What the tests must fail on:** a package exceeding the limits, a package with a path outside its root, a package that does not match its plugin's schema, a package declaring a required capability, a plugin published by someone other than the owner, any message to the player carrying a user field, **importing a plugin file from inside `src/`**, **storing a result coming from the frame**, and inserting content in a migration or in `seed.sql` (R8).
- **An acceptable cost:** evaluation exists in two places (immediate in the frame, authoritative on the server), but the evaluators are shared with one source `src/modules/exercises`, so the logic does not fork.
