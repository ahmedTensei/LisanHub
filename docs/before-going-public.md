# Before making the repository public or launching the platform — what must change or be confirmed

Last review: 19 September 2026 (decision R18: the repository is **public** since this day). This list is the result of a full scan of the pushed tree and of every commit in its history: no secret, no key, no `.env.local`, no specification. What follows is everything that appears publicly and needed a decision or a change, with its state.

## 1. Personal or machine-specific data — as it stands in the repository

| # | Where | What | What is done | State |
| --- | --- | --- | --- | --- |
| 1.1 | `LICENSE` line 1, `NOTICE`, `CONTRIBUTING.md`, `site/index.html` | The copyright holder's name **Ahmed Hayani** and the repository link | Required by the PolyForm notice, and the contribution terms need a named licensee. Confirmed by Ahmed with the switch to public (R18). When a company is registered the name is replaced in all four places together | done |
| 1.2 | Git history | The commit author name **Ahmed Hayani** (from `git config user.name`); the `noreply` e-mail reveals nothing | Kept: it matches the licence notice. To show the handle only: `git config user.name ahmedTensei` before the next commits | Ahmed's choice |
| 1.3 | `docs/decisions/*`, `docs/mvp-roadmap.md`, `docs/prompts/*`, `CLAUDE.md` | The first name "Ahmed" as the decision maker | Acceptable publicly for a single-developer project; it reveals no more than the name | done |
| 1.4 | `docs/mvp-roadmap.md`, `docs/prompts/*.md` | Local paths that carried a Windows user name (in the working tree **and** in the two earlier commits) | **Fixed everywhere:** the paths became `%USERPROFILE%\Documents\...`, and the two earlier commits were rewritten with the same replacement before the repository went public, so no commit carries the machine's user name | done |
| 1.5 | `CLAUDE.md`, `docs/mvp-roadmap.md` | The Supabase project reference `poytjlejclxlobxhyroz` | Not a secret (it is in the API address every visitor's browser uses), kept in the documentation | accepted |
| 1.6 | `src/modules/account/account.test.ts` | E-mail addresses in the tests | All `example.com` or fictional strings; no real e-mail | done |
| 1.7 | `docs/mvp-roadmap.md` | A link to a private Claude artifact (an interactive page of the roadmap) | Removed: it is private to Ahmed's account and useless to a visitor | done |

## 2. Official communication channels — all empty now and to be set before receiving users

| # | Channel | Where it is set | Note |
| --- | --- | --- | --- |
| 2.1 | **Support e-mail** | From inside the platform: `/admin/settings` → "Support e-mail (optional)" (stored in `platform_settings.support.email`) | Support requests work inside the platform without an e-mail; the e-mail is an addition. The `support@example.com` placeholder in the messages is only an example and sends nothing |
| 2.2 | **Sender e-mail for confirmation and recovery messages** | A dedicated SMTP provider + a domain (open decision **Q14**), then restore the trilingual templates in `supabase/config.toml` and `npm run db:config:push` | Until then Supabase sends from its default address with a limit of about two messages per hour |
| 2.3 | **Security reports** | `SECURITY.md` points to "Security → Report a vulnerability" on GitHub | **Private vulnerability reporting is enabled** (19 September 2026) |
| 2.4 | **Questions and ideas** | `CONTRIBUTING.md` points to Issues (with templates for bugs and ideas) | Enabled |

## 3. Domain and hosting

| # | What | Where |
| --- | --- | --- |
| 3.1 | The platform's domain (and any additional domains) | `supabase/config.toml`: `site_url` and `additional_redirect_urls` (one entry per domain in the form `https://<domain>/**`) then `npm run db:config:push` and `npm run db:verify` — details in `docs/SETUP.md` |
| 3.2 | Environment variables on the host | `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`, `STORAGE_PROVIDER=r2` with `R2_ACCOUNT_ID`, `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY`, `R2_JURISDICTION` and the two bucket names, and optionally `SITE_URL` and `R2_PUBLIC_BASE_URL` |
| 3.3 | Generated links | Nothing to change: the public profile link follows the page's domain, and e-mail links follow the request's domain |
| 3.4 | A separate subdomain for the sandboxed player (Q20) | The `PLAYER_ORIGIN` variable on the host pointing to a subdomain that serves the same app (such as `player.<domain>`); optional now, required before community plugins open |
| 3.5 | Cloudflare R2 keys (R13) | An API token limited to the two buckets with **Object Read & Write** on the host (the Admin token is used once to create the buckets then revoked); rotate the keys on any doubt — **the first token went through a chat and must be rotated by Ahmed**; a custom domain on the public bucket (`R2_PUBLIC_BASE_URL`) once the volume of pictures deserves it — `docs/SETUP.md` |
| 3.6 | The two former Supabase buckets | Removed by Ahmed on 19 September 2026 (`storage.buckets` is empty) |
| 3.7 | The project site | `https://ahmedtensei.github.io/LisanHub/` from `site/` through `.github/workflows/pages.yml`; a static page about the project, not the platform (R18) |

## 4. Before the first real user (outside the repository)

- A short privacy policy and explicit consent at sign-up (open decision **Q12**, law 18-07 as amended by 25-11).
- The licence of the content members create (**Q7**); `README.md` says explicitly that it is not settled yet.
- Keeping `README.md` honest (decision **R8**): the status line and the number of tests (208 now) are updated with every real change, and no invented numbers.

## 5. When the repository became public (done on 19 September 2026)

1. **Secret scanning + push protection** enabled (free for public repositories; refused while it was private).
2. **Protection of the `main` branch** (prevents deletion and history rewriting; direct pushes remain possible for Ahmed).
3. **Private vulnerability reporting** enabled.
4. The scan of §1 re-run on the final tree and on every commit: `git grep -n -iE "C:\\\\Users|@gmail|\+213" HEAD` returns nothing, and the history holds no credential.
5. `docs/specification/` stays excluded (`.gitignore`) — never published by Ahmed's decision.
6. GitHub Pages enabled with the `site/` workflow as its source; the repository's homepage points to it.

## 6. What is never added to the repository

The `service_role` key or any secret key, `.env.local` and every `.env*` except `.env.example`, `supabase/.temp` (it holds the project reference and the pooler address), the generated `.claude/`, the specification and the business model.
