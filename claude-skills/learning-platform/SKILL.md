---
name: learning-platform
description: Provides domain guidance for the language-learning experience, language pairs, content types, progress, learning paths, and learner workflows. Use when implementing learner-facing educational functionality.
---

# Learning Platform Domain

The platform is learner-driven rather than a single forced curriculum.

## Language model

- Educational resources are associated with a language pair: comfortable/native language -> target language.
- A user can maintain multiple language-pair learning profiles.
- The same target language can be learned from different comfortable/native languages.
- Dialects are tags/metadata describing variants of a language.
- A learner may prefer a dialect; preference should prioritize discovery rather than exclude other content.
- Do not encode UI language as the same concept as learning language.

## Learning content

The specification includes content such as:
- courses
- lessons
- exercises
- exams/tests
- vocabulary and grammar cards
- reading/listening collections
- flashcards
- learning paths
- articles and educational resources

Do not assume all content is authored centrally. Community-created educational content is a core design principle.

## Levels and skill classification

Classify every educational resource by a fine-grained level following international language-proficiency conventions — A1.1, A1.2, through C2 — not merely "beginner / intermediate / advanced". Model the level as structured data, not a free-text label.

Additionally classify every exercise by the language skill it targets: listening, reading, pronunciation, or writing. Keep this consistent across all content so learners can filter by the skill they want to strengthen.

A new learner may optionally take a placement test when starting a language pair. Never assume every learner starts from zero.

## Learner experience

Support:
- choosing what to learn
- multiple learning pairs
- levels and placement
- progress
- learning paths/courses
- revision/spaced repetition where specified
- achievements where specified
- discovery and search

Do not impose a fixed curriculum unless the product specification explicitly requests one.

## Specified learner conveniences

The specification calls for these; implement them as ordinary product features rather than treating them as optional polish:
- a short "quick review" session (around five minutes) for waiting time or before sleep
- an automatic "my difficult words" list collecting items the learner repeatedly gets wrong
- an audio-only review mode usable without looking at the screen
- smart review reminders driven by spaced-repetition due dates rather than a fixed daily ping
- personal collections grouping lessons and cards from different creators into the learner's own structure
- an optional personal trust circle: a small set of creators the learner trusts, whose content is prioritised in that learner's own recommendations only — entirely separate from community-wide ratings
- specialised tracks by field or profession (medical, legal, business, official exam preparation) as a sub-category inside a language pair
- opt-in group challenges and an opt-in leaderboard; never force competitive mechanics on every learner

## Local content freedom

Once a learner obtains any free content, their freedom to use, edit, and correct their own local copy on their device is complete and unconditional. Paid features are conveniences layered on top; they must never restrict this baseline right. See monetization-marketplace for what is actually paid.

## Accessibility

Treat usability by learners with different needs as a general principle of the learning experience, consistent with the future sign-language and Braille support noted in the language system. Do not defer accessibility to a post-launch cleanup pass.

## Content relationships

When a learning resource is a derived copy, preserve its relationship to its source according to the content-lineage rules. Do not flatten derived content into unrelated content.

## Educational behavior

When implementing an exercise:
- give the learner actionable feedback;
- when an answer is wrong, show the correct answer when the specification calls for it rather than inventing punitive behavior;
- keep assessment logic distinct from presentation;
- make scoring and progress rules explicit and testable.

## Future AI

Do not make advanced conversational AI, pronunciation evaluation, or recommendation AI a hidden dependency of the core learning engine. The current roadmap treats advanced AI as a later layer. Implement the deterministic learning domain so AI can be added as a replaceable service later.
