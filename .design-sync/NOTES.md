# Design sync notes

Claude Design project: https://claude.ai/design/p/debf46a7-0469-4e16-a40a-7f1c8b93cd45 (pinned in `config.json`).

## How this repo is synced

- This is an app, not a component library: there's no `dist/` and no Storybook. `.design-sync/entry.tsx` is the hand-written entry (`cfg.entry`). It re-exports only the presentational components, imports the real stylesheets (Ply, `src/styles/app.css`, `search.css`, `settings.css`, Lexend 400/700), and defines `QuizMakerProvider`.
- Scope (chosen by the user on 2026-11-13): 14 presentational components. Left out because they need Supabase, env vars, or live queries: LoginDialog, LoginButton, SettingsDialog, SettingsButton, SiteHeader, DeleteAccountDialog, QuizDetailsDialog, StartQuizControls, SaveResultSection, the dashboard sections, and the whole quiz editor except FieldError. Importing anything that reaches `src/lib/supabase.ts` would break the bundle (it reads `import.meta.env`).
- `QuizMakerProvider` creates a TanStack memory router with routes `/`, `/search`, `/dashboard`, `/results/$resultId`. Add a route there if a newly synced component links somewhere else.
- No `.d.ts` exists, so every component's props are hand-written in `cfg.dtsPropsFor`, flattened from `src/schemas/*.ts`. **When a component's props or a schema changes, update `dtsPropsFor` by hand.** Nothing checks it automatically.
- `ErrorSummary` here is `src/components/take/ErrorSummary.tsx`. The quiz-editor one has the same name and isn't synced.
- Fonts (Lexend) are inlined as data URLs in `_ds_bundle.css`, so there's no `fonts/` directory. That's expected.
- Converter commands: `node .ds-sync/package-build.mjs --config .design-sync/config.json --node-modules ./node_modules --out ./ds-bundle` (the entry comes from cfg). Playwright and Chromium live in `.ds-sync/node_modules` (installed there, not in the app).
- On Windows Git Bash, big multi-file heredocs with quotes failed to parse. Write preview files one at a time.

## Known render warns

- `[RENDER_THIN]` QuizIllustration: it's a decorative SVG with no text by design. The screenshot shows it correctly.

## Re-sync risks

- `dtsPropsFor` duplicates the prop and schema shapes and goes stale silently when `src/schemas/*.ts` or a component's props change.
- The synced styles are whatever is on disk at build time, including uncommitted work. The first sync ran on `fix/ui-polish` with uncommitted `app.css`/`settings.css` changes.
- The previews in `previews/` use realistic data that matches today's schemas. Recheck them if result or quiz shapes change.
- Card overrides (`ConfirmDialog` 560x440, `TriviaResult` 760x1100) depend on content length.
