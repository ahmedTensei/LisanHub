# One-time task — clean the repository, push the project and configure it

> How to use: in Claude Code (not in plan mode) write one line:
> "Execute the instructions in docs/prompts/GIT-initial-push.md"
>
> Do everything here yourself without asking Ahmed for any step, except signing in to GitHub if it is requested.

The repository: **https://github.com/ahmedTensei/LisanHub** (public). It currently holds three commits of an initial scaffold under Apache-2.0, and **all of them are replaced** by Ahmed's decision today (18 September 2026).

## The decisions this task implements

1. **Licence: MIT License** — commercial and noncommercial use are permitted under its terms. The `LICENSE` and `NOTICE` files are ready in the project. The previous Apache-2.0 disappears.
2. **A clean history**: the content of the `main` branch is replaced entirely by a new history. This is **the only time** `--force` is allowed, by Ahmed's explicit decision.
3. **Outside contributions are closed for now**: `CONTRIBUTING.md` and `SECURITY.md` say so. (Opened later by decision R18.)
4. **Never published**: `docs/specification/` (the specification and the business model), any `.env*` except `.env.example`, `supabase/.temp`, and `.claude/`.

## 1. Before anything

1. `npm run check` — never commit a failing tree. If something fails, fix it first.
2. Make sure `.git` does not exist in the project. If it does, stop and ask Ahmed.
3. Make sure these files exist and are current: `LICENSE`, `NOTICE`, `README.md`, `CONTRIBUTING.md`, `SECURITY.md`, `docs/quickstart.md`.
4. Check `.gitignore`: `.env*` with `!.env.example`, `/.claude/`, `/docs/specification/`, `supabase/.temp`, `node_modules`, and `.next`.

## 2. The security check — fails closed

```
git init -b main
git add -A
```

Then run the two checks below; both **must return nothing**:

```
git ls-files --cached | Select-String -Pattern "^\.env(?!\.example)|supabase/\.temp|docs/specification/|^\.claude/"
git grep -I --cached -nE "service_role|sb_secret_|SUPABASE_SERVICE|BEGIN [A-Z ]*PRIVATE KEY"
```

If anything appears: **stop immediately**, do not commit, and tell Ahmed the file and the reason.

## 3. The first commit

One commit holding the whole current project (S0, S1, the skills, the documentation and the licence), with a clear English message.

## 4. Archive the old content before wiping it

```
git remote add origin https://github.com/ahmedTensei/LisanHub.git
git fetch origin main
git branch archive/old-remote origin/main
```

This branch is **local only and is never pushed**; it remains as a copy of the three old commits should Ahmed ever need them.

## 5. Push, replacing the history

```
git push --force -u origin main
```

If authentication is requested: **do not ask Ahmed for a token or a password in the chat, and do not write any token in a file.** Tell him to complete the sign-in in the browser window Git Credential Manager opens, or to run `gh auth login` himself, then try again.

## 6. Verify what was pushed

```
gh api "repos/ahmedTensei/LisanHub/git/trees/main?recursive=1" --jq ".tree[].path"
```

Make sure the list **does not contain**: any `.env` file (except `.env.example`), `docs/specification/`, `supabase/.temp/`, or `.claude/`. Make sure the new `LICENSE` is present and that the old repository's files (`map/` and what used to be in `docs/`) are gone.

> Expected note: GitHub should recognise the MIT License from the standard `LICENSE` file.

## 7. Repository settings (with `gh`)

Run them one by one, and skip whatever fails while mentioning it in the final report:

```
gh repo edit ahmedTensei/LisanHub --description "Community-driven language-learning platform. Open source under the MIT License. Early development." --enable-wiki=false --enable-projects=false --enable-issues=true --enable-discussions=false
gh repo edit ahmedTensei/LisanHub --add-topic language-learning --add-topic nextjs --add-topic supabase --add-topic typescript --add-topic rtl --add-topic arabic --add-topic plugins --add-topic open-source
gh api -X PATCH repos/ahmedTensei/LisanHub -f "security_and_analysis[secret_scanning][status]=enabled" -f "security_and_analysis[secret_scanning_push_protection][status]=enabled"
gh api -X PUT repos/ahmedTensei/LisanHub/vulnerability-alerts
gh api -X PUT repos/ahmedTensei/LisanHub/automated-security-fixes
```

**Secret scanning with push protection is the most important**: it prevents pushing a key by mistake to a public repository, and it is free for public repositories.

Then the protection of the `main` branch — it prevents deleting the branch and rewriting its history, and keeps direct pushes possible for Ahmed alone:

```
gh api -X PUT repos/ahmedTensei/LisanHub/branches/main/protection -H "Accept: application/vnd.github+json" -F "required_status_checks=null" -F "enforce_admins=false" -F "required_pull_request_reviews=null" -F "restrictions=null" -F "allow_force_pushes=false" -F "allow_deletions=false"
```

If this command fails, skip it and mention it; the rest matters more.

## 8. Only after the push and the verification succeed

1. Delete the local backup at Ahmed's request:
   ```
   Remove-Item -Recurse -Force "%USERPROFILE%\Documents\LisanHub-backups"
   ```
   then make sure the folder no longer exists. **Do not delete it before verifying the push.**
2. Tick the Git item in `docs/SETUP.md` as done with the repository link, and update "Current state" in `CLAUDE.md` to say the repository is live.
3. Summarise for Ahmed in Arabic: the number of files pushed, what was excluded, the settings that were applied and those that failed, and the repository link.

## The permanent rule after this task

**No commit, push, branch, tag or `--force` without an explicit request from Ahmed in his message.** Finish the work, leave the tree uncommitted, and tell him: "ready to commit whenever you want".
