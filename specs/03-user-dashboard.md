# Feature 3: User dashboard

Status: **Approved** (2026-11-12). It depends on features 0, 4, 6, 2 and 1 being Done. Rules come from `CLAUDE.md` (§1 "Quizzes and results" and "Claiming", §6, §8, feature 3). Schema and functions come from `ARCHITECTURE_SPEC.md` (§4.5, §6.2, §6.3 `claim_result` and `list_my_quizzes`, §8). Domain terms come from `GLOSSARY.md`.

## Goal

Members open `/dashboard` to see their saved results and to manage the quizzes they created. A member can also save an anonymous result to their account from its result page. This works only in the browser that took the quiz, because that browser holds the claim token from feature 1.

## Acceptance criteria

### The dashboard page

1. `src/routes/dashboard.tsx` is thin and renders `DashboardPage`. It has no search params.
2. The header shows a "Dashboard" link to `/dashboard` to members only. The header order is Search, Create quiz, Dashboard, then the auth button.
3. **Anonymous visitors** who open `/dashboard` get the `<h1>` "Your dashboard" and the line "Log in with the button at the top of the page to see your dashboard." There is no redirect and no second login button **(call)**.
   - The exact line is "Log in with the **Log in** button at the top of the page to see your dashboard." It names the button, so it doesn't rely on location alone.
   - The header button stays mounted while the page swaps content (feature 4, criterion 2), so after logging in, focus returns to it and the dashboard appears.
   - Logging out while on the page shows this message again.
   - While auth is still `loading`, the page shows only the `<h1>`.
4. **Members** see the `<h1>` "Your dashboard", then two sections, each with an `<h2>`: "My results" first, then "My quizzes" (layout A). `document.title` is "Dashboard". The page never shows the member's email or any account identifier.
5. Focus on arrival follows feature 6's page-change rule (criterion 23a): it goes to the `<h1>`.

### My results

6. A new database function, `list_my_results(p_cursor jsonb default null, p_limit int default 20)`, returns jsonb `{ "items": [...], "next_cursor": jsonb | null }` **(call)**. Its rules:
   - It is `security invoker` with `set search_path = ''` (an exception to §6.3's "all definer", noted there). So the existing RLS and column grants on `results` decide what the caller can read: `authenticated` can read every column it needs, and not `claim_token_hash`. It adds `where owner_id = (select auth.uid())` anyway, so the intent is explicit and the index is used.
   - It is executable by `authenticated` only. Execute is revoked from `public` and `anon`.
   - It orders by `created_at desc, id desc` and pages with a keyset cursor `{ "created_at", "id" }` (`ARCHITECTURE_SPEC.md` §8), using the existing `(owner_id, created_at desc, id)` index. `p_limit` is clamped to 1–50.
   - Each item is `{ id, quiz_kind, quiz_title, created_at, score, question_count, winning_outcome_title, quiz_status }`:
     - `score` and `question_count` (`jsonb_array_length(snapshot->'questions')`) are for trivia. Both are null for personality.
     - `winning_outcome_title` is for personality: the title of the snapshot outcome whose `id` matches `outcome_ranking->0->>'outcome_id'`. It is null for trivia.
     - `quiz_status` is `'deleted'` when `quiz_id` is null, `'updated'` when the live quiz's `version` (read from `quizzes_public`) is higher than `quiz_version`, and otherwise `'current'`. This uses the same checks as `get_result`.
   - It never returns `snapshot`, `owner_id`, `claim_token_hash` or `expires_at`. It returns no anonymous results, because members' own results never have an owner of null.
   - No table, column, policy or grant on `results` changes.
7. `src/hooks/useMyResults.ts` is one `useInfiniteQuery` with the key `['me', 'results']`. It is enabled only when there is a session. It pages with `next_cursor` (`initialPageParam: null`) and parses the response with a Zod schema (`src/schemas/myResults.ts`). Nothing is copied into `useState`.
8. Results are a list (`<ul>`/`<li>`). Each row shows:
   - the quiz title as a link to `/results/<id>`
   - "Trivia" or "Personality" as text
   - trivia: "<points> / <questions>", where points is `score × question_count` with at most 2 decimals, formatted the same way as the result page's headline. If that formatting isn't already a shared helper, it moves to `src/lib/formatScore.ts` and the result page uses it too.
   - personality: the winning outcome's title
   - the date in the member's locale (`Intl.DateTimeFormat` with `dateStyle: 'medium'`), inside a `<time datetime="…">`
   - **edited or deleted quizzes (the deferred Q15):** a text tag, "Quiz updated" or "Quiz deleted". It is plain text, never colour alone, and has no link (the result page has the "updated" link).
9. "Show more results" follows feature 6's rule (criterion 12): it appears only when another page exists, keeps focus on the button, and if no more pages remain afterwards, moves focus to the first newly loaded row's link.
   - Use **the same mechanism feature 6 built**, not a second one. If it lives inside `SearchPage`, extract it into a shared hook or component (`src/hooks/useShowMore.ts` or similar), and have both pages use it.
   - Don't look the element up right after `await fetchNextPage()`. TanStack Query v5 can notify observers after that promise resolves, so the new rows may not be rendered yet. The focus target is marked at render time (for example, `focusOnMount` on the first row of the newest page when that page was loaded by "Show more" and no more pages remain).
10. **States:**
    - Loading: "Loading your results…" in the section.
    - Error: "Couldn't load your results." with a "Try loading results again" button that calls `refetch()`.
    - Empty: "No saved results yet." with a "Find a quiz" link to `/search`.

### My quizzes

11. `list_my_quizzes(p_cursor jsonb default null, p_limit int default 20)` returns jsonb `{ "items": [...], "next_cursor": jsonb | null }`:
    - Each item has the same shape as a `search_quizzes` item (`{ id, kind, title, description, question_count, suggested_time_seconds, created_at }`), so the cards reuse feature 6's item schema and `QuizCard`.
    - It is `security definer` with `set search_path = ''` (`ARCHITECTURE_SPEC.md` §6.3). It can't be `security invoker`, because `authenticated` has no select grant on `quizzes.creator_id`, so even a `where` on that column would be refused. It reads `public.quizzes` with an explicit `creator_id = (select auth.uid())` filter, computes `question_count` inline, and **never outputs `creator_id`**.
    - It orders by `created_at desc, id desc` with the same keyset cursor, and uses the existing `(creator_id, created_at desc)` index. `p_limit` is clamped to 1–50.
    - It is executable by `authenticated` only, and raises if `auth.uid()` is null.
12. `src/hooks/useMyQuizzes.ts` is one `useInfiniteQuery` with the key `['me', 'quizzes']`, enabled only with a session, parsed with Zod.
13. The section heading row has a "+ Create quiz" link to `/quizzes/new`.
14. Each quiz is a `QuizCard` in a list, showing the same content as on the search page:
    - The title link keeps feature 6's single form, `search: (prev) => ({ ...prev, quiz: id })`. From `/dashboard`, which has no search params, that produces `/search?quiz=<id>`, so `QuizCard` needs no new prop for it.
    - Closing the popup returns to the dashboard through the popup's existing Back logic.
    - **Focus returns to the card that opened the popup** (`CLAUDE.md` §8), not to the dashboard's `<h1>`. On the search page the popup handles this itself, because the page stays mounted. Here the dashboard unmounts, so `src/lib/returnFocus.ts` adds a small module-level map **(call)**:
      - the card link's click handler records `quiz-card-<id>` against the current history entry's key (`router.state.location.state.__TSR_key`)
      - the root route's existing page-change focus rule (feature 6, criterion 23a) checks the map first when it resolves a page. If the new location's key has an entry and that element exists, it focuses it and removes the entry. Otherwise it focuses the `<h1>` as before.
      - The map lives only in memory, so a full reload falls back to the `<h1>`.
      - No new effect: it uses the root's one existing effect.
    - `QuizCard` gains an optional `actions` slot. Search passes nothing, so search cards are unchanged.
    - The actions are an **Edit** link to `/quizzes/<id>/edit` and a **Delete** button. Both have accessible names that include the quiz title (for example, a visually hidden "World Capitals" after "Edit"), so a list of them is not just repeated "Edit".
15. **Delete** opens feature 2's `ConfirmDialog` with the same text ("Delete "<title>"?", "This can't be undone. Results people already have will stay.", Cancel focused first, and "Delete quiz").
    - Confirming calls `useDeleteQuiz`. On success, in this order:
      - the draft for that quiz is cleared
      - the card is removed from the `['me', 'quizzes']` cache straight away with `setQueryData`, so it can't be pressed twice
      - `['me']` and `['quizzes']` are invalidated, so the results list picks up its new "Quiz deleted" tags, and `['quiz', id]` is removed
      - the dialog is closed first (`dialog.close()` through `ConfirmDialog`'s close, synchronously). While a modal dialog is open the page behind it is inert and can't take focus, and closing it would otherwise send focus back to the Delete button.
      - then focus moves to the "My quizzes" `<h2>` (`tabIndex={-1}`), because the Delete button that opened the dialog no longer exists
      - "Quiz deleted" is announced
      - the member stays on the dashboard
    - On failure, "Couldn't delete this quiz." shows in the dialog and is announced. The dialog stays open.
16. "Show more quizzes", loading, error ("Couldn't load your quizzes." with "Try loading quizzes again") and empty states follow criteria 9 and 10. Every button name on the page is unique (WCAG 2.4.6). The empty state is "You haven't made a quiz yet." with a "Create one" link to `/quizzes/new`.
17. **Feature 2's temporary Delete moves here.** Feature 2 put Delete on the edit page "until feature 3 exists" **(call)**:
    - The "Delete quiz" section is removed from the edit page, and the file `src/components/quiz-editor/DeleteQuizSection.tsx` is deleted (approving this spec approves that deletion). Its tests move to the dashboard's.
    - `useDeleteQuiz` no longer navigates to `/search`. Navigation and focus are the caller's job, and the dashboard is the only caller.

### Login state and cached member data

18. In `src/stores/authStore.ts`, `SIGNED_OUT` **removes** the `['me']` queries (`queryClient.removeQueries({ queryKey: ['me'] })`) instead of invalidating them, still deferred with `setTimeout(…, 0)`. This stops a member who logs in next on the same browser from briefly seeing the previous member's lists. `SIGNED_IN` still invalidates.

### Save to my account (on the result page)

19. A new migration adds `claim_result(p_id uuid, p_token text) returns boolean` exactly as in `ARCHITECTURE_SPEC.md` §6.3. It is one atomic `update … returning`, raises if `auth.uid()` is null, and is executable by `authenticated` only.
20. `src/components/result/SaveResultSection.tsx` is always rendered by `ResultPage` for an `ok` result. What it shows is derived at render time, with nothing copied into state:
    - **The mutation has an outcome** (`useClaimResult`'s status is not `idle`): it shows that outcome (criterion 22). This comes first, because after a claim the token is gone and the result is no longer `claimable`, yet the message still has to show.
    - **Otherwise**, if `get_result` says `claimable` **and** this browser holds an unexpired `claim:<resultId>` token (read through `src/lib/claimTokens.ts`), it shows the button (criterion 21).
    - **Otherwise** it shows nothing. A member's own result, or anyone else's shared link, never shows a "saved" message.
21. The button is **one element that stays mounted**, like the header button (feature 4, criterion 2):
    - Logged out, it reads "Log in to save this result" and opens the login popup. After logging in, the popup closes, focus returns to the same button, and it now reads "Save to my account". Saving never happens automatically.
    - A plain `LoginButton` can't be used here, because it would have to be swapped for a different button when the session changes, and feature 4 requires the opener to stay mounted. So `LoginButton.tsx` exports a small helper (or hook) holding its open logic (`showModal()` and then focusing the email field), and both `LoginButton` and this button use it with `LoginDialog`. The open logic is not copied.
    - Logged in, it reads "Save to my account" and calls `useClaimResult`.
    - While saving it reads "Saving…" and uses `aria-disabled="true"` with a guard in the click handler, not `disabled`. A `disabled` button drops focus to `<body>` in Chrome.
22. `src/hooks/useClaimResult.ts` is one `useMutation` calling `supabase.rpc('claim_result', …)`. Each outcome is a message paragraph with `tabIndex={-1}`, focused when it mounts through a module-level `focusOnMount` callback ref (not an effect). It is **not also announced**, because focusing it already reads it, and announcing too would read it twice.
    - **`true`:**
      - the token is deleted with `removeClaimToken(resultId)`
      - `['result', id]` and `['me', 'results']` are invalidated
      - the message is "Saved to your account." with a "See your dashboard" link. The refreshed result has no `expires_at`, so the "kept until" line goes away.
    - **`false`:** the token is deleted, `['result', id]` is invalidated, and the message is "This result can't be saved. It may have expired or already been saved."
    - **Any error:** the message is "Something went wrong. Please try again." It sits beside the button, which stays (the token is kept), so the member can retry.
22a. `src/lib/claimTokens.ts` gains `removeClaimToken(resultId)`, with a test. Feature 1 defined only read, write and prune.
23. Feature 1's anonymous notice changes to "This result is kept until <local date and time>." The "Log in to save it to your account" sentence is removed, because the button now covers that, and the sentence would be wrong in a browser with no token.

### Tests and quality

24. pgTAP tests in `supabase/tests/`:
    - `claim_result`: succeeds once, then fails a second time; fails with a wrong token, when expired, and when already owned; raises for a null `auth.uid()`; is not executable by `anon`; and after success the row has an owner, no `expires_at` and no token hash (`ARCHITECTURE_SPEC.md` §12).
    - `list_my_results`: returns only the caller's rows, never another member's or an anonymous one; includes a result just claimed; pages correctly across a cursor with tied `created_at`; returns the right `winning_outcome_title`, `score`, `question_count` and each `quiz_status`; never includes `snapshot`, `owner_id`, `claim_token_hash` or `expires_at`; and is not executable by `anon`.
    - `list_my_quizzes`: returns only the caller's quizzes, never includes `creator_id`, pages correctly, and is not executable by `anon`.
    - Both list functions have `search_path` set to `''`.
25. `npm run db:types` is rerun and the regenerated types are committed.
26. Component tests (role-based, `vitest-axe` in each file, mocked `src/lib/supabase`) cover:
    - anonymous, loading and member views of the dashboard
    - result rows for both kinds, including both tags
    - quiz cards with Edit and Delete, and their accessible names
    - "Show more" for both lists, including the focus move
    - each empty and error state
    - deleting: confirm, announcement, and focus on the heading; and a failed delete keeping the dialog open
    - the header's Dashboard link for members only
    - `SaveResultSection`:
      - hidden without a token, and hidden when not claimable
      - nothing shown on an owned result
      - the button switching label after login
      - each claim outcome (true, false, error), with its message focused and its token handling
    - the anonymous notice's new wording
    - `returnFocus`: a recorded entry is focused on return, and the `<h1>` is the fallback
    - logging out removes cached `['me']` data
27. `npm test`, `npm run lint`, `npm run typecheck` and `npm run db:test` pass, and the browser console shows no warnings.

## Packages

None new.

## Files in scope

```
src/routes/dashboard.tsx
src/pages/DashboardPage.tsx (+ .test.tsx)
src/components/dashboard/*.tsx (+ tests)      # MyResultsSection, ResultRow, MyQuizzesSection
src/components/QuizCard.tsx                   # optional actions slot
src/components/SiteHeader.tsx (+ .test.tsx)   # Dashboard link for members
src/components/result/SaveResultSection.tsx (+ .test.tsx)
src/components/result/ResultNotices.tsx (+ .test.tsx)  # anonymous notice wording
src/pages/ResultPage.tsx (+ .test.tsx)        # render SaveResultSection
src/components/LoginButton.tsx                # export its open logic for reuse
src/lib/claimTokens.ts (+ .test.ts)           # removeClaimToken
src/lib/returnFocus.ts (+ .test.ts)
src/routes/__root.tsx                         # check returnFocus before the <h1>
src/hooks/useShowMore.ts                      # only if extracted from SearchPage
src/pages/SearchPage.tsx                      # only to use the extracted hook
src/stores/authStore.test.ts
src/components/quiz-editor/DeleteQuizSection.tsx  # deleted (criterion 17)
src/pages/QuizEditorPage.tsx (+ .test.tsx)    # remove the Delete section
src/hooks/useMyResults.ts  src/hooks/useMyQuizzes.ts  src/hooks/useClaimResult.ts
src/hooks/useDeleteQuiz.ts                    # no navigation; also invalidate ['me']
src/stores/authStore.ts                       # remove ['me'] on sign-out
src/lib/formatScore.ts (+ .test.ts)           # only if not already shared
src/lib/focusOnMount.ts
src/schemas/myResults.ts  src/schemas/myQuizzes.ts
src/styles/*.css                              # only where Ply lacks something
src/routeTree.gen.ts, src/types/database.types.ts (generated)
supabase/migrations/<timestamp>_claim_result.sql
supabase/migrations/<timestamp>_dashboard_lists.sql
supabase/tests/claim_result.test.sql  supabase/tests/dashboard_lists.test.sql
ARCHITECTURE_SPEC.md (§6.3 and §11: list_my_results)
CLAUDE.md (feature 3 status only)
```

## Out of scope

- Other members' results, which are reachable only by their link.
- Deleting results. No one can, including their owner (`CLAUDE.md` §1).
- Account deletion and the settings menu (feature 5).
- Filtering, sorting options or searching within the dashboard lists.
- A dashboard button on the splash page. Its wording is decided when the splash page is built.
- Any change to RLS policies, grants on tables, or the auth flow itself. `SaveResultSection` reuses `LoginDialog` unchanged, and `LoginButton` only exports its existing open logic.

## Where to look when reviewing

- **No effects in this feature.** Focus moves happen in event handlers or `onSuccess`, plus one module-level `focusOnMount` callback ref.
- **`SaveResultSection.tsx`:** what it shows is derived from the mutation's own status and data, `useSession()`, the `get_result` query and `claimTokens`, at render time. There is no `useState` for "has token" or "saved". The open logic comes from `LoginButton.tsx` and is not copied.
- **`returnFocus.ts` and `__root.tsx`:** a plain module-level map, read inside the root's existing effect. No new effect.
- **`useMyResults.ts` and `useMyQuizzes.ts`:** one `useInfiniteQuery` each. "Show more", loading, empty and error are derived from its flags.
- **`MyQuizzesSection.tsx`:** the dialog's open quiz is the only local state (which quiz is being deleted). The heading ref for focus lives in the same component that owns the delete handler, so nothing is passed down to do it.
- **`QuizCard.tsx`:** the `actions` slot is the only new prop. Cards still receive only the fields they show, and no session or query state.
- **`authStore.ts`:** only the `SIGNED_OUT` branch changes.
- **The two list migrations:** `list_my_results` is `security invoker` and `list_my_quizzes` is `security definer` (criterion 11 says why), both with `search_path = ''`. Check the explicit owner or creator filter, the keyset `where (created_at, id) < (…)` comparison, execute revoked from `anon`, and no `snapshot` or account fields in the output.

## Manual checks

- **Keyboard only:**
  - Tab through the dashboard, open a quiz popup from a card and close it with Escape, and confirm you're back on the dashboard with focus on that card's title link. Repeat with the browser's Back button.
  - Delete a quiz and confirm focus lands on "My quizzes".
  - Use "Show more" until the end and confirm focus moves to the first new row.
- **Claiming:** take a quiz logged out, then on its result page press "Log in to save this result", log in, and confirm focus returns to the same button, now reading "Save to my account". Save it, confirm "Saved to your account" is focused and read once, and that it appears under My results.
- Open the same result link in another browser while logged in and confirm no save button appears.
- **Screen reader:** confirm the "Quiz updated" and "Quiz deleted" tags and the trivia score are read sensibly in each row.
