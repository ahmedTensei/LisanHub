---
name: search-discovery
description: Implements global search, filters, discovery, ranking inputs, saved searches, and recommendations for the language-learning community.
---

# Search and Discovery

Search is a unified discovery capability across the platform.

**Decision R7 — index metadata, not package internals.** Content lives in package files (`plugin-architecture`), so in phase A search covers the metadata the platform extracts at publish time: title, summary, tags, language pair, dialect, CEFR level, skills, plugin, quality label, owner. Item text inside a package is not searchable until a dedicated index is decided (open decision Q19). Never make discovery depend on reading package files at query time.

## Searchable domains

The specification includes discovery of:
- users
- creators
- groups/chats
- courses
- lessons
- exercises
- flashcards
- educational resources
- extensions/packages and contributor-created additions

Do not create isolated search experiences that contradict the unified community search concept unless there is a clear UX reason.

## Language filters

Educational content is primarily discoverable by:
- comfortable/native language
- target language
- level
- topic
- tags
- rating
- verification/trust signals where applicable

Dialect is a preference/priority signal, not an automatic exclusion filter.

## Ranking

Keep retrieval and ranking separate.

Possible ranking inputs include:
- relevance
- language-pair match
- learner level
- topic/tags
- quality/rating
- freshness
- activity/trending signals
- user interests/activity

Do not turn a ranking signal into an authorization rule.

## Saved searches

If implementing saved-search notifications, make the matching criteria explicit and avoid sending duplicate notifications for the same event.

## Recommendations

Recommendations are a later/optional layer. Do not make advanced AI a prerequisite for basic search.

## Architecture

Use a search abstraction/provider boundary so the underlying search engine can be replaced. Keep canonical content data in its owning domain; search indexes are derived data.

## Safety

Search results must respect:
- visibility
- deletion/removal state
- permissions
- blocked users/content
- paid/private access rules

Never leak hidden content through indexes.
