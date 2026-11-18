# UI Redesign Phase 2 (Homepage and Search) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Rebuild the homepage as a two-column hero with the cover art, and the search page as a rounded search field over a responsive grid of quiz cards.

**Architecture:** Markup changes in `HomePage.tsx`, `SearchForm.tsx` and `SearchPage.tsx` only; behaviour (routing, focus, announcements, Show more, the details popup) is untouched. Homepage styles go in a new `src/styles/home.css` imported by `HomePage.tsx`; search styles go in the existing `src/styles/search.css`, which `SearchPage.tsx` now imports too. Built from Phase 1's `CoverArt` and `QuizCard`.

**Tech Stack:** React 19 + TypeScript strict, Ply CSS 1.8, Vitest 5 + React Testing Library + vitest-axe.

**Spec:** `specs/07-ui-redesign.md`, Phase 2 (P2.1, P2.2) and Global criteria G1–G11. Phase 1 (shared pieces) is merged on `fix/ui-polish`.

**Branch:** `feature/7-ui-home-search`, cut from `fix/ui-polish` at its current tip. Never commit to `main`.

## Global Constraints

- No new libraries (G1). New class names, all checked free in `node_modules/ply-css/ply-classes.json`: `home-hero`, `home-hero-text`, `tagline`, `search-field`, `search-icon`, `results-head`, `quiz-grid`.
- Contrast AA in light, dark and high contrast (G2); colours only from Ply variables and the `--qm-*` tokens (G3).
- Sizes in `rem` (G4). Layout switches use `rem`-based `minmax` widths, not `@media` widths, because media queries ignore the root font size and must also respond to the text-size setting.
- Targets ≥ 24×24, visible focus (G5). Artwork decorative (G7). No sideways scroll at 320px at every text size (G8).
- Behaviour and wording unchanged (G9, G10): "Quiz Maker", "Take a quiz, see your result, and make your own.", "Find a quiz", the visible label "Search quizzes", the "Search" button, every status line and "Show more" stay word for word.
- Lint is run as `npx eslint . --ignore-pattern ".ds-sync/**" --ignore-pattern "ds-bundle/**"` until PR #10 merges (Phase 1 ruling).
- Phase ends with lint, `npm run typecheck`, `npm test`, `npm run db:test` passing and no console warnings (G11).

## Decisions this plan makes

- **Grid columns:** `grid-template-columns: repeat(auto-fill, minmax(min(100%, 20rem), 1fr))` inside Ply's `units-container` (max 1200px). At default text size that gives three columns on desktop, two on tablets and one on phones (P2.2). At larger text sizes it drops columns earlier, which is what the text-size setting should do.
- **Hero columns:** the same `minmax` technique (`minmax(min(100%, 20rem), 1fr)` with `auto-fit`), so the art moves under the text whenever two columns don't fit, at any text size (P2.1). Text first in the page order, art second.
- **Search field focus:** the pill wrapper shows the focus ring with `:focus-within` on the input only (`.search-field:has(input:focus-visible)`); the input's own outline is removed only inside that rule, so focus is never lost.
- **`QuizIllustration.tsx`:** deleted in Task 1 **only if the owner has said yes** (CLAUDE.md §7). Without a yes, the file stays and is simply unused; ledger it.

## Review Focus

1. **Largest text at 320px on the homepage.** The 3rem heading and the art must not push the page sideways; Task 1's browser check measures `scrollWidth` at Largest.
2. **The search label must stay visible and stay the input's name.** Styling it smaller is fine; hiding it is not (P2.2). Task 2's test asserts the label is not `sr-only` and still names the searchbox.
3. **Focus inside the pill field.** Removing the input outline without a working wrapper ring would hide focus; Task 2's browser check tabs into the field in light, dark and high contrast.
4. **Show more focus target.** After "Show more", focus moves to the first new card's link (existing `rowRef` behaviour); the grid must keep `rowRef` on each `<li>`. Covered by the existing test at `SearchPage.test.tsx:167`.
5. **Equal-height cards.** Cards in a row should stretch to the tallest so the meta lines align; the card's own `margin-bottom` from Phase 1 must be reset inside the grid so rows don't get double gaps. Task 3's browser check compares card heights in a row.

---

### Task 1: Homepage hero

**Files:**
- Modify: `src/pages/HomePage.tsx`, `src/pages/HomePage.test.tsx`
- Create: `src/styles/home.css`
- Delete (owner's OK only): `src/components/QuizIllustration.tsx`

**Interfaces:**
- Consumes: `CoverArt()` from `src/components/ui/CoverArt.tsx` (renders `<svg className="cover-art" aria-hidden="true" focusable="false">`).
- Produces: nothing other tasks use.

- [ ] **Step 1: Write the failing test** in `HomePage.test.tsx`:

```tsx
it('shows the cover art as decoration beside the text', async () => {
  const { container } = renderHome()
  await screen.findByRole('heading', { level: 1, name: 'Quiz Maker' })
  const art = container.querySelector('svg.cover-art')
  expect(art).toHaveAttribute('aria-hidden', 'true')
  expect(container.querySelector('.home-hero')).toContainElement(art as HTMLElement)
})
```

- [ ] **Step 2: Run** `npx vitest run src/pages/HomePage.test.tsx`. Expected: the new test FAILS (no `svg.cover-art`); the two existing tests pass.

- [ ] **Step 3: Rebuild `HomePage`.** `<main className="units-container">` holds `<div className="home-hero">` with `<div className="home-hero-text">` (h1 with `tabIndex={-1}`, `<p className="tagline">`, the existing "Find a quiz" link as a `btn btn-primary`) followed by `<CoverArt />`. Keep the owner's description comment. Import `../styles/home.css`. CSS: `.home-hero` is a grid with `repeat(auto-fit, minmax(min(100%, 20rem), 1fr))`, `align-items: center`, `gap: 2rem`, padding `2rem 0`; `.home-hero h1` `font-size: 3rem`, `margin: 0 0 0.5rem`, `overflow-wrap: anywhere`; `.tagline` secondary colour, `font-size: 1.125rem`, `margin-bottom: 1.25rem`; `.home-hero .cover-art` `color: var(--ply-color-body)`, `max-width: 40rem`, `justify-self: center`.

- [ ] **Step 4: Delete `QuizIllustration.tsx`** if the owner approved; otherwise skip and ledger `Ruling: kept unused QuizIllustration.tsx — no owner OK`.

- [ ] **Step 5: Run** `npx vitest run src/pages/HomePage.test.tsx` then `npx tsc -b`. Expected: 3 passed; typecheck clean.

- [ ] **Step 6: Verify in the browser** at `/`: wide window shows text left and art right, vertically centred; at 320px the art sits under the text and fits the width. At Largest text size on 320px, `document.documentElement.scrollWidth === 320`. Check light, dark and high contrast (art lines follow the body colour). Load `/` fresh: focus lands on the h1 as before (route focus unchanged).

- [ ] **Step 7: Commit** `git add -A src/pages/HomePage.tsx src/pages/HomePage.test.tsx src/styles/home.css src/components/QuizIllustration.tsx && git commit -m "Rebuild the homepage as a hero with the cover art"`.

---

### Task 2: Rounded search field

**Files:**
- Modify: `src/components/SearchForm.tsx`, `src/styles/search.css`
- Create: `src/components/SearchForm.test.tsx`

**Interfaces:**
- Consumes: nothing new.
- Produces: unchanged `SearchForm({ q }: { q: string | undefined })`.

- [ ] **Step 1: Write the failing tests** in `SearchForm.test.tsx`, mocking `@tanstack/react-router` with `useNavigate: () => vi.fn()`:

```tsx
it('keeps a visible label that names the search box', () => {
  render(<SearchForm q={undefined} />)
  const label = screen.getByText('Search quizzes')
  expect(label).not.toHaveClass('sr-only')
  expect(screen.getByRole('searchbox', { name: 'Search quizzes' })).toBeInTheDocument()
})
it('puts the box, a decorative icon and the Search button in one field', () => {
  const { container } = render(<SearchForm q="cap" />)
  const field = container.querySelector('.search-field')
  expect(field).toContainElement(screen.getByRole('searchbox'))
  expect(field).toContainElement(screen.getByRole('button', { name: 'Search' }))
  expect(field?.querySelector('svg')).toHaveAttribute('aria-hidden', 'true')
})
it('has no detectable accessibility violations', async () => {
  const { container } = render(<SearchForm q={undefined} />)
  expect(await axe(container)).toHaveNoViolations()
})
```

- [ ] **Step 2: Run** `npx vitest run src/components/SearchForm.test.tsx`. Expected: the field test FAILS (no `.search-field`); the others pass (existing behaviour, kept).

- [ ] **Step 3: Rebuild the markup.** Inside the `form` (keep `role="search"`, `className="form"`, the label, the input's id, `maxLength` and `register`): the label, then `<div className="search-field">` containing a 16×16 magnifier `<svg className="search-icon" aria-hidden="true" focusable="false">` (circle plus handle, `stroke="currentColor"`), the input, and the submit button. CSS in `search.css`: `.search-field` is flex, `align-items: center`, `gap: 0.5rem`, `max-width: 34rem`, `padding: 0.25rem 0.25rem 0.25rem 1rem`, `border: 1px solid var(--ply-border-strong)`, `border-radius: 999px`, `background: var(--ply-bg-surface-alt)`; the input inside is `flex: 1; min-width: 0; border: 0; background: transparent; padding-inline: 0`; the button is `border-radius: 999px; flex-shrink: 0` and keeps `margin: 0`; `.search-field:has(input:focus-visible)` gets `outline: 2px solid var(--ply-color-focus); outline-offset: 2px` and the input's outline is `none` only inside that rule. `.search-icon` `width/height: 1rem`, secondary colour.

- [ ] **Step 4: Run** `npx vitest run src/components/SearchForm.test.tsx src/pages/SearchPage.test.tsx`. Expected: all pass (the page tests still find the searchbox and the "Search" button).

- [ ] **Step 5: Verify in the browser** at `/search`: Tab into the box shows the ring around the whole pill in light, dark and high contrast; typing and Enter or clicking Search still runs the search; at 320px Largest the pill fits (`scrollWidth === 320`) and the button stays ≥ 24×24.

- [ ] **Step 6: Commit** `git commit -m "Give the search box a rounded field with icon and button"` (the three files).

---

### Task 3: Results heading and card grid

**Files:**
- Modify: `src/pages/SearchPage.tsx`, `src/pages/SearchPage.test.tsx`, `src/styles/search.css`

**Interfaces:**
- Consumes: `QuizCard` (Phase 1; root `<article className="quiz-card">` with `margin-bottom: 1rem`).
- Produces: nothing other tasks use.

- [ ] **Step 1: Write the failing test** in `SearchPage.test.tsx`, reusing the file's existing `renderApp` and mock data:

```tsx
it('shows the results heading and the count together', async () => {
  renderApp('/search')
  const status = await screen.findByText('2 quizzes found')
  const heading = screen.getByRole('heading', { level: 2, name: 'All quizzes' })
  expect(status).toHaveAttribute('role', 'status')
  expect(heading.parentElement).toBe(status.parentElement)
  expect(heading.parentElement).toHaveClass('results-head')
})
```

- [ ] **Step 2: Run** `npx vitest run src/pages/SearchPage.test.tsx`. Expected: the new test FAILS (heading and status are not wrapped); all others pass.

- [ ] **Step 3: Change the markup.** Wrap the `<h2>` and the always-present `<p role="status">` in `<div className="results-head">` (status stays rendered at all times). Give the results `<ul className="flat-list quiz-grid">`; keep `key` and `ref={rowRef(quiz.id)}` on each `<li>`. Import `../styles/search.css`. CSS: `.results-head` flex, `flex-wrap: wrap`, `align-items: baseline`, `justify-content: space-between`, `gap: 0.25rem 1rem`, `margin: 1.75rem 0 1rem`; its `h2` `margin: 0; font-size: 1.25rem`; its `p` `margin: 0`, secondary colour. `.quiz-grid` `display: grid`, `grid-template-columns: repeat(auto-fill, minmax(min(100%, 20rem), 1fr))`, `gap: 1rem`, `margin: 0 0 1rem`, `padding: 0`; `.quiz-grid > li { display: flex }`; `.quiz-grid .quiz-card { flex: 1; margin-bottom: 0 }`.

- [ ] **Step 4: Run** `npm test`. Expected: all pass, including the Show more focus test and `DashboardPage.test.tsx` (the dashboard keeps its own list; the grid is search-only in this phase).

- [ ] **Step 5: Verify in the browser** at `/search` with the seed quizzes (Docker must be running): three columns at a wide window, two at 768px, one at 375px; cards in a row have equal heights (`getBoundingClientRect().height` equal for the first three cards); a search with no matches shows the no-results text; "Show more" (if the seed has more than 20 quizzes; otherwise note it is covered by the test) moves focus to the first new card. At 320px Largest, no sideways scroll. Light, dark, high contrast.

- [ ] **Step 6: Commit** `git commit -m "Put search results in a card grid under a one-line heading"` (the three files).

---

### Task 4: Phase checks

**Files:**
- Modify: `specs/07-ui-redesign.md` (status line: add "Phase 2 built on `feature/7-ui-home-search`")

- [ ] **Step 1: Run** lint (with the two ignore patterns), `npm run typecheck`, `npm test`, `npm run db:test`, `npx prettier --check src docs/superpowers specs`. Expected: all pass, no console warnings.
- [ ] **Step 2: Manual checks** for what Phase 2 touches: keyboard through the homepage and search page (one tab stop per card, visible focus everywhere); screen reader spot check that the cover art and search icon are skipped and the status line still announces counts; light, dark, high contrast; 320px at Largest on both pages; reduced motion (no motion added).
- [ ] **Step 3: Commit the spec note** with message "Note Phase 2 build in the redesign spec".
