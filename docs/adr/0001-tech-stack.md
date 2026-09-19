# ADR 0001 — The technical stack of the first release

- **Status:** adopted to start (17 September 2026). Open to review before S1 if a reason appears.
- **Context:** one developer, web first (PWA), an Arabic RTL interface with other languages, community content with fine-grained permissions.

## Decision

| Layer | Choice | Reason |
| --- | --- | --- |
| Interface and server | Next.js 16 (App Router) + React 19 + TypeScript | One framework for the interface and the server, and public lesson pages that can be indexed |
| Styling | Tailwind CSS 4 with logical properties | RTL and LTR support without duplication |
| Translation | next-intl 4 | ICU messages, routing by language, `proxy.ts` |
| Data | Supabase (Postgres + RLS + Auth + Storage + Realtime) | Enforces the ownership rule in the database, and provides authentication and chat |
| Data validation | Zod 4 | Schemas of lesson blocks and exercises on the server and in the interface |
| Spaced repetition | ts-fsrs 5 (FSRS-6) | A modern, ready and tested algorithm |
| Tests | Vitest 5 + PGlite | Testing the migrations and the RLS policies without Docker |
| Quality | ESLint (eslint-config-next) + Prettier + GitHub Actions | Automatic checks on every change |

## Consequences

- The migrations in `supabase/migrations` are the source of the database schema, and are tested in `tests/db`.
- The PGlite tests use a simplified stand-in for Supabase's `auth` schema; the final verification happens on a real Supabase project.
- Not added yet: Serwist/Dexie (offline, S6), Sentry and PostHog, the payment provider (Q4).
