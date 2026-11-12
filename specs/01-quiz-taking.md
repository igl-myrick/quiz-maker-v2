# Feature 1: Quiz taking

Status: **Approved** (2026-11-10). It depends on features 0, 4, 6 and 2 being Done. Rules come from `CLAUDE.md` (§1, §6, §8, §9, feature 1). Server design comes from `ARCHITECTURE_SPEC.md` (§4.5, §4.5a, §5, §7.2, §7.3) and ADRs 0001–0003. Domain terms come from `GLOSSARY.md`.

## Goal

Anyone can start a quiz from its details popup, with or without the timer, answer it page by page, and submit it for server-side grading. The submission becomes a result with its own link: owned straight away for members, and expiring after 1 day (with a claim token) for anonymous visitors. Progress survives reloads. A take is graded against the version it started on, even if the quiz is edited or deleted meanwhile.

## Decisions made with the project owner

- **The popup's start controls:**
  - A **switch** whose visible text reads "Timer enabled" or "Timer disabled". Its accessible name is "Timer" and it announces on or off. It starts enabled, and is shown only when the quiz has a suggested time.
  - A **Start quiz** button.
- **Pages of 10 questions:**
  - Questions on a page can be answered in any order.
  - "Next page" requires every question on the page to be answered.
  - Earlier pages can be revisited and changed freely until submitting.
- **Result pages:**
  - **Trivia:** the score, counts of correct, partly correct and wrong answers, and a question-by-question breakdown with points.
  - **Personality:** the winning outcome and its description, with no answer list.
  - **Both:** "Copy link" and "Find another quiz". Anonymous visitors also see the 1-day note.
- **Timer:**
  - A countdown at the top of every page.
  - Announced warnings at 1 minute left and at zero.
  - At zero: "Time's up. You can keep going and submit when you're ready." The countdown then shows "Over time", and nothing locks or submits itself.
  - Timed results show "Finished in m:ss (suggested m:ss)". This **adds `timed` and `duration_seconds` to results**, which the project owner approved.
- **Edited or deleted during a take:** the take is graded against the version it started on, using **retired versions** kept for 24 hours (ADR 0003). The result shows the usual "updated since" or "no longer exists" notice. A take is only rejected after more than 24 hours.
- **Submission rate limits** (fixed one-hour windows):
  - **Anonymous visitors:** 30 per hour per connection. The message says: "Too many quizzes have been sent from this internet connection in the last hour. Please wait a few minutes and try again. Your answers are saved. Logging in also lets you submit, because members have their own limit."
  - **Members:** 60 per hour per account. The message says: "You've submitted a lot of quizzes in the last hour. Please wait a few minutes and try again. Your answers are saved."
- **Client IP header** (`CLAUDE.md` §6 asks for it to be recorded here):
  - Supabase does not document a trustworthy header for Edge Functions. `x-forwarded-for` can be spoofed (a forged value is kept as its first entry).
  - Use **`cf-connecting-ip`**, which Cloudflare sets and overwrites. That rests on Cloudflare's docs (https://developers.cloudflare.com/fundamentals/reference/http-request-headers/) and observed Supabase behaviour (https://github.com/orgs/supabase/discussions/34647), not on a Supabase guarantee.
  - Locally there is no Cloudflare, so the local stack only falls back to `x-forwarded-for` when the function secret `RATE_LIMIT_TRUST_XFF=true` is set in `supabase/functions/.env`. It is never set on a hosted project.
  - **The project owner verifies the header once on the hosted project** before launch: send a forged `X-Forwarded-For` and confirm `cf-connecting-ip` still holds the real address.

## Acceptance criteria

### Starting a take (completes the details popup from feature 6)

1. `QuizDetailsDialog` gains `StartQuizControls`, which `TakePage` also reuses (criterion 4):
   - The timer switch, only when `suggested_time_seconds` is set. It is a `<button role="switch" aria-checked>` with the accessible name "Timer", visible text "Timer enabled" or "Timer disabled", and the suggested time next to it ("Suggested time: 5 min"). Before building, check Ply's docs for a switch or toggle pattern.
   - A **Start quiz** button. The popup shows no start controls when it says the quiz no longer exists.
2. **Start** is an event handler. It:
   - fetches the quiz's **public** content in one request: the quiz row from `quizzes_public`, plus questions, options and outcome names, never keys. The button reads "Starting…" while this runs.
   - writes a new take to the take store: `{ quiz: <that content, including its version>, timed, startedAt: timed ? Date.now() : null, answers: {} }`
   - removes any stored takes for other versions of the same quiz
   - navigates to `/quizzes/<id>/take` (push)

   The take keeps its own copy of the questions, so a reload, or leaving and coming back, always shows the version it started on, even if the quiz was edited since. Submission is then graded against the retired copy (ADR 0003) **(call)**.

   Starting again on a quiz with saved progress asks first: "You have a quiz in progress. Start over?"

### The take store

3. One Zustand store, `src/stores/takeStore.ts`, using Zustand's `persist` middleware with `createJSONStorage(() => sessionStorage)` (`CLAUDE.md` §1):
   - It holds `takes: Record<"<quizId>:<version>", { quiz, timed, startedAt, answers: Record<questionId, optionId[]> }>` under a single session storage key. `quiz` is the public content captured at Start.
   - Session storage persistence loads synchronously when the store is created, so no hydration check is needed.
   - Its actions are `start`, `setAnswer`, `clear`, and `removeOtherVersions`.
   - **It is the only owner of answers.** Inputs are controlled straight from it. There is no React Hook Form and no `useState` copy. "Answered" and "unanswered" are derived when needed.
   - Nothing in it is ever sent to the server except as the submission body.

### Taking (`/quizzes/$quizId/take`)

4. The route validates `page` (a whole number, at least 1, defaulting to 1).
   - **With a stored take for this quiz** (any version), the page renders entirely from the take's own `quiz` copy, with no fetch.
   - **With no stored take,** for example a pasted link or a new tab, the page loads the quiz row from `quizzes_public` and shows the title, `StartQuizControls`, and nothing else.
   - **If the quiz doesn't exist,** it shows "This quiz no longer exists." with a link to search.
5. A `page` beyond the last page renders the last page, using `<Navigate replace>` during render.
6. Each page shows up to 10 questions. Each question is a `fieldset` whose `legend` is "Question <n> of <total>: <prompt>".
   - Single-choice and true/false questions use real radio buttons. Multi-select questions use real checkboxes, plus the hint "Choose all that apply".
   - Each input has a label. Changing an input calls `setAnswer`.
7. **Navigation:**
   - "Previous page" (from page 2 on) and "Next page" or **Submit answers** (on the last page) sit below the questions.
   - Changing page pushes `?page=n`, so browser Back works. Focus moves to the page's `<h2>` ("Page 2 of 3") and that heading is announced.
   - "Next page" with unanswered questions on the page doesn't navigate. It shows an **error summary** ("Answer these questions to continue") that receives focus and links to each unanswered question's first input.
8. A progress line ("12 of 25 answered") is derived from the store and shown under the title, without announcing every change.

### Timer

9. When the take is timed, a countdown appears at the top of every page: "Time left: m:ss", then "Over time: m:ss" after zero.
   - `useCountdown(startedAt, suggestedSeconds)` holds the feature's **one ticking effect**: a 1-second interval that updates a `now` value and is cleared in cleanup. Remaining time is derived as `startedAt + suggested − now`, never stored.
   - The visible countdown is not a live region.
10. **Announcements:**
    - At 1 minute left: "1 minute left". This is skipped when the suggested time is exactly 1 minute.
    - At zero: "Time's up. You can keep going and submit when you're ready."
    - Each is announced through the app's Announcer from the countdown's interval callback, exactly when the threshold is crossed while ticking. A reload after a threshold has passed doesn't announce it again.
    - **(call)** This widens feature 4's "Announcer is called from event handlers only" rule to "from event handlers and timer callbacks". The point of that rule was to keep the auth listener silent, and it still is.
    - Nothing locks and nothing submits itself.
11. A reload continues the countdown from the stored `startedAt`.

### Submitting

12. **Submit answers** first checks every page. Unanswered questions anywhere produce the error summary ("Answer these questions before submitting"), with each item linking to its question and switching page if needed.
13. Submitting calls `supabase.functions.invoke('submit-quiz', { body })`, where the body is `{ quiz_id, quiz_version, answers: { [questionId]: optionId[] }, timed, started_at }` (`started_at` is ISO or null). The button is disabled and reads "Submitting…" while the request runs.
    - A non-2xx response arrives as `FunctionsHttpError`. Its status and `{ code }` body are read from `error.context` (a `Response`, through `await error.context.json()`) and parsed with Zod.
    - A network failure arrives as `FunctionsFetchError`.
14. **Success**, `200 { result_id, claim_token? }`:
    - If a `claim_token` was returned, it is stored in **local storage** as `claim:<result_id>` = `{ token, expiresAt }` (now plus 1 day). It is never put in a URL or logged.
    - The take is cleared from the store.
    - The app navigates to `/results/<result_id>` with `replace: true`, so Back doesn't return to an empty take.
15. **Errors** are shown in the error summary, announced, and the answers stay saved:
    - `401`: "You've been logged out. Log in to submit." with a `LoginButton`. After logging in, the person presses Submit again.
    - `409 quiz_changed`: "This quiz changed more than a day after you started, so these answers can't be graded." with a "Start the current version" button (criterion 2).
    - `410 quiz_deleted`: "This quiz no longer exists." with a link to search.
    - `422 unanswered`: the summary lists the questions the server named. `422 invalid_answers`: "Something about these answers didn't match the quiz. Please start again." with Start.
    - `429`: the anonymous or member message from the decisions above, chosen by whether the person is logged in.
    - Anything else, or a network error: "Couldn't submit. Check your connection and try again."

### The `submit-quiz` edge function

16. `supabase/functions/submit-quiz/index.ts` follows `ARCHITECTURE_SPEC.md` §7.2, with these specifics:
    - **CORS (added 2026-11-12 by feature 5's review):** the function answers the browser's `OPTIONS` preflight and adds CORS headers to every response, using `supabase/functions/_shared/cors.ts`. See feature 5's spec, criteria 21–21a.
    - **Order:** identify the caller, then apply the rate limit, then parse the body, then everything else. A malformed body (`400`) therefore still counts toward the limit. Only a bad user token (`401`) is rejected before counting, because the limiter needs to know whose limit to use.
    - **Caller** **(call)**:
      - `[functions.submit-quiz] verify_jwt = false`, because publishable keys and newer signing keys don't pass the platform's JWT check. The function does its own check.
      - If the bearer token is the project's anon or publishable key, the caller is anonymous.
      - Otherwise the function calls `supabase.auth.getClaims(token)`, passing the token explicitly. The caller is a member only if the claims verify **and** `role = 'authenticated'` **and** `sub` is present.
      - Any other token, such as an expired or invalid user token, returns `401`. Note that a legacy anon key is itself a JWT, with `role: anon`, so being a JWT doesn't make a caller a member.
      - The function uses `@supabase/supabase-js` only, never `@supabase/server`.
    - **Body:** parsed with Zod (≤ 50 questions, ≤ 8 option IDs each, UUIDs only, plus the four other fields). An invalid body returns `400`.
    - **Rate limit,** through `hit_rate_limit`:
      - `anon_submit`: subject = hex HMAC-SHA-256 of the normalised IP, keyed with the secret `IP_HASH_SECRET` using Web Crypto, limit 30 per hour. **Normalising** means:
        - parse the address
        - treat IPv4-mapped IPv6 (`::ffff:a.b.c.d`) as IPv4
        - fully expand compressed IPv6 (`::`) before keeping its first 64 bits
        - write the result in a canonical form

        String slicing is not enough. Unparseable values count as "no usable IP".
      - `member_submit`: subject = user ID, limit 60 per hour.
      - Anonymous requests with no usable IP header are rejected with `400`, never counted under a shared key.
      - The raw IP and its hash are never logged or returned.
    - **Load the quiz** (one PostgREST request, §7.2 step 4).
    - **Choose a version** (§7.2 step 5): the live quiz if its version matches, otherwise the `quiz_versions` copy for `(quiz_id, quiz_version)`, otherwise `409` or `410`.
    - **Validate answers** (§7.2 step 6), then grade with the pure module `supabase/functions/_shared/grading.ts`:
      - single-choice and true/false: 1 or 0
      - multi-select: `max(0, (correct selected − wrong selected) / correct options)`
      - quiz score: the mean
      - personality: per-outcome totals, sorted, with each tied group shuffled using `crypto.getRandomValues`
    - **Insert the result** with the service role:
      - the snapshot (§5)
      - `score` or `outcome_ranking`
      - `quiz_title`, `quiz_kind`, `quiz_version`
      - `timed`, and `duration_seconds = clamp(now − started_at, 0, 86400)` when timed, otherwise null
      - for members, `owner_id`; for anonymous visitors, `expires_at = now() + 1 day` and the claim token hash (§7.2 step 8)
      - if the insert fails its foreign key (`23503`) because the quiz was deleted moments ago, retry once with `quiz_id` null. The taker still gets their result (`ARCHITECTURE_SPEC.md` §7.2 step 8).
    - **Responses** use the status codes from criterion 15 and a JSON body `{ code, … }`. Error responses never include stack traces.
17. `supabase/functions/.env.example` lists `IP_HASH_SECRET` and `RATE_LIMIT_TRUST_XFF` with placeholder values. The real `supabase/functions/.env` is gitignored. Secrets must not start with `SUPABASE_`.

### Database

18. Migrations add:
    - `quiz_versions` (§4.5a) with no client grants and `service_role` select only
    - the retire step at the start of `save_quiz`'s edit path, replacing the feature 2 function
    - a `before delete` trigger on `quizzes`, which runs a `security definer` function that copies the version being deleted
    - `results.timed boolean not null default false` and `results.duration_seconds int null check (duration_seconds >= 0)`
    - `get_result` returning `timed` and `duration_seconds` in `result`
    - `pg_cron` enabled, with the job `cleanup-expired` every 15 minutes. It runs `select public.cleanup_expired();`, a plain SQL function holding the three delete statements from §7.3: expired anonymous results, ended rate-limit windows, and `quiz_versions` older than 24 hours. Putting them in a function lets pgTAP test them **(call)**. Execute is revoked from every client role.
19. pgTAP tests cover:
    - an edit writing a `quiz_versions` row with the old version and its keys
    - a delete, including one through an auth user's cascade, writing one
    - `anon` and `authenticated` being unable to read `quiz_versions`
    - `cleanup_expired()` removing only rows past their limits, and clients being unable to execute it
    - the existing `save_quiz` and `get_result` tests, updated for the retire step and the new result fields
    - `get_result` returning the new fields
    - the new member and anonymous scopes in `hit_rate_limit` counting correctly
20. `npm run db:types` is rerun and the regenerated types are committed.

### Result page (`/results/$resultId`)

21. The route calls `get_result` through the query `['result', resultId]` and parses the JSON with a Zod schema (`src/schemas/result.ts`).
    - **Expired:** "This result has expired. Anonymous results are kept for 1 day."
    - **Not found:** "This result doesn't exist or has expired. Anonymous results are kept for 1 day."
    - Both have a link to search.
22. **Trivia:**
    - The `<h1>` is the quiz title. The headline is "<points> / <questions> (<percent>%)", with points to at most 2 decimals and percent rounded.
    - A summary line: "✓ 7 correct · ◐ 1 partly correct · ✗ 2 wrong", where each icon has text and is never colour alone.
    - "Question by question": each question shows its number and text, then "Correct: 1 point", "Partly correct: 0.5 points" or "Wrong: 0 points". Each option shows whether it was chosen and is marked "correct" or "not correct", and a missed correct option says "correct answer you didn't choose". Icons are decorative and the text carries the meaning.
23. **Personality:** the `<h1>` is "You're <outcome title>" **(call)**, such as "You're Winter", followed by the outcome description and the quiz title as a subheading. No answers are listed.
24. **Both kinds:**
    - "Finished in m:ss (suggested m:ss)" for timed results.
    - The notices from `get_result`: "This quiz has been updated since this result was saved." with a link to its popup (`/search?quiz=<id>`), or "The original quiz no longer exists." with no link.
    - For anonymous results (`expires_at` set): "This result is kept until <local date and time>. Log in to save it to your account." The save button itself is feature 3.
    - **Copy link** copies the page URL with `navigator.clipboard.writeText` and announces "Link copied". If that fails it shows the URL in a read-only field.
    - **Find another quiz** links to `/search`.
    - The page never shows an email or account identifier.
25. The page's `<h1>` receives focus on arrival (feature 6's page-change rule), and `document.title` is set to "Result: <quiz title>".

### Tests and quality

25a. **Deno code and the tooling:**
    - `supabase/functions/submit-quiz/index.ts` uses Deno features (`npm:` imports, `Deno.*`, `.ts` import extensions), so it is excluded from the app's `tsconfig` and ESLint. It is checked by running it with `supabase functions serve`.
    - `supabase/functions/_shared/grading.ts` is **pure TypeScript with no imports**, so the app's type-check, ESLint and Vitest can include it.
    - The test file imports it as `./grading.ts`, so the tsconfig that covers it allows `.ts` import extensions (`allowImportingTsExtensions` with `noEmit`).
    - The config edits this needs are in scope.
25b. On app start, `src/main.tsx` prunes `claim:*` entries in local storage whose `expiresAt` has passed (`ARCHITECTURE_SPEC.md` §10), using `src/lib/claimTokens.ts`.
26. Vitest unit tests for `grading.ts` cover every question type, partial credit including the negative clamp, quiz score, personality totals, tie shuffling (with a seeded or stubbed random source), and that untied rankings are deterministic.
27. Component tests (role-based, `vitest-axe`, mocked Supabase) cover:
    - the timer switch's name and state
    - Start creating a take
    - the paging rules and error summary
    - progress restored from session storage, including the take's own quiz copy after the live quiz changed
    - countdown text and its announcements (fake timers)
    - every submit error
    - the claim token stored in local storage
    - both result layouts and all notices
28. `npm test`, `npm run lint`, `npm run typecheck` and `npm run db:test` pass. The browser console shows no warnings. `supabase functions serve` runs `submit-quiz` locally, and an end-to-end manual take works.

## Packages

None new. The edge function imports `@supabase/supabase-js` and Zod through Deno's `npm:` specifiers, pinned to the same versions as `package.json`.

## Files in scope

```
src/routes/quizzes.$quizId.take.tsx  src/routes/results.$resultId.tsx
src/pages/TakePage.tsx (+ .test.tsx)  src/pages/ResultPage.tsx (+ .test.tsx)
src/components/StartQuizControls.tsx (+ .test.tsx)
src/components/QuizDetailsDialog.tsx          # add StartQuizControls
src/components/take/*.tsx (+ tests)           # QuestionFieldset, PageNav, ErrorSummary, Countdown
src/components/result/*.tsx (+ tests)         # TriviaResult, PersonalityResult, ResultNotices, CopyLinkButton
src/stores/takeStore.ts (+ .test.ts)
src/hooks/useCountdown.ts (+ .test.ts)  src/hooks/useTakeQuiz.ts  src/hooks/useSubmitQuiz.ts  src/hooks/useResult.ts
src/lib/claimTokens.ts (+ .test.ts)           # local storage read/write/prune
src/schemas/submission.ts  src/schemas/result.ts
supabase/functions/submit-quiz/index.ts
supabase/functions/_shared/cors.ts
supabase/functions/_shared/grading.ts (+ grading.test.ts run by Vitest)
supabase/functions/.env.example  supabase/config.toml ([functions.submit-quiz])
supabase/migrations/<timestamp>_quiz_versions.sql
supabase/migrations/<timestamp>_results_timing.sql
supabase/migrations/<timestamp>_cleanup_cron.sql
supabase/tests/quiz_versions.test.sql  supabase/tests/cleanup.test.sql
.gitignore (supabase/functions/.env)
tsconfig*.json  eslint.config.js  vite.config.ts / vitest config   # include _shared/grading.ts, exclude Deno entry points
src/main.tsx                                  # prune expired claim tokens on start
supabase/tests/save_quiz.test.sql  supabase/tests/get_result.test.sql   # update for this feature
src/routeTree.gen.ts, src/types/database.types.ts (generated)
CLAUDE.md (feature 1 status only)
```

## Out of scope

- The "Save to my account" (claim) button and `claim_result` (feature 3). This feature only stores the token.
- The dashboard (feature 3) and settings (feature 5).
- Showing a personality result's full ranking (stretch goal S5), and play counts (S4).
- Anything on the hosted project, including setting secrets there. The project owner does the header check and `supabase secrets set`.
- Offline submission (S2).

## Where to look when reviewing

- **`src/stores/takeStore.ts`:** the single home for answers, timer choice and start time, persisted to session storage. Check that nothing copies answers into component state or React Hook Form.
- **`StartQuizControls.tsx`:** the switch's `role`, `aria-checked` and accessible name. Start creates the take in its click handler, not in an effect.
- **`QuestionFieldset.tsx`:** real radios and checkboxes in a fieldset with a legend, controlled from the store. "Answered" is derived.
- **`useCountdown.ts`:** the one interval effect, its cleanup, and the remaining time derived from `startedAt`. Announcements fire only when a threshold is crossed.
- **`TakePage.tsx`:** the `page` param from the URL, the redirect done during render, and rendering from the take's own stored quiz copy, with no refetch mid-take.
- **`supabase/functions/submit-quiz/index.ts` and `_shared/grading.ts`:** the rate-limit-first order, the IP header handling and HMAC, choosing between the live quiz and the retired copy, and the grading maths. No answer key ever reaches a response other than inside the result's snapshot.
- **`ResultPage.tsx`:** everything comes from `get_result`, and nothing is recalculated or re-randomised.

## Manual checks

- **Keyboard only:** open a popup, toggle the timer switch with Space, start, answer a 25-question quiz across 3 pages, try "Next page" with a gap, follow the summary links, submit, and read the result.
- Reload mid-take and confirm the answers and the countdown continue.
- In one tab start a quiz. In another, as its creator, edit it. Reload the first tab, confirm it still shows the original questions, submit it, and confirm it's graded and shows "updated since". Repeat with a delete.
- **Screen reader:** the switch state, page headings, the 1-minute and time's-up warnings, the error summary and "Link copied" are each announced once.
- Submit 31 anonymous takes within an hour locally (with `RATE_LIMIT_TRUST_XFF=true`) and confirm the anonymous message.
- **Before launch (project owner):** the hosted `cf-connecting-ip` check described above.
