# Development environment setup

Claude Code runs these steps automatically in the first session (see `CLAUDE.md`) and ticks them here when they are done.

- [x] Check that Node.js 22.12 or newer is installed
- [x] `npm ci`
- [x] `npm run setup` (the 19 skills in `.claude/skills`, CI in `.github`, and the `.vscode` settings)
  - Note: the `/skills` panel of the Claude desktop app shows the claude.ai account skills only (docs, pdf, xlsx…). The 19 project skills do not appear there, but they are loaded: type `/` then the skill name (such as `/mvp-scope` or `/roles-permissions`), or let Claude invoke them by itself according to the task.
- [x] `npm run check` (the full check and the tests)
- [x] Git repository: https://github.com/ahmedTensei/LisanHub — initial import on 18 September 2026 (201 files, PolyForm Noncommercial License 1.0.0); public since 19 September 2026 (R18) with secret scanning, push protection, private vulnerability reporting, a protected `main` and a project site on GitHub Pages. After that: no commit and no push without an explicit request from Ahmed.
- [x] Run `npm run dev` and open http://localhost:3000
- [x] (S1) `npm run db:verify` — 67 checks that prove the app is wired to the hosted project (run it after every `db:push`)
- [x] (S1) Hosted Supabase project: `.env.local` written, `npx supabase login` and `link` run by Ahmed, migrations and settings pushed, types generated
- [x] (R13) Cloudflare R2 connected on 19 September 2026: `STORAGE_PROVIDER=r2`, the private bucket `lisanhub` (created by Ahmed) and the public bucket `lisanhub-public` (created by `npm run storage:verify`), the default jurisdiction (`R2_JURISDICTION=`); 14/14 checks, and `/api/media` actually reads from R2. **Owed by Ahmed:** rotating the R2 token (the current one went through a chat) — create a new token with Object Read & Write limited to the two buckets, paste it into `.env.local`, run `npm run storage:verify`, then delete the old token from the Cloudflare dashboard.
- [x] (R13) The two former Supabase buckets removed (19 September 2026; `storage.buckets` is empty)
- [x] (R13) Plugin definitions are files in R2 (migration `20260919000100`, `npm run core:plugins:upload` 2/2); Supabase holds no plugin or learning content — files only in R2, metadata in the database. The audit trail was stripped of the definition bodies captured earlier (migration `20260919000200`).
- [x] The end-to-end browser run with the owner's account (19 September 2026): a new plugin without code → template → preview → publish; a `classic-exercises` package with the four activity types and a picture with an alternative text → publish → edit → rollback; a cards package; a course of three packages with reordering; a title translation; oversight: search, hide with a reason and restore, disable a plugin and re-enable it, the member page; ar/fr/en and phone width. **The sandboxed frame does not show in Claude's built-in browser** (it blocks `sandbox` without `allow-same-origin`) and was shown working by opening `/play` directly; in Brave/Chrome it works inside the page
- [ ] The real Contributor path (Student → Contributor → publish request → acceptance) needs a second account with another e-mail that Ahmed creates

## Cloudflare R2 — what Ahmed does once (R13, ADR 0008)

Every platform file (packages and their assets, profile pictures, plugin definitions) is stored in R2; Supabase is for accounts and metadata only. The keys are secret: never sent in a chat, never committed; they are pasted directly into `.env.local`.

1. In the Cloudflare dashboard → **R2 Object Storage** → **Overview**: copy the **Account ID** (32 hexadecimal characters) into `R2_ACCOUNT_ID`.
2. **Manage R2 API Tokens** → **Create API token**:
   - Name: `lisanhub`; permission: **Admin Read & Write** (needed once so that `npm run storage:verify` can create the two buckets; afterwards it can be replaced by an **Object Read & Write** token limited to the two buckets).
   - The next page shows the **Access Key ID** and the **Secret Access Key** once only → `R2_ACCESS_KEY_ID` and `R2_SECRET_ACCESS_KEY`.
3. `R2_JURISDICTION` matches the jurisdiction of the two buckets (empty = the default, which is where the current `lisanhub` bucket lives; `eu` if they were created in the European jurisdiction), with `STORAGE_BUCKET_PRIVATE=lisanhub`, `STORAGE_BUCKET_PUBLIC=lisanhub-public` and `STORAGE_PROVIDER=r2`.
4. `npm run storage:verify` — creates the two buckets when missing, writes, reads and deletes a probe object in each, and prints no key. Then `npm run core:plugins:upload` uploads the two core plugin definitions to the private bucket (needed once per environment, and once after every new core version). Then restart `npm run dev`.
5. (Optional, before launch) a custom domain on the public bucket (R2 → the bucket → Settings → Custom Domains) then `R2_PUBLIC_BASE_URL=https://media.<domain>`; without it the app serves pictures from `/api/media/<key>`.
6. Removing the two former Supabase buckets (empty and closed since migration `20260918000400`):

```bash
npx supabase storage rm ss:///media-public ss:///media-private --recursive --linked --experimental
```

## What only Ahmed could do in S1 (done)

Creating a Supabase account cannot be done on your behalf. Ahmed chose the hosted project (Paris) on 17 September 2026. The two options were:

1. **A hosted project**: you create a project in the Supabase dashboard, then Claude Code writes the values into `.env.local` and applies the migrations.
2. **Local run**: requires Docker Desktop, then `npm run db:start` and `npm run db:reset` (the Supabase CLI is downloaded automatically through npx).

The tests run offline (PGlite), and the app reads `.env.local`. To grant yourself an administrative rank: Supabase dashboard → SQL Editor → `insert into public.admin_ranks (user_id, rank) values ('<uuid from auth.users>', 'platform_owner');`

## Before launching on a real domain (or several)

Public profile links and e-mail links contain no hardcoded `localhost` anywhere; all of them derive from the domain that serves the page:

- The public profile link (`/u/<username>`) is built in the browser from `window.location.origin` → follows any domain automatically.
- E-mail confirmation and password recovery links are built on the server from the request's `Origin`/`Host` header (`src/server/site-url.ts`), and can be pinned with the `SITE_URL` environment variable on the host.
- Picture links come from Cloudflare R2 through `/api/media/<key>` (or from `R2_PUBLIC_BASE_URL` when it is set) and are independent of the site's domain.

What must be done by hand when the domain changes (once per domain):

1. In `supabase/config.toml`: `site_url = "https://<domain>"` and add `"https://<domain>/**"` to `additional_redirect_urls` (several domains = several entries in the list, keeping localhost for development).
2. `npm run db:config:push` then `npm run db:verify`.
3. On the host: `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`, the `R2_*` variables (with the names in `.env.example`) and optionally `SITE_URL`.
4. (Q20, before the public launch) a separate subdomain for the sandboxed player: deploy the same app on it and set `PLAYER_ORIGIN=https://player.<domain>` on the main host; no code change (`src/modules/player/document.ts`).
