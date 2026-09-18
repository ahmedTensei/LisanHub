# LisanHub

A community-driven platform where people create, review, translate and improve language-learning material. Every resource belongs to a **language pair** — the learner's comfortable language → the language they are learning — so a Kabyle speaker learning Turkish and a French speaker learning Algerian Arabic are first-class cases, not afterthoughts.

**Status: early development. Not usable yet, and not deployed.** There is no public instance, no content, and no sign-up. This repository is published for transparency while it is being built.

## What exists today

- Accounts: email sign-up with confirmation, sign-in, password reset, unique usernames, public profile pages with a visibility setting.
- Roles and ranks: Student and Content Creator, four administrative ranks, capability-based authorization enforced in TypeScript **and** in Postgres row-level security.
- Language pairs over the full ISO 639-3 set (7,919 languages), with dialect handled as a tag rather than a separate language.
- An in-platform admin area: members, ranks, support requests, reports, product feedback, platform settings.
- Interface in Arabic (default, RTL), French and English.
- 123 automated tests, including database invariants run against the real migrations.

## What does not exist yet

Content authoring, the learner experience, derivation and attribution, community chat, ratings — all of it is next. Nothing in this repository fakes those: there is no demo content, no sample lessons and no placeholder statistics anywhere, by design.

## Architecture in one paragraph

The platform contains **no built-in kind of learning**. Each kind of activity is defined by a **plugin** (a declarative contract: activities, a JSON Schema for its content, authoring fields, scoring references), content is a **portable package file** built for that plugin, and both are rendered and evaluated inside a **sandboxed frame that can never reach user data** — no identity, no progress, no settings cross that boundary, and the authoritative score is recomputed on the server. Copying and deriving someone's lesson is therefore a file copy plus a provenance record.

Stack: Next.js 16 (App Router), React 19, TypeScript, Tailwind CSS 4, next-intl, Supabase (Postgres + RLS + Auth + Storage), Zod, ts-fsrs, Vitest with PGlite.

## Licence — source-available, noncommercial

This project is **not open source**. It is licensed under the [PolyForm Noncommercial License 1.0.0](LICENSE): you may read, run, modify and share it for any **noncommercial** purpose, including personal study, research and use by nonprofits, schools and public institutions. **Any commercial use requires a separate written licence from the copyright holder.**

Learning content created by members inside the platform is a separate question and is licensed separately; that decision is not final yet.

## Contributions

Code contributions are **closed for now** — pull requests will not be merged while the architecture is still moving. Bug reports and ideas through Issues are welcome, and security reports are covered in [SECURITY.md](SECURITY.md). Community participation is designed to happen **inside the platform** (creating, reviewing and translating learning material), not in this repository.

---

<div dir="rtl">

## بالعربية

**LisanHub** منصّة مجتمعية لصناعة محتوى تعلّم اللغات ومراجعته وترجمته وتحسينه. كل مورد تعليمي ينتمي إلى **زوج لغوي**: لغتك المريحة ← اللغة التي تتعلّمها.

**الحالة: قيد التطوير المبكّر.** لا نسخة منشورة ولا تسجيل ولا محتوى بعد. ما أُنجز: الحسابات والأدوار والرتب والأزواج اللغوية ولوحة الإدارة، بواجهة عربية (افتراضية) وفرنسية وإنجليزية.

**المعمارية:** لا نوع تعلّم مدمج في المنصّة؛ لكل نشاط **إضافة** تُبنى أولًا، والمحتوى **ملف مستقلّ** يُشغَّل في **بيئة معزولة لا تصل إلى بيانات المستخدم**.

**الترخيص:** PolyForm Noncommercial 1.0.0 — الاستعمال غير التجاري مسموح، و**الاستعمال التجاري يحتاج إذنًا مكتوبًا** من صاحب الحقوق. المشروع مصدره متاح، لكنه ليس «مفتوح المصدر» بالتعريف الرسمي.

**المساهمات:** مغلقة على الكود حاليًا. البلاغات والأفكار عبر Issues مرحّب بها، ومشاركة المجتمع مكانها داخل المنصّة نفسها.

</div>
