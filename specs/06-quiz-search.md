# Feature 6: Quiz search (with splash page and quiz details popup)

Status: **Approved** (2026-11-10). It depends on features 0 and 4 being Done. Rules come from `CLAUDE.md` (§1 "Quiz details popup", feature 6, §8). Schema and access rules come from `ARCHITECTURE_SPEC.md` (§4.2, §6.3, §9). Domain terms come from `GLOSSARY.md`.

## Goal

Anyone can find public quizzes and open a quiz's details popup. The site gets a simple splash page that sends people to search. Search is how quizzes are discovered, because every quiz is public.

## Decisions made with the project owner

- **Splash page** at `/` with a short description, a quiz-in-progress graphic, and one button to search. **The wording is not decided:** the builder must ask the project owner for it when building the splash page, and use placeholder text until then.
- No popular quizzes or stats, because that is stretch goal S4 and needs play counts the site doesn't collect.
- **Search page** at `/search`. With no query it lists every quiz, newest first. A query keeps quizzes containing **at least 2 of its words**, or the one word for a one-word search.
- **Ranking:** most query words matched, then quizzes with a title match, then newest.
- **Popup URL mechanism:** a `quiz` search parameter on the search route (`/search?q=…&quiz=<id>`), closed using `useCanGoBack()`. Route masking was rejected because a masked URL only works inside the current tab's history, so shared links would still need this approach.
- Search runs on submit, not as you type. Results load 20 at a time with "Show more".

## Acceptance criteria

### Splash page (`/`)

1. `HomePage` (from feature 0) becomes the splash page:
   - an `<h1>`
   - a one or two sentence description, using placeholder wording until the project owner supplies it
   - a quiz-in-progress illustration built as an inline SVG component, `QuizIllustration`, with no image files. It is decorative, so it uses `aria-hidden="true"`.
   - a "Find a quiz" link styled as a button, going to `/search`
2. Nothing else is on the splash page: no popular lists, stats or search box.

### Header

3. The site header (from feature 4) gains a "Search" link. TanStack Router's `Link` marks it `aria-current="page"` on `/search`.

### Search route and URL

4. `src/routes/search.tsx` is thin. It validates search params with Zod and renders `SearchPage`:
   - `q`: an optional string, trimmed and **cut to** 200 characters, never rejected. Empty becomes undefined.
   - `quiz`: an optional UUID. An invalid value is treated as missing (`.catch(undefined)`) rather than throwing.
5. The search form has a visible label, "Search quizzes", and a Search button. Submitting it (button or Enter) **navigates** to `/search?q=…`, pushing a history entry. The input is a React Hook Form field, kept in step with `q` through `useForm({ values: { q } })`. That means no `key` remount and no effect, so focus stays in the box after submitting. There is no search-as-you-type. Submitting an empty box navigates to `/search` with no `q`. Back and Forward between searches update the box and the results, and leave focus where it is **(call)**.

### Results

6. The results come from one TanStack Query infinite query (`useInfiniteQuery`) with the key `['quizzes', 'search', q ?? '']`. It calls `supabase.rpc('search_quizzes', …)` and pages with the cursor that function returns (`initialPageParam: null`, and `getNextPageParam` returns `next_cursor`, where null means no more pages). The generated type for a `jsonb` return is `Json`, so the response is parsed with a Zod schema (`src/schemas/searchResult.ts`) before use, with no `any` and no casts. Nothing is copied from the query result into `useState`.
7. **No `q`:** every quiz, newest first, with the heading "All quizzes".
8. **With `q`:** matching quizzes, ranked as decided above, with the heading "Results for "<q>"".
9. **A query made only of ignored words** (such as "the of"): no list, and the message "Try more specific words".
10. **No matches:** "No quizzes match "<q>". Try different words."
11. A `role="status"` region that is always on the page states the outcome once results load. For example: "20 quizzes found, showing 20", "3 quizzes found", "No quizzes found", or "Try more specific words".
    - **(call)** The total comes back from the function, so "found" is exact.
    - Loading says "Loading quizzes…".
    - An error says "Couldn't load quizzes." with a "Try again" button that refetches.
12. "Show more" appears only when another page exists. It loads the next 20 below the current ones and keeps focus on the button. If no more pages remain afterwards, focus moves to the first newly loaded card's link.
13. Each result is a card in a list (`<ul>`/`<li>`) showing:
    - the title as a link with a stable `id`, `quiz-card-<quizId>`, that opens the popup
    - a text label, "Trivia" or "Personality", never colour alone
    - the description, cut to about 2 lines with CSS (`line-clamp`)
    - "<n> questions"
    - "Suggested time: <x> min" when `suggested_time_seconds` is set **(call)**: seconds are rounded up to whole minutes, and "Under 1 min" is never shown

    No tags.

### Database: `search_quizzes`

14. A migration adds `search_quizzes(p_query text, p_cursor jsonb default null, p_limit int default 20) returns jsonb`:
    - It is `security invoker`, with `set search_path = ''`, and `anon` and `authenticated` may execute it. It reads `quizzes_public`, so it can never expose `creator_id`.
    - It returns `{ "mode": "browse" | "search" | "no_terms", "total": int, "items": [...], "next_cursor": jsonb | null }`. Each item is `{ id, kind, title, description, question_count, suggested_time_seconds, created_at }`.
    - **Browse** (when `p_query` is null or blank) orders by `created_at desc, id desc`.
    - This replaces the `websearch_to_tsquery` and `(rank, id)` suggestion in `ARCHITECTURE_SPEC.md` §9, which left the choice to this spec. It also returns `jsonb` rather than the `setof` sketched in §7.1.
    - **Search** splits the query into normalized, stemmed words, with stop words removed and duplicates dropped, using `to_tsvector('english', p_query)`. It keeps at most 10 terms, chosen by **where they first appear in the query**. A tsvector lists its words alphabetically, so the builder uses `unnest()` and orders by the first position. Each word is turned back into a query term with `quote_literal(lexeme)::tsquery`, not run through `to_tsquery('english', …)` again. It keeps quizzes where `matched >= least(2, term count)`, using an OR query against the GIN index on `search` to prefilter.
      - Ordering: `matched desc`, then `title_match desc` (whether any term matches the title-weighted part, using `ts_filter(search, '{a}')`), then `created_at desc`, then `id desc`.
    - **`no_terms`** is returned when the query has text but no searchable words. Its items are empty.
    - `p_limit` is clamped to the range 1 to 50.
    - **The cursor is opaque to the client:** a jsonb object holding the last row's sort values. It is compared as a row value, giving keyset pagination with no OFFSET.
15. pgTAP tests in `supabase/tests/` cover:
    - `anon` can call `search_quizzes`, and no item contains `creator_id`
    - browse ordering and paging, where two pages together equal the full list with no duplicates
    - the 2-word threshold, using seed quizzes that share words such as "capital" and "space"
    - a one-word query
    - title matches ranking above description-only matches
    - a stop-words-only query returning `no_terms`
    - `total` being correct
    - the limit being clamped
16. `npm run db:types` is rerun and the regenerated types are committed.

### Quiz details popup

17. `QuizDetailsDialog` is rendered by `SearchPage` only when `quiz` is in the URL. It is a native `<dialog>` and follows `CLAUDE.md` §8: focus moves into it, it is modal, it is named by the quiz title (or by "Quiz not found"), and it has a visible close button.
    - **Opening and closing use exactly one `useEffect`**, the only effect in this feature. This is the textbook reason to use one: keeping a browser API (`showModal()` and `close()`) in step with React.
      - When the effect runs, it records the element that had focus (the opener) and calls `showModal()`.
      - Its cleanup calls `dialog.close()` **first**. Otherwise the page behind is still inert and focus can't move. Then it returns focus to the opener if it is still on the page, or otherwise to the search page's `<h1>`.
      - This is safe under React StrictMode's run, clean up, run again in development.
    - A callback ref was considered, but React runs its cleanup while the modal is still open, so returning focus silently fails.
    - Pages opened later from other routes (dashboard, result page) get their focus from the route-change rule in criterion 23a, not from the dialog.
18. Opening the popup is a plain `Link` to `/search` with `search: (prev) => ({ ...prev, quiz: id })` from the search page. From other pages it is `search: { quiz: id }`. Opening always pushes a history entry.
19. **Closing:**
    - The close button, Escape (the dialog's `cancel` event, with `preventDefault()`, then the same handler), and the dialog's `close` event share one `close()` function. The `close` event is included because Chrome can close a dialog on a second Escape without firing `cancel`. In that case, if `quiz` is still in the URL, the handler runs the same logic. A guard stops it running twice.
      - if `useCanGoBack()` is true, it calls `router.history.back()`
      - otherwise it navigates to the same search URL without `quiz`, using `replace: true`
    - The browser Back button is never intercepted.
    - Expected results:
      - After opening the popup from the search page, Back, Escape and close all return to `/search?q=…`.
      - After loading a popup URL directly, Escape and close leave `/search?q=…` and Back leaves the site.
20. **The popup's content** comes from a query keyed `['quiz', quizId]`, reading one row from `quizzes_public`. It shows:
    - the title as the heading
    - the kind label
    - "<n> questions"
    - the full description
    - "Suggested time: <x> min" if set
21. **Loading** shows "Loading quiz…" inside the open dialog. **Not found** (no row) shows "This quiz no longer exists." with only the close button. **An error** shows "Couldn't load this quiz." with "Try again".
22. **There is no Start button and no timer choice yet.** Feature 1 adds both to this same component.
23. A shared popup URL loaded directly in a new tab shows the search page behind, with results for `q` (or all quizzes), and the popup open on top.

### Focus on page changes (site-wide)

23a. This is the first feature with more than one page, so it adds the site-wide rule that `CLAUDE.md` §8 asks for:
- When the **path** changes, such as `/` to `/search` or Back to another page, focus moves to that page's `<h1>`, which has `tabIndex={-1}`, and the new page title is announced through the Announcer from feature 4.
- Changing only search params, such as `q` or `quiz`, never moves focus this way. The dialog manages its own focus.
- The rule is implemented once, in the root route, by subscribing to the router's `onResolved` event inside the root's single effect. Every page's `<h1>` follows the same convention.
- Each page also sets `document.title`, using the route's `head` option if the installed router version supports it, or otherwise in the same place.

### Tests and quality

24. Component tests use role-based queries, include a `vitest-axe` check in each file, and mock `src/lib/supabase`. They cover:
    - the splash link going to `/search`
    - submitting the form updating `q`
    - browse, search, `no_terms`, empty and error states, including their status-region text
    - "Show more" appending results
    - card content, including the suggested time shown only when set
    - the popup opening from a card link and closing back
    - the popup's not-found state
    - close with no history using `replace`
    - the dialog's `close` event, fired with no `cancel`, still clearing `quiz`
    - a path change focusing the new page's `<h1>`, while a search-param change doesn't
25. `npm test`, `npm run lint`, `npm run typecheck` and `npm run db:test` pass, and the browser console shows no warnings.

## Packages

None new. `useCanGoBack()` must exist in the installed `@tanstack/react-router`. If feature 0 pinned an older v1 release, upgrading within v1 is in scope.

## Files in scope

```
src/routes/search.tsx
src/pages/HomePage.tsx (+ .test.tsx)            # splash replaces feature 0's heading-only page
src/pages/SearchPage.tsx (+ .test.tsx)
src/components/QuizIllustration.tsx
src/components/SearchForm.tsx
src/components/QuizCard.tsx
src/components/QuizDetailsDialog.tsx (+ .test.tsx)
src/components/SiteHeader.tsx                    # add Search link
src/hooks/useQuizSearch.ts                       # the infinite query
src/hooks/useQuizDetails.ts                      # the single-quiz query
src/schemas/search.ts                            # route search params, search form
src/schemas/searchResult.ts                      # Zod parse of search_quizzes' jsonb
src/routes/__root.tsx                            # page-change focus rule (23a)
src/lib/formatSuggestedTime.ts (+ .test.ts)
src/styles/*.css                                 # only where Ply lacks something
src/routeTree.gen.ts, src/types/database.types.ts (generated)
supabase/migrations/<timestamp>_search_quizzes.sql
supabase/tests/search_quizzes.test.sql
CLAUDE.md (feature 6 status only)
```

## Out of scope

- The timer choice and Start button in the popup, and taking quizzes (feature 1).
- Opening the popup from the dashboard or result pages (features 3 and 1). The `Link` pattern in criterion 18 is what they will use.
- Tags, popular or weekly lists, stats, autocomplete, and suggestions (stretch goals S3 and S4).
- Final splash wording, which the project owner supplies at build time.
- Route masking.
- Changes to the quizzes schema other than adding `search_quizzes`.

## Where to look when reviewing

- **`src/routes/search.tsx` and `src/schemas/search.ts`:** the URL is the single source of truth for `q` and `quiz`. Nothing copies them into `useState`.
- **`SearchForm.tsx`:** React Hook Form holds the box's value, and `values: { q }` keeps it in step with the URL. Submitting navigates. There's no effect and no `key` remount.
- **`__root.tsx`:** the one site-wide page-change effect (23a). It reacts to path changes only.
- **`useQuizSearch.ts`:** one `useInfiniteQuery`. The status text and "Show more" are derived from its data and flags, not stored.
- **`QuizDetailsDialog.tsx`:** its **one** effect (open, then close and return focus in cleanup), the single `close()` that uses `useCanGoBack()`, and the `cancel` and `close` handlers with their guard.
- **The `search_quizzes` migration:** check that it is `security invoker`, reads only `quizzes_public`, and applies the threshold and ordering exactly as above.
- **Props:** cards get only the quiz fields they show. Session and search state are never passed down more than one level.

## Manual checks

- **Keyboard only:**
  - From the splash page: Tab, press Enter on "Find a quiz", search, Tab to a card, press Enter, read the popup, press Escape, and confirm focus is back on that card.
  - Repeat, closing with the close button and with browser Back.
- Copy a popup URL, open it in a new tab, and press Escape. You're on the plain search URL. Press Back and you leave the site, or return to the previous one.
- **Screen reader:** confirm the result count and "Try more specific words" are announced once, and the popup is announced with the quiz title.
- Search "capital space", "planets of the solar system", and "the of", and check the results against the seed data.
