---
name: architecture-guardian
description: Protects the platform architecture during implementation and refactoring. Use for domain modeling, module boundaries, database changes, APIs, services, dependencies, cross-context changes, and architecture reviews.
---

# Architecture Guardian

Design for a long-lived modular platform rather than a short-lived MVP shortcut.

## Core rules

- Use Domain-Driven Design and explicit bounded contexts.
- Keep business rules outside UI components.
- Separate API/application services from interactive UI components.
- Keep infrastructure/provider implementations behind abstractions where replacement is a stated project goal.
- Avoid circular dependencies between bounded contexts or modules.
- Prefer dependency inversion and stable domain contracts.
- Keep workflows as the single source of truth for multi-step business processes.
- Use capability-based authorization rather than scattering role-name checks through business logic.
- Keep domain invariants enforceable on the server/application boundary, not only in UI.
- Do not couple unrelated domains through shared mutable state.
- Avoid premature microservices; modular boundaries can exist inside one deployable system.
- **Learning content is not a platform module (decision R7).** A kind of learning activity is a plugin; its content is a portable package; both are consumed through the plugin contract and rendered in the sandboxed player. Reject any design that adds a branch to platform rendering, authoring or scoring code per activity kind. See `plugin-architecture`.
- The plugin boundary is one-way: platform code may read a plugin's declared contract, but no plugin may import platform modules, and the player may not receive user data.

## Before changing architecture

Inspect the existing codebase first:
1. Locate the current module/context structure.
2. Find existing domain entities, services, repositories, policies, workflows, and providers.
3. Identify the dependency direction.
4. Reuse existing abstractions when they are sound.
5. Do not create a second competing abstraction for the same responsibility.

For cross-context changes, document:
- owning context
- public contract
- consumers
- authorization boundary
- data ownership
- events/workflows if applicable
- migration/backward-compatibility implications

## Data ownership

Each important piece of business data should have a clear owner. Avoid duplicated authoritative state. Derived read models are acceptable when their source of truth is explicit.

## Architecture decisions

For significant structural decisions, create or update an ADR/RFC rather than burying the decision in implementation code.

## Quality gate

Reject a proposed implementation when it:
- places core business rules in UI code,
- creates a dependency cycle,
- bypasses the workflow/policy layer,
- duplicates an existing source of truth,
- hard-codes a provider where an existing provider abstraction is intended,
- or makes a roadmap feature silently mandatory.
