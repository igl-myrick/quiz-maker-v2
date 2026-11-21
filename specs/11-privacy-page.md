# Change 11: Privacy page

Status: **Draft** (2026-11-20). Not approved. Do not build from it until this line says Approved. It is a pre-deploy change. It adds one public page and two links, and it collects, stores and changes no data. Rules come from `CLAUDE.md` (§1, §6, §7 and §8).

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
> - **Your account:** your email address and an ID from Google or GitHub, so you can log in again. Google and GitHub also send your name, username and profile picture. The site removes your name and username as soon as they arrive. The link to your picture is kept by the login system, but the site never shows, uses or shares it.
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
> If you're logged in, open **Settings** and choose **Delete account**. This immediately and permanently deletes your account, your results, the quizzes you made and your settings. Two things to know:
>
> - If someone is partway through one of your quizzes, a private copy of it is kept for up to 24 hours so their answers can still be marked, then deleted. No one can read it.
> - Results other people got from your quizzes keep their copy of the questions, but nothing that identifies you.
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
- Styles for the page and footer, in an existing stylesheet or a new `src/styles/privacy.css`
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
