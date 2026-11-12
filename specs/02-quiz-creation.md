# Feature 2: Quiz creation

Status: **Approved** (2026-11-10). It depends on features 0, 4 and 6 being Done. Rules come from `CLAUDE.md` (§1 validation rules, §6 rate limiting, §8, §9, feature 2). Schema and functions come from `ARCHITECTURE_SPEC.md` (§4, §7.1 `save_quiz` and `get_quiz_for_edit`, §8). Domain terms come from `GLOSSARY.md`.

## Goal

Members create, edit and delete their own quizzes through one form, built in parts. Every quiz meets the validation rules on the client and again on the server. Edits bump the quiz version and never change existing results. Work in progress survives reloads. Creating quizzes is rate limited.

## Decisions made with the project owner

- **The form has parts:**
  - **Basics:** title, description, kind.
  - **Outcomes:** personality quizzes only.
  - **Questions:** each question's type, text, number of answers, and the answers, plus the optional suggested time at the end.
- A new quiz starts with **one** question. Publishing fails until there are at least 3.
- **Trivia:** a correct answer is always worth 1 point, with no points field. **Personality:** each answer is worth **1, 2 or 3** points toward its outcome, defaulting to 1. `CLAUDE.md` §1 and `ARCHITECTURE_SPEC.md` §4.4 are updated to match.
- **Reordering** uses Move up and Move down buttons. Drag-and-drop is a possible later follow-up and needs a library approval, so it is not part of this feature.
- **The draft** is saved in session storage, so a reload, or leaving and returning in the same tab, restores it.
- **Entry points:**
  - a "Create quiz" link in the header for members
  - Edit and Delete on the dashboard's "My quizzes" cards (feature 3)
  - until feature 3 exists, the edit page also has Delete
- **Limits:**

  | Item | Limit |
  | --- | --- |
  | Title | 3–75 characters |
  | Description | optional, up to 250 characters |
  | Question text | 1–300 characters |
  | Answer text | 1–150 characters |
  | Outcome name | 1–80 characters |
  | Outcome description | optional, up to 500 characters |
  | Questions per quiz | 3–50 |
  | Answers per question | 2–8 (true/false is always exactly 2) |
  | Outcomes per personality quiz | 2–**30** |
  | Suggested time | none, or 1–180 whole minutes |

  Text lengths are measured in characters, after trimming. **(call)** The outcome cap is 30. The project owner suggested "30 or 50". 30 keeps each answer's outcome dropdown manageable while still allowing a large cast of characters.
- **Creation rate limit:** 10 new quizzes per member per fixed one-hour window (for example 14:00–15:00). Edits and deletes are not limited, and failed saves don't count (`ARCHITECTURE_SPEC.md` §7.1).

## Acceptance criteria

### Access and entry points

1. The header shows a "Create quiz" link (to `/quizzes/new`) to members only.
2. `/quizzes/new` and `/quizzes/$quizId/edit` (TanStack file routes) render the same `QuizEditorPage`.
   - An anonymous visitor on either route sees "Log in to create a quiz." with a `LoginButton` (feature 4).
   - After logging in on that page, the editor appears in place.
3. On the edit route, the quiz is loaded with `get_quiz_for_edit`, which returns `{ "status": "ok", "quiz": … }`, `{ "status": "not_found" }`, or `{ "status": "forbidden" }` **(call)**. Quizzes are public, so saying it exists reveals nothing. For the last two, the page says "This quiz no longer exists." or "You can only edit your own quizzes." and shows no form. **The form only mounts after the quiz has loaded**, because `defaultValues` are read once.

### Parts and navigation

4. The current part is a validated search param, `part`: `basics` (the default), `outcomes`, or `questions`.
   - `outcomes` is only valid for personality quizzes. `validateSearch` can't see the kind, which lives in the form. So the page itself redirects `part=outcomes` to `basics` with `navigate({ replace: true })` when the kind is trivia. That covers a pasted URL and switching kind while on that part. The redirect happens in the handler that changes kind, or during render as a `<Navigate replace>`, never in an effect.
   - "Next" and "Back" buttons navigate between parts, pushing history entries, so browser Back moves between parts too.
   - Each part has an `<h2>`. Changing part moves focus to it and announces "Part 2 of 3: Outcomes" (or "Part 2 of 2" for trivia).
5. "Next" validates only the current part's fields, using React Hook Form's `trigger` with that part's field names. Problems show inline and in the error summary (criterion 18). Visiting a later part directly through the URL is allowed, because Publish validates everything.
   - With `zodResolver`, `trigger` runs the whole schema and keeps the errors for the named fields. Checks that span several fields therefore attach their errors to explicit paths so they can be shown, for example "every outcome reachable" on `outcomes.<i>.name` and "at least 3 questions" on `questions.root`.

### Part 1: basics

6. The fields are:
   - Title (required)
   - Description (optional)
   - Kind: a radio group, "Trivia: right and wrong answers" or "Personality: answers lead to an outcome"

   Each field has a visible label and a character counter announced politely only near the limit **(call)**: at 10 characters left.
7. **Changing the kind after kind-specific data exists** opens a confirmation popup:
   - Trivia to personality: "Switch to Personality? Correct-answer markings will be cleared, and every question will become single-choice."
   - Personality to trivia: "Switch to Trivia? Your outcomes and each answer's outcome and points will be removed."

   Confirming **rebuilds the whole `questions` array** (and clears `outcomes`) with `replace()`/`setValue`, so no fields from the old kind stay registered. Titles, question text and answer text are kept. Cancelling keeps the old kind.
8. When editing, the kind is shown as text ("Kind: Trivia. This can't be changed after publishing."), not as inputs.

### Part 1.5: outcomes (personality only)

9. The part starts with 2 empty outcomes. Each has a name and an optional description, plus Move up, Move down and Remove. "Add outcome" adds one, up to 30. Remove is disabled at 2.
10. Removing an outcome that answers point to clears those answers' outcome choice, which then fails validation. The person is told before confirming: "3 answers point to this outcome and will need a new one."

### Part 2: questions

11. The part starts with one question. "Add question" appends one, up to 50, and moves focus to its type field. Each question is a `fieldset` whose `legend` is "Question <n>".
12. **Question type:**
    - Trivia: Single-choice, True/false or Multi-select (choose all that apply).
    - Personality: the type is fixed to single-choice and shown as text.
    - Changing to True/false replaces the answers with "True" and "False" and hides "Number of answers". The two inputs are `readOnly`, not `disabled`, because disabled fields are left out of the form's values and the server requires those exact labels. Changing away from True/false gives 2 empty answers.
13. The question text field is required.
14. "Number of answers" is a select from 2 to 8. Changing it adds empty answers to the end or removes them from the end, inside the select's `onChange` handler, never in an effect. Removing answers that already have text asks for confirmation first.
15. **Answers:**
    - **Single-choice and True/false:** each answer has a text field, and one radio group, "Correct answer", marks exactly one.
    - **Multi-select:** each answer has a text field and a "Correct" checkbox.
    - **Personality:** each answer has a text field, an "Outcome" select listing the current outcomes by name, and a "Points" select with 1, 2 or 3 (default 1).

    Every control is labelled with its answer number, for example "Answer 2 text" or "Answer 2 outcome".
16. Each question has Move up, Move down and Remove. Remove is disabled when only one question exists.
    - Moving keeps focus on the same button, now in the question's new position, and announces "Question 3 moved to position 2".
    - Removing asks for confirmation if the question has any text, then announces it and focuses the next question's legend, or the previous one if it was last.
17. **Suggested time,** at the end of part 2: a radio group, "No suggested time" or "Suggested time", with a minutes number field (1–180) shown when chosen. It is stored as `suggested_time_seconds = minutes × 60`. No timer runs in this feature.

### Validation and errors

18. **One Zod schema,** `src/schemas/quiz.ts`, is a discriminated union on `kind`. It encodes every rule in `CLAUDE.md` §1 plus the limits above.
    - The limit numbers live in one exported constant, `src/schemas/quizLimits.ts`, and the SQL in criterion 24 copies the same numbers. Both files carry a comment pointing to the other.
    - **Publish** validates everything. On failure, an **error summary** appears at the top of the current part with the heading "Fix these before publishing" and receives focus. Each item names the problem and its location, for example "Question 4: mark the correct answer". Each item is a link that switches to the right part if needed and focuses the field.
    - Each field also shows its own message, linked with `aria-describedby` and `aria-invalid`.
    - "This quiz needs at least 3 questions" links to "Add question".
19. **Server errors from `save_quiz`** are shown in the same summary:
    - `duplicate_title`: "You already have a quiz called "<title>"." with a link to it (`/search?quiz=<existing id>`). Focus goes to the title field's error.
    - `stale_version`: "This quiz changed since you opened it (maybe in another tab)." There are two buttons, as decided by the project owner:
      - **"Load the latest version"**: after confirming "Your unsaved changes here will be lost", it removes this draft, refetches `get_quiz_for_edit`, and remounts the form with it.
      - **"Save mine over it"**: after confirming "This replaces the changes saved elsewhere", it refetches the quiz's current `version` and calls `save_quiz` again with this form's content and that `expected_version`. On success it behaves like any publish. If it is stale again, the same message reappears.
      - Until one is chosen, the draft keeps its `baseVersion`, so a reload shows the same message again (criterion 22) instead of losing the work.
    - `rate_limited`: "You've made a lot of quizzes recently. Try again in a little while." The draft is kept.
    - Any other error: "Something went wrong. Your draft is saved. Try again."
20. While saving, Publish is disabled and reads "Publishing…".

### Saving, drafts, editing and deleting

21. **Publish** calls `save_quiz` with the whole quiz. The payload and the `get_quiz_for_edit` quiz share one shape **(call)**:

    ```jsonc
    {
      "id": "uuid | null",           // null = create
      "expected_version": 3,         // edit only
      "kind": "trivia",
      "title": "…", "description": "…",
      "suggested_time_seconds": 600, // or null
      "outcomes": [ { "key": "uuid", "title": "…", "description": "…" } ],  // personality only, in order
      "questions": [
        { "type": "multi_select", "prompt": "…",
          "options": [
            { "label": "…", "is_correct": true },                      // trivia
            { "label": "…", "outcome_key": "uuid", "points": 2 }       // personality
          ] }
      ]
    }
    ```

    - Array order is the saved `position`. The correct answer is marked **per answer** (`is_correct`), matching `option_keys`.
    - `key` is a client-side reference. New outcomes use `crypto.randomUUID()`. When editing, the outcome IDs loaded from `get_quiz_for_edit` are used as keys. Every save re-inserts all outcomes, and `save_quiz` maps each `key` to the new row.
    - **Text:** the client trims every text field before validating and sending. `save_quiz` also trims whitespace from both ends of every text value (`regexp_replace(x, '^\s+|\s+$', '', 'g')`, which includes tabs and newlines) before checking and storing. The database constraints check the same trimmed `char_length`.
    - Lengths are counted in characters on both sides. The Zod rules use `[...s].length`, not `.length`, so emoji count the same as in `char_length`.
    - On success: the draft is cleared, ["Quiz published" or "Changes saved"] is announced, and the app navigates to `/search?quiz=<id>`, opening the quiz's details popup.
    - Editing sends `expected_version`.
22. **The draft:**
    - React Hook Form is the only owner of the form's values.
    - When the form starts, `defaultValues` are read from session storage if a matching draft exists. Otherwise they are empty (new) or loaded from `get_quiz_for_edit` (edit).
    - **One effect** subscribes to form changes (`watch` or `subscribe`) and writes the draft to session storage, unsubscribing in its cleanup.
    - The draft keys are `quiz-draft:new` and `quiz-draft:<quizId>`. An edit draft is stored as `{ baseVersion, values }`.
    - When the edit page loads and the draft's `baseVersion` is older than the quiz's current version, the draft is still restored. The stale-version message and its two buttons (criterion 19) are shown straight away, rather than waiting for Publish.
    - "Discard draft", after confirming, clears the key and resets the form to empty (new) or to the saved quiz (edit).
    - A restored draft is announced: "Restored your unsaved draft."
23. **Deleting** happens on the edit page, in a separate "Delete quiz" section, and opens a reusable `ConfirmDialog`:
    - The heading is "Delete "<title>"?" and the body is "This can't be undone. Results people already have will stay."
    - "Cancel" is focused first, and the other button is "Delete quiz".
    - Confirming deletes through the RLS delete policy (`supabase.from('quizzes').delete().eq('id', …).select('id')`). An empty result means nothing was deleted, which shows "Couldn't delete this quiz." On success it clears any draft for it, invalidates `['me', 'quizzes']` and `['quizzes']`, announces "Quiz deleted", and navigates to `/search`.
    - `ConfirmDialog` is the same native-`<dialog>` component used in criteria 7, 10, 14, 16 and 22. It follows `CLAUDE.md` §8, and feature 3 reuses it.

### Database

24. One migration adds the quiz limits as `check` constraints:
    - text lengths use `char_length(col)`. Values are stored already trimmed (criterion 21), and a check that `col = regexp_replace(col, '^\s+|\s+$', '', 'g')` stops untrimmed text being written by any other path.
    - `suggested_time_seconds is null or (suggested_time_seconds between 60 and 10800 and suggested_time_seconds % 60 = 0)`

    Row counts (questions, answers, outcomes) are checked in `save_quiz`, because a constraint can't count rows.
25. Migrations add `rate_limit_scope`, `rate_limits` and `hit_rate_limit` (`ARCHITECTURE_SPEC.md` §4.7, §7.1), with `quiz_create` used here. They also add `save_quiz` and `get_quiz_for_edit`, exactly as in §7.1, including:
    - every validation rule
    - personality single-choice only
    - points 1–3
    - outcomes belonging to the same quiz
    - every outcome reachable
    - `kind` unchanged on edit
    - `stale_version` handling
    - `duplicate_title` with the existing ID in `detail`
    - the rate limit applied only on create, with failures rolling back the increment
26. `points` is constrained to `between 1 and 3` by feature 0's schema (`ARCHITECTURE_SPEC.md` §4.4). If feature 0 was built with `points > 0`, this feature adds a migration that changes it.
27. pgTAP tests cover:
    - `save_quiz` accepting a valid trivia quiz and a valid personality quiz
    - `save_quiz` rejecting each rule in `CLAUDE.md` §1, each count limit, points 0 and 4, a duplicate normalized title, a stale `expected_version`, a kind change, an edit by a non-creator, and an anonymous caller
    - an edit bumping `version` and replacing child rows while leaving existing results unchanged
    - the 11th create in one window raising `rate_limited`, with failed saves not counting
    - `get_quiz_for_edit` returning keys only to the creator
    - a creator deleting their own quiz but not another member's
28. `npm run db:types` is rerun and the regenerated types are committed.

### Tests and quality

29. Component tests use role-based queries, include `vitest-axe` checks, and mock `src/lib/supabase`. They cover:
    - the anonymous login prompt
    - part navigation and focus
    - a kind switch with confirmation
    - add, move and remove for questions and outcomes, including focus and announcements
    - true/false auto-answers
    - "Number of answers" growing and shrinking
    - the error summary linking to fields across parts
    - each server error
    - a draft restored after remount, and cleared on publish and on discard
    - delete confirmation
30. A Zod unit test file covers every rule and limit in `quiz.ts`.
31. `npm test`, `npm run lint`, `npm run typecheck` and `npm run db:test` pass, and the browser console shows no warnings.

## Packages

None new. `react-hook-form`, `zod`, `@hookform/resolvers` and `zustand` were approved in feature 4.

## Files in scope

```
src/routes/quizzes.new.tsx  src/routes/quizzes.$quizId.edit.tsx
src/pages/QuizEditorPage.tsx (+ .test.tsx)
src/components/quiz-editor/*.tsx (+ tests)   # BasicsPart, OutcomesPart, QuestionsPart,
                                             # QuestionEditor, AnswerList, SuggestedTimeField,
                                             # ErrorSummary, DeleteQuizSection
src/components/ConfirmDialog.tsx (+ .test.tsx)
src/components/SiteHeader.tsx               # "Create quiz" link for members
src/hooks/useQuizForEdit.ts  src/hooks/useSaveQuiz.ts  src/hooks/useDeleteQuiz.ts
src/hooks/useQuizDraft.ts                   # read once + the one write subscription
src/schemas/quiz.ts (+ .test.ts)  src/schemas/quizLimits.ts
src/routeTree.gen.ts, src/types/database.types.ts (generated)
supabase/migrations/<timestamp>_quiz_limits.sql
supabase/migrations/<timestamp>_rate_limits.sql
supabase/migrations/<timestamp>_save_quiz.sql
supabase/tests/save_quiz.test.sql  supabase/tests/rate_limits.test.sql
CLAUDE.md (feature 2 status only)
```

## Out of scope

- The dashboard's "My quizzes" section and its Edit and Delete buttons (feature 3), and `list_my_quizzes`.
- Taking quizzes, the timer, and the popup's Start button (feature 1).
- Drag-and-drop reordering (a possible follow-up that needs a library approval).
- Images in questions (S1), multi-select in personality quizzes (S5), AI generation (S3), and tags.
- Any private, unlisted or draft-on-server state. Quizzes are public as soon as they're published.
- The `pg_cron` cleanup of `rate_limits` rows (feature 1 adds the job, which also cleans this table).

## Where to look when reviewing

- **`QuizEditorPage.tsx`:**
  - **One** `useForm` for the whole quiz, with `FormProvider`. The part editors read it with `useFormContext` instead of receiving the form through props.
  - `useFieldArray` handles outcomes, questions, and each question's answers.
  - Nothing from the form is copied into `useState`.
- **`useQuizDraft.ts`:** the draft is read once for `defaultValues`, and the **one** effect subscribes to changes and writes to session storage. Check the cleanup.
- **`QuestionEditor.tsx`:** the type change and "Number of answers" change are handled in `onChange` handlers using the field array's `replace`, `append` and `remove`. No effect watches the type.
- **The `part` search param:** the URL is the only source of the current part.
- **The answer and outcome selects:** the outcome options are derived from the form's current outcomes with `useWatch` while rendering, not stored separately.
- **`save_quiz`:** the server-side copy of every rule. Compare it line by line with `quiz.ts` and `quizLimits.ts`.

## Manual checks

- **Keyboard only:** create a 3-question personality quiz with 3 outcomes, using Move up/down, kind switching and Remove. Publish, then edit it.
- Reload in the middle of each part and confirm everything comes back. Close the tab and reopen it, and confirm the draft is gone.
- Open the same quiz's edit page in two tabs, save in one, then save in the other, and confirm the stale-version message.
- **Screen reader:** the part change, moves, removals, error summary and "Restored your unsaved draft" are each announced once.
