---
name: testing-quality
description: Establishes testing and quality practices for the language-learning platform. Use when implementing, refactoring, reviewing, or debugging code.
---

# Testing and Quality

**Decision R8 — tests never leave fake content behind.** Fixtures live inside test files (`tests/`, `*.test.ts`) and in-process databases; no migration, no `seed.sql` and no script may insert demo lessons, packages, courses, members or ratings into a real project. A test must fail if content inserts appear in a migration or in `seed.sql`. Write tests for honest empty states, and never assert against seeded sample content.

Testing must protect domain invariants, not merely increase coverage numbers.

## Test layers

Use the lowest effective layer:
- domain/unit tests for business rules
- application/service tests for workflows
- integration tests for persistence/providers
- API tests for authorization and contracts
- UI tests for critical user journeys
- security tests for trust boundaries

## Critical invariants

Prioritize tests for:
- content ownership
- derived-copy ownership
- authorization boundaries
- language-pair correctness
- dialect metadata behavior
- content visibility
- publication states
- lineage/provenance
- exercise evaluation
- progress updates
- moderation actions
- search visibility

## Regression discipline

Before modifying existing behavior:
1. find existing tests;
2. identify the current invariant;
3. change the smallest necessary surface;
4. update/add tests;
5. run the relevant suite;
6. run broader tests when cross-context behavior changed.

Do not delete a failing test simply because it conflicts with a new implementation.

## Test data

Use realistic combinations:
- multiple comfortable/native languages
- multiple target languages
- RTL and LTR
- multiple dialect tags
- creators and learners
- derived content
- hidden/removed content
- users with different capabilities

## Quality gate

A change is not complete when code compiles. It is complete when:
- behavior is verified;
- authorization is verified;
- relevant regressions are covered;
- error paths are considered;
- migrations are safe when applicable.
