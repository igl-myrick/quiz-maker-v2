# Feature 7: UI redesign

Status: **Approved** (2026-11-17, by the project owner). Not to be built until the status says Approved. It depends on features 0 to 6 being Done, and on the owner's in-progress UI polish on `fix/ui-polish` being committed first (it is the starting point). Rules come from `CLAUDE.md` (§1, §5, §6, §8, §9). Domain terms come from `GLOSSARY.md`.

## Goal

Make the site feel designed rather than assembled, without losing Ply's minimal character. Every page and popup is rebuilt from one small set of shared pieces (cards, chips, dialogs, switches, pill groups, artwork) so components stop looking thrown together. The homepage, search page and dashboard become the detailed, visual parts of the site. The take page stays close to today. Personality quizzes get their own highlight colour wherever a single quiz is on screen.

Nothing about how quizzes, results, accounts or grading work changes, with one exception: the dashboard's summary tiles need one new read-only database function (Phase 5).

## Decisions made with the project owner

Every page was mocked up and chosen by the owner on 2026-11-16. The mockups are kept in `.superpowers/brainstorm/2045-1794871015/content/` (git-ignored, local only); the file named against each decision below is the chosen version.

| Area | Decision | Mockup |
| --- | --- | --- |
| Homepage | Option A: side-by-side hero, title and tagline left, cover art right | `../1958-1794870374/content/homepage-hero.html` |
| Search | Option A: card grid | `search-page.html` |
| Quiz details popup | B2 side panel with S1b art (progress bar and text lines on top, answer sheet below) | `details-v5.html` (S1b) |
| Settings popup | Option B: theme preview tiles, pill groups, font switch | `popups-v3.html` |
| Log in popup | Option A: full-width buttons, secondary actions as quiet text buttons | `popups-v3.html` |
| Confirm dialogs | Follow the chosen popup style | `popups-v3.html` |
| Kind colour | Blue site-wide; purple highlight on every page and popup that shows one personality quiz (details popup, take page, result page, editor while building one) | `highlight.html` |
| Take page | T1: no boxes, questions separated by lines, real controls at 1.0625rem | `take-v6.html` |
| Result pages | Score or outcome card with the two actions inside it (option B) | `quiz-flow.html`, `result-actions-v3.html` (B) |
| Dashboard | D2: summary tiles, result cards, quiz cards | `dashboard-v3.html` (D2) |
| Quiz editor | Step pills, outlined question and outcome blocks, dashed add slots, Kind and Suggested time in matching padded panels, personality answers as a table with 1-2-3 points pills (option C) | `editor-steps-v2.html`, `editor-fixes-v2.html`, `points-options.html` (C) |
| Build approach | Shared pieces first, then pages, one PR per phase | — |

The mockups were all drawn in dark mode. Light mode and high contrast follow from the same tokens and must be checked, not assumed (criteria G2, G3).

## Approaches considered

- **Shared pieces first, then pages in phases (chosen).** Small reviewable PRs, each shippable; every page uses the same parts, which is what fixes the "thrown together" feel. Costs more PRs.
- **One branch, page by page.** Faster to start, but one very large review and pages drift apart before anything is shared.
- **Design screens in Claude Design first, then port.** Not needed: the owner chose from mockups built with the real Ply styles.

## Acceptance criteria

### Global (every phase)

G1. **No new libraries.** Ply CSS, our CSS, React and inline SVG only. All new class names are checked against `node_modules/ply-css/ply-classes.json` so they don't collide with Ply (the mockups hit collisions with Ply's `.steps` and `.status`).
G2. **Contrast** meets WCAG 2.2 AA for text (4.5:1, 3:1 for large text) and non-text UI (3:1) in light, dark, and high-contrast modes, for both kind colours, the status colours and the chips. Where a colour fails in a mode, it gets a per-mode value; it is never dropped.
G3. **Themes:** every new colour is a CSS custom property on `:root` with values for light and dark (and high contrast where needed), next to the existing rules in `src/styles/settings.css` or in `src/styles/app.css`.
G4. **Text size** in `rem` only, so the four text-size settings scale everything, including the new control and artwork sizes where they should scale.
G5. **Targets** are at least 24×24 CSS pixels (2.5.8). Focus is always visible (2.4.7) and never hidden behind sticky content (2.4.11).
G6. **Colour never carries meaning alone.** Kind chips say TRIVIA or PERSONALITY; result statuses say Correct, Partly correct or Wrong next to their symbol; "Quiz updated" and "Quiz deleted" are words.
G7. **Artwork** is decorative: `aria-hidden="true"`, `focusable="false"`, drawn only with theme colours so it follows light, dark and high contrast.
G8. **Phone width:** no horizontal page scroll at 320 CSS pixels, at every text size (1.4.10). Grids drop to two columns on tablets and one on phones.
G9. **Behaviour is unchanged:** routes, focus management, announcements, dialog open and close rules (including the details popup's URL and Back behaviour from feature 6), form validation and error summaries all keep working exactly as they do now. Existing tests keep passing, updated only where markup legitimately changed.
G10. **Wording is unchanged** except where this spec says otherwise.
G11. Each phase ends with `npm run lint`, `npm run typecheck`, `npm test` and `npm run db:test` passing, no console warnings, new component tests with role-based queries and `vitest-axe`, and the manual checks listed for that phase.

### Phase 1: Shared pieces

P1.1. **Tokens.** In our CSS: a kind accent token used by chips, strips and highlights; personality purple (starting from `#8a3ffc`, adjusted per mode for G2); status colours for correct, partly correct and wrong; a larger corner radius for cards and dialogs (about 1rem) and a medium one for inputs (about 0.6rem).
P1.2. **Kind highlight scope.** An element with `data-kind="personality"` overrides `--ply-btn-default-bg` (and its hover and active shades), `--ply-color-link`, `--ply-color-focus` and `--ply-color-accent` to the purple values, so every Ply button, link, focus ring and checked control inside it turns purple. Trivia needs no attribute. This is separate from the per-element kind accent in P1.1: cards on the search page and dashboard use the accent for their chip and strip only, and are never inside the scope, so their buttons and links stay blue.
  - **Where the scope applies (builder's call, agreed in review):** the whole content of a page or popup that shows one personality quiz, including any popup opened from inside it (for example "Start over?", the editor's confirm dialogs, and Log in opened from "Save to my account" on a personality result). The navbar, and the Settings popup it opens, are never inside the scope.
P1.3. **Native controls.** Radios and checkboxes site-wide are 1.0625rem square and use `accent-color: var(--ply-btn-default-bg)`, so they follow the kind scope.
P1.4. **Components** in `src/components/ui/` (new folder), each with tests:
  - `KindChip`: the TRIVIA / PERSONALITY chip.
  - `QuizMeta`: question count and suggested time with small decorative icons.
  - `Switch`: a `button` with `role="switch"` and `aria-checked`, drawn as a track and knob, with a visible text label. Used for the timer.
  - `PillGroup`: a `fieldset` of real radio inputs drawn as joined pills, legend kept. Used for settings, editor points.
  - `StepPills`: the editor's step indicator (decorative list; the existing "Part N of M" heading stays as the accessible heading).
  - `CoverArt`: the homepage cover drawing (checkbox column, accent answer grid, two result blocks), scalable.
  - `StripArt`: the S1b strip drawing, with a `kind` prop: circles for trivia, rounded squares for personality.
P1.5. **Dialog shell.** One shared look for every `<dialog>`: rounded corners, surface background, shadow, and a round close button at least 2rem. Ply's dialog classes stay; overrides live in our CSS.
P1.6. **Quiz card.** `QuizCard` gets the new look: rounded surface, `KindChip`, title, description clamped to two lines, `QuizMeta` at the bottom. The whole card is clickable through the title link stretched over the card (one link, one tab stop); anything in `actions` sits above the stretched link and stays separately clickable.

### Phase 2: Homepage and search

P2.1. **Homepage:** two-column hero, title, tagline and "Find a quiz" on the left, `CoverArt` on the right, vertically centred. On phones the art moves under the text and scales to the width. `QuizIllustration` is replaced by `CoverArt` (deleting `QuizIllustration.tsx` needs the owner's OK at that point, per `CLAUDE.md` §7).
P2.2. **Search page:** the search box is one rounded field with a search icon and the Search button inside it; the visible label "Search quizzes" stays (it may be visually styled but not removed). Results heading and count on one line. Cards in a grid: three columns on desktop, two on tablets, one on phones. "Show more", the status line and the error retry keep their current behaviour.

### Phase 3: Popups

P3.1. **Quiz details popup:** `StripArt` down the left in the kind colour; on the right the `KindChip`, round close button, title, `QuizMeta` and description; a footer with the timer `Switch` and "Start quiz" (or "No suggested time" in place of the switch). "Continue your quiz" and the "Start over?" confirm keep working. The popup is inside the kind scope.
P3.2. **Settings popup (option B):** Theme as three preview tiles (System, Light, Dark) that are real radios in a fieldset; Text size and High contrast as `PillGroup`s (text-size pills keep showing each size); the Lexend checkbox drawn as a switch (still a checkbox, `role="switch"` allowed); the Account section separated by a rule with "Delete my account" in red. The no-sideways-scroll fix at Largest on 320px still holds.
P3.3. **Log in popup (option A):** full-width "Send code" and "Log in" buttons; "Send a new code" and "Use a different email" become quieter text-style buttons under the main button (still `<button>`s, still at least 24×24). The status note ("Code sent to …") becomes a soft tinted row. The code field keeps its label, `autocomplete="one-time-code"`, `inputmode="numeric"`, paste, and every announcement.
P3.4. **Confirm and delete-account dialogs:** the dialog shell, buttons right-aligned, destructive action in red. No close button is added; Cancel and Escape remain the way out.

### Phase 4: Take and result pages

P4.1. **Take page (T1):** `KindChip`, title, "Page N of M" text above a progress bar, the countdown as a pill at the top right when timed. Questions are separated by thin lines with no boxes or per-answer backgrounds; the "Question N of M" text stays in the legend. An unanswered question shows a red bar on its left edge plus its existing "Answer this question." text. "Previous page" left, "Next page" or "Submit answers" right. The page is inside the kind scope.
P4.2. **Trivia result:** a score card with points, percent, a bar, and the correct / partly correct / wrong tally (symbol plus words); "Copy link" and "Find another quiz" as small buttons inside the score card; notices as soft rows; "Save to my account" as a dashed card when it applies; then a card per question with a status badge that keeps today's words (for example "◐ Partly correct: 0.5 points") and every option marked with its symbol and words.
P4.3. **Personality result:** `StripArt` beside "You're [outcome]" and the description, the quiz title under it, "Copy link" and "Find another quiz" inside that card, then notices. Inside the kind scope.
P4.4. The button label "Copy results link" becomes **"Copy link"** (agreed; the result card gives the context). Its fallback (showing the link in a field) is unchanged.

### Phase 5: Dashboard

P5.1. **Database:** one new function, `get_my_dashboard_summary()`, in a new migration. It takes no arguments, returns `{ results_saved, quizzes_made, average_trivia_score }` for `auth.uid()` only, and is executable by `authenticated` only. `average_trivia_score` is the mean of `results.score` over the member's trivia results, or null when they have none. `quizzes_made` counts quizzes the member created. It follows the existing pattern in `20261113000200_dashboard_lists.sql` (security invoker for results where RLS already allows it; security definer with `set search_path = ''` only if needed for `creator_id`). No new tables, columns, stored data or RLS policies.
P5.2. **pgTAP tests** in a new `supabase/tests/11_dashboard_summary.test.sql`: correct numbers for a member; another member's rows are never counted; anonymous results are never counted; `anon` cannot execute it; null average with no trivia results. `npm run db:types` is re-run.
P5.3. **Dashboard page (D2):** "Your dashboard", then three summary tiles (results saved, quizzes made, average trivia score, showing "—" when null); "My results" as cards in the same grid as search, each with `StripArt` in its kind colour, `KindChip`, title, the score with a bar for trivia or the outcome for personality, the date, and any "Quiz updated" / "Quiz deleted" tag in words; "My quizzes" as `QuizCard`s with Edit and Delete in the card's actions; "Create a quiz" as the primary button on that section's heading. Loading, empty and error states for each section and "Show more" keep their current behaviour; the tiles have their own loading and error state.

### Phase 6: Quiz editor

P6.1. `StepPills` above the existing "Part N of M: …" heading. The editor is inside the kind scope of the kind currently selected, so the highlight switches as soon as the creator picks Personality.
P6.2. **Basics:** title and description with their character counts at the right of the label row; Kind as a padded rounded panel (fieldset, legend "Kind", same two radios and labels).
P6.3. **Suggested time** (bottom of the Questions part, where it is now) uses the same padded panel as Kind.
P6.4. **Questions and outcomes:** each one in a thin rounded outline with its name and the Move up, Move down and Remove buttons in the header. Move up stays `aria-disabled` and visibly dimmed on the first item, Move down on the last, as today. Inputs and selects get the medium radius. "Add question" and "Add outcome" become dashed full-width slots (still `<button>`s, same ids for the error summary links).
P6.5. **Personality answers (option C):** a table per question with column headings Answer, Leads to and Points; each row has the answer text input, the outcome select and a `PillGroup` of 1, 2, 3 for points. Every control keeps a programmatic label naming its answer (for example "Answer 2 points"). Trivia answers keep their Correct radio or checkbox per row.
  - **Narrow screens (decided by the owner):** the table shows wherever it fits. Below a set width (the builder picks it, in `rem`, so it also triggers at larger text sizes), each answer becomes a stacked block with the text input, the outcome select and the points pills one under another, and each control shows its own visible label ("Leads to", "Points"), since the column headings are not visible there. No sideways scrolling at 320px wide at any text size (G8, WCAG 1.4.10). The same inputs are used in both layouts, so labels, values and focus order do not change between them.
P6.6. Previous and Discard on the left, Next or Publish on the right.

## Files in scope

- `src/styles/app.css`, `src/styles/settings.css`, `src/styles/search.css`, `src/styles/editor.css`, and new CSS files under `src/styles/` if a phase needs one.
- New: `src/components/ui/*` (P1.4) and their tests.
- `src/components/*.tsx`, `src/components/{dashboard,quiz-editor,result,take}/*.tsx` that render the pages and popups above, and their tests.
- `src/pages/*.tsx` and their tests.
- Phase 5 only: a new migration in `supabase/migrations/`, `supabase/tests/11_dashboard_summary.test.sql`, a new `src/hooks/useDashboardSummary.ts`, a Zod schema for its response in `src/schemas/`, and the regenerated `src/types/database.types.ts`.
- `specs/07-ui-redesign.md` (status updates).

## Out of scope

- **Points per question** for personality quizzes. The owner raised it; it changes quiz rules in `CLAUDE.md`, the schema, grading and existing quizzes, so it needs its own feature and spec.
- Any change to grading, scoring, results, claiming, auth, rate limits or the details popup's URL mechanism.
- New libraries, icon packs, fonts or third-party assets.
- Tags, categories, analytics, or any new stored user data (the summary is computed on read).
- Editing `CLAUDE.md` (the owner adds feature 7 there).
- Re-syncing the Claude Design design system after the redesign (a follow-up).

## Open questions

None. The narrow-screen personality answers table was decided by the owner on 2026-11-17: a table on wider screens, stacked blocks on narrow ones (P6.5).

## Calls made in review (owner to check)

- Status badges keep today's words ("Partly correct", not "Partly"), per G10.
- Popups opened from inside a personality page share its purple scope; the navbar and Settings stay blue (P1.2).

## Left to the builder

- Exact token values per mode, as long as G2 passes; exact spacing, shadows and icon drawings within the look of the mockups.
- How `data-kind` is applied (a wrapper element or the existing `<main>`/`<dialog>`).
- Splitting a phase into smaller PRs if it gets large.

## Manual checks (each phase, for what it touches)

- Keyboard only: every control reachable, visible focus, popups trap and return focus, Escape closes.
- Screen reader spot check: chips, statuses, switches and pill groups read correctly; artwork is skipped.
- Light, dark and high contrast; both kinds.
- Text size Largest at 320px wide: no sideways scroll.
- `prefers-reduced-motion`: no new motion is added; if any transition is added, it is disabled under reduced motion.
