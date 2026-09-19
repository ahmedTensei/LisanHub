# Claude Code plugins in this project

These plugins are tools for the way we work inside Claude Code; they are not part of the LisanHub platform and have nothing to do with the platform's own plugins (R7). They are installed on Ahmed's machine and are never pushed to the repository.

Source: the guide "6 plugins that turn Claude Code into a full development team" (AI Automation Academy). Every installation command was checked against the official Claude Code documentation and the projects' repositories before being listed here, and whatever could not be confirmed is said explicitly.

## The precedence rule

**Ahmed's decisions ← the specification ← the project skills ← any external plugin.** A plugin proposes a way of working; when it conflicts with a decision or a project skill, the project's decision wins. No external plugin changes the scope of a stage or a working rule in `CLAUDE.md`.

## Facts confirmed from the Claude Code documentation

- Adding a marketplace: `/plugin marketplace add <owner>/<repo>`; installing: `/plugin install <name>@<marketplace>`.
- The official marketplace is called `claude-plugins-official` and is added automatically at the first interactive run.
- **A plugin runs external code on your machine with your user's permissions** — install only what you know the source of.
- Installation has three scopes: user (all your projects), project (shared in the repository), local (personal). A plugin in one project does not carry over to another automatically.
- `/plugin` then the **Discover** tab shows what is actually available — use it to confirm before any installation.

## 1. Superpowers — recommended (the highest impact)

```
/plugin marketplace add obra/superpowers-marketplace
/plugin install superpowers@superpowers-marketplace
```

It imposes an order before the code: `/superpowers:brainstorm` to refine what is wanted, then `write-plan`, then `execute-plan` in TDD style (a failing test first), with `systematic-debugging` and `verification-before-completion`.

**How it meets our project:** our stage prompts (`docs/prompts/S*.md`) remain the source of scope; use brainstorm and write-plan **inside** the stage's scope, not to widen it. TDD serves `testing-quality` directly: every schema change = a migration + a test.

## 2. `/security-review` — ready, no installation

A **built-in** Claude Code command that reviews the current branch's changes for security (SQL injection, XSS, authentication flaws, keys written in the code, data leaking into logs).

> **Important change:** the project's own security skill used to be named `security-review`, which shadowed this built-in command. It is now named **`platform-security`**, so both are available: `/security-review` reviews the changes, and `platform-security` carries LisanHub's security rules (isolation, untrusted packages, permissions).

Run it before every push that touches authentication, data or any external input (which includes the whole package validator of S2).

**Optional, later:** the GitHub Action from `anthropics/claude-code-security-review` reviews every PR automatically, but it needs an API key in the repository secrets — defer it until the public repository has settled.

## 3. Frontend Design — optional

```
/plugin install frontend-design@claude-plugins-official
```

**Its presence in the official marketplace could not be confirmed** from the documentation (it appears in the demo marketplace inside the claude-code repository). Check the Discover tab before installing.

**If you install it:** our interface decisions come first — the light green palette (R6), Arabic first and RTL with logical properties (`i18n-rtl`), and every text in `messages/`. Treat it as a source of visual ideas, not of decisions.

## 4. gstack — optional, with a condition

```
git clone --single-branch --depth 1 https://github.com/garrytan/gstack.git ~/.claude/skills/gstack
cd ~/.claude/skills/gstack && ./setup
```

Useful parts: `/office-hours` (questions before building), `/plan-eng-review` (scope and edge-case review), `/qa`, `/retro`.

- **Forbidden in this project: `/ship` and `/land-and-deploy`.** The first pushes a branch and opens a PR, the second merges and deploys — both break your rule: no commit and no push without an explicit request from you.
- It installs at the user level (`~/.claude/skills`), so it affects all your projects, needs Bun, and the installation is a `./setup` script (which may need Git Bash on Windows).

## 5. Claude-Mem — not recommended for now

The guide describes it as fully local, but the repository page today says the **default mode is a hosted memory service (cmem.ai) with a sign-in**, and purely local operation needs an explicit provider option. It captures everything that happens in your sessions, and your sessions here carry the `.env.local` keys and the unpublished business-model document.

Your project's context is already kept in `CLAUDE.md`, `docs/` and the Claude project, which are read in every new session. If you decide to try it later: a local provider only, and exclude `.env*` and `docs/specification/` explicitly.

## What no plugin changes

| Rule | Reference |
| --- | --- |
| No commit, push, branch or tag without an explicit request from Ahmed | `CLAUDE.md` |
| `docs/specification/` and any `.env*` (except `.env.example`) are never published | `.gitignore`, Ahmed's decision |
| No fake content anywhere | R8 |
| No kind of learning inside platform code, and no execution of a platform plugin's logic in its process | R7 |
| No commercial feature before phase C | R2 |

## A note on storage

`/.claude/` is excluded in `.gitignore`, so plugin settings and their generated skills stay personal on your machine and never enter the public repository. The source of the project skills remains `claude-skills/`, installed by `npm run setup`.

---

# Second batch (18 September 2026): four skills and three plugins

Every repository was checked before being listed here. **A note of honesty:** my fetch tool returns implausible star counts for some of these repositories, so popularity was not relied on at all — the judgement below rests on the licence, on what the documentation says the tool does, and on which of your files it touches. All of them **run external code on your machine with your permissions**.

## Skills

### 1. Find Skills — `vercel-labs/skills` ✅ recommended

A skills manager that works with more than one agent (not only Claude Code): search, install and update skills from GitHub or a local path. MIT licence. The skill itself is text (`SKILL.md`), not code.

```
npx skills find
npx skills add <owner>/<repo>
```

**Its limit here:** install skills at the user level, not inside the project, because the 19 LisanHub skills come from `claude-skills/` and `npm run setup` alone, and nothing is written into `.claude/` by hand.

### 2. Superpowers — `obra/superpowers` ✅ already installed on your machine

This is the same one you installed from `obra/superpowers-marketplace`. **Do not install it a second time.** MIT licence. Later it can be installed from the official marketplace as `superpowers@claude-plugins-official` if you wish.

### 3. Impeccable — `pbakaus/impeccable` ⚠️ useful in S3, with a condition

Design guidance for interfaces: one skill and 24 commands (`/impeccable audit`, `/impeccable polish`) with deterministic detection rules. Apache-2.0 licence. It runs an executable and may call check scripts from your project's `package.json`.

```
npx impeccable install
```

**Its limit here:** its rules are written for Latin left-to-right interfaces. **Our interface decisions come first**: Arabic first and RTL with logical properties (`i18n-rtl`), the adopted colour palette (R6), and every text in `messages/`. Use it for visual critique, not for decisions, and never let it change a file without your review. Defer it to S3 when the learner interface begins.

### 4. Task Observer — `rebelytics/one-skill-to-rule-them-all` ⚠️ with care

A meta-skill that watches your sessions, captures repeated corrections and proposes improvements to your skills. CC BY 4.0 licence; it writes observation logs **locally** on your disk and needs file-system access.

**Its limit here:** its logs contain your project's details and the text of your sessions. Make sure its log path is **outside the repository or excluded in `.gitignore`** before the first commit after it, and never let it edit the 19 project skills automatically: every proposal goes through you, then is written into `claude-skills/`, then `npm run setup`.

## Plugins

### 5. CodeBurn — `getagentseal/codeburn` ✅ recommended

Tracks token consumption and cost across AI tools by reading the session files present on your machine. MIT licence, local and read-only, no API keys.

```
claude mcp add codeburn -- npx -y codeburn mcp
```

**Its limit here:** it reads the text of your sessions (which contains your code and whatever values you pasted). Local, but do not run it on a shared machine, and if you install the desktop app **decline the anonymous usage reports** as long as you prefer that nothing leaves.

### 6. Graphify — `Graphify-Labs/graphify` ⚠️ risk of leaking the specification

Turns code into a queryable graph (local analysis with tree-sitter). Dual Apache-2.0/MIT licence; needs the `uv` tool (Python).

```
uv tool install graphifyy
graphify install
```

**Important warning:** analysing **documents, PDF files and images** sends their content to a model provider with your key. Your `docs/specification/` folder holds the full specification and the business model, and your decision (R9) is that it is never published. **If you install it, restrict it to the code only** and exclude `docs/` explicitly, or skip it — searching a project of this size is still easy with the ordinary Claude Code tools.

### 7. Ponytail — `DietrichGebert/ponytail` ⚠️ useful but a cultural clash

A skills system that pushes the agent to **write less code**: it reuses and refuses complexity. MIT licence; needs Node for the Claude Code lifecycle hooks.

```
/plugin marketplace add DietrichGebert/ponytail
/plugin install ponytail@ponytail
```

**Its limit here:** its "less code" philosophy is useful against over-engineering, but it **does not cancel our rules**: every schema change is a new migration and a test, every text is in `messages/`, and there is no shortcut in isolation or validation. When its proposal conflicts with a project skill, **the project skill wins** (the precedence rule at the top of this file).

## What does not change whatever you add

No commit and no push without your request; no fake content (R8); full isolation of plugins and content (R7); `docs/specification/` and `.env*` are never published (R9); and any tool that proposes otherwise is refused.
