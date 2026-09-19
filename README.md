# LisanHub

A community-driven platform where people create, review, translate and improve language-learning material. Every resource belongs to a **language pair** — the learner's comfortable language → the language they are learning — so a Kabyle speaker learning Turkish and a French speaker learning Algerian Arabic are first-class cases, not afterthoughts.

**Status: early development. Not usable yet, and not deployed.** There is no public instance, no content, and no sign-up. This repository is published for transparency while it is being built. A short project page lives at **https://ahmedtensei.github.io/LisanHub/**.

## What exists today

- Accounts: email sign-up with confirmation, sign-in, password reset, unique usernames, public profile pages with a visibility setting.
- Roles and ranks: Student and Content Creator, four administrative ranks, capability-based authorization enforced in TypeScript **and** in Postgres row-level security.
- Language pairs over the full ISO 639-3 set (7,919 languages), with dialect handled as a tag rather than a separate language.
- An in-platform admin area: members, ranks, support requests, reports, product feedback, platform settings, plugin review with a live preview, and — for the owner and super administrators — search-first oversight of any content item with its versions, derivation chain and sandboxed preview, plus hiding with a written reason.
- Files (packages, package assets, profile pictures, plugin definitions) in Cloudflare R2 behind a storage abstraction, each pinned by its sha256 hash; Supabase holds accounts and metadata only — no file and no learning content.
- The plugin architecture (decision R7): a declarative plugin contract, a Plugin Studio at `/studio` where Contributors compose a kind of activity from a field-type catalogue without code (with templates and moderation review before publication), a `.lisanpkg` package format with a fail-closed validator, and a sandboxed player document (`/play`) that never receives user data.
- A content editor at `/content`: packages generated from a plugin's authoring fields, pictures stored inside the package, metadata (CEFR, skills, tags), learner preview in the sandboxed player, versioned publication with rollback, optional translations of English titles, and courses that order a creator's own packages of the same language pair.
- Two core plugins produced by the studio pipeline and seeded as reference data: classic exercises (multiple choice, fill in the blank, matching, word order) and self-assessed vocabulary cards.
- Interface in Arabic (default, RTL), French and English.
- 208 automated tests, including database invariants run against the real migrations, and guards that no raw translation key can reach the screen.

## What does not exist yet

The learner experience (browsing, studying, spaced review, progress), derivation and attribution, community chat, ratings — all of it is next. Nothing in this repository fakes those: there is no demo content, no sample lessons and no placeholder statistics anywhere, by design.

## Architecture in one paragraph

The platform contains **no built-in kind of learning**. Each kind of activity is defined by a **plugin** (a declarative contract: activities, a JSON Schema for its content, authoring fields, scoring references), content is a **portable package file** built for that plugin, and both are rendered and evaluated inside a **sandboxed frame that can never reach user data** — no identity, no progress, no settings cross that boundary, and the authoritative score is recomputed on the server. Copying and deriving someone's lesson is therefore a file copy plus a provenance record.

Stack: Next.js 16 (App Router), React 19, TypeScript, Tailwind CSS 4, next-intl, Supabase (Postgres + RLS + Auth + Storage), Zod, ts-fsrs, Vitest with PGlite.

## Licence — source-available, noncommercial

This project is **not open source**. It is licensed under the [PolyForm Noncommercial License 1.0.0](LICENSE): you may read, run, modify and share it for any **noncommercial** purpose, including personal study, research and use by nonprofits, schools and public institutions. **Any commercial use requires a separate written licence from the copyright holder.**

Learning content created by members inside the platform is a separate question and is licensed separately; that decision is not final yet.

## Contributions

Anyone may send changes: bug reports and ideas through Issues, and code, documentation or interface-text improvements through pull requests — please open an issue first for anything beyond a small fix. **A contribution is a voluntary gift, not a stake:** contributors keep the copyright of their own work and license it to the project owner, including the right to relicense it, and a contribution creates no ownership, share, revenue right or say in the project's direction. The full terms are in [CONTRIBUTING.md](CONTRIBUTING.md#contribution-terms) and are confirmed in every pull request. Security reports are covered in [SECURITY.md](SECURITY.md).

The repository is written in English only (the product's three interface languages live in `messages/`). Community participation in the product itself is designed to happen **inside the platform** — creating, reviewing and translating learning material — not in this repository.
