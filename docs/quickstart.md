# LisanHub — quick start (for Ahmed)

> The public face of the project is `README.md`. This file is the set of steps to run it on your computer.

A community-driven language-learning platform: the community creates, reviews and improves the content, and every learning resource belongs to a language pair (native language → target language).

## Starting

Two ways, one result:

1. **Claude Code (recommended):** open this folder in Claude Code and write "start". It installs, checks and activates the skills according to `CLAUDE.md`, and fixes any error that appears.
2. **Double click:** run `start-windows.cmd`. It installs the packages, activates the skills, runs the full check, then opens the app at http://localhost:3000.

The basic commands:

| Command | What it does |
| --- | --- |
| `npm run dev` | Runs the app at http://localhost:3000 |
| `npm run check` | The full check: lint + types + tests |
| `npm run build` | Builds the production version |
| `npm run setup` | Installs the skills in `.claude/skills` and the CI and VS Code settings |

## What is in the folder

- `CLAUDE.md` — the project instructions for Claude Code.
- `start-windows.cmd` — prepares and runs the project on Windows with a double click.
- `claude-skills/` — the 19 project skills.
- `setup/` — the sources of the GitHub Actions and VS Code settings (installed by `npm run setup`).
- `site/` — the project site published on GitHub Pages (a static page about the project, not the platform).
- `docs/specification/` — the full specification document (docx + Markdown); never published.
- `docs/mvp-roadmap.md` — the build roadmap of the first release.
- `docs/decisions/` — the resolved and open decisions.
- `docs/adr/` — the architecture decisions.
- `docs/analysis/` — the analysis of the document and skills updates.
- `src/` — the app (Next.js) and the domain modules.
- `supabase/` — the database: tables, security policies and languages.
- `tests/db/` — the database rule tests.
