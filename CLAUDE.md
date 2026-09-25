@AGENTS.md

# LisanHub — project instructions for Claude Code

Community-driven language learning platform. Community members create, review, translate (by copying and deriving) and improve the learning content. Every learning resource belongs to a language pair: comfortable/native language -> target language.

The owner of the project is Ahmed, based in Algeria. He is a solo developer and wants to do nothing by hand that Claude Code can do. Talk to him in Arabic unless he writes in another language. Use Algeria as the default country for anything legal, payments, hosting or market-related unless he says otherwise.

## First session on a new machine

Run this once when `node_modules/` or `.claude/skills/` is missing, then report the result in one short message. (`start-windows.cmd` runs the same steps for Ahmed without Claude Code.)

1. Check `node -v` is 22.12 or newer. If Node is missing, tell Ahmed exactly what to install and stop.
2. `npm ci`
3. `npm run setup` — removes files that older versions shipped (for example `src/modules/entitlements`), then installs `claude-skills/` into `.claude/skills/` (the 19 project skills), `setup/github/` into `.github/` (CI, the Pages workflow, issue and pull request templates) and `setup/vscode/` into `.vscode/`. Remote tools cannot write those dot-folders, which is why their sources live in visible folders. Tell Ahmed that restarting Claude Code loads the skills.
4. `npm run check` — lint, typecheck and the full test suite (includes database invariants against the real migrations in PGlite; no Docker needed).
5. Tick the items in `docs/SETUP.md`.

**Git:** the repository is **https://github.com/ahmedTensei/LisanHub** (public). Ahmed asked for one initial import that replaces the earlier scaffolding and its Apache-2.0 licence with this project and the MIT licence below (`docs/prompts/GIT-initial-push.md`); that import is the single authorised `--force` push, and the local branch `archive/old-remote` keeps the old commits and is never pushed.
**After that import, never `git commit`, `git push`, create a branch or a tag, and never use `--force`, unless Ahmed asks for it explicitly in that message.** Finish the work, leave the tree uncommitted, and tell him in one line that it is ready to commit.
**Licence:** the project is published under the **MIT License** (`LICENSE`, `NOTICE`): commercial and noncommercial use are permitted under its terms. It is **open source** — keep project code under MIT and respect the separate licences of third-party assets. **Outside contributions are accepted under the MIT terms in `CONTRIBUTING.md`.** Security reports go through GitHub private advisories (`SECURITY.md`). **The repository is written in English only** — documentation, decisions, prompts, comments, commit messages — and is never translated into another language; the product's three interface languages live in `messages/` and the e-mail templates, which is content, not repository text. `README.md` is the public face of the project and follows decision R8: no invented status, numbers or features.
**Never publish:** `docs/specification/` (the full specification and the business model — Ahmed's decision, excluded in `.gitignore`), any `.env*` file except `.env.example`, `supabase/.temp`, or the generated `.claude/` copy of the skills.

## Sources of truth, in priority order

1. `docs/decisions/resolved-decisions.md` — decisions by Ahmed. Where a decision explicitly supersedes part of the specification, the decision wins until the document is updated.
2. `docs/specification/specification-ar.md` — the full product specification (Arabic, Markdown copy of `Full_Project_With_Business_Model_AR.docx`). It wins over skills, plans and this file.
3. `claude-skills/<name>/SKILL.md` (installed to `.claude/skills/`; edit the source in `claude-skills/`, then run `npm run setup`) — the specification's structural rules. When a skill and the specification disagree, follow the specification and propose a skill update.
4. `docs/decisions/open-decisions.md` — open questions. Never resolve an open decision by inference.
5. `docs/mvp-roadmap.md` — the build plan (phases A, B, C). A plan, not a requirement.
6. `docs/adr/` — architecture decisions.
7. `docs/before-going-public.md` — everything personal or environment-specific that must be changed or confirmed before the repository goes public or the platform launches; keep it current whenever such an item is added.

## Current state

- Phase **A — complete free platform**. S0 foundations, **S1 (accounts, roles, language pairs)** and **S2 (plugin architecture, Plugin Studio, package format, sandboxed player, content editor, courses; decisions R7, R10, R11) are done in code** (2026-09-18). Ahmed's review of that first run produced decisions **R12–R17** (2026-09-18), all applied in code the same day: files in Cloudflare R2, no import/export/download, language-pair confinement, English titles with optional translations, and the oversight pages of the administration area. On 2026-09-19 plugin definitions moved to R2 as well (migration `20260919000100`, `npm run core:plugins:upload`), the empty Supabase buckets were removed, and the end-to-end browser run with the owner's account was done in the built-in browser (studio → new plugin → template → publish; package with the four classic activities and a picture → publish → edit → rollback; vocab package; course of three packages reordered; title translation; oversight pages: search, hide with a reason, restore, kill switch; ar/fr/en and phone width). **The built-in Claude browser blocks any `iframe sandbox="allow-scripts"` without `allow-same-origin` (`ERR_BLOCKED_BY_CLIENT`), so the sandboxed player is invisible there; it was verified by driving `/play` as a top-level page, and it renders normally in Brave/Chrome.** The audit trail was stripped of the definition bodies it had captured before that move (migration `20260919000200`), so Supabase holds no plugin or learning content at all — verified on 2026-09-19 (0 buckets, 0 objects, metadata rows only) while R2 holds every file. Still owed: a real Contributor account (a second email Ahmed creates) for the request-and-review path, and the rotation of the first R2 token. Next is **S3 (the learner experience)**. See `docs/mvp-roadmap.md` ("ما أُنجز في S2").
- S2 mechanics to keep in mind: plugin definitions and packages are **data** read through `src/modules/plugins` and `src/modules/packages` (never imported; `src/modules/plugins/architecture.test.ts` enforces it); the player document is `src/app/play/route.ts` (outside the locale tree and the proxy) built from `src/player/runtime/` by `npm run player:build` into the committed `src/player/runtime.generated.ts`; modules the player bundles use **`zod/mini`** (ADR 0007); the core plugins come from `scripts/core-plugins.ts` → `plugins/core/*.lisanplugin.json` → a generated seeding migration (`npm run core:plugins`, `scripts/core-plugins-migration.mjs`), never from hand-written SQL; a package's working copy is one `.lisanpkg` file rewritten on every save (`src/server/packages/store.ts`), and publication copies it to an immutable version file.
- **Files live in Cloudflare R2, Supabase keeps accounts and metadata (decision R13, ADR 0008).** `STORAGE_PROVIDER=r2` is the default and needs `R2_ACCOUNT_ID`, `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY` in `.env.local` (never ask for them in chat, never print or commit them). Connected on 2026-09-19: private bucket `lisanhub`, public bucket `lisanhub-public`, default jurisdiction; `npm run storage:verify` 14/14. `STORAGE_PROVIDER=memory` runs a session without files. Supabase Storage is retired (buckets deleted). **Plugin definitions are files too** (`src/server/plugins/store.ts`): the studio draft `plugins/<owner>/<row>-draft.lisanplugin.json` (rewritten on every save), one immutable `plugins/<owner>/<file>.lisanplugin.json` per submitted version, and `plugins/core/<plugin_id>-<version>.lisanplugin.json` for the core plugins (uploaded by `npm run core:plugins:upload`); rows keep `draft_key`/`draft_sha256` and `definition_key`/`definition_sha256`, and every read verifies the hash before the definition is used. Supabase holds no plugin or learning content — metadata only. Public pictures are served by `/api/media/<key>` unless `R2_PUBLIC_BASE_URL` names a bucket domain; the private store is never exposed by URL.
- **Members never import, export or download plugins or packages (decision R14):** content moves through the community inside the platform. `src/modules/plugins/portable.ts` is the internal file format of the core-plugin pipeline only.
- **Names are English first (decision R16):** a package or course `title` is Latin script (DB constraint + `Title` schema), with optional `translations` per interface language shown through `localizedTitle()`; a plugin's `name`/`description` require `en`, the rest is optional. **A course holds packages of its own language pair only** (decision R15, trigger `course_lessons_same_pair`).
- **Administration (decision R17):** the owner and Super Administrators hold `admin.oversee_all` and search/open any content item, plugin or member with a preview (`/admin/content`, `/admin/plugins/<id>`, `/admin/users/<username>`); lower ranks work from queues and, in S4, from cases assigned to or accepted by them — never from a full list. Moderators hide published content with a reason the owner reads (`moderate_content_item()`); the case system (assignment, handover, help, warnings) is S4.
- **No subscriptions, payments or entitlements exist, and none may be built before phase C** (decision R2).
- Supabase: **hosted project connected and linked** (ref `poytjlejclxlobxhyroz`, Paris `eu-west-3`, free tier). Public values live in `.env.local` (never the `service_role` key). Interactive CLI steps (`supabase login`, `link`) are Ahmed's; `npm run db:push`, `db:config:push` and `db:types` run non-interactively once linked. Docker is not installed, so `db:start`/`db:reset` are unavailable on this machine. The free tier refuses custom email templates with the default mailer (open decision Q14): the default Supabase templates are in use and `src/app/[locale]/auth/confirm` accepts both `code` and `token_hash` links.
- Going live on a real domain (or several): nothing in the code hardcodes localhost — public profile links use the browser origin, email links use the request origin (`SITE_URL` can pin it); only `supabase/config.toml` (`site_url`, `additional_redirect_urls`) must list each domain, then `npm run db:config:push`. See docs/SETUP.md.
- The GitHub repository is live since 2026-09-18 and **public since 2026-09-19** (decision R18; `main` tracks `origin/main`). The remote was empty at import time, so no `archive/old-remote` branch was needed. Before the switch every commit was scanned and the two earlier commits were rewritten once to remove a local Windows user name from documentation paths (the one history rewrite Ahmed authorised that day). Settings in place: secret scanning with push protection, private vulnerability reporting, `main` protected against deletion and force pushes, Wiki and Projects off, Issues on with templates. **A project site on GitHub Pages** (`https://ahmedtensei.github.io/LisanHub/`) is built from `site/` by `.github/workflows/pages.yml`: a static English page about the project, never the platform itself, and never a place for invented numbers (R8).
- Ahmed's account is `platform_owner`. Ranks, roles, support requests and settings are managed in `/admin`; `npx supabase db query --linked "<sql>"` remains available for one-off data fixes (never for schema).

## Skills index — read the matching skill before working in that area

| Area | Skill |
| --- | --- |
| Any non-trivial change, scope questions | `project-governance`, `mvp-scope` |
| **Anything that renders, authors, evaluates, stores or copies learning content** | **`plugin-architecture`** |
| Any list of options, defaults, limits, labels or messages — nothing copied from the line above | `deliberate-choices` |
| Any user-visible string, dynamic message key, new enumeration or error code | `no-raw-keys` |
| Module boundaries, dependencies, refactors | `architecture-guardian` |
| APIs, persistence, migrations, providers | `api-data-architecture` |
| Auth, roles, capabilities, ownership | `roles-permissions` |
| Learner experience, levels, language pairs | `learning-platform` |
| Exercise types and evaluation | `learning-exercise-engine` |
| Creating/publishing/reviewing content | `ugc-content-system` |
| Copy, derive, attribution, versions | `content-lineage` |
| Chat, groups, community discovery | `community-chat-system` |
| Money, subscriptions, offline sync, KYC — **phase C only** | `monetization-marketplace` |
| Search, filters, ranking | `search-discovery` |
| Reports, moderation, reputation | `trust-moderation` |
| UI languages, RTL, dialects | `i18n-rtl` |
| Security-sensitive work | `platform-security` |
| Tests and quality gates | `testing-quality` |

## External Claude Code plugins (Ahmed's tooling, not part of the platform)

`docs/claude-code-plugins.md` records which plugins are adopted and why. They are installed on Ahmed's machine, never committed (`/.claude/` is ignored), and they have nothing to do with the platform's own plugins (decision R7).

- **Precedence:** Ahmed's decisions → the specification → the 19 project skills → any external plugin. A plugin never changes a scope, a decision, or a rule in this file.
- `/security-review` is Claude Code's **built-in** command; the project's own security skill is **`platform-security`** (renamed from `security-review` so it stops overriding the built-in). Run `/security-review` before any push that touches auth, data, file parsing or external input.
- **Never run `/ship`, `/land-and-deploy`, or any plugin command that commits, pushes, opens or merges a pull request, or deploys.** Those need Ahmed's explicit request, every time.
- Superpowers' `brainstorm → write-plan → execute-plan` is welcome inside the current stage's prompt (`docs/prompts/S*.md`); it never widens the stage's scope.

## Resolved decisions (details in `docs/decisions/resolved-decisions.md`)

**R7 — every kind of learning is a plugin; content is a separate file that runs sandboxed.** Decided by Ahmed; supersedes the specification's placement of plugins in the maturity phase (community-authored and code plugins stay gated behind verification).

- No kind of learning is platform code. The plugin is built first (declarative in phase A: activities, content JSON Schema, authoring fields, scoring references, `capabilities_required` empty), then the content and curriculum for it. `src/modules/exercises` becomes the first core plugin `classic-exercises`, kept as the reference evaluators.
- Content is a portable `.lisanpkg` package (manifest + `content.json` + `assets/` + sha256) stored through `StorageProvider`; the database keeps metadata, the package key, its hash and the plugin reference — never the content, never a URL. Copy and derive are file copies plus a provenance record; rollback repoints a version at an earlier package.
- Rendering and evaluation happen only inside the sandboxed player: `iframe sandbox="allow-scripts"` without `allow-same-origin`, strict CSP, `connect-src 'none'`, a small Zod-validated `postMessage` bridge. **No user data crosses that bridge** — progress and FSRS stay on the server. The same player serves the editor preview, the learner (S3) and derived content (S4).
- **Two authoring surfaces, never merged:** the **Plugin Studio** (`/studio` — a standalone page, **not** part of `/admin`; open to Contributors, verified contributors and the owner, decision R10) creates plugins **and their templates** from inside the platform — a field-type catalogue generates `content_schema` and `authoring_fields`, previews run in the sandboxed player without persisting anything, versions are append-only with a sha256, and a definition exports/imports as a portable file. The **content editor** (creators) fills a package for an existing plugin from one of its templates. The core plugins are produced by the studio itself, then exported and seeded as reference data.
- Phase A: only the platform owner publishes plugins; the community builds packages on top. Package limits (size, items, assets) are `platform_settings`, not constants. Search indexes metadata only (Q19).
- **The plugin is untrusted too, not only the content.** Platform code never imports a plugin file; definitions and assets are data handed to the player and pinned by sha256. **No plugin logic runs in the platform process** — not in the page, not on the server: the authoritative score is computed server-side by the platform's reference evaluators, and a result coming from the frame is never stored. One frame per activity, zero capabilities (no network, storage, media, clipboard), a per-plugin kill switch, and `PLAYER_ORIGIN` from config so the player can move to its own subdomain (Q20). Future KYC and verification grant publishing rights and reputation — never runtime trust, and never a weaker sandbox.

**R8 — no fake content, ever.** Decided by Ahmed.

- No demo lessons, sample packages, placeholder members, invented ratings or filler text anywhere in the product or the database. Migrations and `seed.sql` carry reference data only: languages, settings, feature flags, core plugin definitions (a plugin is software, not content).
- Numbers in the UI and in `/admin` come from a real query or are not shown. No decorative counters, no charts over invented data.
- Empty states say plainly that nothing exists yet and invite the first contribution, in all three locales. No skeleton cards pretending to be content.
- The starter template is an empty skeleton with hints, never ready-made sentences that look like a real lesson.
- Test fixtures live in test files and never reach the hosted project; a test fails if a migration or `seed.sql` inserts content.

**R2 — free platform first; subscriptions, payments and legal preparation in the final phase.** Decided by Ahmed; supersedes the specification's "paid offline/sync from the first release".

- Phase A: a complete platform that works well, entirely free. Phase B: collect user feedback and ratings, improve. Phase C: legal and commercial preparation, then subscriptions and payments.
- Before phase C, build no subscriptions, payments, payment providers, entitlements, trials, referral rewards, paid content, paid offline downloads or heavy-content sync — no tables, APIs or UI. A database test fails if such tables appear.
- The installable web app (PWA) is fine in phase A. The permanent Founding Member badge is granted from the start; its commercial benefit is applied in phase C.
- If a request would need commercial features, say which phase it belongs to and offer the free alternative.

**R6 — the owner is unlimited (S1).** `platform_owner` holds every capability regardless of primary role (code and the content insert policy). The owner alone can “view as” a narrower rank/role (`lh_view_as` cookie applied in `getSession`; application layer only — RLS still sees the owner). Admin sections are shown and opened only to ranks holding their capability. Profiles carry `avatar_key` (public store, ≤ 2 MB), `bio`, `location`, and a public page `/u/<username>` that respects visibility. Every account change goes through a second confirmation button (`ConfirmSubmit`). Signed-in members get the language menu in the footer. “View as” is chosen from the account menu and only shows a banner while active. Settings are edited through the catalogue in `src/modules/platform/settings.ts` (`SETTING_FIELDS`, `FEATURE_MODES`): labelled per language, chosen from options, never typed.

**R5 — administration inside the platform (S1).** `/admin` (staff only, 404 for everyone else) handles support requests, content/conduct reports, product feedback, members (roles and ranks) and platform settings; no day-to-day use of the Supabase dashboard. Members write to support through `support_requests`; a return to Student is executed by `resolve_support_request()` (Administrator rank). Ranks are assigned with `admin_set_rank()` (Super Administrator below their level, Platform Owner anyone). Signed-in members see a dashboard on `/`, not the landing page; account settings are split into profile, languages, preferences, security and account type/support.

**R4 — becoming a Content Creator (S1).** No visible button: the link sits in a collapsed “advanced settings” section of the account page and leads to `/account/creator`, which lists the commitments and requires one server-verified acknowledgement. There is no self-service way back: `admin_set_primary_role()` (Administrator rank or above, audited) returns an account to Student after support reviews the case; until the S4 admin panel exists, do it with SQL in the Supabase dashboard. Support contact = `platform_settings.support.email` (empty, Q15).

**R3 — profile visibility, usernames and password policy (S1).** Profiles carry a unique Latin `username` (case-insensitive, 4–30 chars, `[A-Za-z0-9_.]`, checked with `username_available()` before sign-up) plus a free-form `display_name` in any script; sign-up reports a used email or username explicitly and ends on `/sign-up/check-email` (pending address in an httpOnly cookie, resend available); Latin-value fields (email, password, username, tags) are always left-aligned. New accounts are `public`; `restricted` hides the profile from everyone but its owner and moderation, while display name, role and the Founding Member badge stay readable through `profile_cards` for attribution. Passwords: at least 8 characters, no complexity rules.

**R1 — progress is free.** Account and learning progress (completed lessons, spaced-repetition due dates, streak, level, settings) is stored server-side for every registered user, free, and restored on any device. Manual export of personal data is always free. Heavy-content sync is the future paid service (phase C).

## Architecture map

```
src/
  app/[locale]/        Next.js App Router pages (UI only, no business rules)
  i18n/                next-intl routing; UI locales ar (default, RTL), fr, en
  proxy.ts             locale negotiation + Supabase session refresh (Next.js 16 "proxy", formerly middleware)
  app/api/languages/   public language typeahead (GET ?q=) over search_languages()
  app/[locale]/auth/confirm  landing point of Supabase email links (verifyOtp / exchangeCodeForSession)
  app/[locale]/account/  member settings (profile, languages, preferences, security, advanced, creator)
  app/[locale]/admin/    staff area (overview, requests, reports, feedback, users, settings), each gated by a capability
  app/[locale]/admin/content/  (R17) oversight: search-first list, item page with owner, versions, derivation chain, sandboxed preview, hide/restore with a reason
  app/[locale]/admin/users/[username]  (R17) one member: account state, role/rank actions, their content, plugins and support requests
  app/[locale]/u/[username]  public member page
  app/[locale]/studio/   (S2, R10) the Plugin Studio for Contributors and the owner: definition, activities, templates, preview, advanced, publish/request
  app/[locale]/content/  (S2, R7) the content editor: my content, new package/course, items, preview, history
  app/[locale]/admin/plugins/  (S2, R10) moderation only: publish requests, kill switch per plugin/version, hiding; [id] (R17) activities, versions, requests and a live preview for reviewers
  app/play/route.ts      (S2, R7) the sandboxed player document: inline runtime pinned by CSP hash, no cookies, no network
  app/api/packages/      package assets as bytes for the sandboxed player, after the actor check (no download — R14)
  app/api/media/         public pictures by key when the R2 bucket has no domain of its own (R13)
  app/fonts/             IBM Plex Sans Arabic woff2 (OFL) served by next/font/local — no Google Fonts request
  player/                runtime/ (TypeScript source of the player, framework-free) + styles.ts + runtime.generated.ts (built)
  components/            UI primitives (ui/), forms/ (client, useActionState), player/ (PlayerFrame), studio/, editor/ (ItemForm generated from authoring fields), admin/ (moderation forms), intl-provider.tsx (throws on a missing message outside production)
  server/                server-only application layer: actor.ts (session -> Actor), actions/, queries/ (oversight.ts for R17), storage/ (provider factory + r2-provider.ts), packages/ (draft/version package files), plugins/ (draft/version definition files, hash-verified), player-origin.ts
  lib/supabase/        typed browser and server clients (@supabase/ssr); database.types.ts is generated
  modules/             framework-free domain modules, each with tests
    account/           UI locales, form schemas with translatable error codes, safe redirects
    authorization/     roles, capabilities, ownership and copy policies, toActor()
    storage/           StorageProvider interface, object-key conventions, in-memory provider (ADR 0005)
    support/           support request kinds, statuses and input rules
    languages/         ISO 639-3 language pairs, dialect preference ranking
    content/           CEFR levels, lesson block schema, lifecycle, quality label, package/course metadata rules (English title, optional translations — R16)
    lineage/           upward derivation chain, derivation notifications
    exercises/         exercise definitions and deterministic evaluation
    learning/          FSRS spaced repetition (ts-fsrs)
    feedback/          product feedback from users (phase B improvement loop)
    moderation/        report types and escalation
    platform/          configurable settings and feature switches
    plugins/           (S2, R7) plugin contract (zod/mini), field-type catalogue, schema + authoring-field generation, validation, hashing, internal file format of the core pipeline, item -> reference-evaluator bridge, kill-switch logic, architecture test
    packages/          (S2, R7) .lisanpkg manifest, deterministic zip build, central-directory reader, byte sniffing, fail-closed validator, stable item ids
    player/            (S2, R7) postMessage bridge schemas (zod/mini), player document + CSP, authoritative-evaluation input
plugins/core/          core plugin definitions written by the studio pipeline (.lisanplugin.json) — data, never imported by src/
supabase/migrations/   schema, row level security, triggers, ISO 639-3 languages, defaults, S1 accounts, (retired) storage buckets, usernames, display names, admin role changes, support requests + admin functions, profile details + owner policy, S2 plugins + publish requests, packages (content_versions without body, rollback, course policy), core plugin seeds, retirement of Supabase Storage (R13), pair confinement + English titles (R15, R16), content moderation with a reason (R17), plugin definitions as files (R13, keys + hashes only)
supabase/templates/    trilingual email templates (inactive until a custom SMTP provider, Q14)
tests/db/              migration, RLS and schema-readiness invariants run in PGlite (auth + storage stubs); storage.test.ts proves no file can live in Supabase
claude-skills/         project skills (source of .claude/skills)
setup/                 sources of .github/ (CI, Pages workflow, issue and PR templates) and .vscode/
site/                  the project site published on GitHub Pages (static, English; not the platform)
scripts/               local setup script
```

Rules that the code already enforces in two places (TypeScript policy + database): Student never publishes; owners edit only their own content, profile and language pairs; only the four administrative ranks edit or hide others' content; a restricted profile is readable by its owner and moderation only, while `profile_cards` keeps attribution public; history is append-only; paid content cannot be derived; progress is stored for everyone for free; no commercial tables exist before phase C.

## Commands

- `npm run dev` — app on http://localhost:3000 (redirects to `/ar`)
- `npm run check` — lint + typecheck + tests (run before every commit)
- `npm run build` — production build
- `npm run setup` — reinstall skills, CI workflow and VS Code settings from their visible sources
- `npm run player:build` — bundle the sandboxed player runtime into `src/player/runtime.generated.ts` (run automatically by `check`, `build` and `dev`)
- `npm run core:plugins` — regenerate `plugins/core/*.lisanplugin.json` through the studio pipeline; a new core version then needs a new seeding migration via `node scripts/core-plugins-migration.mjs <timestamp>` **and** `npm run core:plugins:upload` (puts the files in R2 at the keys the migration names)
- `npm run db:verify` — proves the app is wired to the hosted project (auth settings, every table/view/function, buckets, migration history in sync); run it after every `db:push`
- `npm run db:push` — apply new migrations to the linked hosted project; `npm run db:config:push` — push `supabase/config.toml` auth settings (run `npx supabase config diff` first)
- `npm run db:types` — regenerate `src/lib/supabase/database.types.ts` from the linked project after a migration
- `npm run db:start` / `npm run db:reset` — local Supabase through `npx supabase` (requires Docker, not installed here)
- `npm run storage:verify` — creates the two R2 buckets when missing and round-trips a probe object in each (reads `R2_*` from `.env.local`, prints no secret)

## Working rules

1. Classify every request by roadmap stage before building. Never promote a deferred feature into the MVP.
2. Never let an undecided item become a decision by inference. Surface it and add it to `docs/decisions/open-decisions.md`.
3. Business rules live in `src/modules`, never in React components. Authorization goes through capabilities, never inline role-name checks.
4. Every schema change is a new migration plus a test in `tests/db/`. Never edit an applied migration.
5. A Student never publishes. Local personal copies and published derivations are two distinct operations.
6. RTL is first-class: logical CSS properties (`ps-`, `me-`, `start-`), no left/right assumptions.
7. Never show the word "Fork" in the UI; use plain wording such as «أنشئ نسختك» ("create your copy") or «ترجم هذا الدرس» ("translate this lesson").
8. All user-visible strings go in `messages/{ar,fr,en}.json`; `src/i18n/message-usage.test.ts` fails on any `t("…")` key missing from the catalogue, `src/i18n/message-catalogue.test.ts` checks every dynamic key pattern and every enumeration the pages translate, and a missing message throws outside production. Message keys never contain dots (namespace separators). **No raw key, code or placeholder ever reaches the screen** (`no-raw-keys`), and **no option list, default or message is copied from its neighbour** (`deliberate-choices`).
9. Moderation and quality thresholds are settings (`platform_settings`), never constants.
10. No commercial feature before phase C (decision R2). Users' feedback about the platform goes to `product_feedback`.
11. **No kind of learning is platform code (decision R7).** A new activity kind is a plugin, its content is a package, and it renders only inside the sandboxed player. Never add a per-kind branch to rendering, authoring or scoring code, and never pass user data across the player bridge. **Treat every plugin as untrusted, including ours:** never import a plugin file into platform code, never run plugin logic in the platform process, and never store a score the frame reported. Read `plugin-architecture` first.
12. **Never create fake content or fabricated numbers (decision R8).** No demo or placeholder lessons, packages, members, ratings or filler text — not in migrations, not in `seed.sql`, not in the UI. Build an honest empty state instead, and show a number only when a real query produces it.
13. **The S2 boundaries are tested, keep them:** plugin definitions and packages are read as data (never `import`ed), the server never imports the player bridge, the evaluation input has no field for a frame result, templates carry hints only, and the player document holds one inline script pinned by its CSP hash. Modules bundled into the player use `zod/mini` (ADR 0007).
14. Files go through `StorageProvider` (`src/modules/storage`, chosen by `STORAGE_PROVIDER`: `r2` or `memory`); the database stores relative object keys (`*_key`), never URLs or bucket names; ownership is decided by the server before every read and write, because R2 knows nothing about members (ADR 0005, ADR 0008). Never write a file to Supabase Storage.
