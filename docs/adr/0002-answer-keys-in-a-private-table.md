# Answer keys live in a separate private table

Whether an option is correct, and which outcome it maps to for how many points, is stored in `option_keys`. That table is separate from the public `options` table, and no client role has any grant on it. Postgres row-level security controls which rows a role can see, not which columns. So an `is_correct` column on the publicly readable `options` table would be sent to every taker before grading. Only the grading edge function (service role) and the quiz's creator, through `get_quiz_for_edit`, can read keys.

## Considered Options

- **An `is_correct` / `outcome_id` column on `options`, hidden with column grants.** Rejected. It is easy to undo by accident with a `select *`, a new view, or a grant change, and it mixes public and secret data in one row.

## Consequences

- Creating and editing quizzes writes two tables, both through `save_quiz`.
- "Do not merge `option_keys` back into `options`." That would leak answers before submission, which `CLAUDE.md` forbids.
