# Start prompt — stage S1: accounts, roles and languages

> How to use: in Claude Code, enable plan mode (Shift+Tab until "plan mode on" appears) then write:
> "Execute the instructions in docs/prompts/S1-accounts-roles-languages.md"

## Context

Read first: `CLAUDE.md`, `docs/mvp-roadmap.md`, `docs/decisions/resolved-decisions.md`, `docs/decisions/open-decisions.md`.
Then the skills: `project-governance`, `mvp-scope`, `roles-permissions`, `i18n-rtl`, `api-data-architecture`, `platform-security`, `testing-quality`.

We are in **phase A (a complete free platform)**, and the task is **S1 only**.

## Before writing any code

1. Run `npm run check` and make sure it passes. If it fails, fix it first and tell me why.
2. Ask me one question: a **hosted** Supabase database (I create the account and the project from the browser) or a **local** one through Docker Desktop?
   - If I choose hosted: guide me step by step only through what you cannot do on my behalf (creating the account, creating the project, copying the Project URL and the public publishable key). Then you write `.env.local`, link the project and apply the migrations with `npx supabase` (I will approve the sign-in in the browser). Do not ask me for the `service_role` key and do not write it in any file.
   - If I choose local: check Docker, then `npm run db:start` and `npm run db:reset`.
3. Write a detailed plan for S1 (files, new migrations, tests, order of execution) and wait for my approval.

## Scope of S1

- **The account:** sign-up with e-mail and password, e-mail confirmation, sign-in and sign-out, password recovery. Google sign-in is deferred.
- **The guest:** browses the public pages without an account.
- **Language pairs:** a page to add one or more pairs: a native language and a target language from the `languages` table (search by English name and code), an optional dialect as a tag, an optional goal. No mandatory steps before reaching the content.
- **Roles:** a "become a content creator" button that calls `become_content_creator()`, with a clear explanation that a student does not publish to the community. No "Contributor" role at this stage.
- **The profile:** the name, the interface language, and the profile visibility setting (public or restricted) through **a new migration** with a test in `tests/db`.
- **Authorization on the server:** a function that turns the Supabase session into an `Actor` (primary role and administrative rank), and the use of `can()` and the policies in every server action. No checks by role name inside the interface.
- **The interface:** every text in `messages/ar.json`, `fr.json` and `en.json`, Arabic RTL by default, and logical CSS properties.

## Out of scope

Content creation (S2), Google sign-in, any subscription, payment or entitlement (phase C only, decision R2), creating a Git repository.

## Definition of done

- A new user signs up by e-mail, confirms the account, adds two language pairs, changes the interface language, and becomes a content creator.
- No user can edit another user's profile or language pair, even by calling the database directly (a test).
- The guest sees the public pages and is asked to sign in when attempting an action that needs an account.
- `npm run check` and `npm run build` pass, with new tests for the logic and the authorization.
- The pages work in Arabic, French and English on desktop and phone.

## Way of working

- Small steps, and `npm run check` after every important step.
- Any undecided point: ask me rather than infer, and add it to `docs/decisions/open-decisions.md`.
- When done: update "Current state" in `CLAUDE.md` and the S1 section in `docs/mvp-roadmap.md`, create a compressed backup of the project without `node_modules` and `.next` in `%USERPROFILE%\Documents\LisanHub-backups\` with a name that includes the date and the stage, then summarise for me in Arabic what was done and what I need to do.
