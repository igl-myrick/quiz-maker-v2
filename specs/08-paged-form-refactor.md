# Refactor 8: One paged-form module for the take and the quiz editor

Status: **Approved** (2026-11-18). It depends on feature 7 (UI redesign) and is built on the branch `refactor/paged-form`, cut from `fix/ui-polish`. It came out of an architecture review on 2026-11-18. Domain terms come from `GLOSSARY.md`.

This is a refactor. Apart from the one visible change in criterion 12, people see and hear exactly what they do today: the same pages and parts, wording, focus moves and announcements.

## Goal

The take (`TakePage`) and the quiz editor (`QuizEditor`) each build the same flow by hand: they keep a step in the URL, move between steps (focusing the step heading and announcing it), check one step before Next, show an error summary and focus it, and handle summary links (go to the step that holds the field, then focus the field). One module, `usePagedForm`, will own that flow, with one shared `ErrorSummary`. Each page keeps only what is its own: what it checks, what it submits, and its wording.

The editor also loses its three hand-kept copies of "which field belongs to which part". Next and Publish run the same validation at two stages, and the mapping lives only in `describe()`.

## Acceptance criteria

### The module

1. `src/hooks/usePagedForm.ts` exports one hook, `usePagedForm`. Its interface uses only **steps** (opaque string keys chosen by the caller), DOM ids and summary items. It knows nothing about questions, pages, parts, outcomes, the take store or React Hook Form.
2. The caller supplies:
   - the ordered list of steps and the current step (read by the caller from its own URL search param)
   - `goToStep(step) => Promise<void>`, which does the caller's own typed `navigate`. The module never calls `navigate` itself.
   - `describeStep(step, index, total) => string`, used for **both** the step heading text and the announcement made after moving. For example "Page 2 of 3", or "Part 2 of 3: Outcomes".
3. The hook owns and returns:
   - `next()`, `back()` and `goTo(step)`. Each moves through `goToStep`, then focuses the step heading and announces `describeStep(…)` through the existing `announce()` store.
   - a ref for the step heading
   - whether the summary is shown, and a ref for it
   - `lastCheck: 'step' | 'finish' | null`. This is reset to `null` whenever the step changes.
   - `showSummary(check)`. It shows the summary, sets `lastCheck` and focuses the summary. Callers use it after a failed check and after a server error with no items.
   - `selectItem(item)`. It moves to `item.step` if that isn't the current step, then focuses `item.targetId`.
4. **Focus never uses `setTimeout`.** The hook keeps a pending focus target in state (the summary, the step heading, or an element id). An effect focuses it after the render that shows it, then clears it. All four existing `setTimeout(…focus…, 0)` calls in `TakePage.tsx` and `QuizEditor.tsx` are gone. (The `setTimeout` around the "Quiz published" announcement after navigating to search is out of scope.)
5. A summary item is `{ key: string, step, targetId: string, text: string }`. The module never works out an item's step or target itself. The caller tags each item.

### The shared summary

6. `src/components/ui/ErrorSummary.tsx` replaces `src/components/take/ErrorSummary.tsx` and `src/components/quiz-editor/ErrorSummary.tsx`, and **both of those files are deleted** (approved 2026-11-18). It keeps today's markup: a `div` with `tabIndex={-1}`, `role="group"`, `aria-labelledby` pointing at its heading, and the classes `border padding margin-bottom`. Each item is a link to `#targetId`, and clicking it calls `onSelect(item)` with `preventDefault`.
7. Props: `heading` (text), `headingLevel` (`2 | 3`), `items`, `onSelect`, a ref, and an optional server message (`children`). The server message is rendered **above** the list, and the list is left out when there are no items.

### The take

8. `TakePage` uses the hook with steps `'1'…'N'` (pages of 10 questions), and `describeStep` gives "Page n of N". It keeps:
   - its own checks (`unansweredIds`), run on Next for the current page and on Submit for all questions
   - its summary headings, chosen from `lastCheck` and the server error: "Answer these questions to continue", "Answer these questions before submitting", or "Couldn't submit your answers". `headingLevel` is 2.
   - its server messages, the submission body, claim-token saving, and clearing the take
   - its redirect for a page past the end
   The local `attempt` state is replaced by `lastCheck`. Summary items are tagged with the page that holds the question, using the existing arithmetic.

### The editor

9. `QuizEditor` uses the hook with steps that are `EditorPart` values, and `describeStep` gives "Part n of N: Label". `headingLevel` is 3 and the heading stays "Fix these before publishing". The outcomes-to-basics redirect for trivia quizzes stays in the editor.
10. **Two validation stages.** `crossFieldIssues(values, stage)` in `src/schemas/quiz.ts` takes `'step' | 'finish'` and skips finish-only rules at `'step'`. Today the only finish-only rule is "No answer leads to this outcome yet."
    - `quizFormSchema` keeps its current meaning, the finish stage, for every existing caller.
    - The editor's resolver reads a `stageRef` and validates with the matching stage. Next sets it to `'step'` and runs the whole form. It blocks only if a summary item's step is the current part. Publish sets it to `'finish'`.
    - The reachability error moves from the hidden path `outcomes.i.key` to `outcomes.i.title`. `describe()` no longer special-cases `key`, and `OutcomesPart` no longer reads `errors.outcomes[i].key`.
    - `partFields()` is deleted.
11. **After a successful Next, `form.clearErrors()` runs before moving on.** The part being left is already clean, so this only removes errors on parts the person hasn't reached yet, and they never arrive at a part already showing errors. Behaviour matches today's.
12. `describe()` and `summaryItems()` move unchanged, apart from criterion 10, to `src/components/quiz-editor/summaryItems.ts`. They import `ADD_OUTCOME_ID` and `ADD_QUESTION_ID` from the parts, as they do today. The server message (duplicate title, rate limit, generic) now appears **above** the item list instead of as its first bullet. This is the one visible change, approved 2026-11-18.
13. The duplicate-title path uses `selectItem` (title field on the basics part) instead of calling the summary handler directly.

### Tests

14. `src/hooks/usePagedForm.test.tsx` tests the module through a small three-step test harness, using role-based queries and a `vitest-axe` check on the summary:
    - Next with a failing check shows the summary, focuses it, and sets `lastCheck` to `'step'`.
    - Next with a passing check moves, focuses the step heading, and announces `describeStep`.
    - Back moves without checking.
    - A summary link on another step moves there and focuses the target. A summary link on the same step only focuses.
    - `showSummary('finish')` with no items shows the server message and focuses the summary.
    - `lastCheck` resets when the step changes.
15. `src/components/ui/ErrorSummary.test.tsx` covers the heading level, the server message placed above the list, and the list left out when empty.
16. In `src/pages/TakePage.test.tsx` and `src/pages/QuizEditorPage.test.tsx`, detailed focus and announcement tests that duplicate criterion 14 are reduced to **one smoke test per page**: a failed Next focuses the summary, and a summary link focuses the field. Tests of each page's own wording and rules stay.
17. `src/schemas/quiz.test.ts` covers both stages: at `'step'` the reachability rule is absent, and at `'finish'` it is reported at `outcomes.i.title`.
18. Editor regression tests:
    - Next on Outcomes isn't blocked by reachability.
    - Next on Basics isn't blocked by question errors.
    - After Next, the next part shows no errors.
    - Publish reports reachability on the outcome's name field.

### Definition of done

19. `npm test`, `npm run db:test`, `npm run lint`, `npm run typecheck` and `npm run format:check` pass. The app runs with no console errors or warnings.
20. Manual keyboard check of the take and the editor, with a screen reader if possible:
    - Next with missing answers or fields
    - summary links to another page or part
    - Back
    - a server error on Submit or Publish
    - the duplicate-title error

## Files in scope

- `src/hooks/usePagedForm.ts` (new) and `src/hooks/usePagedForm.test.tsx` (new)
- `src/components/ui/ErrorSummary.tsx` (new) and `src/components/ui/ErrorSummary.test.tsx` (new)
- `src/components/quiz-editor/summaryItems.ts` (new)
- `src/components/take/ErrorSummary.tsx` (delete)
- `src/components/quiz-editor/ErrorSummary.tsx` (delete)
- `src/pages/TakePage.tsx`, `src/pages/TakePage.test.tsx`
- `src/components/quiz-editor/QuizEditor.tsx`, `src/components/quiz-editor/OutcomesPart.tsx`
- `src/pages/QuizEditorPage.test.tsx`
- `src/schemas/quiz.ts`, `src/schemas/quiz.test.ts`
- this spec

## Out of scope

- The `save_quiz` SQL and the grading edge function. The server's validation doesn't change.
- `PageNav`, `StepPills`, `QuestionFieldset` and the part components, except `OutcomesPart`'s error read (criterion 10)
- The submission contract, the dialogs, data access, claim tokens, and the other candidates from the architecture review
- The announcement after publishing (`setTimeout` around `announce(message)`)
- Any styling change. No CSS file changes.
- `GLOSSARY.md`. "Step" is an implementation word, not a domain term, and users still see "page" and "part".

## Build notes (2026-11-18)

- **When `lastCheck` resets (criterion 3).** It resets when the hook moves with `next`, `back` or `goTo`, not when a summary link changes the step, so the summary stays up while the person fixes things. Side effect in the editor: Back after a failed Publish now hides the summary, as it already did on the take. The inline errors stay.
- **Next's check in the editor (criterion 10).** `form.formState.errors` is a snapshot from the last render, so straight after `trigger()` it is out of date. Next decides with `quizStepSchema.safeParse(form.getValues())` and `partOf(path)` from `summaryItems.ts` instead. It runs `trigger()` at the step stage only when the part fails, to show the inline errors. The step-to-part mapping still lives only in `describe()`.
- **After a failed Next, the editor's summary lists only this part's problems.** The whole form is validated, so errors on later parts are filtered out of the list, matching what the old field-by-field Next showed.
- **Page tests (criterion 16).** `TakePage.test.tsx` and `QuizEditorPage.test.tsx` already had one focus-and-announcement test per flow, so they stayed as the smoke tests and nothing was removed.
- **Destructure the refs.** Callers take `headingRef` and `summaryRef` straight out of the hook's result. Otherwise the React Hooks lint treats the whole result as a ref and flags reading `stepHeading` during render.
