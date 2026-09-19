---
name: no-raw-keys
description: Guarantees no raw translation key, code, identifier or placeholder such as "admin.settings.fields.x.label" ever reaches the screen. Every user-visible string comes from the three catalogues, dynamic keys are proven by tests, and missing messages fail loudly outside production.
---

# No raw keys on screen

Asked by Ahmed (2026-09-18) after `/admin/settings` showed
`admin.settings.fields.__________.label` instead of Arabic labels: a regex bug
(`/./g` instead of `/\./g`) turned every setting key into underscores, and no
test caught it because the key was built at runtime.

## The guarantees, and where each one lives

| Guarantee | Where | What fails |
| --- | --- | --- |
| Every literal `t("…")` key exists in `messages/ar.json` | `src/i18n/message-usage.test.ts` | the key is listed as missing |
| The three catalogues have exactly the same keys and no empty text | `src/i18n/messages.test.ts` | the differing key |
| Every template-literal key (`t(\`fields.${x}.label\`)`) matches the shape of the catalogue, each `${…}` being one segment | `src/i18n/message-catalogue.test.ts` | the pattern that matches nothing |
| Every enumeration a page turns into a key (settings, flags, ranks, statuses, field types, evaluators…) is expanded value by value through the same mapping function the page uses | `src/i18n/message-catalogue.test.ts` | `locale: group.code` |
| Error and outcome codes an action can return are all translated | `message-usage.test.ts` (`expectKeys`) | the code |
| A missing message throws outside production instead of rendering its key | `src/i18n/request.ts` and `src/components/intl-provider.tsx` | the dev page (error overlay) |

## Rules when writing UI

1. **Never build a message key from data without a mapping function in a module**
   and a test that expands the real enumeration through it. The settings case is
   the model: `settingMessageKey()` in `src/modules/platform/settings.ts`, tested
   by `message-catalogue.test.ts` against `SETTING_FIELDS`.
2. **Keys never contain dots** — dots are namespace separators for next-intl.
   Map `packages.max_bytes` to `packages_max_bytes`, never `replace(/./g, …)`.
3. **New enumeration → three places at once:** the constant in `src/modules`, the
   messages in `ar`, `fr`, `en`, and a line in `message-catalogue.test.ts`.
4. **New error or outcome code → its message in the three catalogues and its
   entry in the `expectKeys` list** of `message-usage.test.ts`.
5. **Never render an identifier as a label.** A slug, a key, a status code or a
   UUID may appear in `<code>` as a technical reference next to its label, never
   in place of it. Fallbacks like `t.has(code) ? t(code) : code` are for error
   codes that reached the client unexpectedly, not a way to skip a translation.
6. **Never render placeholders**: no "TODO", "lorem", "xxx", "____" in a message
   or a component. An empty state is a full sentence in the three languages.
7. **ICU braces** in messages (`{{0}}`, `{n}`) are escaped with single quotes when
   literal; a message that mentions a code sample uses `'{'`.

## Before finishing any UI change

- `npm run test -- src/i18n` passes (all three files).
- Open the page in the built-in browser in `ar`, then `fr` or `en`, and read
  every label: if a segment looks like `namespace.key` or underscores, stop.
- Look at option labels of every `<select>` you touched: they come from
  `t(...)` or a formatting function (`formatSettingOption`), never from the raw
  value unless the value is itself the human text (a language name, a number).

## When a raw key is reported by Ahmed

Fix the mapping, then add the guard that would have caught it (a catalogue test
line, an `expectKeys` entry), then check the whole area for the same pattern
before answering — one raw key is rarely alone.
