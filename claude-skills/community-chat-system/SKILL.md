---
name: community-chat-system
description: Governs the community layer - direct and group chats, language-pair rooms, study groups, voice/video practice, partner matching, and in-community discovery. Use whenever implementing any social, messaging, or community-facing functionality.
---

# Community and Chat System

The community is one of the platform's most important capabilities, not a secondary social layer bolted onto learning. Implement it with the same care as the learning domain.

## The community is built from three elements only

1. **Chats** — direct (two people) and group conversations.
2. **Marketplace** — reachable from the same community space, not a separate isolated section. See the monetization-marketplace skill.
3. **Discovery/search window** — finding people, groups, content, and extensions.

There is no posts system, no news feed, and no permanent forum threads. Every interaction happens either inside a conversation or as a comment attached to a specific content item (see ugc-content-system). Do not introduce standalone posts, timelines, or thread-based boards.

## File sharing restriction

Inside chats, users may **not** upload arbitrary external files.

Sharing is restricted to referencing content that already exists on the platform's own servers — a lesson, a flashcard deck, an educational resource — via an internal link or reference. This is a deliberate security decision consistent with the platform's content-safety policy. Do not add a generic file-upload control to chat.

## Chat capabilities

Implement according to the specification:
- direct and group conversations
- voice and video rooms inside group chats for real speaking practice
- language-exchange partner matching that leads directly into a conversation
- recurring scheduled practice sessions with the same partner
- a shared activity streak between two exchange partners who keep their scheduled sessions
- optional recording of a practice session with both parties' consent, for the learner's own later review
- community-organised local meetups coordinated through group chat
- reputation-backed help requests (bounty) inside a group chat, without creating persistent topics
- pinning an important message or resource to the top of a group chat
- optional per-user inline translation of group chat messages, applied only for the user who enables it and never altering the original message for anyone else

## Language-pair rooms and study groups

- One group chat room per language pair, where members ask questions and get answers inside the conversation flow.
- Private or public study groups created by any learner around a language, level, or goal.
- Optional lightweight live quizzes among group members.

## In-community discovery

A single unified search window inside the community covering: users and creators, active group chats and study groups, potential conversation partners, educational content, and contributor-created extensions and packages. Keep it consistent with the search-discovery skill rather than building a second isolated search.

## Peer mentoring

Informal peer mentoring happens through direct conversation. It is not a formal role or rank, and it has no associated publishing mechanism.

## Moderation boundary

Personal disputes between users (for example between two conversation partners) follow a separate escalation path from content reports. A behavioural dispute is not a content-quality report and must not be routed into the content moderation queue. See the trust-moderation skill.

## Anti-patterns

Do not build:
- a feed, timeline, or standalone post entity;
- permanent forum sections and threads;
- generic external file upload inside conversations;
- a separate parallel search experience for the community;
- social-network-style profile content unrelated to the learning identity.
