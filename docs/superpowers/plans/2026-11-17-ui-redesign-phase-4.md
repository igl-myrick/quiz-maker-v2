# UI Redesign Phase 4 (Take and Result Pages) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Restyle the take page (T1) and both result pages (score or outcome card with the actions inside it), keeping every behaviour and word except "Copy link".

**Architecture:** Markup and CSS changes in `TakePage.tsx`, `src/components/take/*`, `ResultPage.tsx` and `src/components/result/*`, built from Phase 1's `KindChip` and `StripArt`. The take page and personality result page get the personality scope (`data-kind` on `<main>`). Styles go in a new `src/styles/quiz-pages.css` imported from `src/main.tsx` after `popups.css`. Grading, saving, claiming, timers, focus and announcements are untouched.

**Tech Stack:** React 19 + TypeScript strict, Ply CSS 1.8, Vitest 5 + React Testing Library + vitest-axe.

**Spec:** `specs/07-ui-redesign.md`, Phase 4 (P4.1–P4.4) and Global criteria G1–G11. Phases 1–3 are merged on `fix/ui-polish`.

**Branch:** `feature/7-ui-take-results`, cut from `fix/ui-polish` at its current tip.

## Global Constraints

- No new libraries (G1). New class names, all checked free in `node_modules/ply-css/ply-classes.json`: `take-head`, `take-progress`, `countdown-pill`, `question`, `question-number`, `question-prompt`, `page-nav`, `score-card`, `score-value`, `score-bar`, `tally`, `result-actions`, `notice`, `save-card`, `result-question`, `status-badge`, `outcome-card`, `outcome-strip`. Ply has no small-button class, so small buttons are sized in our CSS.
- Contrast AA in light, dark and high contrast, both kinds (G2). Status colours use the `--qm-correct`, `--qm-partly`, `--qm-wrong` tokens (Phase 1, pre-checked as text on the page and card backgrounds).
- `rem` sizes (G4); targets ≥ 24×24; focus visible (G5); status never colour alone: symbol plus words (G6); artwork decorative (G7); no sideways scroll at 320px at every text size (G8).
- Behaviour unchanged (G9): take autosave, page focus and the "Page N of M" announcement, the error summary and its links, the countdown's warnings (not a live region), Submit, every server error message, the result's notices, Save to my account and its focus moves, the copy fallback field.
- Wording unchanged (G10), with one exception: "Copy results link" becomes **"Copy link"** (P4.4). Status badges keep today's words, e.g. "◐ Partly correct: 0.5 points".
- Lint: `npx eslint . --ignore-pattern ".ds-sync/**" --ignore-pattern "ds-bundle/**"` until PR #10 merges.
- Phase ends with lint, `npm run typecheck`, `npm test`, `npm run db:test` passing and no console warnings (G11).

## Decisions this plan makes

- **The take page's progress bar shows answered questions,** not pages: a native `<progress max={total} value={answered}>` labelled by the existing "N of M answered" text, placed under the "Page N of M" heading. Pages are already said by the heading; answered progress is what the taker wants to see grow.
- **The trivia score bar is decorative** (`aria-hidden` div), because the score is already in text right above it.
- **Result layout slots:** `TriviaResult` and `PersonalityResult` take an `actions` prop (rendered inside their card) and `TriviaResult` takes `children`, rendered between the score card and the question cards, so the page order is card → notices → save card → questions (P4.2). `ResultPage` passes notices and the save section as those children.
- **Phase 3 leftovers fixed here:** (a) `.start-controls` spreads its items apart only in the popup variant, so on the take page "Start quiz" goes back under the timer; (b) the personality scope also sets `--ply-btn-ghost-color`, which Ply hard-codes in dark mode, so Log in's quiet buttons turn purple when opened from a personality result.

- **No scope on the "not started" screen.** A take URL opened with no take in progress only shows the title and Start quiz; it stays blue rather than fetching the kind just for colour.

## Review Focus

1. **Unanswered marker stays associated.** The red left bar is decoration; "Answer this question." must still be in the fieldset's `aria-describedby`, and the error summary links must still land on the first input. Existing TakePage tests cover both and must pass unmodified.
2. **The legend's accessible name.** Splitting the legend into number and prompt spans must keep the fieldset's name as "Question N of M: prompt". Task 2's test asserts the group name.
3. **Purple scope reaches the result page's Log in popup.** "Save to my account" on a personality result opens `LoginDialog`, rendered inside the section, so it inherits `data-kind` from `<main>`. Task 4's browser check opens it in dark mode and confirms the quiet buttons are purple.
4. **Copy fallback inside the score card.** When the clipboard is refused, the read-only link field appears; inside the small-button row it must wrap onto its own line without sideways scroll at 320px. Task 3's browser check forces the fallback.
5. **Timed take at 320px Largest.** The countdown pill next to the title must wrap under it rather than squeezing the heading. Task 1 measures `scrollWidth` with a timed take.

---

### Task 1: Take page header

**Files:**
- Modify: `src/pages/TakePage.tsx`, `src/pages/TakePage.test.tsx`, `src/components/take/Countdown.tsx`, `src/components/StartQuizControls.tsx`, `src/styles/popups.css`
- Create: `src/styles/quiz-pages.css`; Modify: `src/main.tsx` (import after `popups.css`)

**Interfaces:**
- Consumes: `KindChip({ kind })`; `take.quiz.kind` (`TakeQuiz` has `kind`).
- Produces: nothing other tasks use.

- [ ] **Step 1: Write the failing tests** in `TakePage.test.tsx`, using its existing setup that starts a take (the "0 of 12 answered" test's arrangement):

```tsx
it('shows the kind, the page heading and an answered-progress bar', async () => {
  // arrange a 12-question trivia take on page 1, as the existing tests do
  expect(main().getByText('Trivia')).toBeInTheDocument()
  const progress = main().getByRole('progressbar', { name: '0 of 12 answered' })
  expect(progress).toHaveAttribute('max', '12')
  expect(progress).toHaveAttribute('value', '0')
})
it('turns on the personality highlight for personality takes', async () => {
  // arrange a personality take
  expect(screen.getByRole('main')).toHaveAttribute('data-kind', 'personality')
})
```

- [ ] **Step 2: Run** `npx vitest run src/pages/TakePage.test.tsx`. Expected: the two new tests FAIL.

- [ ] **Step 3: Implement.**
  - `TakePage`: `<main className="units-container" data-kind={…}>`, where the kind comes from the take (read in `TakePage`). The "not started" screen (a pasted take link with no take) stays outside the scope: it only offers Start quiz.
  - `TakeInProgress` header: `<div className="take-head">` with a left part (`KindChip`, the `h1` with `tabIndex={-1}`) and the `Countdown` on the right. Under it, the existing `h2` "Page N of M" (same ref, `tabIndex`), then `<div className="take-progress">` with `<p id={answeredId}>N of M answered</p>` and `<progress max={total} value={answered} aria-labelledby={answeredId} />`. The error summary stays between the header and the `h2`.
  - `Countdown`: `<p className="countdown-pill">` with the same text; still not a live region.
  - `StartQuizControls`: root `.start-controls` gets `data-variant={variant}`; in `popups.css`, `justify-content: space-between` moves to `.start-controls[data-variant='popup']`.
  - CSS (`quiz-pages.css`): `.take-head` flex, wrap, `align-items: flex-start`, `justify-content: space-between`, gap; `.take-head h1` `margin: 0.25rem 0 0`, `overflow-wrap: anywhere`; `.countdown-pill` pill (`border-radius: 999px`, `border: 1px solid var(--ply-border-color)`, `background: var(--ply-bg-surface-alt)`, padding `0.3rem 0.85rem`, `margin: 0`); `.take-progress progress` full width, `height: 0.5rem`, rounded, `accent-color: var(--ply-btn-default-bg)`.

- [ ] **Step 4: Run** `npm test`. Expected: all pass (existing "0 of 12 answered", "Page 1 of 2" heading focus and "Time left: 4:50" tests unchanged).

- [ ] **Step 5: Verify in the browser:** start a timed trivia quiz and a personality quiz from the seed. Chip, title, pill top right, "Page 1 of N", progress grows as answers are chosen; personality buttons, radios and focus purple. On a direct take URL with no take, "Start quiz" sits under the timer again. 320px Largest with the timed quiz: pill wraps under the title, `scrollWidth === 320`. Light, dark, high contrast.

- [ ] **Step 6: Commit** `git commit -m "Restyle the take page header with chip, timer pill and progress"`.

---

### Task 2: Questions and page navigation (T1)

**Files:**
- Modify: `src/components/take/QuestionFieldset.tsx`, `src/components/take/PageNav.tsx`, `src/pages/TakePage.test.tsx`, `src/styles/quiz-pages.css`

**Interfaces:** props unchanged.

- [ ] **Step 1: Write the failing tests** in `TakePage.test.tsx`:

```tsx
it('names each question group "Question N of M: prompt"', async () => {
  // arrange the 12-question take; first prompt as in the fixture
  expect(main().getByRole('group', { name: `Question 1 of 12: ${firstPrompt}` })).toHaveClass('question')
})
it('marks an unanswered question for the bar and keeps its message', async () => {
  // press Next page with nothing answered (as the existing summary test does)
  const group = main().getByRole('group', { name: new RegExp('^Question 1 of 12') })
  expect(group).toHaveAttribute('data-missing', 'true')
  expect(group).toHaveAccessibleDescription(/Answer this question\./)
})
```

- [ ] **Step 2: Run** `npx vitest run src/pages/TakePage.test.tsx`. Expected: both FAIL (no `question` class, no `data-missing`).

- [ ] **Step 3: Implement.**
  - `QuestionFieldset`: `<fieldset className="question" data-missing={showMissing || undefined} aria-describedby=…>`; legend `<span className="question-number">Question {n} of {t}</span><span className="sr-only">: </span><span className="question-prompt">{prompt}</span>` (the visible prompt goes on its own line; the hidden colon keeps the name). Hint, error and options unchanged; options keep real inputs.
  - `PageNav`: `<div className="page-nav">`; Previous first (when shown), primary button gets `className="btn btn-primary page-nav-next"`. CSS puts the primary on the right with `margin-left: auto`, so it's right even without Previous. Check `page-nav-next` is free in `ply-classes.json`.
  - CSS: `.question` no border or background, `padding: 1rem 0`, `border: 0; border-top: 1px solid var(--ply-border-color)`, first one no top border; `.question[data-missing]` `border-left: 3px solid var(--qm-wrong); padding-left: 0.85rem`; `.question-number` small uppercase secondary (`0.75rem`, letter-spacing); `.question-prompt` `display: block; font-size: 1.0625rem; font-weight: 700; margin-top: 0.2rem`; `.page-nav` flex, wrap, gap, `margin: 1.25rem 0`.

- [ ] **Step 4: Run** `npm test`. Expected: all pass, including the error-summary link and server-unanswered tests.

- [ ] **Step 5: Verify in the browser:** matches `take-v6.html` T1 (no boxes, lines between questions, controls at 1.0625rem). Press Next with blanks: red bar plus "Answer this question.", summary links land on the first input. Previous left, Next/Submit right. 320px Largest, light, dark, high contrast (the red bar uses `--qm-wrong`, still with its words).

- [ ] **Step 6: Commit** `git commit -m "Lay out take questions as lines with a missing-answer bar"`.

---

### Task 3: Trivia result

**Files:**
- Modify: `src/pages/ResultPage.tsx`, `src/pages/ResultPage.test.tsx`, `src/components/result/TriviaResult.tsx`, `src/components/result/ResultNotices.tsx`, `src/components/result/SaveResultSection.tsx`, `src/components/result/CopyLinkButton.tsx`, `src/styles/quiz-pages.css`

**Interfaces:**
- Produces: `TriviaResult({ result, actions, children }: { result: Result; actions: ReactNode; children?: ReactNode })`.

- [ ] **Step 1: Write the failing tests** in `ResultPage.test.tsx` (its trivia fixture):

```tsx
it('puts Copy link and Find another quiz inside the score card', async () => {
  // render the trivia result as the existing test does
  const card = main().getByText('Copy link').closest('.score-card')
  expect(card).not.toBeNull()
  expect(card?.contains(main().getByRole('link', { name: 'Find another quiz' }))).toBe(true)
})
it('keeps each question status in words with its symbol', async () => {
  expect(main().getByText('Partly correct: 0.5 points').closest('.status-badge')).not.toBeNull()
})
```

  Change the two existing `'Copy results link'` queries (lines ~212 and ~223) to `'Copy link'` (P4.4).

- [ ] **Step 2: Run** `npx vitest run src/pages/ResultPage.test.tsx`. Expected: new tests and the renamed queries FAIL.

- [ ] **Step 3: Implement.**
  - `CopyLinkButton`: label "Copy link"; fallback field unchanged.
  - `ResultPage` (ok branch): `const actions = <><CopyLinkButton /><Link to="/search" className="btn">Find another quiz</Link></>`. Trivia: `<TriviaResult result={…} actions={actions}><ResultNotices data={data} /><SaveResultSection data={data} /></TriviaResult>`. Remove the old bottom button row. Personality handled in Task 4 (keep it working here: render notices and save after it, pass `actions`).
  - `TriviaResult`: `h1` title (unchanged, `tabIndex={-1}`); `<section className="score-card">` with `<p className="score-value">` (points / total and percent, same text), the decorative `.score-bar` (`aria-hidden`, inner width = percent), the tally as a `<p className="tally">` with three spans (symbol `aria-hidden` plus the same words), and `<div className="result-actions">{actions}</div>`; then `{children}`; then the existing "Question by question" `h2` and list, each `li` a `.result-question` card whose status line is `<p className="status-badge" data-status="correct|partly|wrong">` with the same symbol and text.
  - `ResultNotices`: each `<p>` gets `className="notice"`.
  - `SaveResultSection`: the wrapper `div` gets `className="save-card"` (dashed card); the success and "can't be saved" messages keep their focus behaviour and get `className="notice"`.
  - CSS: `.score-card` surface card (`--qm-radius-card`, border, padding `1.25rem 1.5rem`, margin-bottom); `.score-value` `font-size: 2.25rem; font-weight: 800; line-height: 1.1`; `.score-bar` track `height: 0.5rem`, rounded, `background: var(--ply-bg-surface-alt)`, inner fill `var(--ply-btn-default-bg)`; `.tally` flex wrap with gap; `.result-actions` flex, wrap, gap `0.5rem`, `margin-top: 1rem`, and `.result-actions .btn` `font-size: 0.875rem; padding: 0.25rem 0.85rem; min-height: max(24px, 1.75rem)`; `.result-actions .form` (the fallback) `flex-basis: 100%`; `.notice` soft row (`background: var(--ply-bg-surface-alt)`, radius `--qm-radius-input`, padding, border `1px solid var(--ply-border-color)` so it shows in dark mode, where surface-alt equals the card surface); `.save-card` `border: 1px dashed var(--ply-border-strong)`, radius, padding, flex wrap; `.result-question` surface card like `.score-card` with smaller padding; `.status-badge` bold, `color: var(--qm-correct|--qm-partly|--qm-wrong)` per `data-status`.

- [ ] **Step 4: Run** `npm test`. Expected: all pass (`SaveResultSection.test.tsx` included).

- [ ] **Step 5: Verify in the browser:** submit a trivia quiz from the seed and view the result: card, bar, tally, small buttons inside, notices as soft rows, dashed save card (anonymous, same browser), question cards with coloured badges in words. Force the copy fallback (`navigator.clipboard.writeText = () => Promise.reject()` in the console, then click Copy link): the field appears on its own line, focused. 320px Largest, light, dark, high contrast; measure badge colour contrast on the card background.

- [ ] **Step 6: Commit** `git commit -m "Rebuild the trivia result with a score card and question cards"`.

---

### Task 4: Personality result and scope

**Files:**
- Modify: `src/components/result/PersonalityResult.tsx`, `src/pages/ResultPage.tsx`, `src/pages/ResultPage.test.tsx`, `src/styles/tokens.css`, `src/styles/quiz-pages.css`

**Interfaces:**
- Consumes: `StripArt({ kind })`; `actions` from Task 3.
- Produces: `PersonalityResult({ result, actions }: { result: Result; actions: ReactNode })`.

- [ ] **Step 1: Write the failing tests** in `ResultPage.test.tsx` (its personality fixture, "You're Winter"):

```tsx
it('shows the outcome card with the strip and actions, in the personality highlight', async () => {
  // render the personality result
  const card = main().getByRole('heading', { level: 1, name: "You're Winter" }).closest('.outcome-card')
  expect(card?.querySelector('svg.strip-art')).toHaveAttribute('aria-hidden', 'true')
  expect(card?.contains(main().getByRole('button', { name: 'Copy link' }))).toBe(true)
  expect(screen.getByRole('main')).toHaveAttribute('data-kind', 'personality')
})
it('leaves trivia results outside the personality highlight', async () => {
  // render the trivia result
  expect(screen.getByRole('main')).not.toHaveAttribute('data-kind')
})
```

- [ ] **Step 2: Run** `npx vitest run src/pages/ResultPage.test.tsx`. Expected: the personality test FAILS; the trivia one passes (guards the scope).

- [ ] **Step 3: Implement.**
  - `ResultPage`: `<main className="units-container" data-kind={…}>` set to `'personality'` only for an ok personality result.
  - `PersonalityResult`: `<section className="outcome-card">` with `<div className="outcome-strip"><StripArt kind="personality" /></div>` and a body: the `h1` (same text and `tabIndex`), the description, the quiz title `h2` (as today), then `<div className="result-actions">{actions}</div>`. Notices and the save card render after it from `ResultPage`.
  - `tokens.css` scope: add `--ply-btn-ghost-color: var(--qm-personality-text);` to `[data-kind='personality']`.
  - CSS: `.outcome-card` grid `5rem 1fr`, surface card, `overflow: hidden`, radius; `.outcome-strip` `background: var(--qm-personality)`, padding `1rem 0.75rem`; body padding `1.25rem 1.5rem`; container query on the card (`container-type: inline-size`) hiding the strip below 24rem, as in the details popup.

- [ ] **Step 4: Run** `npm test`. Expected: all pass.

- [ ] **Step 5: Verify in the browser:** submit a personality quiz from the seed: outcome card with purple strip, small purple-scoped buttons inside; anonymous in the same browser, "Log in to save this result" opens Log in, and in dark mode its quiet buttons are purple (computed colour `--qm-personality-text`); Escape returns focus to the save button. 320px Largest: strip hidden, no sideways scroll. Light, dark, high contrast.

- [ ] **Step 6: Commit** `git commit -m "Rebuild the personality result as an outcome card in the highlight"`.

---

### Task 5: Phase checks

**Files:** Modify `specs/07-ui-redesign.md` (status line: "Phase 4 built on `feature/7-ui-take-results`").

- [ ] **Step 1: Run** lint (with the ignore patterns), `npm run typecheck`, `npm test`, `npm run db:test`, `npx prettier --check src docs/superpowers specs`. Expected: all pass, no console warnings.
- [ ] **Step 2: Manual checks:** keyboard through a whole take and both result pages; screen reader spot check (legend names, missing message, progress bar label, status badges, strip skipped); light, dark, high contrast; both kinds; 320px Largest; reduced motion (no motion added).
- [ ] **Step 3: Commit the spec note** with message "Note Phase 4 build in the redesign spec".
