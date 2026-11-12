# Feature 4: Authentication

Status: **Approved** (2026-11-10). It depends on feature 0 being Done. Rules come from `CLAUDE.md` (feature 4, §6 "Login emails", and §8). Domain terms come from `GLOSSARY.md`.

## Goal

Members log in with a one-time code sent to their email, through a login popup that opens on whatever page they're on. Logging in and signing up are the same flow. When it succeeds, the popup closes and the member is still on the same page, now logged in. There are no passwords, no sign-in links, and no social or OAuth logins.

## Acceptance criteria

### Entry points

1. A minimal site header appears on every page. It holds the site name, which links home, and an auth button. The header never shows the member's email or any other account identifier.
2. The header's auth button is **one element that stays on the page** **(call)**. Its label and action switch between "Log in" (anonymous visitor) and "Log out" (member). Because it never unmounts, focus can return to it after the popup closes, and after a successful login focus lands on the same button, which now reads "Log out".
   - Until Supabase reports the first session state, the button area shows nothing, while keeping its space so the header doesn't jump. This stops a logged-in member from briefly seeing "Log in" on every reload **(call)**.
   - A reusable `LoginButton` accepts its own label, so feature 3 can render "Log in to save this result" on a result page. Whoever renders a `LoginButton` keeps it mounted until its dialog has closed. That button is not added here.
3. "Log out" signs the member out and leaves them on the same page, with the button back to "Log in". Logging out is announced to screen readers ("You're logged out").

### The login popup

4. The popup is a native `<dialog>` opened with `showModal()` from the button's click handler. It follows the dialog rules in `CLAUDE.md` §8:
   - Focus moves into the dialog when it opens. The open handler calls `showModal()` and then focuses the email field directly. React's `autoFocus` won't work here, because the field mounts while the dialog is closed.
   - Focus stays inside while it is open. The modal makes the rest of the page inert. The browser's own controls are still reachable, which is acceptable.
   - Escape and a visible close button both close it.
   - Focus returns to the button that opened it, which is still on the page (criterion 2).
   - It has an accessible name, "Log in or sign up".

   Resetting the dialog happens in its `close` event handler, which fires for Escape and for the close button. Before building, check Ply's docs for its dialog or modal support and use it.
5. **Step 1, email:**
   - a labelled email field
   - the heading "Log in or sign up"
   - the line "We'll email you a code. No password needed."
   - a "Send code" button

   The email is validated with Zod. An invalid email shows an inline error linked to the field with `aria-describedby`, and focus moves to the field. Submitting calls `supabase.auth.signInWithOtp({ email, options: { shouldCreateUser: true } })`.
6. **Step 2, code:**
   - "Code sent to <email>." is announced in a live region.
   - The code field has the visible label "Code from your email", `autocomplete="one-time-code"`, `inputmode="numeric"`, and allows pasting.
   - It has a "Log in" button, a "Send a new code" button, and a "Use a different email" button that returns to step 1 with the email kept.

   Submitting calls `supabase.auth.verifyOtp({ email, token, type: 'email' })`. Focus moves to the code field when step 2 appears.
7. **On success**, the popup closes, the page stays where it is with nothing reloaded or navigated, the header switches to "Log out", and "You're logged in" is announced.
8. **Errors** are shown in the popup, announced, and never close it. The person stays on the same step:
   - **Wrong or expired code:** "That code didn't work or has expired. Check it or send a new code." The code field is cleared and focused.
   - **Too many requests:** Supabase's rate-limit error is shown in plain words ("Please wait a minute before asking for another code"). There is no countdown timer.
   - **Network or unexpected error:** "Something went wrong. Please try again."
9. **"Send a new code"** calls `signInWithOtp` again for the same email, announces "New code sent", and keeps the person on step 2. This satisfies the "request a new code without leaving the page or losing their place" rule in `CLAUDE.md` §8.
10. Closing and reopening the popup starts again at step 1 with empty fields.
11. Buttons are disabled while a request is in flight, so a double click can't send twice. The person is told what's happening ("Sending…", "Checking…"). If the popup is closed while a code is being checked and the check then succeeds, the member is simply logged in and "You're logged in" is announced **(call)**. Closing is never blocked.
11a. **Announcements** go through one app-level live region, `src/components/Announcer.tsx`, rendered once in the root route so it is already on the page before any message arrives. A tiny store (`src/stores/announcerStore.ts`) exposes `announce(message)`. Announcements are made from event handlers (send, verify, log out), and later from timer callbacks (feature 1), never from the auth listener. The listener also fires on token refresh and on logins in other tabs, which shouldn't be announced. Step-level messages inside the dialog ("Code sent", errors) may use a live region inside the dialog, since it stays open while they're shown.

### Login state

12. **One place owns login state:** a Zustand store, `src/stores/authStore.ts`, holding the current session (or null).
    - The state is `{ status: 'loading' }` until the first auth event, then `{ status: 'ready', session }`, where `session` may be null.
    - It is set up **once at module load**, with a single `supabase.auth.onAuthStateChange` subscription. Its `INITIAL_SESSION` event replaces a separate `getSession()` call. It is not set up inside a component effect.
    - In development, `import.meta.hot?.dispose` unsubscribes, so hot reload doesn't stack up listeners.
    - Components read it through selector hooks such as `useSession()`. Login state is never passed down as a prop.
13. On `SIGNED_IN` and `SIGNED_OUT`, the listener invalidates the `['me', …]` TanStack Query keys, so member-only data refetches. Invalidation is deferred with `setTimeout(…, 0)`, because Supabase warns that making Supabase calls inside the callback can deadlock. In this feature it is a no-op hook point, because no `['me']` queries exist yet.
14. A logged-in member stays logged in across page reloads and new tabs. This uses Supabase's default session storage, with no custom persistence.

### Email and local config

15. `supabase/templates/` contains the login email templates. Each one shows the code (`{{ .Token }}`), never a sign-in link (`{{ .ConfirmationURL }}`), and says the code expires.
    - `signInWithOtp` sends either the **confirmation** template (`[auth.email.template.confirmation]`) or the **magic link** template (`[auth.email.template.magic_link]`), depending on whether the member is new and whether email confirmation is on. Both are therefore set to code-only templates in `supabase/config.toml`.
    - The builder confirms the keys against current Supabase docs for the installed CLI version. Template changes need `npm run db:stop` and `npm run db:start` to take effect.
16. In `supabase/config.toml`:
    - Email OTP sign-in is enabled.
    - Code length and expiry stay at Supabase's defaults (`CLAUDE.md` §13).
    - The minimum time between codes for one email is set to 60 seconds (`max_frequency`) to match hosted Supabase's default **(call)**, so the "too many requests" message can be tested locally.
    - The hourly email-send limit is raised for comfortable testing, for example to 30 per hour.

    Nothing is configured for a hosted project, and no SMTP is configured.
17. Logging in as either seeded test member from feature 0, using a code from the local test inbox (`supabase status` shows its URL), works end to end.

### Tests

18. Component tests use role-based queries and a mocked `src/lib/supabase`. Each test file includes a `vitest-axe` check.
    - The mock stubs `signInWithOtp`, `verifyOtp`, `signOut` and `onAuthStateChange`, captures the listener so tests can fire auth events, and resets the auth store between tests.
    - jsdom has no real `showModal()`, focus trap, Escape handling or focus return, so the test setup adds a minimal `showModal`/`close` stub on `HTMLDialogElement`. Real dialog behaviour is covered by the manual checks.

    They cover:
    - opening the popup puts focus in the email field, and the close event resets it to step 1
    - invalid email → error linked to the field
    - email → code step, with "Code sent" announced
    - wrong code → error announced, field cleared and focused, popup still open
    - "Send a new code" → announced, and still on step 2
    - success → popup closed, header shows "Log out", and "You're logged in" announced through the Announcer
    - logging out → header shows "Log in"
    - while auth is still loading, the header shows no auth button
    - the header never renders the member's email
19. `npm test`, `npm run lint`, `npm run typecheck` and `npm run db:test` pass, and the browser console shows no warnings.

## Packages

These packages need approval as part of approving this spec. Install nothing else.
- `react-hook-form`, `zod` and `zustand`, from the approved stack in `CLAUDE.md` §2
- `@hookform/resolvers`, React Hook Form's official adapter for Zod

## Files in scope

```
src/components/SiteHeader.tsx (+ .test.tsx)
src/components/LoginButton.tsx           # button + its own LoginDialog
src/components/LoginDialog.tsx (+ .test.tsx)
src/components/LogoutButton.tsx
src/stores/authStore.ts                  # session store + useSession selector
src/stores/announcerStore.ts             # announce(message)
src/components/Announcer.tsx             # the one app-level live region
vitest.setup.ts                          # HTMLDialogElement stub
src/schemas/login.ts                     # Zod: email, code
src/routes/__root.tsx                    # render SiteHeader
src/styles/*.css                         # only if Ply lacks something (focus, target size)
supabase/templates/*.html
supabase/config.toml
package.json, package-lock.json
CLAUDE.md (feature 4 status only)
```

## Out of scope

- The "Save to my account" (claim) button and claiming (feature 3). This feature only provides `LoginButton` with a custom label.
- The dashboard and any header link to it (feature 3), and the settings menu (feature 5).
- Account deletion (feature 5).
- Any change to code length or expiry, any SMTP or Brevo setup, and anything on a hosted project.
- Protecting routes or redirecting anonymous visitors. No member-only pages exist yet.
- A countdown timer for resending codes.

## Where to look when reviewing

This is the feature most at risk of the problems you want to catch: extra effects, duplicated state, and prop drilling.

- **`src/stores/authStore.ts`:** the only place login state lives.
  - It subscribes to Supabase exactly once, at module level. Check that it doesn't subscribe again inside a component or on every render.
  - Nothing else stores a copy of the session or an `isLoggedIn` flag. Anything like that should be derived from the session.
- **`src/components/LoginDialog.tsx`:**
  - The only local state is which step is showing (`'email' | 'code'`) and the email being used.
  - Field values live in React Hook Form, not `useState`.
  - Request state ("Sending…", errors) comes from the form's or the mutation's own status, not extra `useState` flags.
  - It has no `useEffect`. Opening and closing happen in event handlers through the dialog ref. Focus moves in the open handler, and step 2's field can use `autoFocus` because it mounts while the dialog is already open. The reset happens in the `close` event.
- **`src/stores/announcerStore.ts` and `Announcer.tsx`:** one live region for the whole app, called from event handlers only.
- **`src/components/SiteHeader.tsx`:** it reads `useSession()` directly and receives no auth props.
- **The code input:** check `autocomplete`, `inputmode`, the label, and that pasting works.

## Manual checks

- **Keyboard only:**
  - Tab to "Log in", press Enter, complete both steps, and confirm focus lands on the same header button, now reading "Log out".
  - Repeat, and press Escape at each step.
- **Screen reader** (NVDA or Narrator): confirm that "Code sent", errors, "You're logged in" and "You're logged out" are each read once.
- Paste a 6-digit code from the local inbox into the code field.
- Request two codes back to back and confirm the rate-limit message is shown.
- Reload while logged in and confirm you stay logged in.
