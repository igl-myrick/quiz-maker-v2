# UI Redesign Phase 1 (Shared Pieces) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the shared tokens, kind highlight scope, UI components, dialog shell and new quiz card that every later redesign phase uses.

**Architecture:** Two new stylesheets: `src/styles/tokens.css` holds the colour and radius tokens per theme and the `data-kind="personality"` scope, and `src/styles/ui.css` holds the component styles. Both are imported in `src/main.tsx` after `settings.css`. Seven small presentational components go in `src/components/ui/`, each with a Vitest + RTL + `vitest-axe` test. `QuizCard` is rebuilt from them. No page other than search and the dashboard (through `QuizCard`) changes visibly in this phase.

**Tech Stack:** React 19 + TypeScript strict, Ply CSS 1.8, Vitest 5 + React Testing Library + vitest-axe, TanStack Router (only through `QuizCard`).

**Spec:** `specs/07-ui-redesign.md` (Approved 2026-11-17), Phase 1 (P1.1–P1.6) and the Global criteria G1–G11. Phases 2–6 get their own plans after this one merges.

**Branch:** `feature/7-ui-shared-pieces`, cut from `fix/ui-polish` **after the owner has committed their work there** (or from `main` once that work is merged). Never commit to `main`.

## Global Constraints

- No new libraries (G1). Ply CSS, our CSS, React and inline SVG only.
- Every new class name is checked against `node_modules/ply-css/ply-classes.json` before use. Checked free already: `kind-chip`, `quiz-meta`, `switch`, `pill-group`, `step-pills`, `cover-art`, `strip-art`, `quiz-card`. Taken by Ply, never reuse: `badge`, `label`, `steps`, `step`, `status`, `field`, `code`, `sr-only` (use it, don't redefine it) and the `dialog-*` classes. Our custom properties use the `--qm-` prefix.
- Contrast WCAG 2.2 AA in light, dark and high contrast, both kinds (G2). Values below are pre-checked.
- Every new colour is a custom property with light, dark and high-contrast values (G3), using the same selector pattern as `src/styles/settings.css` (`:root[data-theme='dark']`, `@media (prefers-color-scheme: dark) { :root:not([data-theme]) … }`, `:root[data-contrast='on']`, `@media (prefers-contrast: more) { :root:not([data-contrast='off']) … }`).
- Sizes in `rem` (G4). Targets at least 24×24 CSS px (G5). Colour never alone (G6). Artwork `aria-hidden="true"` and `focusable="false"`, theme colours only (G7). No sideways scroll at 320px at any text size (G8).
- Behaviour and wording unchanged (G9, G10): the card still says "Trivia" / "Personality" (uppercase via CSS only), "N questions" and "Suggested time: N min".
- Named exports only, no `any`, PascalCase component files, LF line endings (`CLAUDE.md` §4).
- Phase ends with `npm run lint`, `npm run typecheck`, `npm test`, `npm run db:test` passing and no console warnings (G11). `db:test` needs Docker; ask the owner to start it if it is down.

### Token values (pre-checked contrast, ratios in brackets)

| Token | Light | Dark | HC light | HC dark |
| --- | --- | --- | --- | --- |
| `--qm-trivia` (chip/strip fill) | `#0353e9` (white text 6.14) | `#0f62fe` (white text 5.00, vs `#161616` 3.62) | `#0353e9` | `#0f62fe` |
| `--qm-personality` (chip/strip fill, button bg) | `#8a3ffc` (white 5.00) | `#8a3ffc` (white 5.00, vs bg 3.62) | `#6929c4` (white 7.74) | `#8a3ffc` |
| `--qm-personality-hover` | `#7c32e8` | `#a56eff` | `#5a22aa` | `#a56eff` |
| `--qm-personality-active` | `#6929c4` | `#be95ff` | `#491d8b` | `#be95ff` |
| `--qm-personality-text` (links, accent) | `#7c32e8` (6.04 on white, 5.49 on `#f4f4f4`) | `#be95ff` (7.70 on `#161616`, 6.44 on `#262626`) | `#6929c4` | `#d4bbff` (12.35 on black) |
| `--qm-personality-focus` | `#8a3ffc` | `#be95ff` | `#000000` | `#ffffff` |
| `--qm-correct` | `#198038` (5.02) | `#42be65` (7.57) | `#0e6027` | `#42be65` |
| `--qm-partly` | `#8e6a00` (4.99) | `#f1c21b` (10.75) | `#684e00` | `#f1c21b` |
| `--qm-wrong` | `#da1e28` (5.00) | `#ff8389` (7.63) | `#a2191f` | `#ff8389` |
| `--qm-art-ink` (lines drawn on the accent) | `#0b0b0b` | `#0b0b0b` | `#000000` | `#000000` |
| `--qm-radius-card` | `var(--ply-radius-xl)` (1rem) | same | same | same |
| `--qm-radius-input` | `0.6rem` | same | same | same |

## Review Focus

1. **Kind scope leaking into the navbar or Settings.** The scope must sit on page content, never on `<body>`/`#root`; Task 1's browser check sets it on `<main>` and confirms the navbar's Settings and Log in buttons stay blue.
2. **High contrast with the scope.** In HC, focus rings inside the scope must stay black/white, not purple; Task 1 checks computed `--ply-color-focus` inside the scope under `data-contrast="on"`.
3. **Stretched link swallowing the card's actions.** Dashboard Edit/Delete must stay clickable and separately focusable; Task 8 tests that each action is its own button and the card has exactly one link.
4. **Long titles and no description.** A 75-character title (`titleMax`) wraps without overflow and a card with an empty description renders no empty paragraph; Task 8 tests the empty-description case.
5. **PillGroup under React Hook Form.** Later phases drive it through `Controller`; it must be fully controlled (`value` + `onChange`, the checked radio follows `value` only) and keep native arrow-key movement, so the radios are clipped, never `display: none`. Task 4 tests that `onChange` gets the string value and the checked radio follows `value`; arrow keys are a manual check in Task 9 (jsdom has no radio keyboard behaviour).

---

### Task 1: Tokens, kind scope and native controls

**Files:**
- Create: `src/styles/tokens.css`
- Modify: `src/main.tsx` (import `./styles/tokens.css` and `./styles/ui.css` right after `./styles/settings.css`)
- Create: `src/styles/ui.css` (empty except a header comment; filled by later tasks)

**Interfaces:**
- Produces: the `--qm-*` tokens in the table above; the attribute `data-kind="personality"` as the scope hook; CSS classes none yet.

- [ ] **Step 1: Write `tokens.css`.** The table's values on `:root` and per mode, mirroring the selector pattern in `settings.css`. Then the scope:

```css
[data-kind='personality'] {
  --ply-btn-default-bg: var(--qm-personality);
  --ply-btn-default-bg-hover: var(--qm-personality-hover);
  --ply-btn-default-bg-active: var(--qm-personality-active);
  --ply-color-link: var(--qm-personality-text);
  --ply-color-link-hover: var(--qm-personality-hover);
  --ply-color-focus: var(--qm-personality-focus);
  --ply-color-accent: var(--qm-personality-text);
}
```

  Then native controls (P1.3), replacing nothing in `app.css`:

```css
input[type='radio'],
input[type='checkbox'] {
  width: 1.0625rem;
  height: 1.0625rem;
  accent-color: var(--ply-btn-default-bg);
}
```

- [ ] **Step 2: Import both files** in `src/main.tsx` after `settings.css`, each with a one-line comment.

- [ ] **Step 3: Verify in the browser.** Start preview `vite-dev`, open `/search`. With `javascript_tool`: set `document.querySelector('main').dataset.kind = 'personality'`, then read `getComputedStyle` on a `.btn-primary` inside `<main>` (background `rgb(138, 63, 252)`) and on the navbar's Settings button (still blue). Repeat with `document.documentElement.dataset.contrast = 'on'` and check `--ply-color-focus` inside `<main>` is `#000000`; with `dataset.theme = 'dark'` as well it is `#ffffff`. Check a radio's computed `width` is `17px` at default text size.
  Expected: all values as stated, no console warnings.

- [ ] **Step 4: Run** `npm run lint && npm run typecheck && npm test`. Expected: all pass (no markup changed).

- [ ] **Step 5: Commit**

```bash
git add src/styles/tokens.css src/styles/ui.css src/main.tsx
git commit -m "Add redesign tokens, personality kind scope and control sizes"
```

---

### Task 2: KindChip and QuizMeta

**Files:**
- Create: `src/components/ui/KindChip.tsx`, `src/components/ui/QuizMeta.tsx`
- Test: `src/components/ui/KindChip.test.tsx`, `src/components/ui/QuizMeta.test.tsx`
- Modify: `src/styles/ui.css`

**Interfaces:**
- Consumes: `QuizKind` from `src/schemas/quiz.ts`; `formatSuggestedTime` from `src/lib/formatSuggestedTime.ts`; tokens from Task 1.
- Produces:
  - `KindChip({ kind }: { kind: QuizKind }): JSX.Element` renders `<span className="kind-chip" data-chip-kind={kind}>Trivia|Personality</span>`.
  - `QuizMeta({ questionCount, suggestedTimeSeconds }: { questionCount: number; suggestedTimeSeconds: number | null }): JSX.Element` renders `<p className="quiz-meta">` with a span per item, each with a 14×14 decorative SVG icon.

- [ ] **Step 1: Write the failing tests.**

```tsx
// KindChip.test.tsx
it('says Trivia for trivia quizzes', () => {
  render(<KindChip kind="trivia" />)
  expect(screen.getByText('Trivia')).toBeInTheDocument()
})
it('says Personality for personality quizzes', () => {
  render(<KindChip kind="personality" />)
  expect(screen.getByText('Personality')).toBeInTheDocument()
})
it('has no detectable accessibility violations', async () => {
  const { container } = render(<KindChip kind="personality" />)
  expect(await axe(container)).toHaveNoViolations()
})

// QuizMeta.test.tsx
it('shows the question count and suggested time in today\'s words', () => {
  render(<QuizMeta questionCount={4} suggestedTimeSeconds={300} />)
  expect(screen.getByText('4 questions')).toBeInTheDocument()
  expect(screen.getByText('Suggested time: 5 min')).toBeInTheDocument()
})
it('leaves the time out when there is no suggested time', () => {
  render(<QuizMeta questionCount={8} suggestedTimeSeconds={null} />)
  expect(screen.queryByText(/Suggested time/)).not.toBeInTheDocument()
})
it('hides its icons from assistive technology', () => {
  const { container } = render(<QuizMeta questionCount={4} suggestedTimeSeconds={300} />)
  for (const svg of container.querySelectorAll('svg')) {
    expect(svg).toHaveAttribute('aria-hidden', 'true')
    expect(svg).toHaveAttribute('focusable', 'false')
  }
})
it('has no detectable accessibility violations', async () => { /* axe on the timed render */ })
```

- [ ] **Step 2: Run** `npx vitest run src/components/ui`. Expected: FAIL, modules not found.

- [ ] **Step 3: Implement both components.** Icon drawings: the question and timer icons `i-q` and `i-t` in `.superpowers/brainstorm/2045-1794871015/content/details-v5.html` line 46–47, stroke `currentColor`. CSS in `ui.css`: `.kind-chip` is an uppercase (`text-transform: uppercase`), bold, `0.7rem`, letter-spaced pill with `background: var(--qm-trivia)` and white text; `[data-chip-kind='personality']` uses `--qm-personality`. `.quiz-meta` is a flex row with `gap: 1rem`, secondary text colour, icons `0.875rem` square.

- [ ] **Step 4: Run** `npx vitest run src/components/ui`. Expected: PASS.

- [ ] **Step 5: Commit** `git add src/components/ui src/styles/ui.css && git commit -m "Add KindChip and QuizMeta"`

---

### Task 3: Switch

**Files:**
- Create: `src/components/ui/Switch.tsx`, test `src/components/ui/Switch.test.tsx`
- Modify: `src/styles/ui.css`

**Interfaces:**
- Produces: `Switch({ checked, onChange, label, ariaLabel }: { checked: boolean; onChange: (checked: boolean) => void; label: ReactNode; ariaLabel?: string }): JSX.Element` renders `<button type="button" role="switch" aria-checked={checked} className="switch">` containing a decorative track/knob span (`aria-hidden`) and the visible `label`. `ariaLabel` sets `aria-label` when the visible text should not be the name (Phase 3 passes `ariaLabel="Timer"` so the timer's accessible name stays "Timer", as in `StartQuizControls` today).

- [ ] **Step 1: Write the failing tests.**

```tsx
it('is a switch named by its label and reports its state', () => {
  render(<Switch checked label="Timer on" onChange={() => {}} />)
  expect(screen.getByRole('switch', { name: 'Timer on' })).toHaveAttribute('aria-checked', 'true')
})
it('uses ariaLabel as its name when given', () => {
  render(<Switch checked={false} label="Timer off" ariaLabel="Timer" onChange={() => {}} />)
  expect(screen.getByRole('switch', { name: 'Timer' })).toHaveAttribute('aria-checked', 'false')
})
it('asks for the opposite state when clicked', () => {
  const onChange = vi.fn()
  render(<Switch checked label="Timer on" onChange={onChange} />)
  fireEvent.click(screen.getByRole('switch'))
  expect(onChange).toHaveBeenCalledWith(false)
})
it('has no detectable accessibility violations', async () => { /* axe */ })
```

- [ ] **Step 2: Run** `npx vitest run src/components/ui/Switch.test.tsx`. Expected: FAIL.

- [ ] **Step 3: Implement.** CSS: `.switch` is a borderless inline-flex button, `min-height: max(24px, 1.5rem)`, gap `0.5rem`; the track is `2.25rem × 1.25rem`, `border-radius: 999px`, `background: var(--ply-border-strong)`; the knob is a `1rem` circle; when `[aria-checked='true']` the track uses `var(--ply-btn-default-bg)` and the knob moves right. Any transition is wrapped in `@media (prefers-reduced-motion: no-preference)`. Focus ring on the button via `:focus-visible` using `--ply-color-focus`. In HC the track gets a `2px` border in `--ply-border-strong` so the off state isn't colour-only.

- [ ] **Step 4: Run** the test. Expected: PASS.

- [ ] **Step 5: Commit** `git commit -m "Add Switch component"` (with the three files).

---

### Task 4: PillGroup

**Files:**
- Create: `src/components/ui/PillGroup.tsx`, test `src/components/ui/PillGroup.test.tsx`
- Modify: `src/styles/ui.css`

**Interfaces:**
- Produces:

```ts
type PillOption = { value: string; label: ReactNode }
type PillGroupProps = {
  legend: string
  name: string
  options: PillOption[]
  value: string
  onChange: (value: string) => void
  hideLegend?: boolean // legend gets Ply's sr-only class; used by the editor table (Phase 6)
}
export function PillGroup(props: PillGroupProps): JSX.Element
```

  Renders `<fieldset className="pill-group">` with `<legend>` and, per option, `<label><input type="radio" name value checked onChange /><span>{label}</span></label>`. Fully controlled.

- [ ] **Step 1: Write the failing tests.**

```tsx
const sizes = [
  { value: 'default', label: 'Default' },
  { value: 'large', label: 'Large' },
]
it('is a named group of radios with the current value checked', () => {
  render(<PillGroup legend="Text size" name="size" options={sizes} value="large" onChange={() => {}} />)
  expect(screen.getByRole('group', { name: 'Text size' })).toBeInTheDocument()
  expect(screen.getByRole('radio', { name: 'Large' })).toBeChecked()
  expect(screen.getByRole('radio', { name: 'Default' })).not.toBeChecked()
})
it('reports the chosen value', () => {
  const onChange = vi.fn()
  render(<PillGroup legend="Text size" name="size" options={sizes} value="default" onChange={onChange} />)
  fireEvent.click(screen.getByRole('radio', { name: 'Large' }))
  expect(onChange).toHaveBeenCalledWith('large')
})
it('keeps a hidden legend as the group name', () => {
  render(<PillGroup legend="Answer 2 points" name="p" options={sizes} value="default" onChange={() => {}} hideLegend />)
  expect(screen.getByRole('group', { name: 'Answer 2 points' })).toBeInTheDocument()
})
it('has no detectable accessibility violations', async () => { /* axe */ })
```

- [ ] **Step 2: Run** the test. Expected: FAIL.

- [ ] **Step 3: Implement.** CSS: the radios are visually hidden but stay in the tab order and keep arrow-key behaviour (clip pattern, not `display: none`); each `label` is a joined pill segment, `min-height: max(24px, 1.5rem)`, padding `0.25rem 0.75rem`, borders in `--ply-border-strong`, outer corners `999px`; the checked segment (`label:has(input:checked)`) uses `var(--ply-btn-default-bg)` with white text **and** bold weight (not colour alone); `label:has(input:focus-visible)` shows the focus outline. Override `app.css`'s generic `label:has(> input[type='radio'])` rules inside `.pill-group` (display, margin, width) so pills sit in one row and wrap on narrow screens. The fieldset has no border or padding.

- [ ] **Step 4: Run** the test. Expected: PASS.

- [ ] **Step 5: Commit** `git commit -m "Add PillGroup component"`.

---

### Task 5: StepPills

**Files:**
- Create: `src/components/ui/StepPills.tsx`, test `src/components/ui/StepPills.test.tsx`
- Modify: `src/styles/ui.css`

**Interfaces:**
- Produces: `StepPills({ steps, current }: { steps: string[]; current: number }): JSX.Element` where `current` is 1-based like "Part N of M". Renders `<ol className="step-pills" aria-hidden="true">` with one `<li data-state="done" | "current" | "todo">` per step showing its number and name. Decorative: the editor's existing "Part N of M: …" heading stays the accessible version (Phase 6).

- [ ] **Step 1: Write the failing tests.**

```tsx
it('is hidden from assistive technology', () => {
  const { container } = render(<StepPills steps={['Basics', 'Outcomes', 'Questions']} current={2} />)
  expect(container.querySelector('ol')).toHaveAttribute('aria-hidden', 'true')
})
it('marks steps before, at and after the current one', () => {
  const { container } = render(<StepPills steps={['Basics', 'Outcomes', 'Questions']} current={2} />)
  const states = [...container.querySelectorAll('li')].map((li) => li.dataset.state)
  expect(states).toEqual(['done', 'current', 'todo'])
})
it('shows each step name', () => {
  const { container } = render(<StepPills steps={['Basics', 'Questions']} current={1} />)
  expect(container).toHaveTextContent('Basics')
  expect(container).toHaveTextContent('Questions')
})
```

- [ ] **Step 2: Run** the test. Expected: FAIL.

- [ ] **Step 3: Implement.** Look: `.esteps` / `.estep` in `.superpowers/brainstorm/2045-1794871015/content/editor-steps-v2.html`, renamed `step-pills` (Ply owns `.steps`). Current pill filled with `--ply-btn-default-bg`; done pills show a ✓ before the name; todo pills outlined. Wraps on narrow screens.

- [ ] **Step 4: Run** the test. Expected: PASS.

- [ ] **Step 5: Commit** `git commit -m "Add StepPills component"`.

---

### Task 6: CoverArt and StripArt

**Files:**
- Create: `src/components/ui/CoverArt.tsx`, `src/components/ui/StripArt.tsx`, test `src/components/ui/Artwork.test.tsx`
- Modify: `src/styles/ui.css`

**Interfaces:**
- Produces:
  - `CoverArt(): JSX.Element`, an `<svg className="cover-art" viewBox="0 0 440 270">` that scales to its container's width (`width: 100%; height: auto`).
  - `StripArt({ kind }: { kind: QuizKind }): JSX.Element`, an `<svg className="strip-art" viewBox="0 0 68 150" data-art-kind={kind}>`; the caller provides the coloured background (Phase 3 and 5 put it on a strip with `background: var(--qm-trivia|--qm-personality)`).

- [ ] **Step 1: Write the failing tests.**

```tsx
it.each([<CoverArt key="c" />, <StripArt key="t" kind="trivia" />, <StripArt key="p" kind="personality" />])(
  'is decorative',
  (art) => {
    const { container } = render(art)
    const svg = container.querySelector('svg')
    expect(svg).toHaveAttribute('aria-hidden', 'true')
    expect(svg).toHaveAttribute('focusable', 'false')
  },
)
it('draws circles for trivia and rounded squares for personality', () => {
  const trivia = render(<StripArt kind="trivia" />).container
  expect(trivia.querySelectorAll('circle')).toHaveLength(20) // 15 bubbles + 5 marks
  const personality = render(<StripArt kind="personality" />).container
  expect(personality.querySelectorAll('circle')).toHaveLength(0)
})
it('uses only theme colours', () => {
  const { container } = render(<><CoverArt /><StripArt kind="trivia" /></>)
  expect(container.innerHTML).not.toMatch(/#[0-9a-f]{3,6}/i)
})
```

- [ ] **Step 2: Run** the test. Expected: FAIL.

- [ ] **Step 3: Implement.** Geometry, copied as JSX:
  - `CoverArt`: the `<g id="cover-art">` in `.superpowers/brainstorm/1958-1794870374/content/homepage-hero.html` lines 57–79.
  - `StripArt`: the S1b SVGs in `.superpowers/brainstorm/2045-1794871015/content/details-v5.html` line 51 (first `<svg>` is trivia, second is personality).
  - Replace every hard-coded colour: `#0b0b0b` becomes `var(--qm-art-ink)`, the grid fill becomes `var(--qm-trivia)`, and `currentColor` stays. Use `style={{ fill: … }}` or `fill="var(--qm-art-ink)"` as `QuizIllustration.tsx` does. Generate the repeated bubbles with `.map` over rows and columns rather than writing 15 elements out.

- [ ] **Step 4: Run** the test. Expected: PASS.

- [ ] **Step 5: Commit** `git commit -m "Add CoverArt and StripArt drawings"`.

---

### Task 7: Dialog shell

**Files:**
- Modify: `src/styles/ui.css`

**Interfaces:**
- Consumes: Ply's `dialog`, `.dialog-header`, `.dialog-body`, `.dialog-footer`, `.dialog-close` (unchanged markup).
- Produces: the shared look for every `<dialog>`. No component changes.

- [ ] **Step 1: Write the CSS.** `dialog { border-radius: var(--qm-radius-card); background: var(--ply-bg-surface); box-shadow: var(--ply-shadow-3); border: 1px solid var(--ply-border-color) }`. `.dialog-close` is a round button, `width/height: 2rem` (min 24px), `border-radius: 50%`, centred ×, visible `:focus-visible` outline. Keep `.settings-dialog`'s padding overrides in `settings.css` working (do not raise specificity above them). In HC (`--ply-shadow-3: none` already), the border keeps the edge visible.

- [ ] **Step 2: Verify in the browser** at `/search`: open Settings, Log in and a quiz's details popup in light, dark and HC. Check with `javascript_tool` that `getComputedStyle(dialog).borderRadius` is `16px` and the close button's `getBoundingClientRect()` is at least 32×32. Press Tab through each popup: focus visible on the close button. At Largest text size in a 320px-wide window (`resize_window` 320×700), Settings does not scroll sideways (`document.querySelector('dialog[open]').scrollWidth <= clientWidth`).

- [ ] **Step 3: Run** `npm test`. Expected: PASS (no markup changed).

- [ ] **Step 4: Commit** `git commit -m "Give every dialog the shared rounded shell"`.

---

### Task 8: QuizCard redesign

**Files:**
- Modify: `src/components/QuizCard.tsx`, `src/styles/ui.css` (card styles go here; the existing `.quiz-card-description` clamp in `app.css` stays where it is and is reused)
- Create: `src/components/QuizCard.test.tsx`
- Modify: `src/pages/SearchPage.test.tsx:84` (the meta text is now two elements)

**Interfaces:**
- Consumes: `KindChip`, `QuizMeta` (Task 2); `QuizSummary`; existing `quizCardLinkId`, `rememberReturnFocus`.
- Produces: unchanged props `QuizCard({ quiz, actions }: { quiz: QuizSummary; actions?: ReactNode })` and unchanged `quizCardLinkId(quizId: string): string`. Root element `<article className="quiz-card">`.

- [ ] **Step 1: Write the failing tests** in `QuizCard.test.tsx`, mocking `@tanstack/react-router` the way `SiteHeader.test.tsx` does (`Link` renders `<a href id onClick>`; `useLocation` returns `true`; `useRouter` returns `{ state: { location: { state: {} } } }`).

```tsx
const quiz = { id: '…uuid…', kind: 'trivia', title: 'World Capitals', description: 'Name them all.', question_count: 12, suggested_time_seconds: 300 } as const
it('has exactly one link, named by the quiz title', () => {
  render(<QuizCard quiz={quiz} />)
  expect(screen.getAllByRole('link')).toHaveLength(1)
  expect(screen.getByRole('link', { name: 'World Capitals' })).toHaveAttribute('id', quizCardLinkId(quiz.id))
})
it('shows the kind, the description and the meta', () => {
  render(<QuizCard quiz={quiz} />)
  expect(screen.getByText('Trivia')).toBeInTheDocument()
  expect(screen.getByText('Name them all.')).toBeInTheDocument()
  expect(screen.getByText('12 questions')).toBeInTheDocument()
})
it('renders no description paragraph when there is none', () => {
  const { container } = render(<QuizCard quiz={{ ...quiz, description: '' }} />)
  expect(container.querySelector('.quiz-card-description')).toBeNull()
})
it('keeps actions as their own controls', () => {
  render(<QuizCard quiz={quiz} actions={<><button type="button">Edit</button><button type="button">Delete</button></>} />)
  expect(screen.getByRole('button', { name: 'Edit' })).toBeInTheDocument()
  expect(screen.getByRole('button', { name: 'Delete' })).toBeInTheDocument()
  expect(screen.getAllByRole('link')).toHaveLength(1)
})
it('has no detectable accessibility violations', async () => { /* axe with actions */ })
```

- [ ] **Step 2: Run** `npx vitest run src/components/QuizCard.test.tsx`. Expected: the actions and meta tests FAIL (meta is one text node today); others may pass.

- [ ] **Step 3: Rebuild `QuizCard`.** Order: `KindChip`, `<h3>` with the existing `Link` (all its props and the click handler unchanged), description (only when non-empty, class `quiz-card-description`), `QuizMeta`, then `actions` in a `<div className="quiz-card-actions">`. CSS: `.quiz-card` is `position: relative`, `display: flex; flex-direction: column; gap: 0.5rem`, padding `1.25rem`, `border-radius: var(--qm-radius-card)`, `background: var(--ply-bg-surface)`, `border: 1px solid var(--ply-border-color)`; `QuizMeta` pushed to the bottom with `margin-top: auto`. Stretched link: `.quiz-card h3 a::after { content: ''; position: absolute; inset: 0; border-radius: inherit }`; `.quiz-card-actions { position: relative; z-index: 1 }` so actions sit above it. Focus: `.quiz-card:has(h3 a:focus-visible)` gets the outline on the whole card, and the link's own outline is removed only in that case. Hover lifts the border colour to `--ply-border-strong`. The card is never inside the kind scope (P1.2).

- [ ] **Step 4: Update `SearchPage.test.tsx:84`** to assert `'4 questions'` and `'Suggested time: 5 min'` as two `getByText` calls inside `cards[0]`. No other test change.

- [ ] **Step 5: Run** `npm test`. Expected: PASS, including `SearchPage.test.tsx` and `DashboardPage.test.tsx`.

- [ ] **Step 6: Verify in the browser.** On `/search` (needs Docker for seed quizzes; if it is down, ask the owner): click anywhere on a card's empty area opens the details popup; Tab gives one stop per card; focus ring wraps the card; closing the popup returns focus to the card's link. On `/dashboard` as a member, Edit and Delete still work and are separate tab stops. Check light, dark, HC, and 320px at Largest (no sideways scroll; long titles wrap).

- [ ] **Step 7: Commit** `git commit -m "Rebuild QuizCard with chip, meta and a stretched link"`.

---

### Task 9: Phase checks and PR

**Files:**
- Modify: `specs/07-ui-redesign.md` (note under the Status line: "Phase 1 built on `feature/7-ui-shared-pieces`")

- [ ] **Step 1: Run** `npm run lint && npm run typecheck && npm test && npm run db:test && npm run format:check`. Expected: all pass, no console warnings in the test output or the dev server's browser console.
- [ ] **Step 2: Manual checks** from the spec's list for what Phase 1 touches: keyboard through the search page and all three popups; arrow keys move between `PillGroup` options (render one temporarily in a test page or defer to Phase 3's Settings popup, noted in the PR); screen reader spot check that the chip reads "Trivia"/"Personality" and artwork is skipped; light, dark, HC; 320px at Largest; reduced motion turns off the switch transition (component only, checked by toggling the `prefers-reduced-motion` emulation on a page that renders it, or deferred to Phase 3 where the switch first appears, noted in the PR).
- [ ] **Step 3: Commit the spec note**, push the branch, open a PR against `main` (or against `fix/ui-polish` if that has not merged yet; ask the owner which) with the manual checks listed.
