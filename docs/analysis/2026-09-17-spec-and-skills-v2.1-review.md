# Analysis of the specification and skills update to v2.1

Date of the analysis: 17 September 2026. Files: `Full_Project_With_Business_Model_AR.docx` (updated) and `lisanhub-claude-skills-v2.1.zip`.

## What changed in the specification

A line-by-line comparison with the previous version shows that the change is confined to one topic, in two places:

1. **Chapter 4:** the heading "Continuity of personal content by device and subscription" became "Continuity of progress and personal content", with a new paragraph: account and progress data is saved on the server for every user, free and always. The "local only" rules now concern heavy content alone, and the phrase "even if they subscribe later for a whole month" was removed.
2. **Chapter 10:** the section "Offline access and data sync (a paid service)" became "Saving progress and offline access" in two parts: progress is always free, and offline access and heavy-content sync are paid. The fairness principle adds that what is paid is not "saving their learning journey".

No other changes in the 16 chapters.

## What changed in the skills

- `monetization-marketplace`: a new section "Progress versus heavy personal content" that matches the specification and explicitly forbids tying progress saving to a subscription.
- `mvp-scope`: a new item under "Commercial": saving the account and the progress free from day one.
- `README.md`: a "Changes in v2.1" section.
- A new `CLAUDE.md` file that records the decision as settled and forbids reopening it (kept in `docs/claude-skills-CLAUDE.v2.1.md` and merged into the main `CLAUDE.md`).
- The other 14 skills are identical to v2.

## Effect on the plan

- **Q3 is settled** in line with the hybrid model the roadmap recommended. Moved to `docs/decisions/resolved-decisions.md` as R1, and applied in the database schema and the tests.
- The order of the stages does not change.

## Remaining conflicts in the document

- **Chapter 4, "Progress tracking and motivation":** still says that "continue where you left off across devices" depends on sync "for those who enable it". After v2.1 this is free progress data. Recorded as Q9.
- **Chapter 14:** "data sync on the cloud" among the founders' benefits and the storage scope is a general wording that could be read as if all data were paid. Recorded as Q10.
- **The fate of heavy content on the server after a subscription ends** is undefined after the removal of the phrase "even if they subscribe later". Recorded as Q8.
- **The CLAUDE.md in the skills** refers to three specification documents, and only the full one is available. Recorded as Q11.

## What remains open from the first analysis

Q1, Q2, Q4, Q5, Q6, Q7 — details in `docs/decisions/open-decisions.md`.
