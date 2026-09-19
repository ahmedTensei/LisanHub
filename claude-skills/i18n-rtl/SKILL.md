---
name: i18n-rtl
description: Protects multilingual UI architecture, RTL support, language-pair modeling, dialect metadata, localization, and separation of interface languages from learning languages.
---

# Internationalization and RTL

## Separate language concepts

Never conflate:
1. UI/interface language
2. user's comfortable/native language
3. target learning language
4. dialect/variant

A user may use an Arabic UI while learning French, or another combination. The architecture must support many combinations.

## RTL

RTL is a first-class layout requirement, not a final CSS patch.

When implementing UI:
- use logical CSS properties where appropriate;
- avoid hard-coded left/right assumptions;
- test mixed RTL/LTR content;
- handle numbers, punctuation, code, URLs, and embedded media correctly;
- ensure controls and navigation mirror appropriately without mirroring content that should remain direction-neutral.

## Localization

Do not hard-code user-visible strings in business logic. No raw key, code or placeholder ever reaches the screen: follow `no-raw-keys` (catalogue tests for dynamic keys, loud failure on a missing message outside production).

Names of things members create are **English first** (decision R16): a package or course title is written in Latin script and stored in `title`; Arabic and French titles and summaries are optional `translations` that fall back to English. A plugin's name, description and field labels follow the same rule (`en` required, others optional).

Use translation keys and support:
- pluralization
- interpolation
- locale-specific formatting
- fallback behavior
- text direction

## Learning content

Educational content is language-pair based. Interface localization must not alter the content's target language or pair.

## Dialects

Represent dialect as metadata/tagging associated with a language. A learner's dialect preference may prioritize results but should not automatically exclude other dialect content.

## Extensibility

New languages should be data/configuration additions rather than requiring a new code path wherever possible.

Avoid assumptions such as:
- fixed two-language support
- English as mandatory source language
- Arabic as the only RTL language
- one target language per user
