# Resolved decisions

The decisions here come from the project owner (Ahmed) or from the text of the specification, and they take precedence over any skill or plan. Where a decision explicitly states that it supersedes part of the specification, the decision is the reference until the document is updated.

## R18 — Public repository, voluntary contributions without ownership, English only, a project site on GitHub Pages

- **Status:** decided by Ahmed (19 September 2026). **Amends R9 items 3, 5 and 7.**
- **Decision:**
  1. **The repository is public** (`https://github.com/ahmedTensei/LisanHub`), with secret scanning and push protection, private vulnerability reporting, and a protected `main` branch (no deletion, no history rewrite). Before the switch the whole history was scanned: no credential, no personal data beyond the copyright holder's name, no specification.
  2. **Outside contributions are open** (`CONTRIBUTING.md`): anyone may open an issue or a pull request. **A contribution is a voluntary gift, not a stake:** the contributor keeps the copyright of their own work and grants the project owner a perpetual, worldwide, non-exclusive, irrevocable, royalty-free licence to use, modify, distribute, sublicense and relicense it (including under commercial terms); it creates no ownership, share, revenue right, employment or say in the project's direction; the owner decides what is merged and may rewrite or remove it. Opening a pull request means accepting those terms (the template repeats them). This keeps the commercial rights of phase C with the owner while the licence stays noncommercial.
  3. **The repository is written in English only** — README, policies, documentation, decisions, ADRs, prompts, comments — and is **not translated into any other language**. The product itself keeps its three interface languages (`messages/`, e-mail templates, seeded language names); that is content, not repository text.
  4. **A project site on GitHub Pages** (`https://ahmedtensei.github.io/LisanHub/`), built from `site/` by a workflow: what the project is, its state, its licence, how to contribute and where to report security problems. It is a static page about the project, **not the platform** — the app needs a server (Supabase, R2, server actions) and has no public instance yet (R8: the page states that plainly and shows no invented number).
- **Reminder:** this is a practical arrangement, not legal advice; the contribution terms and the licence wording are reviewed with a professional in phase C.
- **Where it applies:** `CONTRIBUTING.md`, `.github/PULL_REQUEST_TEMPLATE.md`, `.github/ISSUE_TEMPLATE/`, `.github/workflows/pages.yml`, `site/`, `README.md`, `SECURITY.md`, `CLAUDE.md`, `docs/before-going-public.md`.

## R17 — Professional administration: full oversight for the two top ranks, cases for the lower ranks, a preview of everything

- **Status:** decided by Ahmed (18 September 2026). The first part is implemented now; the second part (the case system) is scheduled for S4.
- **Decision:**
  1. **The platform owner and the rank immediately below (Super Administrator) are equals in oversight, as principal and deputy:** they see every content item, every plugin and every member from the administration area, and open any item with its details and a preview. Capability `admin.oversee_all` (level 3 and above) and the pages `/admin/content`, `/admin/content/<id>`, `/admin/plugins/<id>` and `/admin/users/<username>`.
  2. **The lower ranks (Administrator and Moderator) do not see everything:** they see the queues (support requests, reports, feedback, plugin publish requests) and what the two top ranks assign to them or what they accept from reports and requests. No full list of content or members for anyone without `admin.oversee_all`.
  3. **The administration area is search-first, not stacked lists:** a moderator searches for the specific member or problem and sees only what concerns it, so nobody gets lost. The content page opens on the search box and the latest changes.
  4. **A preview of everything:** a plugin is tried in the sandboxed player before it is accepted (`/admin/plugins/<id>`), and a package is shown as the learner sees it from the item page, with its metadata, its versions and its derivation chain when there is one.
  5. **Sensible actions on content:** hiding a published item from the community with a written reason its owner reads in the editor, and restoring it (`moderate_content_item()`, column `content_items.moderation_note`, fully audited); the file and its versions are never touched. **Sending a warning to the owner of an attachment** needs a notification channel (Q24) and comes with the case system.
  6. **The case system (S4):** every report, request or assigned item is a "case" with a single person in charge; the lower ranks do not interfere in each other's cases except through an explicit, audited transition: transferring the case, asking another moderator for help, reassignment after no response, or the member asking for a different moderator. Table and transition details are in the roadmap (S4) and the `trust-moderation` skill.
- **Where it applies:** `src/modules/authorization/capabilities.ts` (`admin.oversee_all`), `policies.ts` (`canOverseeAll`, `canModerateContent`), migration `20260918000600_content_moderation.sql`, `src/server/queries/oversight.ts`, the pages `src/app/[locale]/admin/{content,plugins/[id],users/[username]}`.

## R16 — The English name is required, translations are optional

- **Status:** decided by Ahmed (18 September 2026).
- **Decision:** when a package or a course is created, the **title is written in English** (Latin letters, digits and common punctuation — constraint `content_items_title_latin` in the database and the same rule in `Title` in the code); translating the title and the summary into Arabic or French is **optional**, stored in `content_items.translations` and shown to whoever uses that language in the interface, and whatever is left empty falls back to English. The same rule applies to plugins: the English name and description are required by the contract, Arabic and French are optional, and display falls back to English.
- **Where it applies:** migration `20260918000500_pair_confinement_and_titles.sql`, `src/modules/content/package-input.ts` (`Title`, `translationsFromForm`, `localizedTitle`), `src/modules/plugins/generate.ts`, the editor and studio forms.

## R15 — Learning content is confined to its language pair

- **Status:** decided by Ahmed (18 September 2026).
- **Decision:** every package and every course belongs to one language pair (comfortable language → target language), **and a course holds packages of its own pair only**; the pair is locked while the item sits inside a course. A learner studying a pair sees only that pair's material (applied in S3 to paths and review).
- **Where it applies:** the triggers `course_lessons_same_pair` and `content_items_pair_locked` in migration `20260918000500`, the list of candidate packages in the course editor, and the translated `pair_mismatch` error.

## R14 — No import and no export: content and plugins reach the platform through the community only

- **Status:** decided by Ahmed (18 September 2026). **Amends R11 item 3** (package download) **and R7** (exporting and importing a definition as a portable file).
- **Decision:** members do not import or export plugins or packages as files, and do not download `.lisanpkg` files. Content and plugins arrive through the community inside the platform (copy and derive in S4). The `/studio/import` page and the export and download routes were removed. The file format remains **internal** to the core-plugin pipeline only (`scripts/core-plugins.ts` → `plugins/core/*.lisanplugin.json` → a generated migration) and is never shown to a member.
- **Where it applies:** `src/modules/plugins/portable.ts` (module comment), `src/server/packages/access.ts`, the `plugin-architecture` skill.

## R13 — Accounts in Supabase, every file in Cloudflare R2

- **Status:** decided by Ahmed (18 September 2026). Completes ADR 0005 with ADR 0008.
- **Decision:** account data and metadata (keys, hashes, plugin references, permissions) in Supabase; **every file** — content packages and their assets, profile pictures, and code plugin bundles when they come — in **Cloudflare R2** behind `StorageProvider`. Supabase Storage is retired: no policies, no functions; the two former buckets were emptied and closed, then removed by Ahmed with the CLI command documented in `docs/SETUP.md` (19 September 2026). The server is the gatekeeper: every read and write goes through an action or a route that checks the actor first; the private store is never exposed by URL. **Plugin definitions are files in R2 too** (completed by Ahmed on 19 September 2026: "nothing related to plugins or learning stays in Supabase"): the studio draft `plugins/<owner>/<row>-draft.lisanplugin.json` is rewritten on every save, every submitted version is an immutable file `plugins/<owner>/<file>.lisanplugin.json`, and the two core plugins `plugins/core/<plugin_id>-<version>.lisanplugin.json` are uploaded by `npm run core:plugins:upload`. The database keeps only the key and the hash (`draft_key`/`draft_sha256`, `definition_key`/`definition_sha256`), and every read verifies the hash before the definition is used (migration `20260919000100`). The only JSON column left in the plugin tables is the translated disable message; the audit trail was stripped of the definition bodies it had captured before that day (migration `20260919000200`).
- **Keys:** `R2_ACCOUNT_ID`, `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY` (an API token with "Admin Read & Write" to create the buckets once, then "Object Read & Write"), `R2_JURISDICTION` (`eu` is the closest jurisdiction to Algeria and to the Paris database and is the value `.env.example` suggests; the buckets Ahmed created on 19 September 2026 — `lisanhub` private and `lisanhub-public` public — live in the default jurisdiction, so `.env.local` names them and leaves the jurisdiction empty). They are written in `.env.local` only; `npm run storage:verify` creates the buckets when missing and round-trips a probe object without printing any key.
- **Where it applies:** `src/server/storage/r2-provider.ts`, `src/lib/env.ts`, `src/app/api/media/[...key]/route.ts`, migration `20260918000400_retire_supabase_storage.sql`, `scripts/r2-setup.mjs`, `src/server/plugins/store.ts`.

## R12 — The long-term goal: a content creator builds a Duolingo-class course

- **Status:** a strategic direction from Ahmed (18 September 2026), not a requirement of any particular stage.
- **Decision:** the final goal — not the nearest one — is that a content creator can build a complete course comparable to what Duolingo and the other language apps offer (a path of units and lessons with varied activities, progress, review, motivation) out of the platform's plugins, packages and courses, without code. Every stage after S2 moves closer to that without breaking R7: no activity kind in platform code, and every course is data. Templates and packages may also be produced by code in the future (code plugins in the maturity phase), which is why **the sandbox stays fully isolated whatever the review**: if the moderators miss a malicious program inside a plugin, it reaches nobody's data.
- **Where it applies:** the roadmap (S3 onwards), the `learning-platform` skill.

## R11 — Three small decisions for the S2 implementation

- **Status:** decided by Ahmed (18 September 2026), answers to the three questions asked before S2 was implemented.
- **Decision:**
  1. **Vocabulary cards are self-assessed:** the learner sees the front, reveals the back, then picks "I did not know it / hard / I knew it / easy". A fifth reference evaluator `self_assessment` in `src/modules/exercises` turns the choice into a score (0 / 0.5 / 0.8 / 1), which is what FSRS scheduling needs in S3. Typing the answer and comparing it remains possible later as a package option.
  2. **A course holds its owner's own packages only in S2** (the `course_lessons` policy in migration `20260918000200`). Including other members' packages opens with the attribution chain in S4; nothing in the schema prevents it.
  3. ~~Downloading a published package as a `.lisanpkg` file for signed-in members~~ — **cancelled by R14 the same day**: no download, no import, no export; content arrives through the community only.
- **Where it applies:** `src/modules/exercises/definitions.ts`, migration `20260918000200_packages.sql`, `src/server/packages/access.ts`.

## R10 — The studio is a standalone page, and the Contributor role belongs to it, not to the administration

- **Status:** decided by Ahmed (18 September 2026). **Amends R7 item 6**: creating plugins is no longer reserved to the platform owner.
- **Decision:**
  1. **The engine that creates plugins and templates is a standalone page** at `/studio`, **not a section of `/admin`**. The administration is the place of oversight and operations; the studio is a place of building, with its own design and navigation.
  2. **Who enters it:** the **Contributor** (`contributor`), the **verified contributor** once the verification rank is activated, and the **platform owner** (unlimited, R6). The Student and the Content Creator do not enter it, but any member becomes a Contributor through an explicit step like the Content Creator step (R4): the commitments are explained and one acknowledgement is verified on the server. **A member does not combine Content Creator and Contributor** (specification), and going back goes through support.
  3. **The Contributor role enters phase A in S2** instead of being deferred: the column exists in `primary_role` since S0, and the capabilities and the interface are added to it.
  4. **Graduated permissions in the studio:**
     - creating a plugin draft, editing it, previewing it and exporting it, and its templates: **every Contributor, on what they own only**.
     - **Publishing to the public catalogue:** in phase A it goes through a **publish request** then a **review** by oversight (a list in `/admin`), because the plugin becomes visible to every content creator on the platform.
     - **A verified contributor publishes directly** without prior review, once the verification rank is activated (phase C, Q2), while disabling and reports remain.
     - **Disabling** (kill switch) and **hiding a plugin**: oversight and the owner only.
  5. **Ownership and attribution:** every plugin has an owner who is its author, is attributed to them in the catalogue and on their public page, and nobody else edits it except the administrative ranks within the ownership rules.
  6. **What does not change:** the plugin stays **declarative, without code** in phase A (R7), fully isolated at runtime (R7 item 8), reaches no user's data, and its template carries no content (R8). **Code plugins stay closed** until verification and security review.
- **Where it applies:** `/studio` and its pages, the capabilities `plugins.author`, `plugins.publish`, `plugins.review` and `plugins.disable` in `src/modules/authorization`, RLS policies on `plugins` and `plugin_versions` with an owner column, the plugin review list in `/admin`, and block 6 of `docs/prompts/S2-content-engine-and-editor.md`.
- **Open:** Q21 (templates made by a content creator) and Q22 (is a minimum of experience or of reviewed plugins required before direct publishing is granted to a non-verified member?).

## R9 — Noncommercial licence, public repository, contributions closed at first

- **Status:** decided by Ahmed (18 September 2026). **Items 3, 5 and 7 were amended by R18 on 19 September 2026** (the repository is now public, contributions are open under the contribution terms, and the repository settings were applied).
- **Decision:**
  1. **Licence: PolyForm Noncommercial 1.0.0** (`LICENSE` and `NOTICE`). Reading, running, modifying and sharing are allowed **for noncommercial purposes** (study, research, associations, educational and public institutions), and **any commercial use needs written permission from Ahmed**. This keeps the right to run LisanHub commercially in phase C with its owner alone.
  2. **The project is "source-available", not "open source"** in the official sense; it is never described otherwise in any text, no second licence is added, and no code under a conflicting licence (GPL/AGPL/SSPL) is merged.
  3. **The repository is public**: `https://github.com/ahmedTensei/LisanHub`; its old content (an initial scaffold under Apache-2.0) is replaced in one push with a single authorised `--force`, keeping the old content in a local branch `archive/old-remote` that is never pushed. (At import time the remote turned out to be empty, so no archive branch was needed; the repository stayed private until R18.)
  4. **Never published**: `docs/specification/` (the specification and the business model), any `.env*` except `.env.example`, `supabase/.temp`, `.claude/`.
  5. ~~**Outside code contributions are closed for now**~~ (`CONTRIBUTING.md`): reports and ideas through Issues, vulnerabilities through GitHub private reporting (`SECURITY.md`). Opening them later requires a contributor agreement that preserves the right of commercial use, because the licence is noncommercial. — **Opened by R18** with exactly that: a licence grant to the owner, written into `CONTRIBUTING.md`.
  6. **Community participation happens inside the platform** (authoring content, reviewing it, translating it), not in the repository.
  7. **Repository settings**: secret scanning with push protection, Dependabot alerts and their fixes, Wiki and Projects disabled, Issues kept, and `main` protected against deletion and history rewriting.
- **What stays open:** the licence of the **content** members author inside the platform (Q7) is a separate decision from the code licence and is not settled yet.
- **Reminder:** this is a practical arrangement and not legal advice; the final wording of the licence and the agreements is reviewed with a professional in phase C.
- **Where it applies:** `LICENSE`, `NOTICE`, `README.md`, `CONTRIBUTING.md`, `SECURITY.md`, `.gitignore`, `CLAUDE.md`, and `docs/prompts/GIT-initial-push.md`.

## R8 — No fake content, ever

- **Status:** decided by Ahmed (17 September 2026).
- **Decision:**
  1. **No demo, sample or filler content of any kind** in the platform or its database: no lessons, packages, courses, ratings, comments, members or invented avatars.
  2. **Migrations and `seed.sql` seed reference data only:** languages, settings, feature flags, and the core plugin definitions (a plugin is software, not content). Not a single insert of content.
  3. **Numbers come from a real query or are not shown:** no decorative counters, no charts over invented data, no "4.8 rating" in an interface nobody has rated yet.
  4. **Empty states are explicit and translated:** "There is no content for this language pair yet — be the first to create it", not fake cards or loading skeletons that look like content.
  5. **The starter template is an empty skeleton** with fields and hints, never ready-made sentences that look like a real lesson.
  6. **Test data stays in test files** (`tests/` and `*.test.ts`) and is never written to the hosted project; a test fails if a migration or `seed.sql` inserts content.
  7. Screenshots and demonstrations never show invented content as if it were real.
- **Reason:** the platform is community-driven, and fake content breaks the trust of the first visitor and corrupts the phase B measurements (real use cannot be told apart from fake seeding). The initial content (30–50 lessons) is written by real people: Ahmed and the founding contributors.
- **Where it applies:** a working rule in `CLAUDE.md`, the skills `testing-quality` and `ugc-content-system`, the cold-start section of `mvp-scope`, and a test in `tests/db`.

## R7 — Every kind of learning is a plugin, and content is a separate file that runs sandboxed

- **Status:** decided by Ahmed (17 September 2026). **Supersedes part of the specification:** plugins and executable content were placed in the maturity phase after phase C and conditioned on verified members; **the plugin architecture becomes the foundation of the platform from S2**, and the verification and review requirement remains for community plugins that contain code.
- **Decision:**
  1. **No kind of learning is built into the platform.** For every activity kind (lesson, exercise, cards, any future activity) the **plugin** is built first, then the content and curriculum for it. The current exercise engine becomes the first core plugin `classic-exercises`, not privileged code inside the platform.
  2. **The plugin is declarative in phase A:** it defines the activities, the content data schema (JSON Schema), the editor fields, the reference scoring rules and its texts in every language. No user code, and `capabilities_required` must be empty. The contract itself does not change when code is opened later, so that transition does not rebuild the architecture.
  3. **Content is a completely separate file:** a `.lisanpkg` package (zip) with `manifest.json`, `content.json`, `assets/` and a sha256 hash, stored through the storage layer. The database keeps only the metadata, the package key, its hash and the plugin reference. **Copy and derive = a file copy plus an attribution record.**
  4. **Isolation is structural:** rendering and evaluation happen inside an `iframe` with `sandbox="allow-scripts"` and without `allow-same-origin`, under a strict CSP with `connect-src 'none'`, communicating through `postMessage` with a small set of validated messages. **No user data is sent to the player**: no identity, e-mail, name, progress or settings — only the content item and the learner's answer. Progress and FSRS scheduling stay on the server.
  5. **One render path:** the same sandboxed player serves the editor preview (S2), the learner experience (S3) and derived content (S4).
  6. **Publishing:** ~~in phase A only the platform owner publishes plugins~~ — **amended by R10**: **Contributors** build them in `/studio`, a verified contributor publishes directly and anyone else after an oversight review; content creators build packages and curricula on top of them. Community plugins open after verification and review (phase C or later), and executable content is never published automatically.
  7. **Compatibility:** `plugin_versions` is append-only, and every package declares the range of compatible plugin versions and its `schema_version`; a new plugin version never breaks a published package.
  8. **The plugin itself is isolated like the content:** plugin logic never runs inside the platform process — neither in the platform page nor on the server. The plugin definition and its files are handed to the sandboxed frame as data and assets, and platform code never imports them. **The authoritative score is computed on the server** by the platform's evaluators; the frame's result is for immediate display only and is never trusted. Every plugin in its own frame: it sees neither another plugin nor its content. Every plugin and version has an immediate kill switch and a pinned sha256 hash the player verifies before use. Required capabilities are **zero by default**, and any future capability goes through a platform broker and a review.
  9. **Two authoring surfaces:** the **Plugin Studio** (for the owner) creates plugins **and their templates** from inside the platform without writing code or SQL, through a field-type catalogue that generates the schema and the editor fields, with a preview in the sandboxed player and export/import of the plugin definition as a portable file. The **content editor** (for content creators) builds packages on an existing plugin starting from its templates. A template is a skeleton with fields and hints without a single sentence of content (R8), and follows the plugin version.
  10. **Foundation first, verification later:** isolation is built on the assumption that every plugin is untrusted, **including Ahmed's**. Therefore KYC and verification in the last phase add **publishing rights and reputation**, not runtime trust, and no future verification is allowed to weaken the isolation.
- **Where it applies:** `docs/adr/0006-learning-plugins-and-content-packages.md` (technical details), the `plugin-architecture` skill, the S2, S3 and S4 scope in `docs/mvp-roadmap.md`, and the prompt `docs/prompts/S2-content-engine-and-editor.md`.
- **Known and accepted effect:** search in phase A runs on metadata only, not inside item text (Q19), and S2 costs one to two more weeks in exchange for cancelling a later content migration.
- **Open:** Q17 (importing packages from outside the platform), Q18 (upgrading a plugin schema and the fate of old content), Q19 (indexing item text for internal search), Q20 (a separate subdomain for the player before launch).

## R6 — The owner is unlimited, "view as", a dashboard by rank, and confirmation of every change

- **Status:** decided by Ahmed (17 September 2026).
- **Decision:**
  1. **The platform-owner rank holds every capability** whatever the primary role (in `capabilitiesOf` and in the database's content insert policy). The primary role remains an independent concept as in the specification, but it does not limit the owner.
  2. **"View as"**: the owner alone picks Student / Content Creator / Moderator / Administrator / Super Administrator and sees the interface and the actions within that rank's limits (cookie `lh_view_as`, applied in `getSession` only). The database still knows them as the owner; the restriction lives in the application layer, for trying things out, not for security.
  3. **A dashboard by rank**: every section is tied to a capability and is neither shown nor opened to anyone without it: requests/reports/feedback (`moderation.handle_queue`), members (`admin.manage_users`), settings (`admin.platform_settings`), granting ranks (`super_admin.manage_administrators`). An overview with fixed sections: work queues, members (total, by role, by rank, founders, newcomers), content, system.
  4. **The profile**: a profile picture through the storage layer (`avatars/<id>/<uuid>.<ext>` in the public bucket, ≤ 2 MB, JPEG/PNG/WebP), a bio ≤ 500, a location ≤ 80, and a public page `/u/<username>` that respects visibility.
  5. **Confirmation of every change**: every save in the account (profile, picture, preferences, password, e-mail, language pairs added or removed) goes through a second confirmation button; nothing changes with a single click.
  6. After signing in, the interface language menu moves from the header to the footer.
  7. "View as" appears only when asked for: the choice is in the account menu, and the yellow banner shows only during the trial, with a button to return.
  8. The settings page is a catalogue: every setting has a name and a description in every language, values are picked from options (`SETTING_FIELDS`), and every feature flag has only its sensible modes (`FEATURE_MODES`; maintenance on/off). The only exception is the optional support e-mail field.
  9. The public profile link `/u/<username>` is shown in the account with a copy button, in the account menu, and from the dashboard lists.
- **Where it applies:** migration `20260917001000_profile_details_and_owner.sql`, `src/modules/authorization` (`capabilitiesOf`, `emulate`), `src/server/view-as.ts`, `src/components/ui/confirm-submit.tsx`, `src/components/forms/avatar-form.tsx`, `src/app/[locale]/u/[username]`, the `/admin` dashboard.
- **Open (Q16):** does the owner configure the permission matrix of every rank from the dashboard (instead of it being fixed in the code and in the database functions)?

## R5 — An administration area inside the platform from the start, and a member space after sign-in

- **Status:** decided by Ahmed (17 September 2026).
- **Decision:**
  1. No reliance on the Supabase dashboard for day-to-day operations: the `/admin` page is seen only by the holders of administrative ranks (everyone else gets a 404) and receives **requests** (support_requests), **reports** (content and conduct), **feedback** (product_feedback), **members** (roles and ranks) and **settings** (platform_settings and feature_flags), ordered by kind, status and category. It is built now as a v0 and fills up along S2–S5 instead of waiting for S4.
  2. Members write to support from inside the platform (table `support_requests`); no e-mail needed. A return to "Student" is executed from the dashboard by an administrator's decision through `resolve_support_request()`.
  3. Ranks are granted from the dashboard with the function `admin_set_rank()`: a Super Administrator grants Moderator/Administrator, the platform owner alone touches the Super Administrator and owner ranks; nobody changes their own rank.
  4. After sign-in a member does not see the visitors' page but **their dashboard**: what is ready now (my languages, my account, the administration for staff) and a map of the coming sections (learning S3, my content and the editor S2, community and chats S5, notifications S4) with their stage label.
  5. Account settings are split: profile, my languages, preferences (interface language, visibility), security (password change after verifying the current one, e-mail change with double confirmation), account type and support.
- **Where it applies:** migration `20260917000900_support_requests_and_admin.sql`, `src/app/[locale]/admin`, `src/app/[locale]/account`, `src/components/dashboard.tsx`, the policies in `src/modules/authorization/policies.ts`, the tests in `tests/db/admin.test.ts`.

## R4 — Becoming a Content Creator: deliberate, with one confirmation, and going back only through support

- **Status:** decided by Ahmed (17 September 2026).
- **Decision:**
  1. The change is not shown as a visible button in the settings; its link sits inside a collapsed "advanced settings" section at the bottom of the account page and leads to `/account/creator`.
  2. The page explains the commitments (publishing to the community, attribution, the rules, review, no way back), and requires **one confirmation**: an acknowledgement the server verifies, then the confirmation button.
  3. No self-service return to "Student". The return is a support decision: the function `admin_set_primary_role()` is executed only by an **Administrator** (the second rank and above) after reviewing the case, and is recorded in `audit_log`. Until the administration dashboard exists (S4) this is done with SQL from the Supabase dashboard.
  4. The support channel is the setting `support.email` in `platform_settings` (empty until decided — Q15).
- **Where it applies:** migration `20260917000800_role_changes_by_admin.sql`, `src/server/actions/account.ts` (`becomeContentCreator` requires the acknowledgement), the page `src/app/[locale]/account/creator`, the tests in `tests/db/accounts.test.ts`.

## R3 — Profile visibility and the password in S1

- **Status:** decided by Ahmed (17 September 2026).
- **Reference:** the specification, chapter 7 "Account settings and privacy" (the user controls the visibility of their profile: public or restricted), noting that the document leaves the default details undecided.
- **Decision:**
  1. The default visibility of a new account is **public** (`public`).
  2. "Restricted" (`restricted`) means: only its owner and the oversight team (the four administrative ranks) read the profile; the display name, the user's role and the founder badge remain available to everyone through `profile_cards`, because every community content item must carry clear attribution to its owner.
  3. The password: at least 8 characters, without complexity rules (enforced in the application and in the Supabase Auth settings together), with a show/hide button.
  4. **A username** next to the "display name" (the latter is free in any language, 1–60 characters, and equals the username by default): unique per user (case-insensitive), at least 4 characters. Implementation assumption: Latin letters, digits, `_` and `.`, at most 30 characters (the pattern in `USERNAME_PATTERN` and the constraint `profiles_username_check`); allowing Arabic letters is a possible extension by changing the pattern in two places.
  5. At sign-up an explicit message says whether the e-mail or the username is already used (at Ahmed's request; it reveals the existence of the account to the owner of that e-mail — accepted). After sign-up a "confirm your e-mail" page appears with a resend option, and the e-mail link signs the user in automatically in the same browser.
  6. Fields with Latin values (e-mail, password, username, tags) are always left-aligned whatever the direction of the interface.
- **Where it applies:** the migrations `20260917000400_accounts_s1.sql`, `20260917000600_usernames.sql` and `20260917000700_display_names.sql` (the column `profiles.visibility`, the read policy, the view `profile_cards`), the tests in `tests/db/accounts.test.ts`, the schemas in `src/modules/account/schemas.ts`, and `supabase/config.toml` (`minimum_password_length = 8`).
- **What stays open:** the rest of the privacy policy details (Q12).

## R2 — A complete free platform first; subscriptions and payments with the legal preparation in the last phase

- **Status:** decided by Ahmed (17 September 2026).
- **Supersedes:** the exception of chapter 14 of the specification ("offline access and data sync are paid from the first release"), and what follows from it in chapters 10 and 11 as far as timing only. The rules of the business model themselves remain valid for the last phase.
- **Decision:**
  1. First a complete platform that works well is built, **entirely free**: no subscriptions, no payments, no entitlements, no free trials or referral rewards, no paid content.
  2. Then a phase of collecting user feedback and improving the platform on that basis.
  3. In the **last phase**: the legal and commercial preparation, then subscriptions and payments (offline access and heavy-content sync first, the marketplace later).
- **What does not change:** saving progress is always free (R1), manual export is always free, and the permanent "Founding Member" badge is granted from the start; the commercial benefit attached to it (a free year of the paid features) is applied when subscriptions launch.
- **Assumption adopted until Ahmed decides otherwise:** the web app is installable (PWA) in the first phase, while downloading content for offline use and heavy-content sync come with subscriptions in the last phase because they are the paid service.
- **Where it applies:**
  - The database has no tables for entitlements, subscriptions or payments, and a test in `tests/db/rls.test.ts` prevents them from appearing before the last phase.
  - The field `content_items.is_paid` always stays `false`, which keeps the rule "paid content cannot be derived" enforced without a later migration.
  - The table `product_feedback` and the module `src/modules/feedback` collect users' feedback about the platform.
  - The skills `mvp-scope` and `monetization-marketplace` are updated.

## R1 — Saving progress is free, heavy sync is paid

- **Status:** decided in specification v2.1 and skills v2.1. **The timing of the paid part was amended by R2** (moved to the last phase).
- **Reference:** the specification, chapter 4 "Continuity of progress and personal content" and chapter 10 "Saving progress and offline access".
- **Decision:**
  - Account data and learning progress (completed lessons, spaced-repetition due dates, activity streak, level, settings) are saved on the server for every registered user, free and always, and restored on any device.
  - Downloading content for offline use, and syncing heavy personal content across devices: one paid service, built in the last phase (R2).
  - Manual export of personal data is always free.
- **Where it applies:** the tables `progress`, `review_states` and `activity_days` without any subscription condition, with tests in `tests/db/rls.test.ts`.
