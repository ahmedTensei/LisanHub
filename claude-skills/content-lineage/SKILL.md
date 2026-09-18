---
name: content-lineage
description: Implements and reviews copying, derivation, attribution, versioning, ownership, and source relationships for community educational content.
---

# Content Lineage

Treat content derivation as a first-class domain relationship.

**Decision R7 — derivation is a package copy.** Content is a portable package file built for a plugin (`plugin-architecture`). Deriving means: copy the package file, write a new manifest whose `provenance` snapshots the source (`package_id`, version, sha256, author), and create the new content row pointing at the same plugin. The lineage rules below (upward-only chain, provenance snapshot that survives source removal, paid content cannot be derived) are enforced on that record, not on scattered content rows. A derived package must keep the source's `item_id` values where items are kept, so a learner's progress on the source is meaningful in the copy.

## Two kinds of derivation

Distinguish them explicitly; they have different authorization rules and different lineage requirements.

1. **Published derivation** — requires the Content Creator role. The result is public, attributed, indexed, and carries full lineage.
2. **Local personal copy** — available to any user including a Student. The result never leaves the user's device, is never indexed, and is never visible to others. See the ugc-content-system skill for the authorization boundary.

Never implement a copy operation that blurs these two paths.

## Derivation rule

When a user copies/derives eligible free content:
- the original remains unchanged;
- the new copy belongs to the new creator;
- the derived copy retains attribution to its source;
- the relationship must be queryable.

The specification prefers an upward lineage relationship from a current copy to its original rather than requiring a complete derivation tree as the primary model.

## Lineage visibility

Lineage displayed to a user is the personal upward chain only: this copy → the item it was derived from → … → the original source. Do not display sibling derivations created by other users from the same source. Each user sees the path of their own copy, not the full derivation tree.

## Minimum provenance

A derived item should be able to answer:
- what source it was derived from;
- who created the current version;
- when derivation occurred;
- what attribution/license applies;
- whether the source is still available.

## Cross-language derivation

If the specification permits derived versions across language pairs, preserve the relationship even when the language pair changes. Do not assume a derived copy must use the same pair as its source.

## Versioning

Separate:
- content identity
- version
- owner
- publication state
- source/derivation relationship

Do not overwrite history when a new version is created.

## Notifications

Where specified, source creators may be notified when their content receives many derivatives. Implement thresholds as configurable policy rather than hard-coded magic numbers.

## Deletion and archive

Distinguish deletion, removal, and archival. If a source is deleted but a derived copy is legally allowed to remain, the derived copy must retain sufficient provenance information without pretending the source is still active.

## Paid content

Do not apply free-content copying rules to paid/protected content unless the current product/legal specification explicitly permits the operation.

## Integrity

Lineage records must be append-safe and auditable. Never allow an ordinary content editor to rewrite historical provenance.
