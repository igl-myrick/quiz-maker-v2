# Change 12: Editor and result page fixes

Status: **Approved** (2026-11-23). It is built on the branch `fix/12-editor-and-results-polish`. It changes feature 2 (quiz creation) and feature 7 (UI redesign), which are Done. Rules come from `CLAUDE.md` (§4, §5 and §8).

## Goal

Three problems the owner found on production:

1. **After publishing, the editor sends people to the wrong place.** Today a successful publish opens the quiz's details popup over the search page (spec 02, criterion 21). Closing that popup with Back returns to the editor, which is now empty because the draft was cleared. Publishing should go to the dashboard instead, with a visible confirmation.
2. **The error summary can be off screen.** When Publish finds problems, the summary appears at the top of the part, but on the **first** press the page doesn't move to it. People at the bottom of a long questions part don't see anything happen.
   - **Cause (reproduced on the local stack):** `usePagedForm` asks for focus on the summary and checks once, straight after the next render. On the first press the summary isn't rendered yet, because React Hook Form's errors arrive a render later. The request is then dropped, focus stays on Publish and the page doesn't scroll. A second press works, because the summary already exists.
   - The take page uses the same hook, so it has the same bug.
3. **The trivia result page shows bullets on each answer.** Each answer already has a ✓ or ✗, so the hollow bullets add nothing. They also sit outside the answers, too far to the left.

## Acceptance criteria

### 1. After publishing, go to the dashboard

1. On a successful publish, the editor navigates to `/dashboard` with `replace: true`. The dashboard **replaces** the editor in history, so browser Back goes to the page before the editor, never to an empty editor. This replaces spec 02 criterion 21's navigation to `/search?quiz=<id>`. Clearing the draft and refreshing the cached queries stay as they are.
2. The dashboard shows a confirmation under its `<h1>`:
   - after creating a quiz: **"Quiz created ✓"**
   - after saving changes to an existing quiz: **"Changes saved ✓"** (not "Quiz updated ✓", which the dashboard already uses as a tag on results whose quiz changed)

   The ✓ is `aria-hidden`, and the text has the site's success colour with sufficient contrast in every theme and in high contrast. It is plain text, not a live region. Screen readers hear it through one announcement, after the dashboard's own page-change announcement, using the existing `setTimeout(() => announce(message), 0)` pattern. That is "Quiz created" or "Changes saved".
3. The confirmation is shown **once**:
   - It's kept in a small in-memory Zustand store (`src/stores/noticeStore.ts`), never in the URL, history state or browser storage.
   - The dashboard reads it when it mounts and clears it when it unmounts, so leaving and coming back, or reloading, doesn't show it again.
4. Deleting a quiz from the editor is unchanged and still goes to `/search`. It's out of scope here.

### 2. Focus the error summary on the first press

5. `usePagedForm` keeps a focus request until its target exists. If the heading, the summary or the element isn't rendered yet, the effect leaves the request in place and tries again after the next render. Only a successful lookup clears it. A newer request still replaces an older one, as today.
6. Result: on the first press of **Publish** (editor) or **Submit** (take) with problems, focus moves to the error summary. The browser scrolls it into view, and its heading is read out, which is spec 02 criterion 18 as written.
7. The summary stays **at the top** of the part. That's where spec 02 put it, and it's where people look for it, ahead of the fields it links to. The take page puts it there too. Focusing it brings it into view wherever the person was.

### 3. No bullets on trivia result answers

8. The answer list inside each question on a trivia result gets Ply's `flat-list` class, which removes the bullets and the left indent. Each answer then lines up with the question heading and the status line above it. The ✓ or ✗, the answer text and the note in brackets are otherwise unchanged. It stays a real `<ul>`, so screen readers still hear a list.

### Tests and checks

9. Tests, written first and failing before the fix:
   - **Editor:** a successful publish of a new quiz navigates to `/dashboard`, and the dashboard shows "Quiz created ✓". A successful edit shows "Changes saved ✓". Both are announced once.
   - **Dashboard:** with no notice in the store, no confirmation shows. The notice is cleared on unmount.
   - **`usePagedForm`:** a focus request for an element that renders one render later still receives focus. The editor test covers this through Publish with errors, with focus on the summary. The take test does the same through Submit.
   - **Trivia result:** the answer list has the `flat-list` class.
10. `npm run lint`, `npm run typecheck`, `npm test`, `npm run db:test` and `npm run build` pass, with no console errors or warnings in the app.
11. Browser checks on the local stack, at 1920×1080 and at phone width, as a seeded member:
    - From the bottom of a long questions part, the first Publish press with problems scrolls to and focuses the summary.
    - Publishing a new quiz and editing one both land on the dashboard with the right confirmation, and Back doesn't return to an empty editor.
    - The trivia result answers have no bullets and line up with the heading, in light, dark and high contrast.

## Files in scope

- `src/components/quiz-editor/QuizEditor.tsx` (the success handler only) and its tests (`src/pages/QuizEditorPage.test.tsx`)
- `src/stores/noticeStore.ts` (new) and its test
- `src/pages/DashboardPage.tsx` and its test
- `src/hooks/usePagedForm.ts` (the focus effect only) and `src/hooks/usePagedForm.test.tsx` (one new test)
- `src/pages/TakePage.test.tsx` (the Submit summary test only)
- `src/components/result/TriviaResult.tsx` (the class only) and `src/pages/ResultPage.test.tsx`
- Styles for the confirmation, in `src/styles/dashboard.css`
- `specs/12-editor-and-results-polish.md` (this file: status and build notes)

## Out of scope

- Moving the error summary to the bottom of the form.
- Deleting a quiz from the editor (still goes to `/search`).
- Changing spec 02's text. This spec records the new navigation instead.
- The personality result page and any other list on the site.

## Calls for the owner

None open. Decided:

- **Edit wording** (2026-11-23): "Changes saved ✓".

## Build notes (2026-11-23)

### Changes from the spec

- **The confirmation is cleared on the next navigation, not on unmount** (criterion 3). The dashboard subscribes to the router's `onBeforeNavigate` and clears the notice there. Clearing in an unmount cleanup would have wiped it straight away in development, where StrictMode unmounts and remounts every component once. The result is the same: leaving the dashboard, or reloading, removes it.
- **`usePagedForm` gets its own test** (`src/hooks/usePagedForm.test.tsx`). The editor and take page tests can't show the bug: in the test environment React Hook Form's errors arrive in the same render as the focus request, while in the browser they arrive one render later. The new test renders the summary one tick after the request. It failed before the fix and passes after. The editor and take tests now also check that the summary has focus after the first press, as a guard.

### Checks

- **Tests first:** the new hook test, both dashboard confirmation tests, the two editor publish tests and the result list test failed before the fixes and pass after.
- Lint, typecheck and `format:check` pass. `npm test` passes 306 tests in 42 files, `npm run db:test` passes, and `npm run build` succeeds.
- **In the browser** (local stack, dev server, 1920×1080, signed in as the seeded member `alex` through the local auth admin API):
  - **First Publish press:** from the bottom of a long, incomplete questions part, focus moved to "Fix these before publishing" and the page scrolled to the top. Before the fix it stayed on Publish.
  - **Creating:** with a complete draft, opened from the dashboard, Publish went to `/dashboard` showing "Quiz created ✓" in `--qm-correct` green. "Quiz created" was announced after the page heading, and the history length didn't grow. Back went to the dashboard the editor was opened from, without the confirmation.
  - **Editing:** saving that quiz showed "Changes saved ✓" and announced it.
  - **Trivia result:** a submitted World Capitals result had no bullets (`list-style-type: none`), with each answer starting at the same left edge as its question heading. No console errors on any of these pages.
- **Clean-up:** the local test quiz, its retired versions, the result and the `user_settings` row the login synced for `alex` were deleted afterwards. The synced settings row had also made `09_user_settings` and `10_account_deletion` fail until it was removed, which is unrelated to this change.
- **Not checked in the browser:** phone width and light or high-contrast themes for the confirmation. It uses the theme-aware `--qm-correct` token, which the result badges already use in every theme.
