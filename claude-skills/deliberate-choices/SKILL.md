---
name: deliberate-choices
description: Forbids writing code by pattern-copying. Every option list, enum, setting, default, limit, label, message and error code must be chosen for its own case, on purpose, and differ from its neighbours unless they truly share the same meaning (enable/disable and the like). Applies everywhere, not only to settings or the admin area.
---

# Deliberate choices — nothing by pattern-copying

Asked by Ahmed (2026-09-18) after seeing values that could have been cloned from
one line to the next. The rule: **every value you write must be justified by the
thing it describes, not by the line above it.**

## What the rule covers

Anything that is a *choice* rather than a mechanical consequence:

- option lists of a setting (`SETTING_FIELDS[...].options`), feature modes, enum
  members, allowed statuses and transitions;
- defaults, limits, thresholds, sizes, durations, cache lifetimes, page sizes;
- labels, hints, descriptions, empty states, error and outcome messages in the
  three catalogues;
- validation rules (min/max, patterns), required/optional flags;
- names of keys, columns, functions, capabilities, reasons;
- fixtures and expectations in tests.

## How to work

1. **Ask what this one is for.** Before writing a value, say (in a comment or in
   your head) what the setting, field or message is about and who reads it. The
   value follows from that, not from the sibling.
2. **Derive the options from the domain.** A size limit gets sizes in the unit
   people reason in (256 KB … 2 MB); a count gets counts on the scale the thing
   varies (3, 5, 10, 20); a threshold gets the values administration will
   plausibly choose. Two settings share an option list only when the two things
   genuinely vary on the same scale — and then say so in a comment.
3. **Same wording only for the same meaning.** "on/off", "enabled/disabled",
   "confirm/cancel" are legitimately identical across places. A description,
   hint or error must name *its* subject: "Items one package may hold" is not
   "Assets one package may hold".
4. **Different things get different names.** Never suffix a copied identifier
   with `2`, `_new`, `Alt`. If two names differ only by a number, the concept is
   not clear yet — clarify it first.
5. **Defaults are decisions.** A default limit or mode is what the platform runs
   with on day one; pick it for LisanHub's reality (free tier, Algeria, phase A)
   and record why when it is not obvious.
6. **Tests assert meaning.** A test that copies the expectation from the
   implementation proves nothing. Write the expected value from the rule
   (specification, decision, domain), then run.

## Review checklist before finishing

- Read every list you added with the previous one covered: could a reader tell
  which is which from its values alone? If not, revise.
- Any two sibling messages that differ only by a noun swap: is the rest of the
  sentence really true for both?
- Any `options` array pasted from another field: is the scale the same? Is the
  unit the same? Is the default inside the list?
- Any error code reused from another form: does it describe *this* failure to
  *this* person?

## Relation to other rules

- Settings are edited from options (decision R6): this skill says how to pick
  those options; `platform/settings.ts` says where they live.
- Message keys must exist in the three catalogues and never reach the screen raw
  (`no-raw-keys`); this skill says the texts behind them must be written for
  their place.
- No fake content (decision R8): a "deliberate" placeholder is still a placeholder.
