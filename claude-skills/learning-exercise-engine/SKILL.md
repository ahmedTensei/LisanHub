---
name: learning-exercise-engine
description: Designs and implements the reusable exercise engine, exercise types, answer evaluation, feedback, attempts, and learning integration.
---

# Learning Exercise Engine

Build a reusable engine rather than hard-coding each exercise type into a page.

**Decision R7 — exercises ship as plugins.** No exercise type is platform code. A type is declared by a plugin (`plugin-architecture`), its content lives in a portable package, and it renders inside the sandboxed player. The four classic types (multiple choice, fill blank, matching, word order) are the first core plugin, `classic-exercises`. The engine's role is narrower than it looks here: it provides the **reference evaluators** a plugin's `scoring` refers to, and the result shape the learning/progress domain consumes. Read `plugin-architecture` before adding any type.

## Exercise model

Separate:
- exercise definition/content
- exercise type
- prompt/input
- expected answer or evaluation rule
- attempt
- evaluation result
- learner feedback
- progress integration

UI rendering should consume exercise definitions through stable contracts.

## Supported patterns

The current specification includes patterns such as:
- writing an answer
- reordering words
- drag/drop
- multiple choice
- image-supported activities
- audio-only review

Keep the type system extensible.

## Evaluation

Evaluation should be deterministic where possible and configurable by exercise type.

For each attempt, make it possible to distinguish:
- submitted answer
- correctness/evaluation
- feedback
- expected/correct answer where appropriate
- attempt metadata

Do not hide evaluation logic in presentation components.

## Feedback

When the specification calls for correction:
- show the correct answer;
- explain or expose useful correction information where the exercise supports it;
- do not invent punitive blocking mechanics.

## Community exercise types

Technical contributors may eventually create new exercise types or extensions, but executable content is subject to the project's security/review rules. Never execute untrusted contributor code directly in the main application process.

Under R7 the mechanism for this already exists: a new type is a plugin. In phase A only the platform owner publishes plugins, and plugins are declarative (no user code). Community-authored plugins, and code inside a plugin, open only after verification and review — the sandbox and the contract do not change at that point.

## Progress integration

The exercise engine should emit/return structured results that the learning/progress domain can consume. Do not let an individual exercise type directly mutate unrelated learner state.

## Testing

Every exercise type needs tests for:
- valid input
- invalid input
- edge cases
- scoring/evaluation
- feedback
- serialization/deserialization
- backward compatibility when definitions evolve
