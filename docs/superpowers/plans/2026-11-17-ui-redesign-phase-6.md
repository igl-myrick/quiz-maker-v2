# UI Redesign Phase 6 (Quiz Editor) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Restyle the quiz editor: step pills, matching padded Kind and Suggested time panels, outlined question and outcome blocks with dashed add slots, the personality answers table with 1-2-3 points pills (stacked on phones), and the new button layout, inside the purple highlight while building a personality quiz.

**Architecture:** Markup and CSS changes in `src/components/quiz-editor/*`, built from Phase 1's `StepPills` and `PillGroup`. The points pills use React Hook Form's `Controller` (already a dependency) to drive the controlled `PillGroup`. Validation, saving, drafts, the error summary, focus moves and announcements are untouched. Styles go in the existing `src/styles/editor.css`.

**Tech Stack:** React 19 + TypeScript strict, React Hook Form, Zod, Ply CSS, Vitest + RTL + vitest-axe.

**Spec:** `specs/07-ui-redesign.md`, Phase 6 (P6.1–P6.6, including the owner's narrow-screen decision in P6.5) and Global criteria G1–G11. Phases 1–5 are merged on `fix/ui-polish`.

**Branch:** `feature/7-ui-editor`, cut from `fix/ui-polish` at its current tip.

## Global Constraints

- No new libraries (G1). New class names, all checked free in `node_modules/ply-css/ply-classes.json`: `editor-frame`, `editor-nav`, `editor-nav-start`, `editor-nav-end`, `label-row`, `option-panel`, `editor-block`, `editor-block-tools`, `add-slot`, `answer-table`, `answer-table-head`, `answer-row`, `answer-cell`, `cell-label`.
- Contrast AA in light, dark and high contrast, both kinds (G2); tokens only (G3); `rem` (G4); targets ≥ 24×24 and visible focus (G5); colour never alone (G6); no sideways scroll at 320px at every text size (G8), which P6.5's stacked layout exists for.
- Behaviour unchanged (G9): parts and their order, Next's checks, Publish and Save changes, the stale-draft banner, Discard with its confirm, the error summary and every link target id (`fieldDomId(...)`, `ADD_QUESTION_ID`, `ADD_OUTCOME_ID`, the legend and move-button ids), focus after Move/Remove/Add, the kind-switch confirm, character counts and their near-limit announcements, Move up/Move down `aria-disabled` at the ends (P6.4).
- Wording unchanged (G10). The buttons stay "Back", "Next", "Publish" / "Save changes" and "Discard draft" (P6.6 calls Back "Previous"; the existing word stays). Every control keeps its label text ("Answer 2 text", "Answer 2 outcome", "Answer 2 points", …).
- Lint: `npx eslint . --ignore-pattern ".ds-sync/**" --ignore-pattern "ds-bundle/**"` until PR #10 merges.
- Phase ends with lint, `npm run typecheck`, `npm test`, `npm run db:test` passing and no console warnings (G11).

## Decisions this plan makes

- **Scope wrapper:** `QuizEditor` wraps its `<form>` and its confirm `dialog` in `<div className="editor-frame" data-kind={kind === 'personality' ? 'personality' : undefined}>`, so the highlight switches the moment Personality is picked (P6.1) and reaches the editor's confirm dialogs (P1.2). The "Switch to Personality?" confirm opens while the kind is still trivia, so it is blue; that's correct, since the switch hasn't happened yet.
- **Block headers:** each question and outcome `fieldset` keeps its `legend` first (it must stay the fieldset's name and keeps its focus id), and the Move up / Move down / Remove buttons move from the bottom into a tools row right after it, laid out beside the legend with CSS. This also moves them earlier in the tab order, before the block's fields.
- **Personality answers table (P6.5):** built as a CSS grid, not a `<table>`, because the narrow layout must stack the same controls without changing their order or labels. The column headings Answer / Leads to / Points are a visible header row with `aria-hidden="true"`: every control already has its own full label ("Answer 2 outcome"), so the headings would only repeat. In the wide layout those per-control labels are visually hidden (clipped, still read); below the switch point (a container query on the answer list at 34rem, so it also triggers at larger text sizes) the header row hides and each label becomes visible. Trivia answers keep today's stacked layout with their Correct radio or checkbox.
- **Points pills:** `PillGroup` with legend "Answer N points" (`hideLegend` in the wide layout, visible in the stacked one through the same container query), options 1, 2, 3, driven by `Controller` on `questions.${q}.options.${a}.points`, whose values stay the strings '1' | '2' | '3'.
- **Character counts** move into a `.label-row` next to their label (flex, space-between); the count markup and its live region are unchanged.

## Review Focus

1. **Error summary links after the restructure.** Every summary link (title, description, outcome names, question type/prompt, answer text, answer outcome, correct answer, add buttons) must still land on its control. The existing editor tests that click summary links must pass unmodified; Task 4 adds one for "Answer 1 outcome" inside the table.
2. **Points survive save and reload.** A chosen 3 must reach `save_quiz` as `points: 3` and come back as 3 when editing. Task 4 tests the publish payload.
3. **Focus after Move up / Move down / Remove** now that the buttons sit in the header: focus must stay on the moved block's same button (existing ids) and the announcement still fires. Existing tests cover it.
4. **Narrow stacked layout at Largest text.** At 320px with root 150%, the table must stack, show its labels and pills legend, and not scroll sideways. Task 4 measures it in the browser.
5. **Kind switch with data present.** Switching to Personality and confirming must turn the frame purple, and the kind-specific data reset must still happen. Existing kind-switch test plus Task 1's attribute test.

---

### Task 1: Editor frame, step pills and button row

**Files:**
- Modify: `src/components/quiz-editor/QuizEditor.tsx`, `src/pages/QuizEditorPage.test.tsx`, `src/styles/editor.css`

**Interfaces:**
- Consumes: `StepPills({ steps: string[], current: number })` (Phase 1); existing `parts`, `partIndex`, `PART_LABELS`.

- [ ] **Step 1: Write the failing tests** in `QuizEditorPage.test.tsx`, reusing its render helper for a new quiz:

```tsx
it('shows step pills and turns purple once Personality is picked', async () => {
  // render the new-quiz editor
  const frame = document.querySelector('.editor-frame')
  expect(frame).not.toHaveAttribute('data-kind')
  expect(document.querySelector('.step-pills')).toHaveAttribute('aria-hidden', 'true')
  fireEvent.click(main().getByRole('radio', { name: /^Personality/ }))
  // (confirm if the fixture has kind data; a fresh form has none)
  await waitFor(() => expect(frame).toHaveAttribute('data-kind', 'personality'))
  expect(document.querySelectorAll('.step-pills li')).toHaveLength(3)
})
it('puts Back and Discard on the left, Next and Publish on the right', async () => {
  // render, type a title so a draft exists, press Next to reach part 2
  expect(document.querySelector('.editor-nav-start')?.textContent).toMatch(/Back.*Discard draft/)
  expect(document.querySelector('.editor-nav-end')?.textContent).toMatch(/Publish/)
})
```

- [ ] **Step 2: Run** `npx vitest run src/pages/QuizEditorPage.test.tsx`. Expected: both FAIL.

- [ ] **Step 3: Implement.** Wrap `<form>` and `{dialog}` in the `editor-frame` div with `data-kind`. Above the `h2`, `<StepPills steps={parts.map((p) => PART_LABELS[p])} current={partIndex + 1} />`. Replace the bottom `btn-group` with `<div className="editor-nav">` holding `<div className="editor-nav-start">` (Back when `partIndex > 0`, Discard draft when `hasDraft`) and `<div className="editor-nav-end">` (Next when not last, the submit button). CSS: `.editor-nav` flex, wrap, `justify-content: space-between`, gap, `margin: 1.5rem 0`; both groups flex, wrap, gap `0.5rem`; `.editor-nav-end` `margin-left: auto`. Remove the duplicate `.btn[aria-disabled]` rule from `editor.css` (it's already in `app.css`).

- [ ] **Step 4: Run** `npm test`. Expected: all pass.
- [ ] **Step 5: Commit** `git commit -m "Add step pills, the personality frame and the new editor button row"`.

---

### Task 2: Basics and Suggested time panels

**Files:**
- Modify: `src/components/quiz-editor/BasicsPart.tsx`, `src/components/quiz-editor/SuggestedTimeField.tsx`, `src/pages/QuizEditorPage.test.tsx`, `src/styles/editor.css`

- [ ] **Step 1: Write the failing tests:**

```tsx
it('puts Kind and Suggested time in matching panels, and counts beside the labels', async () => {
  // render the new-quiz editor (part 1)
  expect(main().getByRole('group', { name: 'Kind' })).toHaveClass('option-panel')
  const title = main().getByLabelText('Title')
  expect(title.closest('div')?.querySelector('.label-row')?.textContent).toMatch(/Title.*0\/75/)
  // go to the Questions part (fill title, press Next) and:
  expect(main().getByRole('group', { name: 'Suggested time' })).toHaveClass('option-panel')
})
```

- [ ] **Step 2: Run** the file. Expected: FAIL.
- [ ] **Step 3: Implement.** Title and description: `<div className="label-row">` holding the `label` and the `CharacterCount`, then the input, then `FieldError`. Kind fieldset and the Suggested time fieldset get `className="option-panel"` (Suggested time keeps `margin-bottom`). The "Kind: … can't be changed after publishing" paragraph for edits stays as is. CSS: `.label-row` flex, `justify-content: space-between`, `align-items: baseline`, gap; `.label-row label` margin 0; `.option-panel` `padding: 0.85rem 1rem 0.5rem`, `border: 1px solid var(--ply-border-color)`, `border-radius: var(--qm-radius-card)`, `background: var(--ply-bg-surface-alt)`; editor inputs, textareas and selects get `border-radius: var(--qm-radius-input)` (scoped to `.editor-frame`).
- [ ] **Step 4: Run** `npm test`. Expected: all pass (character-count announcement tests unchanged).
- [ ] **Step 5: Commit** `git commit -m "Give Kind and Suggested time matching panels and move counts beside labels"`.

---

### Task 3: Question and outcome blocks, add slots

**Files:**
- Modify: `src/components/quiz-editor/QuestionEditor.tsx`, `src/components/quiz-editor/OutcomesPart.tsx`, `src/components/quiz-editor/QuestionsPart.tsx`, `src/pages/QuizEditorPage.test.tsx`, `src/styles/editor.css`

- [ ] **Step 1: Write the failing tests:**

```tsx
it('shows each question as an outlined block with its tools in the header', async () => {
  // reach the Questions part
  const block = main().getByRole('group', { name: 'Question 1' })
  expect(block).toHaveClass('editor-block')
  expect(block.querySelector('.editor-block-tools')?.contains(
    within(block).getByRole('button', { name: 'Move up: question 1' }))).toBe(true)
  expect(within(block).getByRole('button', { name: 'Move up: question 1' })).toHaveAttribute('aria-disabled', 'true')
  expect(main().getByRole('button', { name: 'Add question' })).toHaveClass('add-slot')
})
```

  plus the same for an outcome block and "Add outcome" in a personality quiz.

- [ ] **Step 2: Run** the file. Expected: FAIL.
- [ ] **Step 3: Implement.** Question and outcome `fieldset`s: `className="editor-block"`; right after the `legend`, `<div className="editor-block-tools">` with the three existing buttons (same ids, `aria-disabled`, labels). Remove the bottom button group. "Add question" and "Add outcome" get `className="btn add-slot"` (ids and `disabled` unchanged; drop the wrapping `<p>` margin if it doubles spacing). CSS: `.editor-block` `padding: 1rem 1.25rem; border: 1px solid var(--ply-border-color); border-radius: var(--qm-radius-card); margin-bottom: 1rem`; `.editor-block > legend` `float: left; width: auto; margin: 0.25rem 0 0.75rem`; `.editor-block > legend + .editor-block-tools` `clear: none; display: flex; flex-wrap: wrap; justify-content: flex-end; gap: 0.35rem; margin-bottom: 0.75rem` (a flex container sits beside the float); `.editor-block-tools + *` `clear: both`; tool buttons small (`font-size: 0.8125rem`, min-height `max(24px, 1.75rem)`); `.add-slot` `display: block; width: 100%; padding: 0.75rem; border: 1.5px dashed var(--ply-border-strong); background: transparent; color: var(--ply-color-link)` with visible `:focus-visible`.
- [ ] **Step 4: Run** `npm test`. Expected: all pass (move, remove and add focus tests unchanged).
- [ ] **Step 5: Verify in the browser:** blocks and tools match `editor-steps-v2.html`; Move up dimmed on the first block, Move down on the last; 320px Largest: tools wrap under the legend, no sideways scroll.
- [ ] **Step 6: Commit** `git commit -m "Outline question and outcome blocks and make the add buttons dashed slots"`.

---

### Task 4: Personality answers table with points pills

**Files:**
- Modify: `src/components/quiz-editor/AnswerList.tsx`, `src/pages/QuizEditorPage.test.tsx`, `src/styles/editor.css`

**Interfaces:**
- Consumes: `PillGroup<T extends string>({ legend, name, options, value, onChange, hideLegend })` (Phase 3 generic); `Controller` from `react-hook-form`.

- [ ] **Step 1: Write the failing tests** (a personality quiz with two outcomes, reaching the Questions part, as the existing personality tests do):

```tsx
it('lays personality answers out as a table with 1-2-3 points pills', async () => {
  // reach Questions in a personality quiz
  const answers = main().getByRole('group', { name: 'Answers to question 1' })
  expect(answers.querySelector('.answer-table-head')).toHaveAttribute('aria-hidden', 'true')
  expect(within(answers).getByLabelText('Answer 1 text')).toBeInTheDocument()
  expect(within(answers).getByLabelText('Answer 1 outcome')).toBeInTheDocument()
  const points = within(answers).getByRole('group', { name: 'Answer 1 points' })
  expect(within(points).getByRole('radio', { name: '1' })).toBeChecked()
  fireEvent.click(within(points).getByRole('radio', { name: '3' }))
  expect(within(points).getByRole('radio', { name: '3' })).toBeChecked()
})
it('publishes the chosen points', async () => {
  // fill a valid personality quiz, choose 3 for answer 1 of question 1, Publish
  // expect the save_quiz call's first question's first option to have points: 3
})
it('links the summary to an answer outcome inside the table', async () => {
  // press Publish with answer 1's outcome unchosen; click the summary link
  // expect(main().getByLabelText('Answer 1 outcome')).toHaveFocus()
})
```

  (Use the file's existing save mock and summary helpers; mirror the existing "publishes a personality quiz" test's arrangement.)

- [ ] **Step 2: Run** the file. Expected: the table and points tests FAIL; the summary-link one may already pass (it guards the restructure).

- [ ] **Step 3: Implement.** In `AnswerList`, for `kind === 'personality'`: the `fieldset` (legend unchanged) holds `<div className="answer-table">` with `<div className="answer-table-head" aria-hidden="true"><span>Answer</span><span>Leads to</span><span>Points</span></div>` and, per answer, `<div className="answer-row">` with three `answer-cell`s: (1) `label.cell-label` "Answer N text" + input + error, (2) `label.cell-label` "Answer N outcome" + select + error, (3) a `Controller` rendering `<PillGroup legend={`Answer ${n} points`} name={fieldDomId(pointsName)} options={[1,2,3] as strings} value={field.value} onChange={field.onChange} hideLegend />`. Trivia keeps the current markup. CSS: `.answer-table` `container-type: inline-size`; `.answer-table-head` and `.answer-row` grid `minmax(0, 2fr) minmax(0, 1.4fr) auto`, gap `0.75rem`, align center; head row small secondary bold; `.cell-label` (and the pills legend, already `sr-only` via `hideLegend`) clipped in the wide layout. `@container (max-width: 34rem)`: head row `display: none`; rows become one column with a top border between answers; `.cell-label` shown as a normal label; inside the stacked layout the pills legend is shown too (override `.answer-row .pill-group > legend.sr-only` with static positioning and normal size). Note: `hideLegend` uses Ply's `sr-only`; the override must target only `.answer-row` so other PillGroups are unaffected.

- [ ] **Step 4: Run** `npm test`. Expected: all pass.

- [ ] **Step 5: Verify in the browser:** a personality quiz's Questions part matches `points-options.html` option C (one row per answer under the three headings), purple pills; Tab order per row: text, outcome, points (arrow keys move within the pills). At 320px default and Largest: stacked blocks with visible "Answer N outcome" and "Answer N points" labels, no sideways scroll. Publish a test personality quiz, reopen it in Edit, and the chosen points are still selected. Light, dark, high contrast.

- [ ] **Step 6: Commit** `git commit -m "Lay out personality answers as a table with points pills, stacked on phones"`.

---

### Task 5: Phase checks

**Files:** Modify `specs/07-ui-redesign.md` (status line: "Phase 6 built on `feature/7-ui-editor`").

- [ ] **Step 1: Run** lint (with the ignore patterns), `npm run typecheck`, `npm test`, `npm run db:test`, `npx prettier --check src docs/superpowers specs`. Expected: all pass, no console warnings. If `db:test` fails, check first for leftover local test data from the browser checks (Phase 5 lesson) before suspecting the code.
- [ ] **Step 2: Manual checks:** keyboard through all three parts (step pills skipped, every control reachable, Move buttons keep focus, summary links land); screen reader spot check (block names, table controls' labels, pills group names); light, dark, high contrast; both kinds; 320px Largest; reduced motion.
- [ ] **Step 3: Commit the spec note** with message "Note Phase 6 build in the redesign spec".
