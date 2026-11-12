# Feature 5: Settings

Status: **Approved** (2026-11-12). It depends on features 0, 4, 6, 2, 1 and 3 being Done. Rules come from `CLAUDE.md` (§1 "Account deletion", §5, §6, §7, §8, feature 5). Schema and the edge function come from `ARCHITECTURE_SPEC.md` (§4.1 enums, §4.6 `user_settings`, §6.2, §7.2 `delete-account`, §10). Domain terms come from `GLOSSARY.md`.

## Goal

Everyone can change the theme, text size, high contrast and font from a settings popup on every page. Changes apply immediately and are remembered on the device. Members' settings also follow them across devices. Members can permanently delete their account from the same popup.

## Acceptance criteria

### The settings popup

1. The header has a "Settings" button for everyone, on every page. Like the auth button, it is **one element that stays mounted**, so focus can return to it.
2. It opens `SettingsDialog`, a native `<dialog>` opened with `showModal()` from the click handler. It follows `CLAUDE.md` §8:
   - Its accessible name is "Settings".
   - Focus moves to the **checked** radio of the Theme group when it opens.
   - Escape and a visible close button close it, and focus returns to the "Settings" button.
   - It uses Ply's dialog classes (`dialog-header`, `dialog-body`, `dialog-close` and so on). The builder confirms them in `node_modules/ply-css/PLY.md` first.
3. **There is no Save button.** Every change applies at once and is visible behind the popup. Each group is a `<fieldset>` with a `<legend>`:
   - **Theme:** radios "System" (default), "Light" and "Dark".
   - **Text size:** radios "Default" (100%), "Large" (112.5%), "Larger" (125%) and "Largest" (150%). Each label is shown at its own size as a preview.
   - **High contrast:** radios "Follow system" (default), "On" and "Off".
   - **Font:** one checkbox, "Use Lexend, a font designed for easier reading" (default off).
3a. Every radio, the checkbox, and the dialog's close button have a target of at least 24×24 CSS pixels (WCAG 2.2 criterion 2.5.8), with the label included in the target. This is checked against Ply's defaults and overridden in `src/styles/settings.css` if needed (`CLAUDE.md` §5).
4. The inputs are plain controlled inputs. Each one reads its value from the settings store and calls the store's setter in `onChange`. There is **no React Hook Form** here, because nothing is submitted, and no copy of the values in `useState`.
5. **Account** section, shown only to members, at the bottom of the popup (criteria 17–21).

### Applying settings

6. `src/stores/settingsStore.ts` is one Zustand store, `{ theme, textSize, highContrast, dyslexiaFont }`, with setters:
   - It uses Zustand's `persist` middleware with local storage under the key `settings`. Persist stores `{"state": {…}, "version": 0}`, and `partialize` keeps only the four values.
   - The persisted value is validated with the Zod schema `src/schemas/settings.ts` in persist's `merge` option, `(persisted, current) => ({ ...current, ...validValues(persisted) })`. Invalid values fall back to the defaults.
   - **Only the setters, which are user changes, write to the server** (criterion 14). The sync writes server values with `useSettingsStore.setState(…)` directly, so they never bounce back. No flag is needed.
   - A `storage` event listener calls `persist.rehydrate()`, so other open tabs pick up a change.
7. **Applying to the page** happens in one place, `applySettings(settings)` in `src/lib/applySettings.ts`. It sets attributes on `<html>`:
   - `data-theme="light"` or `"dark"`, and **no** `data-theme` for System. With no attribute, Ply follows `prefers-color-scheme` itself.
   - `data-text-size="default" | "large" | "larger" | "largest"`. `src/styles/settings.css` maps these to the root `font-size` (100%, 112.5%, 125%, 150%).
   - `data-contrast="on" | "off" | "system"`.
   - `data-font="lexend"` when the font is on, and no attribute otherwise.
   - The builder checks whether Ply sets `color-scheme` under `data-theme`. If it doesn't, `settings.css` sets `color-scheme: light` or `dark` for each forced theme, so native controls and scrollbars match.
   - The store calls it once at module load and then through a **module-level `subscribe`**, like the auth store. No component effect. In development, `import.meta.hot?.dispose` unsubscribes it and removes the `storage` listener.
8. **No flash of the wrong settings.** A small inline `<script>` in `index.html` runs before the app bundle. It reads `JSON.parse(localStorage.settings).state` inside `try`/`catch`, checks each value against the allowed list, and sets the same attributes.
   - It's our own inline code, not a third-party script. There is no Content-Security-Policy today. If one is added later (for example in stretch goal S1), it needs a hash for this script.
   - Its allowed-values list carries a comment pointing to `src/schemas/settings.ts`, and the Zod schema carries one pointing back.
9. **Text size scales everything:**
   - All our own CSS uses `rem`, never fixed `px`, for text.
   - Some of Ply's type utilities are sized in `px`, so the builder doesn't use those utilities, or overrides them in `rem` in `src/styles/settings.css`.
   - A manual check confirms the whole page scales at Largest.
10. **High contrast:**
    - Our own high-contrast rules in `src/styles/settings.css` apply when `data-contrast="on"`, or when `data-contrast="system"` and `@media (prefers-contrast: more)` matches. They use stronger text and border colours, underlined links, and thicker focus rings, in both light and dark themes.
    - Ply's own `prefers-contrast: more` tweaks still follow the operating system even when the setting is Off. That is accepted, because settings only add to the accessibility baseline and never remove it (`CLAUDE.md` feature 5).
    - Contrast is checked with the theme set to light and to dark, at WCAG 2.2 AA in normal mode, and visibly stronger in high-contrast mode.
11. **Lexend:**
    - `src/main.tsx` imports only `@fontsource/lexend/400.css` and `@fontsource/lexend/700.css`. Vite bundles the font files, so they are served from our own domain, never from a third party.
    - When `data-font="lexend"` is set, `src/styles/settings.css` sets `--ply-font-body` and `--ply-font-heading` to `"Lexend", <Ply's default stack>`, and adds a little extra letter spacing (`0.02em`) and line height (`1.6`).
    - Browsers only download a font when text uses it, so people with the setting off never load it.
    - The font's OFL licence ships inside the package, so nothing else is needed.

### Syncing to a member's account

12. A migration creates `user_settings` exactly as in `ARCHITECTURE_SPEC.md` §4.6:
    - It first creates the enums `theme_pref` and `contrast_pref` (`ARCHITECTURE_SPEC.md` §4.1), because feature 0 left them for this feature.
    - Columns: `user_id`, `theme theme_pref`, `text_size text check (text_size in ('default', 'large', 'larger', 'largest'))`, `high_contrast contrast_pref` and `dyslexia_font boolean`, with the defaults in §4.6. There is no `updated_at`, because nothing reads it, and §4.6 is updated to match.
    - RLS is on, with select, insert and update policies for `user_id = (select auth.uid())`. There is no delete policy, because the row cascades with the account. `anon` gets no grants.
    - Creating these RLS policies is approved as part of approving this spec.
13. `src/lib/settingsSync.ts` holds the sync logic as plain async functions, called from the auth store's existing listener (deferred with `setTimeout(…, 0)` as before):
    - It runs on `INITIAL_SESSION` or `SIGNED_IN` **only when the session's user ID differs from a module-level `lastSyncedUserId`**. Supabase also fires `SIGNED_IN` when a tab regains focus, and both events can fire on one load, so syncing every time would overwrite changes made moments ago. `SIGNED_OUT` resets `lastSyncedUserId` to null.
    - When it runs, it selects the member's row:
      - If one exists, it replaces the local settings with `setState`, and the page updates through the store's subscription.
      - If none exists, it saves the current local settings with `upsert(…, { onConflict: 'user_id', ignoreDuplicates: true })` (`CLAUDE.md` feature 5), so a second run can't fail on the primary key.
    - **Accepted:** a change made in the brief moment before the first auth event is replaced by the account's settings.
14. While a member is logged in, each change through a setter upserts their row (`onConflict: 'user_id'`). The last write wins. There is no debounce, because each change is one click.
15. **Errors:**
    - If saving to the account fails, "Couldn't save your settings to your account. They're still saved on this device." is announced. The local change stays.
    - If loading from the account fails, the local settings stay and nothing is announced. It is retried at the next login or load.
16. Logging out leaves the device's settings as they are.

### Account deletion

17. The Account section has a "Delete my account" button. It opens `DeleteAccountDialog`, a second native `<dialog>` stacked over the settings popup (Ply's `dialog-layer-2`, if confirmed in the docs). It follows `CLAUDE.md` §8:
    - Escape closes only the top dialog.
    - Focus returns to "Delete my account" when it closes.
    - It doesn't reuse feature 2's `ConfirmDialog`, because it needs the typed-word field and its own error states. Adding those to `ConfirmDialog` would complicate every other caller.
18. The dialog contains:
    - the heading "Delete your account?"
    - the text "This permanently deletes your account, your saved results and the quizzes you made. This can't be undone."
    - a labelled text field, "Type delete to confirm", with `autocomplete="off"`
    - "Cancel", focused first, and "Delete my account"
19. "Delete my account" uses `aria-disabled="true"` until the field's value, trimmed and in any capitalization, is `delete`. The click handler checks it again. If it doesn't match, it shows "Type the word delete to confirm." as an error linked to the field and moves focus there. The value comes from React Hook Form with a Zod schema, like other forms.
20. Confirming calls the `delete-account` edge function with `supabase.functions.invoke('delete-account')`:
    - While it runs, the button reads "Deleting…" and uses `aria-disabled`. The click handler also returns early while the mutation is pending, because `aria-disabled` doesn't block clicks.
    - **On success**, the cleanup lives in `useMutation({ onSuccess })` inside `useDeleteAccount`, not in a `mutate(…, { onSuccess })` callback, because the dialogs unmount partway through. In this order:
      1. close the delete dialog, then the settings dialog. This must happen before signing out: signing out hides the members-only Account section, which would otherwise unmount an open dialog.
      2. `supabase.auth.signOut({ scope: 'local' })` clears this browser's session. supabase-js ignores the server's error for a user that no longer exists, and still emits `SIGNED_OUT`, which removes the `['me']` queries (feature 3, criterion 18).
      3. remove `quiz-draft:*` keys from session storage
      4. `await navigate({ to: '/' })`. If the member was already on `/`, the path doesn't change, so focus the `<h1>` directly.
      5. announce "Your account has been deleted" **after** that, on the next tick, so the page-change announcement (feature 6, criterion 23a) doesn't replace it.
      - The device's display settings and any anonymous claim tokens stay.
    - **On error:** "Couldn't delete your account. Please try again." shows in the dialog and is announced. The dialog stays open and nothing is cleared.
21. `supabase/functions/delete-account/index.ts`:
    - It is configured with `[functions.delete-account] verify_jwt = false`, for the same reason as `submit-quiz`, and does its own check: `supabase.auth.getClaims(token)` must verify, with `role = 'authenticated'` and a `sub`. Otherwise it returns `401`.
    - **CORS:** the app and the functions are on different origins, so `functions.invoke` triggers a preflight request. The function answers `OPTIONS` with CORS headers (`Access-Control-Allow-Origin`, `Access-Control-Allow-Headers: authorization, x-client-info, apikey, content-type`, `Access-Control-Allow-Methods: POST, OPTIONS`), and adds them to every response. These headers live in `supabase/functions/_shared/cors.ts`, which feature 1's `submit-quiz` uses too (criterion 21a).
    - Apart from `OPTIONS`, only `POST` is accepted. Anything else returns `405`.
    - It calls `auth.admin.deleteUser(sub)` with a service-role client created inside the function from the platform's environment. The key is never in the repo or the client.
    - It returns `204` on success. A "user not found" from `deleteUser` also counts as success, because the account is already gone (for example, after a retried request). Anything else returns `500` with a generic message. It logs no email, token or user ID.
21a. **Correction to feature 1:** the approved `submit-quiz` spec didn't mention CORS and needs the same handling. If feature 1 is already built when this is built, its function is updated to use `_shared/cors.ts`. If not, feature 1's builder adds it then, and feature 1's spec has a note saying so.
    - The foreign keys do the rest (`ARCHITECTURE_SPEC.md` §7.2): quizzes and their child rows, results and settings cascade, other people's results get `quiz_id` set to null, and the retired-version trigger keeps a 24-hour copy of each deleted quiz.

### Tests and quality

22. pgTAP tests in `supabase/tests/`:
    - a member can read, insert and update only their own `user_settings` row, and cannot delete it
    - `anon` can't read any rows
    - the `text_size` and enum constraints reject other values
    - deleting an auth user removes their settings row along with their quizzes and results, leaves other people's results with `quiz_id` null, and writes the retired copies
23. `npm run db:types` is rerun and the regenerated types are committed.
24. Vitest tests:
    - `applySettings` sets and removes each attribute correctly.
    - The persisted value falls back to defaults when it is invalid.
    - `settingsSync` covers:
      - a server row replacing local values
      - local values saved when there is no row
      - no second sync for the same user (a repeated `SIGNED_IN` and `INITIAL_SESSION`)
      - a sync again after logging out and in as another user
      - server values not written back
      - an upsert on change only when logged in
      - the failure announcement
    - `delete-account`'s CORS headers are checked by calling the function from the running app (manual check).
25. Component tests (role-based, `vitest-axe` in each file, mocked `src/lib/supabase`) cover:
    - the Settings button for everyone, and the Account section for members only
    - each radio group and the checkbox changing the store and the `<html>` attributes
    - the popup's focus on open and Escape closing it
    - the popup's focus landing on the checked theme radio
    - the delete dialog's confirm-word rule; success (dialogs closed before sign-out, drafts cleared, navigated, announced last); a double click sending one request; and error (stays open, announced)
26. `npm test`, `npm run lint`, `npm run typecheck` and `npm run db:test` pass, and the browser console shows no warnings. `supabase functions serve` runs `delete-account` locally, and deleting a seeded test member works end to end. Afterwards, `npm run db:reset` restores the seed.

## Packages

This package needs approval as part of approving this spec. Install nothing else.
- `@fontsource/lexend`: the Lexend font files (SIL Open Font License), bundled by Vite and self-hosted. The project owner chose Lexend on 2026-11-12.

## Files in scope

```
src/components/SettingsButton.tsx             # stays mounted, owns SettingsDialog
src/components/SettingsDialog.tsx (+ .test.tsx)
src/components/DeleteAccountDialog.tsx (+ .test.tsx)
src/components/SiteHeader.tsx (+ .test.tsx)   # add SettingsButton
src/stores/settingsStore.ts (+ .test.ts)
src/stores/authStore.ts                       # call settingsSync from the listener
src/lib/applySettings.ts (+ .test.ts)
src/lib/settingsSync.ts (+ .test.ts)
src/hooks/useDeleteAccount.ts
src/schemas/settings.ts  src/schemas/deleteAccount.ts
src/styles/settings.css                       # text size, high contrast, Lexend, px overrides
src/main.tsx                                  # import settings.css and the two Lexend weights
index.html                                    # the pre-paint inline script
src/types/database.types.ts (generated)
supabase/migrations/<timestamp>_user_settings.sql
supabase/tests/user_settings.test.sql  supabase/tests/account_deletion.test.sql
supabase/functions/delete-account/index.ts
supabase/functions/_shared/cors.ts            # shared with submit-quiz
supabase/functions/submit-quiz/index.ts       # only to use _shared/cors.ts, if feature 1 lacks it
supabase/config.toml ([functions.delete-account])
ARCHITECTURE_SPEC.md (§4.6: no updated_at)
package.json, package-lock.json
CLAUDE.md (feature 5 status only)
```

## Out of scope

- The accessibility baseline in `CLAUDE.md` §8, which is always on and never behind a setting.
- Any setting beyond theme, text size, high contrast and font, such as reduced motion. That one follows `prefers-reduced-motion` as part of the baseline.
- Changing a member's email address, or any other account field.
- Exporting account data.
- Anything on a hosted project. The owner deploys `delete-account` and applies the migration.

## Where to look when reviewing

- **`settingsStore.ts`:** the only place settings live. It subscribes once at module level to call `applySettings`. Nothing else reads local storage for settings except the inline script in `index.html`.
- **`settingsSync.ts`:** plain functions called from the auth listener, not from a component effect. Check the `lastSyncedUserId` guard, that server values go in through `setState` and not the setters, and that the upsert only runs while logged in.
- **`SettingsDialog.tsx`:** controlled inputs reading the store directly. There is no `useState`, no React Hook Form and no `useEffect`. Opening and focusing happen in the button's click handler.
- **`DeleteAccountDialog.tsx`:** the confirm-word state lives in React Hook Form. Request state comes from the mutation's status. The success handler does its cleanup in a clear order.
- **`index.html`'s inline script:** short, wrapped in `try`/`catch`, and it only sets attributes from an allowed list.
- **`delete-account/index.ts`:** the caller check before anything else, and the service-role client never leaving the function.

## Manual checks

- **Keyboard only:** open Settings, change each setting with the arrow keys and Space, and close with Escape. Focus should return to Settings. Open the delete dialog, Cancel, and confirm focus returns to "Delete my account".
- Reload with Dark and Largest set, and confirm there's no flash of the light theme or default size.
- At Largest, check that the header, search, the take page and the result page all scale with no overlap or clipped text. At 320px width, check that the settings popup, including the "Largest" preview label, fits without horizontal scrolling (WCAG 1.4.10).
- Set high contrast to On in both themes and check the contrast. Repeat with Follow system plus the operating system's contrast setting.
- Turn Lexend on and confirm in the network panel that the font loads from our own origin.
- Log in on a second browser and confirm your settings follow you.
- **Screen reader:** the save-failure message, and "Your account has been deleted", are each read once.
