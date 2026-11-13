# CLAUDE.md

Guidance for AI coding agents working in this repository. Read this fully at the start of every session. If a task conflicts with anything here, stop and ask.

## 1. Project overview

A casual quiz platform. Anyone can take personality quizzes and trivia quizzes for fun. Logged-in users can save their results and create their own quizzes. Everything lives in one area of the site. There are no schools, classes, teachers, students, or proctoring, and nothing should be built that assumes them.

There is **no separate "test" type**. A creator may call their quiz a test in its title, but the app treats it like any other quiz. Do not add a test flag, field, mode, or any test-specific logic.

### Access model

| Who | Can do |
| --- | --- |
| Anonymous visitor | Take quizzes and view results through a result link that **expires after 1 day** |
| Member (logged in) | Everything above, plus results saved long term, creating quizzes, and the dashboard |

Members log in with a one-time code sent to their email. There are no passwords (see feature 4).

### Quizzes and results

- Quizzes are **always public**. There is no private, unlisted, or draft visibility option. Do not add one.
- Creators can edit and delete their own quizzes. This **never changes existing results**. Each result stores a snapshot of the questions, answer options, correct answers, and scoring as they were when the quiz was taken. Results must not depend on the live quiz rows: deleting a quiz must not cascade to results, and result pages show a short notice (with no link) when the original quiz no longer exists.
- **Edits during a take:** Each quiz has a version number that increases on every edit. A submission includes the version the taker loaded, and is always graded against **that** version, even if the quiz has since been edited or deleted. The result then shows the usual "updated since" or "no longer exists" notice.
  - To make this possible, when a quiz is edited or deleted, the version being replaced is first saved as a **retired version**: a private, sealed copy including its answer key.
  - No client can read retired versions. They are deleted automatically 24 hours after being retired, including those retired by deleting a quiz or an account.
  - A submission whose version has neither live rows nor a retired copy (the take lasted more than a day) is rejected. The taker sees a clear message, announced to screen readers, saying the quiz changed or no longer exists, with a button to start the current version when there is one.
  - Do not keep old versions for any other purpose or any longer. See `docs/adr/0003-retired-versions-for-in-progress-takes.md`.
- **Progress during a take:** In-progress answers are saved in the browser's session storage as the taker goes (using Zustand's built-in persist middleware) and restored if the page reloads. Session storage is cleared when the tab closes, so unfinished quizzes do not pile up on the device. Saved progress is kept per quiz and per version, and is discarded if the quiz has changed since. Submitting clears it. Saved progress never goes to the server.
- Every submitted quiz produces a result with its own **unguessable ID**, viewed at a result link. Anyone with the link can view that result, so results are effectively private unless the owner shares the link.
- Result links fetch a result only by exact ID, through a database function. Never allow listing, searching, or enumerating results, and never create a policy that lets the public select from the results table. The one exception is a member listing their own results: RLS allows select only where the owner is the current user, and the dashboard uses this. No one can list anyone else's results, and anonymous results can never be listed. Result pages must not show an email or any other account identifier.
- **Anonymous results expire after 1 day.** They are stored server-side with an `expires_at`. Reads must check `expires_at` and not rely only on cleanup, and expired links show a clear "expired" message. A Supabase Cron job deletes expired rows (see section 6).
- **Claiming:** When an anonymous visitor submits a quiz, the server also returns a random **claim token**, once. Store only a hash of the token in the database, never the token itself. The browser keeps the token in local storage, keyed by result ID, and deletes it when the result is claimed or expires. Never put the token in a URL or log it, so sharing a result link never shares the ability to claim it. A logged-in member viewing an unexpired anonymous result in the browser that holds the token can choose "Save to my account". This runs through a single database function that atomically verifies the token hash, that the result has no owner, and that it has not expired, then sets the owner, clears `expires_at`, and clears the token hash. Claiming is always an explicit user action, never automatic, and it must not change the auth flow itself. Because login uses a code entered on the same page (see feature 4), the user is still on the result page after logging in. Without the token, or if the result is expired or already owned, it cannot be claimed and the "Save to my account" button is hidden. Members taking a quiz while logged in own their result immediately, with no token.
- **Members' results are saved long term** with no expiry, appear in their dashboard, and can also be viewed by link. Results cannot be deleted individually by anyone, including their owner, so no role has a delete policy on the results table. A result row is removed only by account deletion or, for anonymous results, by the expiry cleanup job.
- **Account deletion:** A member can delete their account from the settings menu (see feature 5). This permanently deletes the account, all of their results, all quizzes they created, and their saved settings. Other people's results for those quizzes are unaffected because results store snapshots, and they show the "quiz no longer exists" notice. The only exception is the private retired copy of each deleted quiz's last version (see "Edits during a take"). No one can read it except the grading function, and it is deleted within 24 hours. Deletion requires explicit confirmation in an accessible dialog and runs in an edge function, because deleting an auth user needs the service role key. Set up foreign keys so the database does the cleanup: results, quizzes, and settings cascade from their owner, while results reference their quiz with `ON DELETE SET NULL` and never cascade from it.

### Quiz details popup

- Selecting a quiz (from search, the dashboard, or a shared link) opens a **details popup** showing the quiz's information and, if it has a suggested time, the choice to take it with or without the timer. The taker only goes to the quiz itself after confirming there.
- The popup has its own **shareable URL**. Opening it updates the URL. Opening that URL directly shows the same popup over the search page, which loads behind it. Closing works like this:
  - When the popup was opened from within the app, Escape, the close button, and the browser's Back button all return to the previous page and URL.
  - When there is no previous page in the app (for example, after opening a shared link directly), Escape and the close button go to the search page. They replace the popup's URL in history instead of adding an entry, so pressing Back afterward does not reopen the popup.
  - Never intercept the browser's Back button. After a direct link, Back leaves the site as it would on any other website.
- There is **no standalone quiz details page**, so the details UI is built once.
- Do not pick the URL mechanism yourself. Read the TanStack Router docs (e.g. route masking, search params) and propose an approach in the spec before building.
- The popup follows the dialog accessibility rules in section 8.

### Question types

- Supported: **single-choice**, **true/false**, and **multi-select** (select all that apply).
- **No free-text answers.** No typed answers, fill-in-the-blank, or short-answer questions, and no ordering or matching questions. Do not add them or code to support them (such as fuzzy matching). Creators still type titles, question text, and option text. Only the taker's answers are limited to choices.
- Trivia quizzes score each question from 0 to 1. Single-choice and true/false are 1 or 0. **Multi-select earns partial credit**: score = max(0, (correct options selected − wrong options selected) ÷ number of correct options), so a perfect answer is 1 and a question score is never negative. The quiz score is the sum divided by the number of questions. Result pages show which options were correct and the points earned for each question. This means anyone can learn a quiz's answers by submitting it once. That is a deliberate choice for a casual site, so do not add measures to hide answers after submission.
- Personality quizzes map each answer to an outcome and show the outcome with the most points. They use single-choice questions only for now (see stretch goal S5). **Ties are broken randomly, once, at submission.** The grading function ranks the outcomes by points, orders any tied outcomes randomly, and stores that final ranking on the result. Result pages always read the stored ranking and never recompute or re-randomize it, so a result looks the same every time it is viewed. The randomness happens server-side, never in client code.
- All grading and scoring, including multi-select, happens server-side.
- **Validation rules:**
  - Every quiz has at least 3 questions.
  - A creator cannot have two quizzes with the same title. Titles are compared after trimming, collapsing repeated whitespace, and ignoring capitalization, so "Capitals Quiz" and "capitals  quiz " count as the same. This applies when editing too. Different creators can use the same title. Enforce it with a unique index on the creator and the normalized title, and show an accessible error that links to the creator's existing quiz with that title.
  - Single-choice questions have at least 2 options and exactly 1 correct option.
  - True/false questions have exactly 2 options, True and False, with 1 correct.
  - Multi-select questions have at least 2 options, with at least 1 correct and at least 1 incorrect.
  - Personality quizzes have at least 2 outcomes. Every option maps to exactly 1 outcome and is worth 1, 2, or 3 points (default 1), so no single answer can swing the outcome too far. Trivia answers have no points setting: a correct answer is always worth 1. Every outcome is reachable from at least 1 option.
  - Every question must be answered before a quiz can be submitted. A multi-select question counts as answered once at least 1 option is selected. If any are unanswered, an accessible error message names them and links to each one.
  - The creation form checks these rules with Zod, and the server checks them again: the function that saves a quiz rejects invalid quizzes, and the grading function rejects submissions with unanswered questions. Limits on text length and on the number of questions and options are set in feature 2's spec.

## 2. Tech stack

Use only these. Do not add competing libraries in any category.

| Area | Choice |
| --- | --- |
| Framework | React + TypeScript (strict) + Vite |
| Styling | Ply CSS (see section 5) |
| Routing | TanStack Router (file-based routing) |
| Server state | TanStack Query |
| Forms | React Hook Form |
| Validation | Zod |
| Client state | Zustand |
| Backend | Supabase (Postgres, Auth, Storage, Edge Functions) |
| Unit/component tests | Vitest + React Testing Library |
| Lint/format | ESLint + Prettier |
| Package manager | npm |
| Hosting | Vercel (static front end only) |

**Not set up yet:** end-to-end testing. Do not add Playwright, Cypress, or similar unless asked.

**Hosting:** Vercel, for the static front end only. All server logic lives in Supabase, so do not use Vercel functions or add Vercel-specific packages, and never enable Vercel Analytics or Speed Insights (see the no-telemetry rule). Direct loads of any URL, including result links and quiz URLs, must serve the app, so all paths rewrite to `index.html` (via `vercel.json`). Vercel's free Hobby plan is for personal, non-commercial use only, so revisit hosting if the site ever earns money.

**Pre-approved dev dependencies:** `eslint-plugin-jsx-a11y` and `vitest-axe` (accessibility), `@tanstack/router-plugin` (Vite plugin for file-based routing), and the `supabase` CLI (approved in feature 0).

Never install any other library unless I have approved it for the current task.

## 3. Commands

Confirm exact script names in `package.json` before running.

```
npm run dev            # Vite dev server
npm run build          # Production build (tsc -b && vite build)
npm run preview        # Serve the production build locally
npm run lint           # ESLint
npm run typecheck      # TypeScript check of every tsconfig (tsc -b; all set noEmit)
npm run format         # Prettier (write)
npm run format:check   # Prettier (check only)
npm test               # Vitest, single run

npm run db:start       # supabase start: local Supabase stack (Docker)
npm run db:stop        # supabase stop
npm run db:reset       # supabase db reset: rebuild local DB from migrations + seed
npm run db:test        # supabase test db: pgTAP database tests (supabase/tests/)
npm run db:types       # regenerate src/types/database.types.ts from the local DB
npm run db:new -- <name>   # supabase migration new <name>
```

The Supabase CLI is a dev dependency, so outside npm scripts run it as `npx supabase …`. Never run commands that target a hosted project (`supabase link`, `db push`, `functions deploy`, or anything with `--remote`).

## 4. Project structure and code conventions

The structure is **type-based**, not feature-based.

```
src/
  components/
  pages/
  hooks/
  stores/       Zustand stores
  schemas/      Zod schemas
  lib/          Supabase client, query client, utilities
  types/        database.types.ts (generated) + app-level types
  routes/       File-based routes (thin files; routeTree.gen.ts is generated)
supabase/
  migrations/   SQL migrations (source of truth for schema)
  functions/    Edge functions (grading and submission, account deletion)
  templates/    Auth email templates (login code)
  tests/        pgTAP database tests (RLS)
  seed.sql
```

Conventions:

- TypeScript strict mode. **No `any`.** Use `unknown` and narrow, or define a proper type.
- Function components only. **Named exports**, no default exports. The exception is config files whose tools require a default export, such as `vite.config.ts` and `eslint.config.js`.
- Files: PascalCase for components (`QuizCard.tsx`), camelCase for hooks and utilities (`useQuizAttempt.ts`). Route files in `src/routes/` follow TanStack Router's naming instead (e.g. `__root.tsx`, `$quizId.tsx`).
- Routing is **file-based**: each file in `src/routes/` is a route. Keep route files thin. They declare the route, validate params and search params with Zod, and render a component from `pages/`.
- **Generated files** are committed and **never edited by hand**: the route tree (`src/routeTree.gen.ts` by default) and `src/types/database.types.ts`. Changes to them from adding routes or regenerating types are expected and always in scope. Exclude both from ESLint and Prettier. Changes to `package-lock.json` from installing an approved dependency are also in scope.
- Database row types come from `src/types/database.types.ts` (generated). Never hand-write types for database shapes. Zod schemas validate form input and data boundaries.
- All files use LF line endings, enforced by `.gitattributes` (`* text=auto eol=lf`) and Prettier. Never introduce CRLF.
- Keep code simple. Prefer clear and boring over clever.

## 5. Styling with Ply CSS

- Ply CSS is a **pure CSS library**: no JavaScript, no React components. The npm package is `ply-css`. Import the compiled stylesheet (`ply-css/dist/css/ply.min.css`), not the SCSS source, because Sass is not an approved dependency.
- **Before writing or changing any UI, read `node_modules/ply-css/PLY.md` and search `node_modules/ply-css/ply-classes.json`** for the classes and patterns you need. Use https://plycss.com/ for live examples when the local files are not enough. Do not guess class names or attributes, and do not fall back on Tailwind or other habits. Write custom CSS only when Ply has nothing suitable.
- The package also ships its own `CLAUDE.md`, written for work on Ply itself. Where it differs from this file, this file wins.
- Do not add Tailwind, CSS-in-JS, or another CSS framework.
- Ply documents conformance with WCAG 2.1 AA, but this project targets 2.2 AA (section 8). Do not assume Ply defaults meet our requirements. Verify contrast, focus styles, and touch targets, check the criteria added in 2.2 (especially 2.4.11 Focus Not Obscured and 2.5.8 Target Size, at least 24 by 24 CSS pixels), and override in our own CSS where needed.

## 6. Supabase rules

- Develop against the **local Supabase CLI stack**, not the hosted project.
- All schema and RLS changes are **migration files** in `supabase/migrations/`. Never rely on dashboard edits.
- You may write and test migrations locally. **Never apply migrations to production or any hosted project.** I review and apply them.
- Row-level security is enabled on every table. Quizzes are readable by everyone and editable only by their creator. Results follow the rules in section 1: no public listing, direct reads limited to the owner, and link access only through a function that looks up one exact ID. Write RLS tests for any new policy.
- **RLS controls rows, not columns.** Anything the public must not see lives in a separate table or behind column privileges: correct answers, the outcome each personality option maps to and its points, and quiz creators' user IDs. Only grading functions and the quiz's own creator can read answer keys and outcome mappings. Public quiz reads go through a view or column grants that omit the creator ID, while creators can still read their own quizzes in full.
- Regenerate `database.types.ts` after every schema change.
- **Where server logic lives:** Edge functions handle anything that needs secrets, request headers, or the service role key: grading and submission (including rate limiting) and account deletion. Database functions handle short operations that must be atomic: fetching a result by its exact ID and claiming a result. Scheduled cleanup uses Supabase Cron (`pg_cron`), defined in a migration, and runs plain SQL every 15 minutes to delete expired anonymous results and old rate-limiter rows.
- **Grading and answer checking happen server-side only**, in the grading edge function. Correct answers and scoring logic must never be sent to the browser before a submission is graded. This applies to personality quiz scoring too.
- The Supabase **anon key** is the only key allowed in front-end env vars. The **service role key** never appears in client code or in the repo.
- **Login emails** are sent by Supabase Auth. During development they land in the local stack's test inbox (its URL is shown by `supabase status`), so no real email is sent. The login email template is a file in `supabase/templates/`, referenced from `supabase/config.toml`, and it must show the code (`{{ .Token }}`), never a sign-in link (`{{ .ConfirmationURL }}`). Never configure SMTP or email settings on a hosted project. I set up the production email provider, Brevo, and its SMTP key lives only in the hosted Supabase settings, never in the repo.
- **Spam protection** is simple rate limiting, with three limits:
  - **Anonymous submissions** are limited inside the grading function, checked before grading. Store only a salted hash of the visitor's IP (the salt is a server-side secret, never in the repo), a count, and a window timestamp. Never store, log, or expose raw IPs, and never read the IP in client code.
  - **Member submissions** are limited the same way, keyed by user ID instead of an IP hash. Do not read or store a member's IP.
  - **Quiz creation** is limited per member, keyed by user ID, inside the function that saves a new quiz.

  For all three, the cleanup job (see "Where server logic lives") deletes limiter rows on its first run after their window ends, so no row outlives its window by more than 15 minutes. The limiter is for stopping spam only and is never used for analytics. No CAPTCHAs or third-party scripts. Before building the limiter, confirm from current Supabase docs which request header holds the real client IP in edge functions, and record it in the spec. Some headers, such as `x-forwarded-for`, can contain values the client supplied, so do not assume.

## 7. Hard rules

**Never:**

- Put answers or grading logic in client code.
- Commit secrets.
- Install a library I have not approved for the task.
- Commit directly to `main`. All work happens on branches.
- Deploy to production or change settings in the Vercel, Supabase, or Brevo dashboards. I do that. Editing `vercel.json` in the repo is allowed when a task needs it, such as for rewrites or headers.
- Modify files outside the current task's scope. Generated files and `package-lock.json` changes described in section 4 are the exception.
- Add analytics, telemetry, tracking, error-reporting services, or third-party scripts. This site collects no data beyond what accounts and saved content require.

**Always ask before:**

- Deleting files.
- Changing RLS policies.
- Modifying the auth flow.
- Adding any new user data field or collecting any new kind of user data. Keep it to the minimum the feature needs. Accounts store only what Supabase Auth requires, plus each member's settings (feature 5). The only other user content is saved results and created quizzes. Two exceptions are approved: short-lived rate-limiter rows (a hashed IP for anonymous visitors, or a user ID for members) used only for rate limiting (see section 6), and Brevo, the email provider that delivers login codes. Brevo receives a member's email address only to send a code, through its transactional SMTP relay. Members are never added to Brevo contact lists, open and click tracking are turned off, and Brevo is never used for marketing.

## 8. Accessibility (WCAG 2.2 AA)

Target **WCAG 2.2 AA**. This must not break site functionality or the visual design. Most of it is invisible (markup, keyboard support, labels) and the rest is mainly sufficient color contrast and visible focus indicators. If an accessibility requirement seems to conflict with a feature or the intended styling, **do not silently drop either one**. Flag the conflict and propose a solution that keeps both.

**Baseline, always on and never behind a setting:** semantic HTML, full keyboard operability, visible focus, labelled inputs, associated error messages, sufficient contrast, and screen reader announcements for dynamic changes.

Quiz-specific requirements:

- Answer choices are real radio buttons or checkboxes inside a `fieldset` with a `legend` containing the question.
- Manage focus when moving between questions and routes, and announce the change.
- Never rely on color alone (e.g. correct/incorrect needs an icon or text).
- Once question images exist (stretch goal S1), every image needs alt text. If audio or video is ever added, it needs captions.
- Provide a non-drag alternative for any drag-and-drop interaction. None are planned, since there are no ordering or matching question types.
- Any popup or dialog (such as the quiz details popup) moves focus into it when opened, keeps focus inside, closes with Escape, and returns focus to what opened it. Prefer the native `<dialog>` element, and check the Ply CSS docs for modal support.
- The login code field has a visible label, uses `autocomplete="one-time-code"` and `inputmode="numeric"`, and allows pasting. Announce when a code has been sent and when a code is rejected. If a code expires, the user can request a new one without leaving the page or losing their place.
- Respect `prefers-reduced-motion`, `prefers-contrast`, and `prefers-color-scheme`.

**Testing:** use role-based queries in React Testing Library, run `eslint-plugin-jsx-a11y`, and add `vitest-axe` checks to component tests. Automated checks catch only part of the problems, so also note any manual keyboard checks needed for the task.

## 9. Timers

- Timers are optional. A quiz has no timer unless the creator adds a **suggested time limit** during setup. Model it as an optional field.
- Before starting a quiz that has a suggested time, the taker chooses in the quiz details popup whether to take it **with or without the timer**. The timed option is pre-selected, honoring the creator's suggestion. The choice is made before the quiz starts, not during it. The timer is advisory and is never enforced server-side.
- The timer's start time is saved with the taker's progress, so a page reload continues the countdown instead of resetting it.
- When the timer reaches zero, announce that time is up and let the taker keep going. **Never auto-submit** or lock the quiz.
- Because takers can turn the timer off before starting, this satisfies WCAG's time-limit requirement. Keep the choice easy to find and keyboard accessible.
- Timer warnings must use live regions, not just visual changes.

## 10. Workflow and definition of done

Work from a spec for each task (see the template below). If a spec is missing or its acceptance criteria say TBD, **stop and ask** before building.

A task is complete only when:

- The app runs locally with no errors or console warnings, and all tests pass (`npm test` and `supabase test db`).
- Lint and type-check pass (`npm run lint` and `npm run typecheck`).
- The component matches **every** acceptance criterion in its spec.
- No files outside the task's scope were changed.
- The code is simple enough that I can explain every line.

### Spec template

```
Goal:
Acceptance criteria:
Files in scope:
Out of scope:
```

## 11. Features

Each feature has a status: Planned, In progress, or Done. Only work on the feature named in the current task. Acceptance criteria are filled in before work starts.

### Build order

Feature numbers are IDs, not the order of work. Build features in this order. Each one depends only on those before it, so do not start a feature until the ones before it are Done unless I say otherwise.

1. Project foundation (feature 0)
2. Authentication (feature 4)
3. Quiz search (feature 6), including the quiz details popup. Use quizzes from `seed.sql`. The popup's timer choice and start action are completed in feature 1.
4. Quiz creation (feature 2)
5. Quiz taking (feature 1)
6. User dashboard (feature 3)
7. Settings (feature 5)

### 0. Project foundation
- **Status:** Done
- **Goal:** Set up the project so features can be built on it: Vite, TypeScript, TanStack Router, TanStack Query, ESLint, Prettier, Vitest, the `typecheck` script, `.gitattributes`, the `vercel.json` rewrites, the local Supabase stack, and the core database schema and RLS for quizzes and results.
- **Spec:** [`specs/00-project-foundation.md`](specs/00-project-foundation.md) (acceptance criteria, files in scope, out of scope). Do not build from it until its status says Approved.

### 1. Quiz taking
- **Status:** In progress
- **Goal:** Anyone can take trivia and personality quizzes without an account. Each submission is graded server-side and produces a result link. This feature handles everything that happens at submission: a logged-in member owns their result immediately, while an anonymous result gets its 1-day expiry and its claim token (see section 1), which is issued, stored as a hash, and kept in the browser. Submissions are graded against the version the taker started on, even if the quiz was edited or deleted meanwhile, using 24-hour retired versions (see section 1). Submissions with unanswered questions are rejected, and in-progress answers survive a page reload (see section 1). Before starting, a quiz details popup (see section 1) shows the quiz's information and, if it has a suggested time, lets the taker choose to take it with or without the timer.
- **Spec:** [`specs/01-quiz-taking.md`](specs/01-quiz-taking.md) (includes the submission rate limits and the client IP header). Do not build from it until its status says Approved.

### 2. Quiz creation
- **Status:** Done
- **Goal:** Logged-in members can create quizzes, which are always public, with an optional suggested time limit. They can edit and delete their own quizzes without affecting existing results. Each edit increases the quiz's version (see section 1). Quizzes must meet the validation rules in section 1, including unique titles per creator, and creating quizzes is rate limited (see section 6). Questions are single-choice, true/false, or multi-select (see section 1).
- **Spec:** [`specs/02-quiz-creation.md`](specs/02-quiz-creation.md) (includes the text and count limits and the creation rate limit). Do not build from it until its status says Approved.

### 3. User dashboard
- **Status:** Planned
- **Goal:** Logged-in members see their saved quiz history and results, and the quizzes they have created. A member can also save a recent anonymous result to their account from its result page, but only in the browser that took the quiz, using the claim token issued in feature 1.
- **Spec:** [`specs/03-user-dashboard.md`](specs/03-user-dashboard.md) (includes "Save to my account" on the result page). Do not build from it until its status says Approved.

### 4. Authentication
- **Status:** Done
- **Goal:** Supabase Auth for members, using passwordless email login. The member enters their email address, receives a one-time code, and types it into the page they are on, then stays on that page once logged in. Signing up and logging in are the same flow, with no separate registration form. No passwords, no sign-in links, and no social or OAuth logins. Anonymous users can take quizzes but must log in to save results long term or create quizzes.
- **Spec:** [`specs/04-authentication.md`](specs/04-authentication.md). Do not build from it until its status says Approved. Any change to the auth flow beyond that spec needs asking first.

### 5. Settings
- **Status:** Planned
- **Goal:** A settings menu, reachable from every page, with:
  - **Theme:** System (the default, following `prefers-color-scheme`), Light, or Dark.
  - **Accessibility:** text size, high contrast, and a dyslexia-friendly font. High contrast defaults to following `prefers-contrast`.
  - **Account deletion**, shown only to logged-in members (see section 1).
- **Notes:** Theme and accessibility settings are available to everyone, including anonymous visitors, whose settings are stored only in the browser's local storage. Logged-in members' settings are also saved to their account, in one row per member that only they can read or write, so their settings follow them across devices. Every device keeps a local copy so settings can be applied before the first paint and the page never flashes the wrong theme. When a member logs in, their account settings replace the local ones. If they have never saved settings to their account, their current local settings are saved to it instead. Allowed values are checked with Zod and by database constraints. Use Ply's theme support for light and dark (check the Ply docs). Text size scales the root font size, so text sizes elsewhere must use `rem`, not fixed pixels. Any font for the dyslexia-friendly option must be self-hosted, never loaded from a third-party service, and needs my approval before it is added. Settings only add to the accessibility baseline in section 8 and never turn any of it off.
- **Spec:** [`specs/05-settings.md`](specs/05-settings.md) (includes the text sizes, the Lexend font, and account deletion). Do not build from it until its status says Approved.

### 6. Quiz search
- **Status:** Done
- **Goal:** Anyone can search the public quizzes and open a quiz's details popup (see section 1) from the results. Because all quizzes are public, this is how they are discovered.
- **Notes:** Search matches only quiz titles and descriptions. A quiz matches when enough of the search words appear in them (Postgres full-text search is the expected approach, and the threshold and ranking are set in the spec). There are **no user-picked tags or categories**. Do not add them.
- **Spec:** [`specs/06-quiz-search.md`](specs/06-quiz-search.md) (also covers the splash page and the quiz details popup's URL mechanism). Do not build from it until its status says Approved.

## 12. Stretch goals

Not part of the current scope. **Do not start, scaffold, or prepare for any of these** (no placeholder code, dependencies, tables, or abstractions) unless a task explicitly names one. Each needs a spec, and any new library needs my approval first. The notes below record constraints so future work stays compatible with the rest of this file.

### S1. Images in quiz questions
- **Status:** Idea
- **Goal:** Creators attach images to questions using links from a short allowlist of trusted image hosts (e.g. imgur, imgchest) rather than us hosting files.
- **Constraints:**
  - The host allowlist lives in one place and is enforced in validation (Zod) and, where possible, in the Content-Security-Policy, not only in the UI.
  - Alt text is required for every image (see section 8).
  - Third-party hosts can see viewers' IP addresses when images load. Keep this in mind given the no-tracking rule.
  - Supabase Storage is the alternative if we host images ourselves. Ask before choosing it.
- **Decisions needed:** Pasted links vs in-app upload, which hosts, and whether images can be reported or moderated.

### S2. PWA / offline mode
- **Status:** Idea
- **Goal:** An installable app with limited offline use.
- **Constraints:**
  - This conflicts with server-side grading. Offline devices cannot grade, and answer keys must never be cached on the device. Realistic scope is caching the app shell and already-loaded question text, queueing submissions, and showing results once back online.
  - The service worker must never cache private API responses or session data unsafely.
  - A service worker library (e.g. vite-plugin-pwa) needs my approval.
  - Connectivity changes must be announced accessibly (live region).
- **Decisions needed:** Installable only vs offline quiz taking, and which content is available offline.

### S3. AI quiz generation and tagging
- **Status:** Idea
- **Goal:** A creator enters a topic and gets a draft quiz. AI also assigns tags to quizzes automatically. Users never pick tags.
- **Constraints:**
  - The AI provider's API is called only from a Supabase Edge Function. The API key is a server-side secret, never in client code or the repo.
  - Output is validated with Zod and treated as a **draft**. The creator reviews and edits before publishing. Generated answer keys stay server-side like any other.
  - Logged-in members only, with rate limits or usage caps to control cost and abuse.
  - Tags are generated server-side by AI and never chosen or typed by users. There are no tags until this goal exists. Once they do, search and suggestions (S4) may use them.
  - Send only the topic or quiz content and generation settings to the provider, never account or user data.
- **Decisions needed:** Provider and model, usage limits, whether generated quizzes are labeled as AI-generated, whether every quiz gets AI tags or only AI-generated ones, and whether creators can see or remove tags.

### S4. Search suggestions and popular quizzes
- **Status:** Idea
- **Goal:** Add suggestions to the search page: lists of **popular this week** and **popular all-time** quizzes, and optionally search autocomplete.
- **Constraints:**
  - No behavior tracking. Suggestions come from quiz content (titles, descriptions, or AI-generated tags if S3 exists) or aggregate play counts, never from per-user history or analytics.
  - Popularity uses a **server-side play count** per quiz, incremented by the grading function each time a result is submitted. Clients can never write it.
  - A single running total cannot produce a weekly list. Store aggregate counts per quiz per day (quiz ID, date, count) with no user identifiers. All-time is the sum of all days, and weekly is computed from recent days. Do not derive counts from the results table, because anonymous results expire after 1 day.
  - Counts can still be inflated by spam, so rely on the rate limiting in section 6 and never count submissions the limiter rejects.
  - The suggestion UI must be accessible (e.g. a combobox with correct roles and keyboard support for autocomplete, and clear headings for each list).
  - Ask before adding any other counters or stored data.
- **Decisions needed:** Whether "this week" is a rolling 7 days or a calendar week, how many quizzes each list shows, and whether to include autocomplete.

### S5. Personality quiz upgrades
- **Status:** Idea
- **Goal:** Personality quizzes can use multi-select questions, and creators choose whether the quiz shows a single result or several (up to 5, ranked by points).
- **Constraints:**
  - Multi-select in a personality quiz needs a scoring rule (for example, each selected option adds its points to its mapped outcome). Do not guess. Get the rule in the spec.
  - Scoring is server-side, like all grading.
  - Version 1 personality scoring already computes points per outcome (to find the winner and break ties) and stores the full ranking on the result, so this goal should need only display, creator-setting, and validation changes.
  - The number of results shown is a creator setting from 1 to 5 (default 1) and cannot exceed the quiz's number of outcomes.
  - The result page presents several results accessibly (an ordered list with clear headings).
- **Decisions needed:** Confirm that "multiple results" means the top N outcomes taken from the stored ranking (ties already broken at submission), and the multi-select scoring rule.

### S6. Moderation and reporting
- **Status:** Idea
- **Goal:** A way for people to report abusive or inappropriate quizzes, and for me to review and remove them.
- **Constraints:**
  - Until this goal exists, there is no reporting feature. I remove quizzes manually through the Supabase dashboard if needed.
  - Removing a quiz never changes existing results, because results store snapshots (see section 1).
  - Store the minimum needed to act on a report. Anything stored about reports or reporters is new user data and needs my approval (see section 7).
  - Any report UI follows the accessibility rules in section 8.
- **Decisions needed:** A report button or a contact address, what a report stores, whether reporting requires an account, whether to build an admin view or keep using the Supabase dashboard, and what people see when a quiz has been removed.

## 13. Open decisions

Ask me before assuming any of these:

- The rate limit numbers: how many anonymous submissions, member submissions, and new quizzes are allowed per window, and how long each window lasts. Submission limits are set in feature 1's spec, and the creation limit in feature 2's.
- Which URL mechanism the quiz details popup uses (to be proposed in its spec).
- How many of the search words a quiz must match, and how search results are ranked.
- Login code length and expiry. Use the Supabase defaults unless I decide otherwise.

## Agent skills

### Issue tracker

Issues live as GitHub issues in igl-myrick/quiz-maker-v2 (uses the `gh` CLI). See `docs/agents/issue-tracker.md`.

### Triage labels

Default five-role vocabulary (needs-triage, needs-info, ready-for-agent, ready-for-human, wontfix), used as-is. See `docs/agents/triage-labels.md`.

### Domain docs

Single-context layout: one `GLOSSARY.md` and `docs/adr/` at the repo root. See `docs/agents/domain.md`.