# Contributing

Thank you for looking. Anyone may send changes to this project. Please read this page first: it says how to contribute and, more importantly, on what terms.

## Contribution terms

**Please read this before opening a pull request.** LisanHub is licensed under the [MIT License](LICENSE). Contributions to the code, documentation, translations and other repository material are accepted under the MIT License. **By opening a pull request, or by otherwise submitting material to this repository, you confirm that you have the right to submit it and agree that it may be distributed under the MIT License.**

1. **A contribution is voluntary and unpaid.** No payment, credit, position or other consideration is owed in return.
2. **You confirm that you have the right to contribute it.** The contribution is your own original work, or you have the necessary rights to it; no employer, client or other party holds rights over it that conflict with its distribution under the MIT License.
3. **The owner decides.** Whether a contribution is merged, changed, rewritten, delayed or declined is the owner's decision, and a merged contribution may later be modified or removed.
4. **No warranty or liability** is provided beyond what the MIT License states.

These terms are a practical arrangement between individuals, not legal advice; if they do not suit you, please do not contribute code — an issue with your idea is still welcome. The wording may be refined with a professional later; a change to these terms never applies retroactively to contributions already accepted.

## What is welcome

- **Bug reports** and **ideas** through GitHub Issues. Say what you expected, what happened, and how to reproduce it.
- **Pull requests** for bugs, for the current roadmap stage (see below), for documentation and for the interface texts in `messages/`.
- **Security reports** — do not open an Issue and do not open a pull request. Follow [SECURITY.md](SECURITY.md).

Where community participation *in the product* happens: LisanHub is built so that the community contributes **inside the platform** — creating lessons and exercises, reviewing them, translating them into other language pairs, reporting mistakes and outdated expressions. That path opens when the platform does.

## Before you start on code

1. **Open an issue first** for anything beyond a small, obvious fix, and wait for a reply. The architecture and the roadmap are deliberate; a change that conflicts with them will be declined however good the code is, and it is better to learn that before spending your time.
2. **Read the rules the code enforces.** `CLAUDE.md` is the project's working instructions and is worth reading even if you do not use Claude Code: the roadmap stages, the resolved decisions in `docs/decisions/`, the architecture decisions in `docs/adr/`, and the skills in `claude-skills/` describe the boundaries the tests protect.
3. The most important boundaries, in one breath: no kind of learning is platform code (everything is a plugin rendered in the sandboxed player, which never receives user data); no commercial feature before phase C; no fake content anywhere; every user-visible string in the three message catalogues; every schema change is a new migration plus a database test; RTL is first-class.

## Working on a change

- Fork the repository, create a branch, and keep the pull request focused on one thing.
- Run `npm ci`, then `npm run check` (lint, types and the full test suite — the database tests run in PGlite, no Docker or Supabase account needed) and `npm run format:check`. CI runs the same and must be green.
- Add or update tests for what you change. A behaviour without a test is treated as unspecified.
- Do not commit `.env*` files (only `.env.example` is tracked), generated folders, or anything from `docs/specification/` (which is not published).
- Write commit messages and code comments in English. The repository is English-only; the three interface languages live in `messages/` and in the e-mail templates, which is product content, not repository text.
- Fill in the pull request template, including the checkbox that confirms the contribution terms above.

## Running it locally

The repository is public so the work can be read, audited and improved. Running the app needs a Supabase project and a Cloudflare R2 account of your own (or `STORAGE_PROVIDER=memory` for a session without files); see `docs/SETUP.md` and `docs/quickstart.md`. There is no public instance and no shared database.
