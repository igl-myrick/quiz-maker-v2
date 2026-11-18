# UI Redesign Phase 5 (Dashboard) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Rebuild the dashboard as D2: three summary tiles from one new read-only database function, result cards in the search grid, and the member's quizzes as quiz cards.

**Architecture:** One new migration adds `get_my_dashboard_summary()` (security definer, filtered to `auth.uid()`, executable by `authenticated` only), tested with pgTAP. A new hook and Zod schema read it under the `['me', …]` query key. The dashboard page gets a `SummaryTiles` component; `ResultRow` becomes a result card; My quizzes reuses `QuizCard` in the `.quiz-grid` from Phase 2. Styles go in a new `src/styles/dashboard.css` imported by `DashboardPage.tsx`.

**Tech Stack:** Postgres + pgTAP (local Supabase CLI stack), React 19 + TypeScript strict, TanStack Query, Zod, Ply CSS, Vitest + RTL + vitest-axe.

**Spec:** `specs/07-ui-redesign.md`, Phase 5 (P5.1–P5.3) and Global criteria G1–G11. Phases 1–4 are merged on `fix/ui-polish`.

**Branch:** `feature/7-ui-dashboard`, cut from `fix/ui-polish` at its current tip.

## Global Constraints

- **Database (P5.1):** one new migration only. No new tables, columns, stored data, policies or RLS changes (CLAUDE.md §6, §7). The function never returns `creator_id`, emails or any account identifier. Migrations are applied only to the local stack (`npm run db:reset`); never to a hosted project.
- Regenerate `src/types/database.types.ts` with `npm run db:types` after the migration (CLAUDE.md §4, §6); never hand-edit it.
- No new libraries (G1). New class names, all checked free in `node_modules/ply-css/ply-classes.json`: `summary-tiles`, `summary-tile`, `result-card`, `result-card-strip`, `result-card-main`, `result-score`, `status-tag`.
- Contrast AA in light, dark and high contrast (G2); tokens only (G3); `rem` (G4); targets ≥ 24×24 and visible focus (G5); "Quiz updated" / "Quiz deleted" stay words (G6); artwork decorative (G7); no sideways scroll at 320px at every text size (G8).
- Behaviour unchanged (G9): loading, empty and error states and their retry buttons, "Show more results" / "Show more quizzes" and their focus moves, deleting a quiz (confirm, focus to My quizzes, "Quiz deleted" announcement), no email shown.
- Wording unchanged (G10) except the new tile labels and their states (below). The "+ Create quiz" link keeps its text and becomes the primary button (P5.3).
- Lint: `npx eslint . --ignore-pattern ".ds-sync/**" --ignore-pattern "ds-bundle/**"` until PR #10 merges.
- Phase ends with lint, `npm run typecheck`, `npm test`, `npm run db:test` passing and no console warnings (G11).

## Decisions this plan makes

- **Function shape:** `get_my_dashboard_summary()` returns `jsonb` `{ "results_saved": int, "quizzes_made": int, "average_trivia_score": numeric | null }`. One function, `security definer` with `set search_path = ''`, because counting `quizzes` needs `creator_id`, which `authenticated` can't read (the same reason `list_my_quizzes` is definer). It raises `42501` when `auth.uid()` is null, like `list_my_quizzes`. `average_trivia_score` is `avg(score)` over the caller's trivia results with a non-null score, unrounded (0 to 1); the page rounds it to a whole percent.
- **Tile wording** (new, the spec names the three figures): "Results saved", "Quizzes made", "Average trivia score" (shown as "N%" or "—" when null). Loading: "Loading your summary…". Error: "Couldn't load your summary." with a "Try loading summary again" button (named uniquely, like the existing retry buttons).
- **Tiles markup:** a `<dl className="summary-tiles">`, each tile a `div` with `<dt>` label and `<dd>` value, placed between the `h1` and My results with no new heading, so the page's `h2`s stay My results then My quizzes.
- **Keeping the tiles fresh:** the query key is `['me', 'summary']`, so deleting a quiz (which invalidates `['me']`) refreshes it. `useClaimResult` also invalidates `['me', 'summary']` when a result is saved; nothing else changes there.
- **"Create a quiz":** the spec's phrase describes the existing "+ Create quiz" link; its text stays (G10) and it becomes `btn btn-primary`.
- **Result cards are one link each** (the title, stretched over the card like `QuizCard`), so the grid has one tab stop per result.

## Review Focus

1. **Another member's or anonymous results leaking into the counts.** Covered by the pgTAP tests; the function must filter on `auth.uid()` explicitly, never rely on RLS (it's definer).
2. **Average with no trivia results, and with personality results only.** Must be null, shown as "—", never "NaN%" or "0%". pgTAP plus a component test.
3. **Summary failing while the lists load.** Each part has its own state; a failed summary must not hide My results or My quizzes. Component test.
4. **Score bar meaning.** The bar on a trivia result card is decorative (the score is in words beside it), `aria-hidden`.
5. **Grid and Show more focus.** `rowRef` must stay on each `<li>` of both grids; the existing Show more tests cover it and must pass unmodified.

---

### Task 1: get_my_dashboard_summary() and its pgTAP tests

**Files:**
- Create: `supabase/migrations/<timestamp>_dashboard_summary.sql` (via `npm run db:new -- dashboard_summary`)
- Create: `supabase/tests/11_dashboard_summary.test.sql`
- Modify (generated): `src/types/database.types.ts`

**Interfaces:**
- Produces: `public.get_my_dashboard_summary() returns jsonb` as in Decisions; executable by `authenticated` only.

- [ ] **Step 1: Write the failing pgTAP test**, following `08_dashboard_lists.test.sql`'s style (`begin; … select plan(N); … select * from finish(); rollback;`). As `postgres`: insert results for Alex (`11111111-…`): two trivia with scores `0.5` and `1`, one personality (score null); for Sam (`22222222-…`): one personality result only (score null); one anonymous trivia result with score `1` and an `expires_at`. Record Alex's expected quiz count in a temp table: `create temp table expected as select count(*)::int as n from public.quizzes where creator_id = '11111111-…';` and `grant select on expected to authenticated`. Then assertions:

```sql
-- as Alex
select is((public.get_my_dashboard_summary() ->> 'results_saved')::int, 3, 'counts only the caller''s saved results');
select is((public.get_my_dashboard_summary() ->> 'quizzes_made')::int, (select n from expected), 'counts the quizzes the caller made');
select is((public.get_my_dashboard_summary() ->> 'average_trivia_score')::numeric, 0.75, 'averages the caller''s trivia scores only');
-- as Sam (personality only)
select is((public.get_my_dashboard_summary() ->> 'results_saved')::int, 1, 'another member sees only their own');
select is(public.get_my_dashboard_summary() -> 'average_trivia_score', 'null'::jsonb, 'no trivia results means a null average');
-- reset role; as postgres insert a trivia result for Sam with score 0; switch back to Sam
select is((public.get_my_dashboard_summary() ->> 'average_trivia_score')::numeric, 0::numeric, 'a zero average is zero, not null');
-- as anon
select throws_ok('select public.get_my_dashboard_summary()', '42501', null, 'anon cannot execute it');
-- shape: exactly three keys, no account fields
select is((select array_agg(k order by k) from jsonb_object_keys(public.get_my_dashboard_summary()) k), array['average_trivia_score','quizzes_made','results_saved'], 'returns only the three figures');
```

  (The shape check runs as Alex. The seed has only two members, Alex and Sam. Anonymous results never count because they have no owner; Alex's count of 3 proves the anonymous one is excluded.)

- [ ] **Step 2: Run** `npm run db:test`. Expected: `11_dashboard_summary.test.sql` FAILS (function does not exist); all other files pass.

- [ ] **Step 3: Write the migration** with `language plpgsql stable security definer set search_path = ''`: `v_uid := (select auth.uid())`; raise `42501` when null; `results_saved` = `count(*) from public.results where owner_id = v_uid`; `quizzes_made` = `count(*) from public.quizzes where creator_id = v_uid`; `average_trivia_score` = `avg(score) from public.results where owner_id = v_uid and quiz_kind = 'trivia' and score is not null`; return `jsonb_build_object(...)`. Then `revoke execute … from public, anon, authenticated; grant execute … to authenticated;`. Header comment explains why it's definer (as in `20261113000200_dashboard_lists.sql`).

- [ ] **Step 4: Apply and test:** `npm run db:reset` then `npm run db:test`. Expected: all files PASS.

- [ ] **Step 5: Regenerate types:** `npm run db:types`; `npx tsc -b` clean; the new function appears under `Functions` in `database.types.ts`.

- [ ] **Step 6: Commit** `git commit -m "Add get_my_dashboard_summary for the dashboard tiles"` (migration, test, generated types).

---

### Task 2: Summary hook, schema and tiles

**Files:**
- Create: `src/schemas/dashboardSummary.ts`, `src/hooks/useDashboardSummary.ts`, `src/components/dashboard/SummaryTiles.tsx`, `src/styles/dashboard.css`
- Modify: `src/pages/DashboardPage.tsx`, `src/pages/DashboardPage.test.tsx`, `src/hooks/useClaimResult.ts`

**Interfaces:**
- Produces: `dashboardSummarySchema` (`results_saved: z.number().int()`, `quizzes_made: z.number().int()`, `average_trivia_score: z.number().nullable()`), type `DashboardSummary`; `useDashboardSummary()` (TanStack `useQuery`, key `['me', 'summary']`, `enabled: session !== null`, parses with the schema); `SummaryTiles()` with no props.

- [ ] **Step 1: Write the failing tests** in `DashboardPage.test.tsx`: add `summary: vi.fn()` to `mocks`, route `'get_my_dashboard_summary'` to it in the `rpc` mock, and default it in `beforeEach` to `Promise.resolve({ data: { results_saved: 3, quizzes_made: 1, average_trivia_score: 0.6667 }, error: null })`.

```tsx
it('shows the summary tiles', async () => {
  await renderDashboard()
  const tiles = await main().findByRole('term', { name: 'Results saved' }) // dt
  expect(tiles.nextElementSibling).toHaveTextContent('3')
  expect(main().getByText('Quizzes made').nextElementSibling).toHaveTextContent('1')
  expect(main().getByText('Average trivia score').nextElementSibling).toHaveTextContent('67%')
})
it('shows a dash when there are no trivia results', async () => {
  mocks.summary.mockResolvedValue({ data: { results_saved: 0, quizzes_made: 0, average_trivia_score: null }, error: null })
  await renderDashboard()
  expect((await main().findByText('Average trivia score')).nextElementSibling).toHaveTextContent('—')
})
it('keeps the lists when the summary fails, with its own retry', async () => {
  mocks.summary.mockResolvedValue({ data: null, error: new Error('boom') })
  await renderDashboard()
  expect(await main().findByText("Couldn't load your summary.")).toBeInTheDocument()
  expect(main().getByRole('button', { name: 'Try loading summary again' })).toBeInTheDocument()
  expect(main().getByRole('region', { name: 'My results' })).toBeInTheDocument()
})
```

  (If `findByRole('term')` isn't supported for `dt` by the installed testing-library, use `findByText('Results saved')` and assert it's a `DT`.)

- [ ] **Step 2: Run** `npx vitest run src/pages/DashboardPage.test.tsx`. Expected: the three new tests FAIL; existing pass.

- [ ] **Step 3: Implement** the schema and hook as in Interfaces; `SummaryTiles` renders loading ("Loading your summary…"), error (text plus retry calling `refetch`), or `<dl className="summary-tiles">` with three `div.summary-tile` (`dt` label, `dd` value). Average shown as `${Math.round(value * 100)}%` or "—". `DashboardPage` renders `<SummaryTiles />` before `MyResultsSection` for members, and imports `../styles/dashboard.css`. `useClaimResult`'s success handler also invalidates `['me', 'summary']` when saved. CSS: `.summary-tiles` grid `repeat(auto-fit, minmax(min(100%, 12rem), 1fr))`, gap `1rem`, `margin: 1rem 0 1.5rem`; `.summary-tile` surface card (`--qm-radius-card`, border, padding `1rem 1.25rem`, `margin: 0`); `dt` secondary, `0.875rem`; `dd` `margin: 0.25rem 0 0`, `font-size: 1.75rem`, `font-weight: 800`.

- [ ] **Step 4: Run** `npm test`. Expected: all pass.

- [ ] **Step 5: Commit** `git commit -m "Show summary tiles on the dashboard"`.

---

### Task 3: Result cards and the quiz grid

**Files:**
- Modify: `src/components/dashboard/ResultRow.tsx` (rename the component's role, keep the file and export name `ResultRow` to limit churn), `src/components/dashboard/MyResultsSection.tsx`, `src/components/dashboard/MyQuizzesSection.tsx`, `src/pages/DashboardPage.test.tsx`, `src/styles/dashboard.css`

**Interfaces:**
- Consumes: `KindChip`, `StripArt` (Phase 1); `.quiz-grid` (Phase 2, `search.css`, already imported through `QuizCard`).
- Produces: `ResultRow({ result }: { result: MyResult })` rendering `<article className="result-card">`.

- [ ] **Step 1: Write the failing tests** in `DashboardPage.test.tsx`, updating the first test's text assertions that depended on the old one-line layout (G9, markup changed):

```tsx
// in 'shows My results then My quizzes…'
expect(trivia?.querySelector('.result-card')).not.toBeNull()
expect(within(trivia as HTMLElement).getByText('Trivia')).toBeInTheDocument()
expect(trivia).toHaveTextContent('3.5 / 4')
expect(trivia?.querySelector('svg.strip-art')).toHaveAttribute('aria-hidden', 'true')
expect(within(personality as HTMLElement).getByText('Personality')).toBeInTheDocument()
expect(personality).toHaveTextContent('Winter')
expect(within(personality as HTMLElement).getByText('Quiz updated')).toHaveClass('status-tag')
```

  (replacing `toHaveTextContent('Trivia 3.5 / 4')` and `'Personality Winter'`), plus:

```tsx
it('lays both lists out in the card grid, with Create quiz as the primary button', async () => {
  mocks.listResults.mockImplementation(() => page([result(1)]))
  mocks.listQuizzes.mockImplementation(() => page([worldCapitals()]))
  await renderDashboard()
  expect((await section('My results').findByRole('list'))).toHaveClass('quiz-grid')
  expect((await section('My quizzes').findByRole('list'))).toHaveClass('quiz-grid')
  expect(section('My quizzes').getByRole('link', { name: '+ Create quiz' })).toHaveClass('btn-primary')
})
```

- [ ] **Step 2: Run** `npx vitest run src/pages/DashboardPage.test.tsx`. Expected: the new and updated assertions FAIL.

- [ ] **Step 3: Implement.**
  - `ResultRow` → `<article className="result-card">`: `<div className="result-card-strip" data-strip-kind={kind}><StripArt kind={kind} /></div>` and `<div className="result-card-main">` with `KindChip`, the `h3` title link (stretched over the card, as in `QuizCard`), `<p className="result-score">` (trivia: the existing "X / N" text plus a decorative bar `aria-hidden` at `score * 100%`; personality: the outcome title), the `<time>` date, and the status tag as `<span className="status-tag">` when present. The card is never inside the personality scope.
  - `MyResultsSection` and `MyQuizzesSection`: the `ul` becomes `className="flat-list quiz-grid"`; `rowRef` and keys unchanged. "+ Create quiz" becomes `btn btn-primary`; the heading row keeps its layout.
  - CSS (`dashboard.css`): `.result-card` like `.quiz-card` (relative, rounded surface, border, hover border) but a grid `4rem 1fr` with `overflow: hidden`; `.result-card-strip` padding `0.75rem 0.6rem`, background `--qm-trivia` / `--qm-personality` by `data-strip-kind`; `.result-card-main` flex column, gap `0.4rem`, padding `1rem 1.25rem`, `min-width: 0`; stretched link and card-wide focus ring as in `ui.css`'s quiz card; `.result-score` bold, with the bar under it (track `--ply-bg-surface-alt` plus inset border, fill `--qm-trivia`); `.status-tag` outlined pill, secondary text. Inside `.quiz-grid`, `.result-card` stretches like `.quiz-card` (`flex: 1; margin: 0`).

- [ ] **Step 4: Run** `npm test`. Expected: all pass, including both Show more focus tests and the delete flow.

- [ ] **Step 5: Verify in the browser** as a member of the local stack (log in with a test address; the code comes from the local inbox at the URL `npx supabase status` prints): tiles show real numbers (submit one trivia and one personality quiz first); result cards with strips, chips, scores, dates, tags; quiz cards with Edit and Delete still separate tab stops; delete a test quiz and the "Quizzes made" tile drops by one. 3/2/1 columns at 1024/768/320; 320 Largest no sideways scroll; light, dark, high contrast.

- [ ] **Step 6: Commit** `git commit -m "Show dashboard results and quizzes as cards in the grid"`.

---

### Task 4: Phase checks

**Files:** Modify `specs/07-ui-redesign.md` (status line: "Phase 5 built on `feature/7-ui-dashboard`").

- [ ] **Step 1: Run** lint (with the ignore patterns), `npm run typecheck`, `npm test`, `npm run db:test`, `npx prettier --check src docs/superpowers specs supabase/tests`. Expected: all pass, no console warnings.
- [ ] **Step 2: Manual checks:** keyboard through the dashboard (one stop per card, Edit and Delete reachable, Show more focus); screen reader spot check (tiles read as label then value, chips, tags, strips skipped); light, dark, high contrast; 320px Largest; reduced motion.
- [ ] **Step 3: Commit the spec note** with message "Note Phase 5 build in the redesign spec".
