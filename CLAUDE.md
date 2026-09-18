@AGENTS.md

# LisanHub — project instructions for Claude Code

Community-driven language learning platform. Community members create, review, translate (by copying and deriving) and improve the learning content. Every learning resource belongs to a language pair: comfortable/native language -> target language.

The owner of the project is Ahmed, based in Algeria. He is a solo developer and wants to do nothing by hand that Claude Code can do. Talk to him in Arabic unless he writes in another language. Use Algeria as the default country for anything legal, payments, hosting or market-related unless he says otherwise.

## First session on a new machine

Run this once when `node_modules/` or `.claude/skills/` is missing, then report the result in one short message. (`start-windows.cmd` runs the same steps for Ahmed without Claude Code.)

1. Check `node -v` is 22.12 or newer. If Node is missing, tell Ahmed exactly what to install and stop.
2. `npm ci`
3. `npm run setup` — removes files that older versions shipped (for example `src/modules/entitlements`), then installs `claude-skills/` into `.claude/skills/` (the 17 project skills), `setup/github/` into `.github/` (CI) and `setup/vscode/` into `.vscode/`. Remote tools cannot write those dot-folders, which is why their sources live in visible folders. Tell Ahmed that restarting Claude Code loads the skills.
4. `npm run check` — lint, typecheck and the full test suite (includes database invariants against the real migrations in PGlite; no Docker needed).
5. Tick the items in `docs/SETUP.md`.

**Git:** the repository is **https://github.com/ahmedTensei/LisanHub** (public). Ahmed asked for one initial import that replaces the earlier scaffolding and its Apache-2.0 licence with this project and the licence below (`docs/prompts/GIT-initial-push.md`); that import is the single authorised `--force` push, and the local branch `archive/old-remote` keeps the old commits and is never pushed.
**After that import, never `git commit`, `git push`, create a branch or a tag, and never use `--force`, unless Ahmed asks for it explicitly in that message.** Finish the work, leave the tree uncommitted, and tell him in one line that it is ready to commit.
**Licence:** the project is published under the **PolyForm Noncommercial License 1.0.0** (`LICENSE`, `NOTICE`): noncommercial use is allowed, commercial use needs Ahmed's written permission. It is **source-available, not open source** — never describe it as open source, never add a second or replacement licence, never relicense a file, and never copy in code whose licence is incompatible with that (GPL/AGPL/SSPL included). Code contributions from outside are closed for now (`CONTRIBUTING.md`); security reports go through GitHub private advisories (`SECURITY.md`). `README.md` is the public face of the project and follows decision R8: no invented status, numbers or features.
**Never publish:** `docs/specification/` (the full specification and the business model — Ahmed's decision, excluded in `.gitignore`), any `.env*` file except `.env.example`, `supabase/.temp`, or the generated `.claude/` copy of the skills.

## Sources of truth, in priority order

1. `docs/decisions/resolved-decisions.md` — decisions by Ahmed. Where a decision explicitly supersedes part of the specification, the decision wins until the document is updated.
2. `docs/specification/specification-ar.md` — the full product specification (Arabic, Markdown copy of `Full_Project_With_Business_Model_AR.docx`). It wins over skills, plans and this file.
3. `claude-skills/<name>/SKILL.md` (installed to `.claude/skills/`; edit the source in `claude-skills/`, then run `npm run setup`) — the specification's structural rules. When a skill and the specification disagree, follow the specification and propose a skill update.
4. `docs/decisions/open-decisions.md` — open questions. Never resolve an open decision by inference.
5. `docs/mvp-roadmap.md` — the build plan (phases A, B, C). A plan, not a requirement.
6. `docs/adr/` — architecture decisions.

## Current state

- Phase **A — complete free platform**. S0 foundations and **S1 (accounts, roles, language pairs) are done in code** (2026-09-17); next is **S2, redefined by decision R7: the plugin architecture, the content package format, the sandboxed player, a schema-generated editor, and the first core plugin.** See `docs/mvp-roadmap.md` and `docs/prompts/S2-content-engine-and-editor.md`.
- **No subscriptions, payments or entitlements exist, and none may be built before phase C** (decision R2).
- Supabase: **hosted project connected and linked** (ref `poytjlejclxlobxhyroz`, Paris `eu-west-3`, free tier). Public values live in `.env.local` (never the `service_role` key). Interactive CLI steps (`supabase login`, `link`) are Ahmed's; `npm run db:push`, `db:config:push` and `db:types` run non-interactively once linked. Docker is not installed, so `db:start`/`db:reset` are unavailable on this machine. The free tier refuses custom email templates with the default mailer (open decision Q14): the default Supabase templates are in use and `src/app/[locale]/auth/confirm` accepts both `code` and `token_hash` links.
- Going live on a real domain (or several): nothing in the code hardcodes localhost — public profile links use the browser origin, email links use the request origin (`SITE_URL` can pin it); only `supabase/config.toml` (`site_url`, `additional_redirect_urls`) must list each domain, then `npm run db:config:push`. See docs/SETUP.md.
- Ahmed's account is `platform_owner`. Ranks, roles, support requests and settings are managed in `/admin`; `npx supabase db query --linked "<sql>"` remains available for one-off data fixes (never for schema).

## Skills index — read the matching skill before working in that area

| Area | Skill |
| --- | --- |
| Any non-trivial change, scope questions | `project-governance`, `mvp-scope` |
| **Anything that renders, authors, evaluates, stores, copies or exports learning content** | **`plugin-architecture`** |
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

- **Precedence:** Ahmed's decisions → the specification → the 17 project skills → any external plugin. A plugin never changes a scope, a decision, or a rule in this file.
- `/security-review` is Claude Code's **built-in** command; the project's own security skill is **`platform-security`** (renamed from `security-review` so it stops overriding the built-in). Run `/security-review` before any push that touches auth, data, file parsing or external input.
- **Never run `/ship`, `/land-and-deploy`, or any plugin command that commits, pushes, opens or merges a pull request, or deploys.** Those need Ahmed's explicit request, every time.
- Superpowers' `brainstorm → write-plan → execute-plan` is welcome inside the current stage's prompt (`docs/prompts/S*.md`); it never widens the stage's scope.

## Resolved decisions (details in `docs/decisions/resolved-decisions.md`)

**R7 — every kind of learning is a plugin; content is a separate file that runs sandboxed.** Decided by Ahmed; supersedes the specification's placement of plugins in the maturity phase (community-authored and code plugins stay gated behind verification).

- No kind of learning is platform code. The plugin is built first (declarative in phase A: activities, content JSON Schema, authoring fields, scoring references, `capabilities_required` empty), then the content and curriculum for it. `src/modules/exercises` becomes the first core plugin `classic-exercises`, kept as the reference evaluators.
- Content is a portable `.lisanpkg` package (manifest + `content.json` + `assets/` + sha256) stored through `StorageProvider`; the database keeps metadata, the package key, its hash and the plugin reference — never the content, never a URL. Copy and derive are file copies plus a provenance record; rollback repoints a version at an earlier package.
- Rendering and evaluation happen only inside the sandboxed player: `iframe sandbox="allow-scripts"` without `allow-same-origin`, strict CSP, `connect-src 'none'`, a small Zod-validated `postMessage` bridge. **No user data crosses that bridge** — progress and FSRS stay on the server. The same player serves the editor preview, the learner (S3) and derived content (S4).
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
  app/[locale]/u/[username]  public member page
  components/          UI primitives (ui/), forms/ (client, useActionState), site header, extension-guard (dev only)
  server/              server-only application layer: actor.ts (session -> Actor), actions/, queries/, storage/ (provider factory)
  lib/supabase/        typed browser and server clients (@supabase/ssr); database.types.ts is generated
  modules/             framework-free domain modules, each with tests
    account/           UI locales, form schemas with translatable error codes, safe redirects
    authorization/     roles, capabilities, ownership and copy policies, toActor()
    storage/           StorageProvider interface, object-key conventions, in-memory provider (ADR 0005)
    support/           support request kinds, statuses and input rules
    languages/         ISO 639-3 language pairs, dialect preference ranking
    content/           CEFR levels, lesson block schema, lifecycle, quality label
    lineage/           upward derivation chain, derivation notifications
    exercises/         exercise definitions and deterministic evaluation
    learning/          FSRS spaced repetition (ts-fsrs)
    feedback/          product feedback from users (phase B improvement loop)
    moderation/        report types and escalation
    platform/          configurable settings and feature switches
    plugins/           (S2, R7) plugin contract: activities, content schema, authoring fields, scoring refs
    packages/          (S2, R7) .lisanpkg reader/writer, validation and limits — framework-free
  app/[locale]/play/   (S2, R7) the sandboxed player document: opaque origin, strict CSP, postMessage bridge
supabase/migrations/   schema, row level security, triggers, ISO 639-3 languages, defaults, S1 accounts, storage buckets, usernames, display names, admin role changes, support requests + admin functions, profile details + owner policy
supabase/templates/    trilingual email templates (inactive until a custom SMTP provider, Q14)
tests/db/              migration, RLS, storage-policy and schema-readiness invariants run in PGlite (auth + storage stubs)
claude-skills/         project skills (source of .claude/skills)
setup/                 sources of .github/ and .vscode/
scripts/               local setup script
```

Rules that the code already enforces in two places (TypeScript policy + database): Student never publishes; owners edit only their own content, profile and language pairs; only the four administrative ranks edit or hide others' content; a restricted profile is readable by its owner and moderation only, while `profile_cards` keeps attribution public; history is append-only; paid content cannot be derived; progress is stored for everyone for free; no commercial tables exist before phase C.

## Commands

- `npm run dev` — app on http://localhost:3000 (redirects to `/ar`)
- `npm run check` — lint + typecheck + tests (run before every commit)
- `npm run build` — production build
- `npm run setup` — reinstall skills, CI workflow and VS Code settings from their visible sources
- `npm run db:verify` — proves the app is wired to the hosted project (auth settings, every table/view/function, buckets, migration history in sync); run it after every `db:push`
- `npm run db:push` — apply new migrations to the linked hosted project; `npm run db:config:push` — push `supabase/config.toml` auth settings (run `npx supabase config diff` first)
- `npm run db:types` — regenerate `src/lib/supabase/database.types.ts` from the linked project after a migration
- `npm run db:start` / `npm run db:reset` — local Supabase through `npx supabase` (requires Docker, not installed here)

## Working rules

1. Classify every request by roadmap stage before building. Never promote a deferred feature into the MVP.
2. Never let an undecided item become a decision by inference. Surface it and add it to `docs/decisions/open-decisions.md`.
3. Business rules live in `src/modules`, never in React components. Authorization goes through capabilities, never inline role-name checks.
4. Every schema change is a new migration plus a test in `tests/db/`. Never edit an applied migration.
5. A Student never publishes. Local personal copies and published derivations are two distinct operations.
6. RTL is first-class: logical CSS properties (`ps-`, `me-`, `start-`), no left/right assumptions.
7. Never show the word "Fork" in the UI; use plain wording such as «أنشئ نسختك» or «ترجم هذا الدرس».
8. All user-visible strings go in `messages/{ar,fr,en}.json`; `src/i18n/message-usage.test.ts` fails on any `t("…")` key missing from the catalogue, and message keys never contain dots (namespace separators).
9. Moderation and quality thresholds are settings (`platform_settings`), never constants.
10. No commercial feature before phase C (decision R2). Users' feedback about the platform goes to `product_feedback`.
11. **No kind of learning is platform code (decision R7).** A new activity kind is a plugin, its content is a package, and it renders only inside the sandboxed player. Never add a per-kind branch to rendering, authoring or scoring code, and never pass user data across the player bridge. **Treat every plugin as untrusted, including ours:** never import a plugin file into platform code, never run plugin logic in the platform process, and never store a score the frame reported. Read `plugin-architecture` first.
12. **Never create fake content or fabricated numbers (decision R8).** No demo or placeholder lessons, packages, members, ratings or filler text — not in migrations, not in `seed.sql`, not in the UI. Build an honest empty state instead, and show a number only when a real query produces it.
13. Files go through `StorageProvider` (`src/modules/storage`, chosen by `STORAGE_PROVIDER`); the database stores relative object keys (`*_key`), never URLs; buckets `media-public`/`media-private` enforce ownership from the key path (ADR 0005).
