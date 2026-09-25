# LisanHub — build roadmap

Source: Full_Project_With_Business_Model_AR.docx (16 chapters, version v2.1), amended by Ahmed's decisions R2 and R7. Last update: 2026-09-19 (S1 and S2 done in code; decisions R12–R17 on 2026-09-18: the long-term goal, files in R2, no import/export, language-pair confinement, English names, professional administration; R18 on 2026-09-19: public repository, open contributions, English-only repository, project site).
Reference country: Algeria. Repository: https://github.com/ahmedTensei/LisanHub (public, MIT License — R19); no commit and no push without an explicit request from Ahmed.
Assumptions: one developer (Ahmed), web first (PWA), the technical stack in docs/adr/0001-tech-stack.md.

## The governing principle of the order (R2)

A complete, well-working, entirely free platform first ← user feedback and improvement ← legal preparation, then subscriptions and payments in the last phase.

| Phase | Goal | Built in it | Not built in it |
| --- | --- | --- | --- |
| **A — a complete free platform** | The whole learning experience and the community content work well | S0–S6 below (S7 opens phase B) | Any subscription, payment, entitlement or paid content |
| **B — user feedback and improvement** | Learn what users like and what must be fixed | Closed trial, feedback collection, improvement cycles, free public launch | Payments |
| **C — legal, subscriptions and payments** | Turn the proven platform into a sustainable business | Legal preparation, payment provider, the subscription (offline + heavy-content sync), later the marketplace | — |

## Phase A — a complete free platform (full time ~35–40 h/week; double for part time)

- **S0 (weeks 1–2) Foundations** — **done in code**: Next.js structure, domain modules, Supabase schema with RLS, tests.
- **S1 (weeks 3–4) Accounts, roles and languages** — **done in code** (17 September 2026): sign-up by e-mail with confirmation, sign-in and sign-out, password recovery, Student/Content Creator (a "become a content creator" step), a moderator rank granted by SQL, multiple language pairs with search across 7,919 languages, a profile (unique username, interface language, visibility), auditing of role changes. Google sign-in deferred.
- **S2 (weeks 5–10) The plugin architecture, its engine and the content editor** — **done in code** (18 September 2026; see "What was done in S2" below). Redefined by decision **R7**: the plugin contract (declarative), the `.lisanpkg` content package format and its validator, the sandboxed player (an iframe with no access to user data), **the engine that creates plugins and templates (a standalone studio at `/studio` for Contributors — not in the administration area — that creates the activity kind, its schema and its templates without writing code, with review before publication; ~~export and import~~ cancelled by R14), and the entry of the Contributor role into phase A (R10)**, a content editor generated from the plugin schema with a starter template, drafts and a preview, the first two core plugins `classic-exercises` and `vocab-cards` **produced by the studio itself**, courses and curricula on top of packages, metadata (CEFR, skills, tags), versions and rollback, and picture upload inside a package. **Two weeks longer than the earlier estimate** because content became a standalone file; the following stages shift by the same amount without changing their order. **Isolation covers the plugin itself, not only the content** (R7 item 8: no import of plugin files in platform code, no execution of their logic on the server, and the authoritative evaluation is server-side), and **no demo content at any stage** (R8).
- **S3 The learner experience** (after S2): the home page, browsing, search and filtering, the lesson player through the same sandboxed player from S2, FSRS review and a quick session, progress tracking (free and saved on the server).
- **S4 Derivation, quality and oversight** (after S3): "create your copy" and "translate this lesson" as package copies with an attribution record, the attribution chain, reports, notes and escalation, the quality label, notifications (Q24), and **the case system in the administration area (R17)**:
  - A table `admin_cases`: the case kind (report, support request, plugin publish request, an assigned item or member), the single person in charge, the state (open → assigned/accepted → in progress → transferred → closed with a decision), and an audited transition log (from, to, why, when).
  - Assignment by the two top ranks, and self-acceptance of reports and requests from the queue; the lower ranks open only their own cases and do not interfere in a colleague's case except through an explicit transition: transfer, a request for help, reassignment after a period without response (a `platform_settings` setting), or the member asking for a different moderator.
  - Actions on content inside a case: hide with a reason / restore (exists since S2: `moderate_content_item()`), **a warning to the owner of the attachment** through the Q24 channel, a request for changes, escalation to the higher rank.
  - The case page shows only what concerns it: the item with its preview, the member with their account state and content, the derivation chain when there is one — an extension of the oversight pages built in S2 (`/admin/content`, `/admin/plugins/<id>`, `/admin/users/<username>`).
- **S5 (weeks 12–13) Community and ratings**: one group chat, mute and block, lesson ratings and reviews, the content creator page.
- **S6 (weeks 14–15) The app, feedback and quality**: an installable app (PWA without a paid download), **an in-app "your opinion of the platform" form** and a dashboard to sort it (the product_feedback table is ready), the "Founding Member" badge and invitation codes, data export and account deletion, performance, accessibility and a security review.
- **S7 (weeks 16–18) The closed trial and feedback collection** (the start of phase B): simple kill switches, a usage indicators dashboard, inviting the founders in batches, the first improvement cycle.
- **In parallel**: recruiting 10–20 founding contributors and 50–100 founding learners (weeks 1–7), opening the editor to them (week 8), seeding 30–50 reviewed lessons (weeks 8–15) — **real content written by people, and never any demo content (R8)**.
- **In parallel (proposed, Q12)**: a minimum of data protection before the closed trial (weeks 12–15): a short privacy policy, explicit consent at sign-up.

## Phase B — user feedback and improvement (flexible, roughly 6–10 weeks)

- A closed trial with the founders, then gradual widening.
- Feedback collection: the "your opinion of the platform" form (a 1–5 score + a comment + a category: bug, idea, learning, content, community), lesson ratings, weekly feedback sessions in the chat, usage indicators.
- Improvement cycles every two weeks: rank what to fix first by the feedback, then fix, then measure.
- Deepening features users actually ask for (from the post-first-release list): Anki import, activity streaks and goals, review reminders, "my hard words", a placement test, saved search.
- A free public launch once the feedback stabilises.
- **Proposed (your decision, see Q12):** a minimum of user data protection before inviting real users: a short privacy policy and explicit consent at sign-up.

## Phase C — legal, subscriptions and payments (the last phase)

1. **Legal preparation**: registering the company, the final terms of use and privacy policy, the content licence (Q7), the ANPDP declaration and the hosting decision (Q12), with a professional.
2. **The payment provider (Q4)**: Chargily Pay for local payment in dinars (Edahabia and CIB), and an international provider (Paddle or Polar) after verifying eligibility and exchange restrictions. Stripe is not available for business accounts in Algeria.
3. **The subscription**: offline access and heavy-content sync, the free trial, referral rewards, applying the founders' benefit (the design is kept in docs/adr/0004).
4. **Later**: the marketplace, commissions, KYC and the verified member, the Teacher rank, once the transition criterion is met.

## Outside this order

- **Trust and community** (reputation, trust score, badges, a chat per pair, study groups, language partners): added during phase B or after it as the feedback requires, because they are free.
- **Maturity** (community plugins and executable content with code, institutions, advanced administration tools, AI): after phase C, because publishing a plugin by someone other than the owner requires member verification and a security review. **The plugin architecture itself is built in S2** (R7); what is deferred is community authoring of plugins and code inside them.

## What was done in S0

- A Next.js 16 structure with interface-language routing (ar default RTL, fr, en) and a home page, and Supabase session refresh in proxy.ts.
- Domain modules with tests: authorization, language pairs, levels, lesson blocks, lifecycle and the quality label, derivation, the exercise engine (ignoring Arabic diacritics), FSRS, reports, platform feedback, settings.
- Supabase migrations: tables, RLS policies, triggers (ownership, derivation, the append-only log, escalation, auditing), 7,919 ISO 639-3 languages, default settings, the platform feedback table. **No commercial tables** (R2).
- 60 tests: 16 for the database rules through PGlite, and 44 for the domain modules and the messages.

## What was done in S1

- Supabase hosted and linked (project `poytjlejclxlobxhyroz`, Paris `eu-west-3`), the four migrations applied, and TypeScript types generated in `src/lib/supabase/database.types.ts`.
- S1 migrations: `20260917000400_accounts_s1.sql`, `20260917000500_storage_buckets.sql`, `20260917000600_usernames.sql` (a unique username ≥ 4 characters with `username_available()` checked before sign-up), `20260917000700_display_names.sql` (a free display name in any language). Forms keep their values after an error, and a "confirm your e-mail" page follows sign-up with a resend option.
- Migration `20260917000400_accounts_s1.sql`: profile visibility (R3), the `profile_cards` view for attribution, `search_languages()`, a constraint that the two languages of a pair differ, auditing of role changes.
- The server layer `src/server/`: turning the session into an `Actor` (`getSession`), the account, profile, pair and role actions, all through `can()` and the policies, then RLS.
- Pages: sign-up, sign-in, password recovery, new password, the e-mail confirmation route (`token_hash` and `code` together), my account, my language pairs; in Arabic (RTL), French and English, and tested at phone width.
- 82 tests: 25 for the database rules in PGlite (9 of them new for S1), and 57 for the domain modules and the messages.
- A unified interface (the light green palette D chosen by Ahmed, and a dark mode that follows the device with neutral colours): the IBM Plex Sans Arabic font bundled, a header with the platform mark and the interface-language menu behind a globe icon (saved in the profile for signed-in members), an account dropdown, e-mail and password fields aligned with their labels in RTL.
- The storage isolation layer (ADR 0005): the `StorageProvider` interface, relative file keys in the database rather than links, a Supabase provider and a memory provider for the tests; the `media-public`/`media-private` buckets and their ownership policies applied to the hosted project and tested in PGlite. Schema-readiness tests: RLS and a primary key on every table, uuid identifiers, no link columns.
- The owner is unlimited with "view as" to try the ranks, an administration dashboard by capability with a sectioned overview, a profile picture, bio, location and a public page `/u/username`, confirmation of every account change, the language menu in the footer after sign-in (R6).
- The administration dashboard v0 (R5, pulled forward from S4): requests, reports, feedback, members and settings, for rank holders only; support requests from inside the platform; the member dashboard after sign-in instead of the visitors' page; split account settings (security: password and e-mail). Ahmed is the platform owner (`platform_owner`).
- Becoming a content creator (R4): hidden in "advanced settings", a commitments page with one confirmation, and the return to Student through support with the function `admin_set_primary_role()` (Administrator and above, recorded in the audit).
- A known limit (Q14): custom e-mail templates wait for a dedicated SMTP provider; the default templates work with links that open in the same browser.

## What was done in S2

- **The plugin contract v1** (`src/modules/plugins`): a Zod schema for the definition, a catalogue of nine field types that generates `content_schema` (JSON Schema 2020-12) and `authoring_fields` from one source, fail-closed validation with translated codes that point to the field, an internal `.lisanplugin.json` format with a sha256 hash over canonical JSON for the core-plugin pipeline only (no import or export for members — R14), and an architecture test that forbids importing plugin files in `src/` and forbids the server from listening to the player bridge.
- **The `.lisanpkg` package** (`src/modules/packages`): deterministic build (same content = same bytes), reading through the central zip directory before decompression, rejection of every required case (size, count, paths, symbolic links, the asset type from its bytes, hashes, schema, references), a stable item identifier, and the four limits as `platform_settings` settings.
- **The sandboxed player**: a `/play` document outside the locale tree and the proxy, with a single inline script pinned by a CSP hash (`default-src 'none'`, `connect-src 'none'`, `img-src blob:`), without cookies or permissions; a `postMessage` bridge with `zod/mini` schemas on both sides and an origin check; a test that fails on any user field in the messages; `PlayerFrame` with `sandbox="allow-scripts"`; the immediate evaluation in the frame is for display, and the authoritative evaluation on the server (`evaluateAnswer`) takes an input that rejects any result coming from the browser; `PLAYER_ORIGIN` from the configuration. The player is ≈ 53 KiB (ADR 0007).
- **The studio `/studio`** (R10): for Contributors and the owner, a standalone page with its own navigation; create / definition / activities (building the item structure from the catalogue, the corrected field, the evaluator and its options) / templates (hints only, no values) / preview in the same player with a temporary item that is never saved / advanced (the generated schema, and pasting a schema in a collapsed section) / overview (contract conformance, publish or request publication, versions, delete the draft). The Contributor role: `become_contributor()` and the page `/account/contributor` with one confirmation; the capabilities `plugins.author/publish/review/disable`.
- **The database**: `plugins` (with an owner column), `plugin_versions` (append-only with a hash), `plugin_publish_requests`, the functions `submit_plugin_version`, `review_plugin_publish_request`, `set_plugin_disabled`, `set_plugin_hidden` and `rollback_content_version`, full RLS, auditing, and `content_versions` without a `body` column (every version points at a package file with a hash). `/admin/plugins` reviews publish requests and holds the disable and hide switches.
- **The two core plugins** `classic-exercises` (multiple choice, fill in the blank ignoring diacritics, matching, word ordering; an optional picture) and `vocab-cards` (front/back/example/picture/tags; self-assessment): produced by the studio pipeline (`scripts/core-plugins.ts`), exported to `plugins/core/`, and seeded by migration `20260918000300` as reference data with their hashes.
- **The content editor `/content`**: a "my content" list filtered by state, kind, plugin and pair; creating a package (plugin → pair → template → title) starts as a file in the store with empty items; the item form is generated from `authoring_fields` for every type with Zod validation and translated messages; add/remove/reorder with buttons; picture upload inside the package with a required alternative text; metadata (dialect, CEFR and sub-level, skills, normalised tags); a preview as a learner in the player with "check on the server"; publication with a second confirmation (full validation → an immutable version file → a `content_versions` row); the change history with rollback; courses gather their owner's packages of their language pair and order them (R11, R15).
- **Added the same day by decisions R12–R17 (after Ahmed's review of the first run):**
  - The raw message keys in `/admin/settings` fixed (`/./g` instead of `/\./g`) with three new guarantees: a test of the dynamic patterns and a test of the catalogues (`src/i18n/message-catalogue.test.ts`), and a loud failure on any missing message outside production (`src/i18n/request.ts`, `IntlProvider`); the skills `no-raw-keys` and `deliberate-choices`.
  - The Arabic font IBM Plex Sans Arabic bundled in the repository (`src/app/fonts`, OFL) through `next/font/local` instead of Google Fonts.
  - **R13** every file in Cloudflare R2 (`R2StorageProvider`, `/api/media`, `npm run storage:verify`, migration `20260918000400` retires Supabase Storage).
  - **R14** no import, export or download: `/studio/import` and the routes `api/plugins/*/export` and `api/packages/*/download` removed.
  - **R15** a course holds packages of its own pair only and the pair is locked inside a course (two triggers in migration `20260918000500`).
  - **R16** the title in English (a constraint in the database and in the code) and optional translations (`content_items.translations`, a collapsed section in the editor, display in the interface language with a fallback to English); plugins: the English name and description are required, the rest optional.
  - **R17** administration: the `admin.oversee_all` capability for the owner and the Super Administrator, the pages `/admin/content` (search first), `/admin/content/<id>` (metadata, owner, versions, derivation chain, preview in the player, hide with a reason / restore through `moderate_content_item()`), `/admin/plugins/<id>` (activities, versions, requests, trying the plugin in the player) and `/admin/users/<username>` (account state, their content, plugins, requests); the content owner reads the hiding reason in the editor. The case system → S4.
- **Tests**: 208 (67 of them for the database rules in PGlite), and `npm run db:verify` checks 67 items on the hosted project.
- **R2 actually connected** (19 September 2026): the private bucket `lisanhub` and the public bucket `lisanhub-public`, `npm run storage:verify` 14/14, and `/api/media` reads from R2 through the provider. **Plugin definitions are files in R2 too** (migration `20260919000100`, `npm run core:plugins:upload`): no plugin or learning content remains in Supabase, the two former buckets were removed, and the audit trail was stripped of the definition bodies it had captured earlier (migration `20260919000200`).
- **The end-to-end run with the owner's account was done** (19 September 2026) in the built-in browser, and what appeared was fixed: an ambiguous `plugin_versions`↔`plugins` relationship in a query (it prevented creating any package), a new draft showed "invalid value" for the description in the three languages, "expected answer" in the player showed the option identifier instead of its text, the confirmation buttons stayed armed after success, the course page said "republish" and "fill the items", the interface language on the member page was a code, and the language fields in the studio became English first with an "optional" marker (R16). The built-in browser blocks the sandboxed frame (`ERR_BLOCKED_BY_CLIENT`), so the player was verified by opening `/play` directly; in Brave/Chrome it works inside the page.
- **Not done yet:** the real Contributor path (a second account with another e-mail that Ahmed creates), and the rotation of the first R2 token.

## Decisions

The full list is in docs/decisions/open-decisions.md (split: what is needed before phase C, and what is deferred to it) and docs/decisions/resolved-decisions.md (R1 to R18; the latest is R18: public repository, voluntary contributions, English-only repository, project site).

## The criterion for moving to phase C (proposed thresholds)

- An average platform rating ≥ 4/5 from active users, with a clear decline in bug reports.
- Founding contributors active within 4 weeks ≥ 50%; weekly active learners after 8 weeks ≥ 30%.
- Derived content ≥ 20% with a rating ≥ 4/5 and justified reports < 5%.
- Real demand for the future paid service (offline and sync) visible in the feedback; and ≥ 5 content creators asking to sell before the marketplace opens.
