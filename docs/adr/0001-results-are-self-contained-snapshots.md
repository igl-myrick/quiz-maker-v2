# Results are self-contained snapshots

A result stores a full copy of the quiz as it was when taken: questions, options, answer key, scoring, the taker's answers, and the stored outcome ranking. It never reads the live quiz rows to display itself. This is because results must never change when a creator edits or deletes a quiz, and a personality result's random tie-break must look the same every time. The result's link to its quiz is `ON DELETE SET NULL` and never cascades.

## Considered Options

- **Normalize results against live quiz rows.** Rejected. Edits would rewrite old results, and deletes would break them.
- **Keep every old version of a quiz's questions and grade against them.** Rejected. It needs version tables and more complex reads. Results never read versions anyway, because they carry their own snapshot. (ADR 0003 later added short-lived retired versions, used only for grading in-progress takes and deleted after 24 hours. Results still never depend on them.)

## Consequences

- Results duplicate quiz content, a few KB each. This is acceptable at this scale.
- The snapshot carries a `snapshot_version`, so its format can change without breaking old rows.
- The snapshot holds the full answer key, so what leaves the database is filtered when a result is read (see ADR 0002).
