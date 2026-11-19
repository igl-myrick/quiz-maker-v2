# Change 9: Log in with Google or GitHub

Status: **Draft** (2026-11-19). Do not build from it until this says Approved. It changes feature 4 (authentication), which is Done, and depends on every feature before it. Rules come from `CLAUDE.md` (feature 4, §6 "Login providers", §7 and §8). The reasons are in `docs/adr/0004-oauth-login-instead-of-email-codes.md`. Domain terms come from `GLOSSARY.md`.

## Goal

Members log in with their Google or GitHub account instead of a code sent by email, because the project can't use an SMTP provider. Login goes through Supabase Auth's built-in OAuth support, so members are still ordinary Supabase Auth users, and the database, RLS, claiming, settings sync and account deletion don't change.

Logging in now leaves the page: the tab goes to Google or GitHub and comes back to the same URL. The app then puts focus back where it was and announces "You're logged in", so the experience matches today's as closely as a redirect allows. Logging in and signing up are still the same flow. There are still no passwords and no email links.

## Acceptance criteria

### The login popup

1. The login popup keeps the dialog shell from feature 4 (criterion 4) and feature 7 (P3.3): native `<dialog>`, the accessible name "Log in or sign up", the close button, Escape, focus moving in on open and returning to the opener on close.
2. Its body has:
   - the heading "Log in or sign up"
   - the line "Use your Google or GitHub account. No password needed."
   - two full-width buttons, "Continue with Google" and "Continue with GitHub", in that order. Focus moves to "Continue with Google" when the popup opens.
   - the line "We only use your email address to keep your account. Your name and picture from Google or GitHub are never shown or shared."

   The buttons are real `<button>`s with visible text, at least 24×24, and use no provider logo images or third-party scripts. A small provider mark in our own CSS or inline SVG is allowed if it has `aria-hidden="true"` **(call)**.
3. Pressing a button:
   - saves the return state (criterion 6) in session storage
   - shows "Opening Google…" or "Opening GitHub…" on that button and disables both buttons, so a double click can't start twice
   - calls `supabase.auth.signInWithOAuth({ provider, options: { redirectTo: <origin>/auth/callback } })`. Supabase then sends the tab to the provider.
4. If `signInWithOAuth` itself fails (for example the network is down), the popup stays open, shows "Something went wrong. Please try again." in a `role="alert"` paragraph, re-enables the buttons and focuses the button that was pressed. The saved return state is removed.
5. The email field, the code field, "Send code", "Send a new code", "Use a different email", and their schemas, mutations and messages are removed. `src/schemas/login.ts` is deleted.

### Return state and the callback route

6. **Return state** is one session storage entry, `auth:return`, holding `{ path, focusId }`:
   - `path` is the current path plus search string (`location.pathname + location.search`). It never includes the origin, so it can only point back into this site.
   - `focusId` is the `id` of the element to focus after logging in (criterion 9). It is optional.

   It never holds a claim token, a session, or anything about the member. Session storage survives the round trip because the redirect happens in the same tab, and it is gone if the tab closes.
7. A new route, `src/routes/auth.callback.tsx` (`/auth/callback`), renders a page with the `<h1>` "Logging you in…" and does the rest from a single handler, not from the auth listener:
   - It reads `code`, `error` and `error_description` from the URL with a Zod search-param schema.
   - With a `code`, it calls `supabase.auth.exchangeCodeForSession(code)`.
   - It reads and removes `auth:return`, then navigates to `path` with `replace: true`, so the callback URL is not left in history. Without a saved path, or with one that doesn't start with a single `/`, it goes to `/`.
8. The Supabase client uses the PKCE flow and does not read the URL itself: `createClient(url, anonKey, { auth: { flowType: 'pkce', detectSessionInUrl: false } })`. Only the callback route exchanges a code **(call)**. This keeps `code` and `error` out of every other route's search params.

### After coming back

9. **On success**, once the page at `path` has rendered:
   - focus moves to the element with `focusId` if it is on the page, otherwise to the header's auth button, which now reads "Log out"
   - "You're logged in" is announced once, through the app-level Announcer
   - the root route's page-change rule (focus the `<h1>` and announce it) does not also run for this navigation. The builder reuses `src/lib/returnFocus.ts` or extends it, rather than adding a second mechanism.
10. **On failure** (an `error` in the URL, or a failed exchange), the person is taken back to `path` still logged out, focus moves to the header's "Log in" button, and one message is announced:
    - the provider's `access_denied` (the person cancelled): "Login cancelled. You're still logged out."
    - anything else, including a GitHub account with no verified email: "Couldn't log you in. Please try again."

    The error text from the provider is never shown or logged.
11. Existing focus targets keep working:
    - The header button (`SiteHeader`) is the default target, as today.
    - "Log in to save this result" (`SaveResultSection`) passes its own button's id, so after logging in focus lands on the same button, now reading "Save to my account". Saving is still a separate press.
    - `QuizEditorPage` replaces `onLoggedIn={() => headingRef.current?.focus()}` with the id of its `<h1>`.
    - `TakePage`'s "You've been logged out. Log in to submit." keeps a plain `LoginButton`, and focus goes to the header button. The take, its page and the timer's start time survive in session storage (feature 1), so the person presses Submit again.

    `LoginButton`'s and `LoginDialog`'s `onLoggedIn` prop is replaced by an optional `returnFocusId` **(call)**, because a callback can't survive the redirect.

### Accounts

12. Google and GitHub are the only providers. A member's account is keyed on their verified email address. Supabase links identities with the same verified email automatically, so a member who uses Google one day and GitHub the next (with the same email) gets the same account, results and quizzes. The builder confirms this from current Supabase docs and records the result in this spec's build notes.
13. Supabase Auth stores the provider's profile (name, avatar URL and similar) in `auth.users.raw_user_meta_data` and `auth.identities.identity_data`. This is an approved exception (`CLAUDE.md` §7): **no app code, migration, function, view or query reads, displays, copies or logs these fields.** The header and every page still show no email, name, avatar or other account identifier.
14. Logged-in state, the auth store and the listener don't change: `exchangeCodeForSession` fires `SIGNED_IN`, which already invalidates `['me']` queries and runs the settings sync (feature 5). Logging out is unchanged.

### Local config

15. In `supabase/config.toml`:
    - `[auth.external.google]` and `[auth.external.github]` are enabled, with `client_id` and `secret` read through `env(...)`. The values live in a gitignored env file that the Supabase CLI reads. The builder confirms which file from current docs, adds it to `.gitignore` if needed, and adds a matching `*.example` file with empty values.
    - `site_url` and `additional_redirect_urls` match the Vite dev server's origin (both `localhost` and `127.0.0.1` forms) and its `/auth/callback` path.
    - Email sign-in is turned off (`[auth.email] enable_signup = false`, and any other key current docs require), the two `[auth.email.template.*]` blocks are removed, and the OTP settings added in feature 4 (`max_frequency`, the raised `email_sent` limit) go back to their defaults or are removed.
16. `supabase/templates/login-code.html` is deleted, and so is `supabase/templates/` if it is then empty.
17. To try it locally, the project owner registers a Google OAuth client and a GitHub OAuth app whose callback is the local stack's `http://127.0.0.1:54321/auth/v1/callback`, and puts their IDs and secrets in the env file. The builder writes these steps in the build notes. Nothing is configured on a hosted project.

### Tests

18. Component tests use role-based queries and a mocked `src/lib/supabase`, with a `vitest-axe` check in each file:
    - The mock stubs `signInWithOAuth` and `exchangeCodeForSession` and drops `signInWithOtp` and `verifyOtp`.
    - `LoginDialog.test.tsx` covers: focus on "Continue with Google" when opened; each button calls `signInWithOAuth` with its provider and the callback URL; return state saved with the current path and `focusId`; both buttons disabled while pending; a failed call shows the alert, keeps the popup open and removes the return state.
    - A callback test covers: success navigates to the saved path with `replace`, focuses the `focusId` element and announces once; a missing or unsafe path goes to `/`; `access_denied` and other errors announce the right message and leave the person logged out; the return state is removed in every case.
    - The OTP tests in `LoginDialog.test.tsx` and any OTP mocks in other test files are removed or updated.
19. `npm test`, `npm run lint`, `npm run typecheck`, `npm run format:check` and `npm run db:test` pass, and the browser console shows no warnings.

## Packages

None. `signInWithOAuth` and `exchangeCodeForSession` are part of `@supabase/supabase-js`, which is already installed.

## Files in scope

```
specs/09-oauth-login.md                  # this spec (build notes)
src/lib/supabase.ts                      # PKCE, detectSessionInUrl: false
src/lib/authReturn.ts (+ .test.ts)       # new: save/take the auth:return entry
src/lib/returnFocus.ts                   # only if criterion 9 needs it
src/components/LoginDialog.tsx (+ .test.tsx)
src/components/LoginButton.tsx
src/components/SiteHeader.tsx (+ .test.tsx)
src/components/result/SaveResultSection.tsx (+ .test.tsx)
src/pages/QuizEditorPage.tsx (+ .test.tsx)
src/pages/AuthCallbackPage.tsx (+ .test.tsx)   # new
src/routes/auth.callback.tsx                    # new
src/routes/__root.tsx                    # only if criterion 9 needs it
src/routeTree.gen.ts                     # generated
src/schemas/login.ts                     # delete
src/styles/*.css                         # login buttons, only where Ply lacks something
*.test.tsx files that mock signInWithOtp/verifyOtp   # mock updates only
supabase/config.toml
supabase/templates/login-code.html       # delete
.gitignore, supabase/<env file>.example
```

Deleting `src/schemas/login.ts`, `supabase/templates/login-code.html` and the `supabase/templates/` folder is approved as part of approving this spec.

## Out of scope

- Any provider other than Google and GitHub, and any choice of OAuth scopes beyond Supabase's defaults.
- Reading or showing the member's name or avatar anywhere, including a "Logged in as" line.
- Opening the provider in a popup window instead of redirecting the tab (considered in ADR 0004).
- Database changes. No migrations, RLS or pgTAP changes are expected. If one turns out to be needed, stop and ask.
- Account deletion, the settings sync, claiming and the submit-quiz function, apart from the focus change in criterion 11.
- Anything on a hosted project: the hosted Google and GitHub providers, the production redirect URL allowlist (including Vercel preview URLs), and turning off hosted email sign-in. The project owner does these.

## Where to look when reviewing

- **`src/lib/authReturn.ts`:** the only code that touches `auth:return`. Check that `path` can't hold another origin (`//evil.example` must fall back to `/`).
- **`src/pages/AuthCallbackPage.tsx`:** one handler, run once. Check it doesn't exchange the code twice under React's Strict Mode double effects, and that every path removes the return state.
- **`src/components/LoginDialog.tsx`:** no leftover OTP state. Request state comes from the mutation, not extra `useState`.
- **Nothing reads profile data:** search for `user_metadata`, `identity_data`, `avatar` and `full_name`. There should be no hits outside generated types.

## Manual checks

- **Keyboard only:** from a result page while logged out, press "Log in to save this result", choose a provider, finish the provider's screens, and confirm focus lands on the same button, now "Save to my account".
- Repeat from the header, the quiz editor's login prompt, and a take's "Log in to submit" message. On the take, confirm your answers and the timer are kept.
- Cancel at the provider's screen and confirm "Login cancelled" is read and you're on the page you started from.
- **Screen reader** (NVDA or Narrator): "You're logged in" and "You're logged out" are each read once, and the page heading isn't read as well after logging in.
- Log in with Google, log out, log in with GitHub using the same email, and confirm the dashboard shows the same results.
- Press Back after logging in and confirm you don't land on a broken `/auth/callback` page.
- Reload while logged in and confirm you stay logged in.

## Build notes

_To be filled in while building: the env file the CLI reads, the local provider setup steps (criterion 17), and confirmation of automatic identity linking (criterion 12)._
