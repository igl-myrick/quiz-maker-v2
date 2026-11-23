# Change 10: Security headers

Status: **Approved** (2026-11-20). It is built on the branch `feature/10-security-headers`. It is a pre-deploy change that depends on every feature before it, and it changes no features' behaviour. Rules come from `CLAUDE.md` (§2 "Hosting", §6, §7 and §8).

## Goal

Before the site goes live on Vercel, it sends standard security headers with every page, so that:

- the browser runs only our own scripts and talks only to our own Supabase project (Content-Security-Policy)
- no other site can show ours in a frame (clickjacking)
- the browser doesn't guess file types, leak full URLs to other sites, or offer features we never use (camera, microphone, location)
- built files, whose names change when their content does, are cached long term

Everything is set in `vercel.json`, so it adds no server code, no dependency and no third-party anything. The site must look and work exactly as before. The only change a user could notice is that it can't be framed.

## What the built site loads today

Checked against `npm run build` on 2026-11-20. The builder rechecks this before writing the policy.

| Kind | What | Where from |
| --- | --- | --- |
| Scripts | the Vite bundle in `/assets/` | our origin |
| Scripts | one inline script in `index.html` that applies saved settings before the first paint | inline, so it needs a hash |
| Styles | the Ply CSS and app stylesheets in `/assets/` | our origin |
| Styles | three React `style={…}` props (score bars, header auth button) | set through the DOM, which CSP doesn't block |
| Fonts | Lexend (`@fontsource/lexend`), self-hosted | our origin |
| Images | `data:image/svg+xml` URIs inside Ply's CSS | `data:` |
| Network | Supabase REST, RPC, Auth and the `submit-quiz` and `delete-account` edge functions | the Supabase project URL |
| Navigation | login sends the tab to Supabase Auth, then Google or GitHub | a top-level navigation, which CSP doesn't restrict |

Two library details matter:

- **Zod** probes for `new Function` the first time it validates something. The probe is caught, but under a strict policy the browser still reports a violation, which shows as a console error. Zod's documented switch, `z.config({ jitless: true })`, skips the probe.
- **Supabase Realtime** can start a `blob:` Web Worker, but only when Realtime is used with `worker: true`. The app doesn't use Realtime, so no `worker-src` or `blob:` allowance is needed.

## Acceptance criteria

### Headers

1. `vercel.json` keeps the existing rewrite unchanged and adds a `headers` entry for every path (`"source": "/(.*)"`) with exactly these headers:

   | Header | Value |
   | --- | --- |
   | `Content-Security-Policy` | see criterion 2 |
   | `X-Content-Type-Options` | `nosniff` |
   | `Referrer-Policy` | `strict-origin-when-cross-origin` |
   | `Permissions-Policy` | `camera=(), microphone=(), geolocation=(), payment=(), usb=()` |

2. The Content-Security-Policy is exactly these directives, in this order:

   ```
   default-src 'self';
   script-src 'self' 'sha256-<hash of the inline settings script>';
   style-src 'self';
   img-src 'self' data:;
   font-src 'self';
   connect-src 'self' https://yslyxdjkzbdkxenwfkpy.supabase.co;
   object-src 'none';
   base-uri 'self';
   form-action 'self';
   frame-ancestors 'none'
   ```

   - There is no `'unsafe-inline'`, no `'unsafe-eval'` and no wildcard host anywhere.
   - `https://yslyxdjkzbdkxenwfkpy.supabase.co` is the hosted production project's URL, chosen by the owner on 2026-11-20. It is the origin only, with no path, so it covers REST, RPC, Auth and the edge functions. It is already public, because it's in the front-end bundle through `VITE_SUPABASE_URL`, so this commits no secret. Vercel's `VITE_SUPABASE_URL` must be this same URL, or the policy blocks every request. The wildcard alternative, `https://*.supabase.co`, was rejected because it would let the page talk to any Supabase project.
   - The hash is computed from the inline script exactly as it appears in the built `dist/index.html`. Before this change it was `sha256-qRLCek200dt6eZysCDQBx7P23h//HqwT16ipz5PImtU=`. Criterion 7's comment edit changed it to `sha256-78P5wo/cJBaHgIZQNh7M6N5FWSH3mnACZqDIhlcMSA0=`. Any edit to that script, including its comments or whitespace, changes the hash, which criterion 6 catches.

3. Built assets get long-term caching: a second `headers` entry for `/assets/(.*)` adds `Cache-Control: public, max-age=31536000, immutable`. `index.html` keeps Vercel's default caching, so a new deploy is picked up immediately.
4. No other headers are added. In particular:
   - no `Strict-Transport-Security`, because Vercel already sends it on its domains (the builder confirms this in the Vercel docs and records the link in the build notes)
   - no `X-Frame-Options`, because `frame-ancestors 'none'` replaces it in every browser the site supports
   - no CSP reporting endpoint, because that would mean collecting data (CLAUDE.md §7)

### App changes the policy needs

5. `src/main.tsx` calls `z.config({ jitless: true })` before anything else runs, with a one-line comment explaining that it keeps Zod from probing `new Function`, which the CSP blocks. No other app code changes.
6. A Vitest test, `src/lib/securityHeaders.test.ts`, keeps the policy and the page in step. It:
   - reads `index.html` and `vercel.json` through Vite `?raw` imports (the app tsconfig has no Node types, so it doesn't use `node:fs`)
   - extracts the inline script, hashes it with Web Crypto (`crypto.subtle.digest('SHA-256', …)`), and checks that `'sha256-<that hash>'` appears in the policy's `script-src`
   - checks that every header in criterion 1 is present with its exact value, and that the policy contains neither `'unsafe-inline'` nor `'unsafe-eval'`

   It hashes the source `index.html`, not the build. The builder first confirms that Vite leaves the inline script's bytes unchanged, by comparing the hash of the source script with the hash from `dist/index.html`. If they differ, stop and ask.
7. The comment in `index.html` that says "a future Content-Security-Policy needs a hash for it" is updated to say the hash lives in `vercel.json`, and that editing the script means updating it there, with the test above as the check.

### Verification

8. `npm run lint`, `npm run typecheck`, `npm test`, `npm run db:test` and `npm run build` all pass.
9. Local check of the policy. `vite preview` doesn't read `vercel.json`, so the builder serves a scratch copy of `dist/` (outside the repo, never committed) with the policy added as a `<meta http-equiv="Content-Security-Policy">` tag (without `frame-ancestors`, which meta tags ignore) and `connect-src` set to the local stack's URL. Against the local Supabase stack, the builder checks in the browser that:
   - the console shows **no** CSP violations and no other errors or warnings
   - search, the quiz details popup, taking and submitting a trivia and a personality quiz, the result page, the dashboard, creating and editing a quiz, settings (theme, text size, high contrast, Lexend) and account deletion all work
   - a saved dark theme still applies before the first paint (the inline script ran)
   - "Continue with Google" and "Continue with GitHub" still leave the page for the provider

   The build notes say what was checked and how.
10. **On the first Vercel preview deployment (project owner):** open DevTools, confirm the headers in criterion 1 are on the page response and `Cache-Control` is on an `/assets/` file, repeat the console check in criterion 9 (including a full Google and a GitHub login), and confirm that a page framing the site is refused. The builder writes these steps in the build notes.

## Files in scope

- `vercel.json`
- `src/main.tsx` (one import line only)
- `src/lib/zodConfig.ts` (new, added during the build: see the build notes)
- `index.html` (the comment only)
- `src/lib/securityHeaders.test.ts` (new)
- `specs/10-security-headers.md` (this file: status and build notes)

## Out of scope

- Anything on Vercel's dashboard or the hosted Supabase project, including deploying. The project owner does these.
- Changes to the Supabase edge functions' own headers, including CORS.
- A CSP reporting endpoint or any other monitoring.
- `X-Frame-Options`, `Strict-Transport-Security`, Cross-Origin-Opener/Embedder/Resource-Policy headers, and Trusted Types. These can be a later change if wanted.
- Moving the inline settings script into a separate file to avoid the hash. That would risk the wrong theme flashing before the first paint (feature 5).
- Adding a CLAUDE.md entry for this change. The owner decides whether it gets one.

## Calls for the owner

None open. Decided:

- **`connect-src` host** (2026-11-20): the exact production project URL, `https://yslyxdjkzbdkxenwfkpy.supabase.co`, not a wildcard.
- **`Permissions-Policy` list** (2026-11-20, changed 2026-11-23): camera, microphone, geolocation, payment and usb, all turned off. `interest-cohort=()` was in the first build but removed on 2026-11-23: browsers no longer recognise that feature, so it logged "Unrecognized feature" in the console on the preview.

## Build notes (2026-11-20)

### Change from the spec

- **Criterion 5 needed a separate module.** `z.config` can't sit in `src/main.tsx` itself. ES imports run before the importing file's own code, and `src/stores/settingsStore.ts` already parses with Zod while it is being imported (its persist `merge` runs on the synchronous rehydrate), so Zod would probe `new Function` before `z.config` ran. The call lives in `src/lib/zodConfig.ts`, which `main.tsx` imports first, with a comment saying it must stay first. "Files in scope" lists the new file.

### Checks

- **Hash (criterion 6):** before any edits, the inline script's SHA-256 was the same in `index.html` and the built `dist/index.html`, so Vite leaves its bytes alone and hashing the source is safe.
- **Test first:** `src/lib/securityHeaders.test.ts` failed before `vercel.json` had headers, then passed (5 tests).
- **Criterion 8:** lint, typecheck and `format:check` pass. `npm test` passes 297 tests in 40 files, `npm run db:test` passes, and `npm run build` succeeds.
- **Criterion 4, HSTS:** Vercel sends `Strict-Transport-Security` by default (two-year max-age; `*.vercel.app` is preloaded), per https://vercel.com/docs/cdn-security/encryption and https://vercel.com/docs/headers/response-headers.

### Local browser check (criterion 9)

A scratch copy of `dist/` (in the session's temporary folder, outside the repo) had the policy added as a `<meta http-equiv="Content-Security-Policy">` tag, with `frame-ancestors` removed and `connect-src` set to `http://127.0.0.1:54321`. It was served with `vite preview --outDir <scratch>` on port 4173, against the local Supabase stack, in the in-app browser.

- **The policy was enforced.** An injected inline script and an image from `https://example.com` were both blocked and reported in the console, which also confirmed the console captures violations. (Code run by the browser tool itself bypasses the page's policy, so `new Function` called from the tool proves nothing either way.)
- **No violations or other console errors** came from the app on any page below, apart from those two deliberate tests.
- **The inline script ran under its hash.** A saved `dark` theme, `large` text and the Lexend font applied on reload, and the Lexend font files loaded under `font-src 'self'`.
- **Worked:** the splash page, search (`?q=capitals`), the details popup opened by click and by direct link (`/search?quiz=…`), taking and submitting a trivia quiz (graded by the local `submit-quiz` function, score bar drawn), taking and submitting a personality quiz, reloading a result link directly, and the Settings popup (theme and high contrast).
- **Login:** "Continue with GitHub" left the page and reached GitHub's sign-in page. The check stopped there.
- **Not checked locally:** the dashboard, creating and editing a quiz, and account deletion. These need a logged-in member, and logging in locally means signing in to a real GitHub or Google account. They make the same kind of requests to the same Supabase origin as the pages above, and nothing they load falls outside the policy, so they are checked on the first preview deployment (below).

### First Vercel preview deployment (criterion 10, project owner)

1. Push `feature/10-security-headers`. Vercel builds a preview deployment.
2. Open the preview URL with DevTools open (Network tab, "Preserve log" on).
3. Click the first request (the page itself). Under Response Headers, check `Content-Security-Policy`, `X-Content-Type-Options`, `Referrer-Policy`, `Permissions-Policy` and `Strict-Transport-Security`.
4. Click any `/assets/…` file and check `Cache-Control: public, max-age=31536000, immutable`.
5. In the Console, check there are no red errors while you search, open a quiz, take and submit one, view the result, log in with Google and then with GitHub, open the dashboard, create and edit a quiz, change settings, and save an anonymous result to your account. A message containing "Content Security Policy" means something was blocked; send it to the builder.
6. Framing check: in the Console on any other site (for example `https://example.com`), run `document.body.innerHTML = '<iframe src="https://<preview-url>" width="600" height="400"></iframe>'`. The frame should stay empty or show a "refused to connect" message.
7. Account deletion only on a throwaway account, if at all, since it is permanent.
