# ADR 0002 — Authorization in two layers: capabilities in the code, RLS in the database

- **Status:** adopted.
- **Context:** the skills `roles-permissions` and `platform-security` require capability-based authorization rather than role names, enforced on the server.

## Decision

1. **The application layer:** `src/modules/authorization` turns the role and the administrative rank into a set of capabilities, and provides policies (`canEdit`, `canCopy`, `canHide`...). Feature code asks about the capability only.
2. **The database layer:** the RLS policies and the trigger `content_items_guard` enforce the same rules even if someone bypasses the interface.
3. The primary role is a single column in `profiles`, so combining "Content Creator" and "Contributor" is structurally impossible. Changing it goes only through `become_content_creator()`.
4. The four administrative ranks live in the `admin_ranks` table, which only the platform writes to.

## Consequences

- Every new ownership rule needs an update in both layers and a test in both.
- Reputation, verification and badges never enter the computation of capabilities.
