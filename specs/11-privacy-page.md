# Change 11: Privacy page

Status: **Approved** (2026-11-20). It is built on the branch `feature/11-privacy-page`. It is a pre-deploy change. It adds one public page and two links, and it collects, stores and changes no data. Rules come from `CLAUDE.md` (§1, §6, §7 and §8).

## Goal

Google won't publish the app's OAuth consent screen (so that anyone, not just listed test users, can log in with Google) without a privacy policy link on the same site as the app's home page. Beyond that, people who log in should be able to read, in plain language, what the site keeps about them, for how long, and how to remove it.

The site already has strict data rules (CLAUDE.md §1, §6 and §7), so the page mostly describes what the code already does. It must be **accurate**: every statement on it is checked against the code, the migrations or the running app before it ships, and nothing on it promises more than the site does.

This page is written by the project owner and the builder, not a lawyer, and isn't legal advice. If the site ever earns money or targets a particular country's users, revisit it (see "Calls for the owner").

## Acceptance criteria

### The page

1. A new route at `/privacy` (`src/routes/privacy.tsx`) renders `PrivacyPage` from `src/pages/PrivacyPage.tsx`. The route file stays thin (CLAUDE.md §4). The page title is "Privacy · Quiz Maker", following the existing `<title>` pattern.
2. Anyone can open it, logged in or not, and it loads no data: no Supabase calls, no queries and no stores.
3. Its text is the wording in "Page text" below, with the date and contact filled in from the owner's calls. Changing the meaning of any sentence needs the owner's approval. Fixing a statement the builder finds to be inaccurate (criterion 10) is required, but the builder flags each fix in the build notes.
4. Structure: one `<main>` with an `<h1 tabIndex={-1}>Privacy</h1>`, so the existing page-change focus and announcement work (CLAUDE.md §8). Each section is an `<h2>`, lists are real `<ul>` lists, and the "Last updated" date is a `<time dateTime="…">`.
5. It uses Ply CSS and the existing `--qm-*` tokens and shared pieces (feature 7), with a readable line length. The builder reads `node_modules/ply-css/PLY.md` and `ply-classes.json` first and writes custom CSS only if Ply has nothing suitable. Text sizes use `rem` so the text size setting applies.

### Links to it

6. **A site footer.** The root layout (`src/routes/__root.tsx`) gets a `<footer>` after the page content, on every page, with one link: "Privacy". It's a TanStack Router `<Link to="/privacy">` with visible focus and a target of at least 24×24 CSS pixels. The footer is small and quiet, in the site's existing style. It must not cover content or the focused element at any text size (WCAG 2.4.11), so it sits in the normal page flow, not fixed to the bottom of the screen.
7. **The login popup.** The existing line "We only use your email address to keep your account. Your name and picture from Google or GitHub are never shown or shared." gets a link after it: "Read the privacy page". The builder checks how following it affects the open `<dialog>` (it must close, and focus must land on the privacy page's `<h1>` like any other page change). If that can't be done without changing the dialog's behaviour, drop this link and say so in the build notes rather than changing the dialog.

### Tests and checks

8. `src/pages/PrivacyPage.test.tsx`: the page has one `h1` "Privacy" and the expected `h2` sections, found by role; the GitHub issues link is present, with an accessible name that says where it goes; it passes `vitest-axe`. `SiteHeader`/root and `LoginDialog` tests are updated only as far as the new links need, using role-based queries.
9. `npm run lint`, `npm run typecheck`, `npm test`, `npm run db:test` and `npm run build` pass, and the app runs with no console errors or warnings.
10. **Accuracy check.** For each statement in "Page text", the builder confirms it against the source and writes one line per section in the build notes saying how. In particular, the builder checks and corrects the wording if needed for:
    - what Supabase Auth keeps for a logged-in user on the local stack: the `auth.users` and `auth.identities` columns for a Google or GitHub login, and whether `auth.audit_log_entries` records IP addresses
    - that the site sets no cookies of its own (the browser's storage view on the local build, logged out and logged in)
    - every browser storage key the app uses (local and session storage) and when each is removed
    - the retention times: anonymous results (1 day), retired quiz versions (24 hours), rate-limit rows (window plus up to 15 minutes)
11. **Manual checks:** the footer and the page at every text size and in light, dark and high contrast; Tab reaches the footer link after the page content; the page reads correctly with a screen reader (headings list, lists, link names).
12. **Owner, after deploying:** paste `https://<production-domain>/privacy` into Google Auth Platform → Branding → Application privacy policy link, then publish on the Audience page. The builder writes this step in the build notes.

## Page text

Draft wording. `[call]` marks the owner's choices.

> # Privacy
>
> Last updated: `[date the page ships]`
>
> Quiz Maker is a small, free quiz site. It keeps as little about you as it can, and never sells or shares it. This page explains what it keeps and for how long.
>
> ## If you don't log in
>
> - You can take any quiz without an account.
> - Your result is saved on the server so it has a link you can share. It's deleted automatically after 1 day.
> - To stop spam, the site counts how many quizzes are sent from your internet connection each hour. It doesn't keep your IP address: it stores a scrambled version (a salted hash) that can't be turned back into it, and deletes it about an hour later.
>
> ## If you log in
>
> You log in with Google or GitHub. The site never sees or stores a password.
>
> - **Your account:** your email address and an ID from Google or GitHub, so you can log in again. Google and GitHub also send your name, username and profile picture. The site removes your name and username from your account as soon as they arrive. The link to your picture is kept, but the site never shows, uses or shares it.
> - **Login records:** while you're logged in, the login system keeps your IP address and the type of browser you use with your login session, until you log out. It also keeps a security log of sign-ups, logins and logouts, which records your email address, the name Google or GitHub sent when you signed up, and sometimes your IP address. This log is kept by Supabase, which runs the site's logins.
> - **Your results:** kept until you delete your account, so you can see them in your dashboard.
> - **Quizzes you make:** public, so anyone can find and take them. Your name and account aren't shown with them.
> - **Your settings:** theme, text size, contrast and font, so they follow you to other devices.
> - **Spam limits:** the site counts how many quizzes you submit and create each hour, using your account ID. Each count is deleted about an hour later.
>
> ## What a result contains
>
> A result keeps a copy of the quiz's questions and answers as they were when you took it, the answers you chose, your score or personality result, when you took it, and how long it took if you used the timer. Anyone with a result's link can see it, but it never shows who you are.
>
> ## What's kept in your browser
>
> The site uses your browser's storage, not cookies:
>
> - your settings
> - your login, while you're logged in
> - for a result you got without logging in: a code that lets you save it to an account later, removed once it's saved or expires
> - answers to a quiz you're partway through, a quiz you're editing, and the page to return to after logging in. These are cleared when you close the tab.
>
> ## Who else handles your data
>
> The site has no ads, analytics or tracking, and loads no scripts from other companies. It relies on:
>
> - **Supabase**, which stores the site's data and runs logins, and **Cloudflare**, which sits in front of Supabase
> - **Vercel**, which hosts the site
> - **Google** or **GitHub**, only if you choose to log in with them
>
> Like any website, these companies see your IP address when your browser connects to them, and may keep it in their own logs under their own privacy policies.
>
> ## Deleting your data
>
> If you're logged in, open **Settings** and choose **Delete account**. This immediately and permanently deletes your account, your results, the quizzes you made, your settings and your login sessions. Three things to know:
>
> - If someone is partway through one of your quizzes, a private copy of it is kept for up to 24 hours so their answers can still be marked, then deleted. No one can read it.
> - Results other people got from your quizzes keep their copy of the questions, but nothing that identifies you.
> - Supabase's security log of your sign-ups and logins isn't deleted.
>
> Results can't be deleted one at a time.
>
> ## Questions
>
> You don't need to contact anyone to delete your data: see above. For other questions about this page, open an issue on the site's GitHub page: [github.com/igl-myrick/quiz-maker-v2/issues](https://github.com/igl-myrick/quiz-maker-v2/issues). Issues are public and need a GitHub account, so don't include your email address or anything else personal.

## Files in scope

- `src/routes/privacy.tsx` (new)
- `src/pages/PrivacyPage.tsx` and `src/pages/PrivacyPage.test.tsx` (new)
- `src/routes/__root.tsx` (the footer only)
- `src/components/LoginDialog.tsx` (the link only) and its test
- Styles for the page, the footer and the login popup's link: `src/styles/privacy.css` (new, the page) and `src/styles/app.css` (the footer and the link, which appear outside the page)
- `src/routeTree.gen.ts` (regenerated)
- `specs/11-privacy-page.md` (this file: status and build notes)

## Out of scope

- Terms of service, a cookie banner (the site sets no cookies), and an app icon for Google.
- Any new data, settings, forms or contact form. The page collects nothing.
- Deleting single results, data export, or any other new data feature the page might suggest.
- Anything on Google's, Vercel's or Supabase's dashboards. The owner does these.
- Legal review, or wording for a particular country's law.

## Calls for the owner

None open. The owner can still change any sentence in "Page text" before approving.

Decided (2026-11-20):

- **Contact:** GitHub issues on the public repository, not an email address. The page tells people issues are public and not to include personal details, and that deleting their data needs no contact at all.
- **Footer:** on every page, with just a "Privacy" link, because Google's reviewers also look for a privacy link on the home page.
- **Date:** the day the page ships, updated whenever the page's meaning changes.

## Build notes (2026-11-20)

### Wording changed for accuracy (criterion 3)

The accuracy check found two things the draft didn't say. The page text above and the page itself now include them:

- **"If you log in" gained a "Login records" item.** On the local stack, Supabase Auth keeps the IP address and user agent on each row of `auth.sessions`, which lasts until logout or account deletion. Its security log, `auth.audit_log_entries`, keeps the email (`actor_username`) on every event, the provider's full name (`actor_name`) on sign-up, and an IP address on some events. The "Your account" item now says names are removed "from your account", because the trigger from change 9 only cleans `auth.users` and `auth.identities`, not this log.
- **"Deleting your data" now says the security log isn't deleted.** `auth.audit_log_entries` has no foreign key to `auth.users`, so deleting an account leaves those rows. It also lists login sessions among what is deleted, since `auth.sessions` cascades.

These describe the local stack's defaults. **For the owner:** this is a gap against CLAUDE.md §7, which says names are removed whenever a profile is saved. Fixing it, by clearing or trimming the security log or by turning off its database copy on the hosted project if Supabase offers that, is a separate change that touches auth data, so it needs its own decision. If it's fixed, the "Login records" and "Deleting your data" wording can be simplified.

### Accuracy check (criterion 10)

- **If you don't log in:** anonymous results get `expires_at` = submission + 1 day (`supabase/functions/submit-quiz/index.ts`), and reads and the 15-minute cleanup enforce it. The anonymous limit stores an HMAC of the normalized IP under `IP_HASH_SECRET`, with a 1-hour window, and cleanup deletes rows after the window ends.
- **If you log in:** `auth.users` and `auth.identities` on the local stack (after Google and GitHub logins) hold the email, provider ID (`sub`, `provider_id`), `iss`, `email_verified`, `phone_verified` and the picture link (`avatar_url`, `picture`), with no name or username. Session and audit log contents are as described above. Results have no expiry once owned. Public quiz reads go through `quizzes_public`, which leaves out `creator_id`. Settings are the four `user_settings` columns. Member limits are 60 submissions and 10 quiz creations per 1-hour window, keyed by user ID.
- **What a result contains:** the `results` columns (`snapshot`, `score`, `outcome_ranking`, `created_at`, `timed`, `duration_seconds`). `get_result` returns `claimable` (a yes or no) but never `owner_id`.
- **What's kept in your browser:** local storage holds `settings`, Supabase's session (`sb-…-auth-token`, plus a short-lived PKCE code verifier during login) and `claim:<resultId>` (removed when claimed, and pruned at startup once expired). Session storage holds `quiz-takes`, `quiz-draft:*` and `auth:return`. `document.cookie` was empty in the running app, and the code sets no cookies.
- **Who else handles your data:** no analytics or third-party scripts in the code (CLAUDE.md §7). Cloudflare sits in front of Supabase (`cf-connecting-ip`, and the error 1000 seen during the hosted rate-limit check).
- **Deleting your data:** results, quizzes, settings, identities and sessions cascade from `auth.users`. Results keep their snapshot with `quiz_id` set to null. A deleted quiz's last version goes to `quiz_versions` and is cleaned up after 24 hours.
- **Questions:** the repository is public (`gh repo view` shows PUBLIC).

### Other build details

- **Footer styles live in `src/styles/app.css`, not `privacy.css`.** The privacy page's stylesheet only loads with that page, but the footer is on every page.
- **The login popup's link is 28 pixels tall.** It's small text on its own line, so it would have been 19 pixels. It gets the footer link's minimum size (`.login-privacy-link` in `app.css`). Following it closes the popup first (`onClick`), so the page-change rule then focuses the privacy page's `<h1>`.
- **The footer sits at the bottom of short pages** (added at the owner's request after the first build). `#root` is a flex column at least as tall as the window, and `main` grows to fill it, so on a short page the footer and its border sit at the bottom. On a longer page it follows the content as before. It is never fixed, so 2.4.11 still holds. Main and the footer get `width: 100%`, because flex items with auto side margins otherwise shrink to fit. At 1920×1080, every page's heading position and content width were the same before and after. The footer ended exactly at the window's bottom on the home page, dashboard and not-found page, with no new scrollbar. On a 375-pixel-wide phone at the largest text size, there was no sideways scrolling and the Settings popup still opened normally.
- **The date is shown as "November 20, 2026"**, in the US style the result pages use. If the page ships on a later day, update the `<time>` and its test.

### Checks

- `PrivacyPage.test.tsx` and the new `LoginDialog` test failed first, then passed. Lint, typecheck, `format:check`, `npm test` (299 tests in 40 files), `npm run db:test` and `npm run build` pass.
- **In the browser, on the dev server:**
  - The footer link goes to `/privacy`, focus moves to the `h1`, "Privacy" is announced and the title is "Privacy · Quiz Maker".
  - The popup link closes the popup and lands the same way.
  - The footer link is 49×32 pixels, and 74×48 at the largest text size.
  - At the largest text size, in light theme with high contrast, in a 431-pixel-wide window, there's no sideways scrolling and the footer stays in the page flow.
  - The console showed only Vite's and React's normal development messages.
- **Not checked:** a screen reader pass (criterion 11). The headings, lists and link names are covered by the role-based tests and axe.

### After deploying (owner, criterion 12)

1. Open `https://<production-domain>/privacy` in a private window and check it loads.
2. In Google Auth Platform → **Branding**, paste that address into **Application privacy policy link** and save.
3. On **Audience**, click **Publish app**.
4. In a private window, log in with a Google account that isn't a test user.
