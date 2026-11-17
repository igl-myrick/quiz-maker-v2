# UI Redesign Phase 3 (Popups and Navbar) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Rebuild the quiz details, Settings, Log in and confirm popups in the chosen designs, and make the navbar usable at 320px.

**Architecture:** Markup and CSS changes to the existing popup components, built from Phase 1's `KindChip`, `QuizMeta`, `Switch`, `PillGroup` and `StripArt` and the dialog shell. Every open/close rule, focus move, announcement and URL behaviour stays as it is. Popup styles go in a new `src/styles/popups.css`, imported from `src/main.tsx` after `ui.css` (the popups are mounted from the header on every page). The details popup is the first place the personality scope (`data-kind`) is applied.

**Tech Stack:** React 19 + TypeScript strict, Ply CSS 1.8, Vitest 5 + React Testing Library + vitest-axe.

**Spec:** `specs/07-ui-redesign.md`, Phase 3 (P3.1–P3.5) and Global criteria G1–G11. Phases 1–2 are merged on `fix/ui-polish`.

**Branch:** `feature/7-ui-popups`, cut from `fix/ui-polish` at its current tip.

## Global Constraints

- No new libraries (G1). New class names, to be checked free in `node_modules/ply-css/ply-classes.json` before use: `details-dialog`, `details-strip`, `details-main`, `details-top`, `details-footer`, `start-controls`, `no-timer-note`, `theme-tiles`, `theme-preview`, `font-switch`, `settings-account`, `login-status`, `login-links`, `login-submit` (all checked free). Ply has no `btn-block` or `btn-link`; quiet buttons use Ply's `btn-ghost`.
- Contrast AA in light, dark and high contrast, both kinds (G2); colours only from Ply variables and `--qm-*` tokens (G3).
- `rem` sizes (G4). Targets ≥ 24×24 and focus always visible (G5). Colour never alone (G6). Artwork decorative (G7). No sideways scroll at 320px at every text size (G8), including the Settings popup fix that already exists (`settings.css`, "The settings popup").
- Behaviour unchanged (G9): the details popup's URL, Back and close rules (feature 6), "Continue your quiz", the "Start over?" confirm, the Settings focus-on-open (`openSettingsDialog` focuses the checked `input[name="theme"]`), every Log in announcement and the code field's label, `autocomplete="one-time-code"`, `inputmode="numeric"` and paste.
- Wording unchanged (G10): "Timer enabled" / "Timer disabled" (accessible name "Timer"), "Start quiz", "Use Lexend, a font designed for easier reading", "Send code", "Log in", "Send a new code", "Use a different email", all status and error lines. The one new string is "No suggested time" (P3.1).
- Lint: `npx eslint . --ignore-pattern ".ds-sync/**" --ignore-pattern "ds-bundle/**"` until PR #10 merges.
- Phase ends with lint, `npm run typecheck`, `npm test`, `npm run db:test` passing and no console warnings (G11).

## Decisions this plan makes (owner to check)

- **Confirm buttons are always red.** Every current confirm (Start over, Delete quiz, Remove question/outcome/answers, Discard draft, Save mine over it, Switch to Personality/Trivia) throws work away, so `ConfirmDialog`'s confirm button becomes `btn btn-red` for all of them, with no new option (P3.4). If a non-destructive confirm is ever added, it gets an option then.
- **Suggested time is shown once in the details popup.** `QuizMeta` at the top shows "Suggested time: N min"; the timer switch in the footer no longer repeats it. `StartQuizControls` gets `variant?: 'page' | 'popup'` (default `'page'`, so the take page is unchanged); `'popup'` hides the time text and shows "No suggested time" when there is none.
- **The strip is hidden on narrow popups.** A container query on the details dialog hides the decorative strip when the popup is narrower than 26rem (rem in container queries follows the text-size setting), so the content keeps the room at 320px.
- **Theme tiles use clipped radios, not Ply's `.sr-only`.** Phase 1's global radio size outranks `.sr-only`, so the tiles hide their radios the same way `PillGroup` does.
- **`PillGroup` becomes generic** (`PillGroup<T extends string>`), so Settings passes typed values without casts. Existing callers (none yet outside tests) are unaffected.
- **Navbar wraps.** `.navbar > ul` wraps onto a second row when items don't fit (P3.5); no menu button.

## Review Focus

1. **Details popup close paths after the markup change.** Escape, the round close button and Back must still go back or replace the URL exactly as feature 6 says; the close button must keep `aria-label="Close"` and stay the one `requestClose` caller. Existing `QuizDetailsDialog.test.tsx` covers this; it must pass unmodified except for markup queries.
2. **Purple scope inside the popup's nested confirm.** "Start over?" is a `<dialog>` rendered inside the details dialog; custom properties inherit through the DOM even in the top layer, so it should turn purple for personality quizzes. Task 1's browser check confirms its confirm button colour.
3. **Settings at Largest on 320px.** Theme tiles and pill groups must wrap; the existing `.settings-dialog` padding fix must still apply. Task 2 measures `scrollWidth`.
4. **Lexend as a switch keeps working as a checkbox.** `role="switch"` on the checkbox changes its role in tests from `checkbox` to `switch`; its checked state, label and store wiring stay. Task 2's test asserts the switch role, name and checked state.
5. **Navbar for members.** Members see six items (Quiz Maker, Search, Create quiz, Dashboard, Settings, Log out); at 320px Largest all must be visible and focusable with no sideways scroll. Task 5 checks both logged-out and member states (member via the `SiteHeader.test.tsx` session mock for the test, and the browser for the visual).

---

### Task 1: Quiz details popup (B2 + S1b)

**Files:**
- Modify: `src/components/QuizDetailsDialog.tsx`, `src/components/QuizDetailsDialog.test.tsx`, `src/components/StartQuizControls.tsx`, `src/components/StartQuizControls.test.tsx`
- Create: `src/styles/popups.css`; Modify: `src/main.tsx` (import it after `ui.css`)

**Interfaces:**
- Consumes: `KindChip({ kind })`, `QuizMeta({ questionCount, suggestedTimeSeconds })`, `StripArt({ kind })`, `Switch({ checked, onChange, label, ariaLabel })` (Phase 1).
- Produces: `StartQuizControls` props gain `variant?: 'page' | 'popup'` (default `'page'`).

- [ ] **Step 1: Write the failing tests.**
  In `StartQuizControls.test.tsx` (reuse its existing render helper):

```tsx
it('in the popup, leaves the time to the popup and keeps the Timer switch', () => {
  // render with suggestedTimeSeconds={300} variant="popup"
  expect(screen.getByRole('switch', { name: 'Timer' })).toHaveTextContent('Timer enabled')
  expect(screen.queryByText('Suggested time: 5 min')).not.toBeInTheDocument()
})
it('in the popup, says when there is no suggested time', () => {
  // render with suggestedTimeSeconds={null} variant="popup"
  expect(screen.getByText('No suggested time')).toBeInTheDocument()
  expect(screen.queryByRole('switch')).not.toBeInTheDocument()
})
```

  In `QuizDetailsDialog.test.tsx` (reuse its quiz fixtures; add a personality one if missing):

```tsx
it('shows the kind chip, meta and the decorative strip', async () => {
  // open a trivia quiz with suggested_time_seconds 300
  const dialog = getDialog()
  expect(within(dialog).getByText('Trivia')).toBeInTheDocument()
  expect(within(dialog).getByText('Suggested time: 5 min')).toBeInTheDocument() // once, from QuizMeta
  expect(dialog.querySelector('svg.strip-art')).toHaveAttribute('aria-hidden', 'true')
})
it('turns on the personality highlight only for personality quizzes', async () => {
  // trivia: expect(getDialog()).not.toHaveAttribute('data-kind')
  // personality: expect(getDialog()).toHaveAttribute('data-kind', 'personality')
})
```

- [ ] **Step 2: Run** `npx vitest run src/components/StartQuizControls.test.tsx src/components/QuizDetailsDialog.test.tsx`. Expected: the four new tests FAIL; existing ones pass.

- [ ] **Step 3: Implement.**
  - `StartQuizControls`: replace the hand-made switch button with `<Switch checked={timerOn} onChange={setTimerOn} ariaLabel="Timer" label={timerOn ? 'Timer enabled' : 'Timer disabled'} />`. Wrap the timer part and the buttons in `<div className="start-controls">`. In `'page'` show the time text beside the switch as today; in `'popup'` omit it, and when there is no timer render `<span className="no-timer-note">No suggested time</span>` where the switch would be. Error alert and "Continue your quiz" unchanged; `{dialog}` stays inside the component's root.
  - `QuizDetailsDialog`: `<dialog className="details-dialog" data-kind={quiz?.kind === 'personality' ? 'personality' : undefined} …>` (same handlers). When `quiz` is loaded: `<div className="details-strip" data-strip-kind={quiz.kind}><StripArt kind={quiz.kind} /></div>` then `<div className="details-main">` with a `details-top` row (`KindChip`, close button), the `<h2 id={headingId}>`, `QuizMeta`, description, and a `details-footer` holding `<StartQuizControls … variant="popup" />`. Loading, error and not-found states keep today's header and body (no strip). The close button keeps `className="dialog-close"`, `aria-label="Close"`, `onClick={requestClose}`, and the h2 keeps its id in every state.
  - CSS in `popups.css`: `.details-dialog` `padding: 0; overflow: hidden; container-type: inline-size; max-width: 34rem`; loaded layout a grid `grid-template-columns: 5.5rem 1fr`; `.details-strip` padding `1rem 0.75rem`, background `var(--qm-trivia)`, `[data-strip-kind='personality']` `var(--qm-personality)`; `.details-main` padding `1.25rem 1.5rem`; `.details-top` flex, space-between; `.details-footer` flex, wrap, space-between, `border-top: 1px solid var(--ply-border-color)`, padding-top `1rem`; `.start-controls` flex, wrap, `align-items: center`, `gap: 0.75rem`, `justify-content: space-between`; `.no-timer-note` secondary colour. `@container (max-width: 26rem) { .details-strip { display: none } … single column }` (put the container query on a wrapper inside the dialog if `container-type` on the `<dialog>` itself misbehaves; ledger which).

- [ ] **Step 4: Run** the two test files, then `npm test`. Expected: all pass (TakePage timer tests still see "Timer enabled"/"Timer disabled" and the name "Timer").

- [ ] **Step 5: Verify in the browser** on `/search`: open a trivia and a personality quiz. Layout matches `details-v5.html` S1b (strip left, chip and × top right, title, meta, description, footer with switch and Start quiz). Personality: Start quiz and the switch track are purple; with a take in progress, "Start over?" opens and its confirm button is purple too (computed `background-color`). Escape, × and Back close as before; focus returns to the card. At 320px Largest: strip hidden, no sideways scroll. Light, dark, high contrast.

- [ ] **Step 6: Commit** `git commit -m "Rebuild the quiz details popup with the side strip"`.

---

### Task 2: Settings popup (option B)

**Files:**
- Modify: `src/components/SettingsDialog.tsx`, `src/components/SettingsDialog.test.tsx`, `src/components/ui/PillGroup.tsx`, `src/styles/popups.css`, `src/styles/settings.css` (only if the 320px fix needs adjusting)

**Interfaces:**
- Consumes: `PillGroup` (Phase 1).
- Produces: `PillGroup<T extends string>` with `options: { value: T; label: ReactNode }[]`, `value: T`, `onChange: (value: T) => void` (legend, name, hideLegend unchanged).

- [ ] **Step 1: Write the failing tests** in `SettingsDialog.test.tsx` (use its existing `openSettings` helper):

```tsx
it('draws the theme as tiles that are still radios, and Lexend as a switch', () => {
  const dialog = openSettings()
  expect(within(dialog).getByRole('group', { name: 'Theme' }).querySelector('.theme-tiles')).not.toBeNull()
  expect(within(dialog).getByRole('radio', { name: 'Dark' })).toBeInTheDocument()
  const font = within(dialog).getByRole('switch', { name: 'Use Lexend, a font designed for easier reading' })
  expect(font).not.toBeChecked()
  fireEvent.click(font)
  expect(font).toBeChecked()
})
it('shows text size and high contrast as pill groups', () => {
  const dialog = openSettings()
  for (const name of ['Text size', 'High contrast']) {
    expect(within(dialog).getByRole('group', { name })).toHaveClass('pill-group')
  }
})
```

  Update the existing Lexend assertion at line ~96 from role `checkbox` to role `switch` (markup legitimately changed, G9).

- [ ] **Step 2: Run** `npx vitest run src/components/SettingsDialog.test.tsx`. Expected: the two new tests and the updated one FAIL.

- [ ] **Step 3: Implement.**
  - Make `PillGroup` generic as in Interfaces; its tests keep passing unchanged.
  - Theme: a `fieldset` (legend "Theme") holding `<div className="theme-tiles">` with one `label` per choice: a clipped radio (`name="theme"`, same values), a decorative `<span className="theme-preview" data-preview={value} aria-hidden="true" />` (a mini page: light = white page with dark lines, dark = the reverse, system = split diagonally), and the text. Checked tile: 2px `--ply-btn-default-bg` border and bold text (thickness + weight, not colour alone); focus ring on `label:has(input:focus-visible)`. Tiles wrap (`flex-wrap`), min 5.5rem each.
  - Text size and High contrast: `PillGroup` with the existing choices; text-size labels keep their `text-size-*` spans so each shows at its size.
  - Font: keep the `fieldset` and legend "Font"; the checkbox gets `role="switch"` and `className="font-switch"`, drawn with `appearance: none` as a track and knob matching Phase 1's `.switch` (border in both states, knob position changes; `:checked` fills with `--ply-btn-default-bg`; `:focus-visible` ring; transition only under `prefers-reduced-motion: no-preference`). Label text unchanged.
  - Account: `<section className="settings-account">` with `border-top: 1px solid var(--ply-border-color)`, padding-top; "Delete my account" stays `btn btn-red`.
  - Remove the now-unused local `RadioGroup` component.

- [ ] **Step 4: Run** `npx vitest run src/components/SettingsDialog.test.tsx src/components/ui/PillGroup.test.tsx src/components/SiteHeader.test.tsx`. Expected: all pass, including "focuses the checked theme on open".

- [ ] **Step 5: Verify in the browser**: Settings matches `popups-v3.html` option B. Arrow keys move between theme tiles and between pills (the Phase 1 deferred check). Every change applies at once. At Largest on 320px, `dialog.scrollWidth <= dialog.clientWidth`. Light, dark, high contrast (both "On" and "Follow system"). Reduced motion: no switch transition.

- [ ] **Step 6: Commit** `git commit -m "Rebuild the Settings popup with theme tiles, pills and a font switch"`.

---

### Task 3: Log in popup (option A)

**Files:**
- Modify: `src/components/LoginDialog.tsx`, `src/components/LoginDialog.test.tsx`, `src/styles/popups.css`

**Interfaces:** none new.

- [ ] **Step 1: Write the failing test** in `LoginDialog.test.tsx` (reuse its helpers that reach the code step):

```tsx
it('puts the secondary code actions in a quiet row under Log in', async () => {
  // reach the code step
  const links = dialog.querySelector('.login-links')
  expect(links?.contains(screen.getByRole('button', { name: 'Send a new code' }))).toBe(true)
  expect(links?.contains(screen.getByRole('button', { name: 'Use a different email' }))).toBe(true)
  expect(screen.getByRole('button', { name: 'Log in' })).toHaveClass('login-submit')
})
```

- [ ] **Step 2: Run** `npx vitest run src/components/LoginDialog.test.tsx`. Expected: the new test FAILS.

- [ ] **Step 3: Implement.** "Send code" and "Log in" get `btn btn-primary login-submit`; `.login-submit { width: 100% }` in `popups.css`. Under "Log in", `<div className="login-links">` holds "Send a new code" and "Use a different email" as `<button type="button" className="btn btn-ghost">`, each `min-height: max(24px, 1.5rem)`, centred, with `disabled={busy}` kept. The `<p role="status">` gets `className="login-status"`; `.login-status:not(:empty)` is a soft tinted row (`background: var(--ply-bg-surface-alt)`, radius `--qm-radius-input`, padding). Inputs get `border-radius: var(--qm-radius-input)` inside `.dialog-sm` forms only.

- [ ] **Step 4: Run** `npx vitest run src/components/LoginDialog.test.tsx src/components/SiteHeader.test.tsx`. Expected: all pass, including every announcement test.

- [ ] **Step 5: Verify in the browser** (local stack running; the code arrives in the local inbox shown by `npx supabase status`): open Log in, send a code to a test address, see the tinted "Code sent to …" row; the secondary buttons are quiet, each ≥ 24×24; paste works in the code field. Matches `popups-v3.html` option A. 320px Largest no sideways scroll. Light, dark, high contrast.

- [ ] **Step 6: Commit** `git commit -m "Restyle the Log in popup with full-width actions and quiet links"`.

---

### Task 4: Confirm and delete-account dialogs

**Files:**
- Modify: `src/components/ConfirmDialog.tsx`, `src/components/ConfirmDialog.test.tsx`

**Interfaces:** `ConfirmOptions` unchanged.

- [ ] **Step 1: Write the failing test** in `ConfirmDialog.test.tsx`:

```tsx
it('shows the confirm action as destructive', () => {
  render(<Harness />)
  fireEvent.click(screen.getByRole('button', { name: 'Open' }))
  expect(screen.getByRole('button', { name: 'Delete quiz' })).toHaveClass('btn-red')
})
```

- [ ] **Step 2: Run** `npx vitest run src/components/ConfirmDialog.test.tsx`. Expected: FAIL (`btn-primary`).
- [ ] **Step 3: Implement:** confirm button `className="btn btn-red"`. Footer stays Ply's right-aligned `dialog-footer`. `DeleteAccountDialog` already uses `btn-red` and a right-aligned footer; no change unless the browser check shows a gap.
- [ ] **Step 4: Run** `npm test`. Expected: all pass.
- [ ] **Step 5: Verify in the browser:** "Start over?" (details popup with a take in progress) and, as a member, "Delete your account?" from Settings: rounded shell, right-aligned buttons, red action, Cancel focused first, Escape closes. Red on white/dark meets 4.5:1 for its white text (Ply's `btn-red`; measure).
- [ ] **Step 6: Commit** `git commit -m "Show confirm actions in red"`.

---

### Task 5: Navbar at phone width

**Files:**
- Modify: `src/styles/app.css` (the header buttons section), `src/components/SiteHeader.test.tsx` only if a test needs the member state helper

**Interfaces:** none.

- [ ] **Step 1: Reproduce in the browser** (the RED for a CSS-only change): at 320px, logged out and as a member, record that the last navbar item's `getBoundingClientRect().right > innerWidth` (cut off).
- [ ] **Step 2: Implement** in `app.css`: `.navbar > ul { flex-wrap: wrap; }`; tighten link padding inside the navbar so more fits (`padding: 0.75rem 0.75rem`, still ≥ 24×24); keep the existing `li:has(> .btn)` centring.
- [ ] **Step 3: Verify (GREEN):** at 320px, every item's `right <= innerWidth`, `document.documentElement.scrollWidth === 320`, at default and Largest text, logged out and as a member; Tab reaches every item with visible focus; at a wide window the bar is one row as before. Light, dark, high contrast.
- [ ] **Step 4: Run** `npm test`. Expected: all pass.
- [ ] **Step 5: Commit** `git commit -m "Let the navbar wrap so every item fits at phone width"`.

---

### Task 6: Phase checks

**Files:** Modify `specs/07-ui-redesign.md` (status line: "Phase 3 built on `feature/7-ui-popups`").

- [ ] **Step 1: Run** lint (with the ignore patterns), `npm run typecheck`, `npm test`, `npm run db:test`, `npx prettier --check src docs/superpowers specs`. Expected: all pass, no console warnings.
- [ ] **Step 2: Manual checks** for every popup: keyboard only (focus moves in, stays in, Escape closes, focus returns); screen reader spot check (chip, switch states, pill groups, theme tiles, strip skipped); light, dark, high contrast; both kinds for the details popup; 320px Largest; reduced motion.
- [ ] **Step 3: Commit the spec note** with message "Note Phase 3 build in the redesign spec".
