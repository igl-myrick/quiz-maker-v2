# Retired quiz versions are kept for 24 hours so in-progress takes can be graded

When a creator edits or deletes a quiz, the version being replaced is first copied, with its answer key, into a private `quiz_versions` table. The copy is deleted 24 hours later by the cleanup job. Grading uses the live quiz when the taker's version is current, and otherwise uses the retired copy. Takers who started before an edit or delete therefore still get a result, and it carries the usual "updated since" or "no longer exists" notice. The project owner chose this over rejecting such submissions (the original rule in `CLAUDE.md`), because losing a finished take to someone else's edit is a bad experience.

## Considered Options

- **Reject submissions for a changed or deleted quiz** (the original rule). Rejected by the project owner: the taker loses their work through no fault of their own.
- **Store a server-side copy when each take starts.** Rejected. It writes a row for every start, including anonymous visitors who never finish, and it sends take progress to the server, which `CLAUDE.md` forbids.
- **Keep every version permanently.** Rejected. Answer keys and deleted content would be kept for no reason. 24 hours covers any realistic take.

## Consequences

- Deleting a quiz, or an account, leaves its last version in a private table for up to 24 hours. No client can read it, and it is used only for grading.
- A take that lasts more than 24 hours across an edit or delete is still rejected.
- A retired copy is only created when a version is replaced, so a quiz that is never edited has none.
