# Feature 0: Project foundation

Status: **Approved** (2026-11-10). Rules come from `CLAUDE.md`. Schema details come from `ARCHITECTURE_SPEC.md` (sections 4, 6, 7.1 and 12).

## Goal

A working, empty foundation that every later feature builds on:
- the front-end toolchain, with routing and data fetching wired up
- styling available
- tests, lint and type-check running
- the local Supabase stack, holding the core schema and access rules for quizzes and results
- seed quizzes to develop against

No feature screens.

## Starting point

- `package.json` already lists the `supabase` CLI (`^3.1.0`) as a dev dependency. The project owner approved it for this feature, and it is run with `npx supabase` or through npm scripts.
- `supabase/.temp/` exists because this folder is linked to a hosted Supabase project. **Agents must never run `supabase link`, `supabase db push`, `supabase functions deploy`, or any command that targets a hosted project.** `supabase/.temp/` is never committed.
- Docker is installed, which `supabase start` needs.

## Acceptance criteria

### Toolchain

1. `npm run dev` starts Vite. The home page (`/`) shows an `<h1>` with the site name, "Quiz Maker" **(call)**, with no errors or warnings in the browser console.
2. `npm run build`, `npm run lint`, `npm run typecheck` (type-checks every tsconfig in the project without emitting files: `tsc --noEmit` for a single tsconfig, or `tsc -b` when the tsconfigs set `noEmit`), `npm run format` (Prettier write), `npm run format:check`, and `npm test` (Vitest, single run) all exist and pass.
3. TypeScript `strict` is on. ESLint fails on `any` (`@typescript-eslint/no-explicit-any`), on `jsx-a11y` recommended rules, and on React Hooks rules. Prettier and ESLint do not conflict (`eslint-config-prettier`).
4. `src/routeTree.gen.ts` and `src/types/database.types.ts` are excluded from both ESLint and Prettier, and are committed.
5. `.gitattributes` contains `* text=auto eol=lf`, and Prettier uses `endOfLine: "lf"`. No committed file has CRLF line endings (`git ls-files --eol` shows `i/lf` throughout).
6. `vercel.json` rewrites every path to `/index.html`, so direct loads of any URL serve the app. It enables no Vercel-specific features.
7. `.gitignore` covers `node_modules/`, `dist/`, `.env*.local`, `supabase/.temp/`, and `.superpowers/` (local brainstorming mockups). `supabase init` also writes its own ignore file inside `supabase/`.
8. `package.json` has `"type": "module"` and `"engines": { "node": ">=22" }` **(call)**.

### App skeleton

9. TanStack Router is file-based through `@tanstack/router-plugin` (Vite plugin). `src/routes/__root.tsx` and `src/routes/index.tsx` are thin: the index route renders `HomePage` from `src/pages/HomePage.tsx`. The root route sets a minimal `notFoundComponent`: an `<h1>` reading "Page not found" and a link home **(call)**. Without it, TanStack Router logs a console warning in development, which would break criterion 1. It gets no styling or design work.
10. `src/lib/queryClient.ts` exports one `QueryClient`. The root route wraps the app in `QueryClientProvider`.
11. `src/lib/supabase.ts` exports one typed client, `createClient<Database>(url, key)`. It reads `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY`, which takes the local stack's anon/publishable key. If either is missing it throws a clear error at startup. A committed `.env.example` shows both names with local placeholder values. No service role key appears anywhere in `src/` or in any env file the front end reads.
12. Ply CSS (`ply-css`) is installed, and `ply-css/dist/css/ply.min.css` is imported once in `src/main.tsx`. Neither Sass nor any other CSS library is added. Before importing, the builder reads `node_modules/ply-css/PLY.md` and follows any setup it requires, such as a root class or attribute.
13. Every component uses named exports. The only default exports are config files that require them.
14. One component test, `src/pages/HomePage.test.tsx`, renders `HomePage`, finds the heading by role, and passes a `vitest-axe` check. This proves the test setup works.

### Database (local stack only)

15. `npx supabase init` has created `supabase/config.toml`. npm scripts wrap the CLI:

    | Script | Runs |
    | --- | --- |
    | `db:start` | `supabase start` |
    | `db:stop` | `supabase stop` |
    | `db:reset` | `supabase db reset` |
    | `db:test` | `supabase test db` |
    | `db:types` | `supabase gen types typescript --local > src/types/database.types.ts` |
    | `db:new` | `supabase migration new` (used as `npm run db:new -- <name>`) |

16. Migrations in `supabase/migrations/` build exactly the feature 0 subset of `ARCHITECTURE_SPEC.md`, with one concern per file:
    - enum types `quiz_kind` and `question_type` (the other enums arrive with their features)
    - tables `quizzes`, `questions`, `options`, `outcomes`, `option_keys` and `results`, with every column, check constraint, unique constraint, foreign key action and index from section 4. Text and count limits are not included, because feature 2 adds them.
    - the `quizzes_public` view (section 6.3)
    - privileges and RLS for every table, using the revoke-then-grant pattern and the access matrix in section 6
    - `get_result(p_id uuid) returns jsonb` as specified in section 7.1. It never returns `owner_id` or `claim_token_hash`. Exact shape **(call)**:
      - **Not found:** `{ "status": "not_found" }`, and nothing else.
      - **Expired:** `{ "status": "expired" }`, and nothing else.
      - **OK:** `{ "status": "ok", "quiz_exists", "quiz_updated", "claimable", "result": { "id", "quiz_id", "quiz_version", "quiz_kind", "quiz_title", "created_at", "expires_at", "score", "snapshot", "winning_outcome" } }`.
        - `score` is null for personality quizzes.
        - `winning_outcome` is `{ "id", "title", "description" }` for personality quizzes and null for trivia.
        - For trivia, `snapshot` is returned exactly as stored.
        - For personality, `snapshot` is returned with `outcomes` removed, and with `outcome_id` and `points` removed from every option. `outcome_ranking` is never returned.
17. `npm run db:reset` rebuilds the database from migrations plus `supabase/seed.sql` with no errors.
18. `supabase/seed.sql` (local only) inserts:
    - **2 test members** with fixed UUIDs and `@example.test` emails. Each has complete `auth.users` and `auth.identities` rows, so from feature 4 onward you can log in as either one with a code from the local test inbox and edit their seeded quizzes **(call)**. The builder copies the row shape from current Supabase docs or examples for the installed CLI version, rather than guessing.
    - **8 public quizzes**:
      - 5 trivia: world capitals, the solar system, animals, food around the world, and general science
      - 3 personality: which season matches you, what kind of traveller you are, and which pet suits you
    - Ownership:
      - Each test member creates some of the quizzes.
      - Both test members have a quiz titled "General Knowledge", which shows that different creators may share a title. These may be 2 of the 8 above, or 2 extra quizzes.
    - Variety:
      - Every question type appears.
      - At least 2 quizzes have a suggested time and at least 2 do not.
      - Overlapping words such as "capital" and "space" appear in more than one title or description.
      - One personality quiz has an answer path that ends in a tie between outcomes.
    - Every seeded quiz passes all of the validation rules in `CLAUDE.md` §1.
    - No seed results.
19. `npm run db:types` regenerates `src/types/database.types.ts`, which is committed and matches the migrations.
20. `npm run db:test` passes pgTAP tests in `supabase/tests/` covering at least:
    - RLS is enabled on every table in `public`.
    - `anon` and `authenticated` can read `quizzes_public`, `questions`, `options` and `outcomes`.
    - `anon` and `authenticated` cannot read `quizzes.creator_id` or anything in `option_keys`.
    - `anon` cannot select from `results`. A member sees only their own results and cannot read `claim_token_hash`.
    - No client role can insert, update or delete `results`, and `service_role` cannot delete them.
    - A creator can delete their own quiz but not someone else's.
    - Deleting a quiz sets `results.quiz_id` to null and leaves the result intact.
    - Deleting an auth user removes their quizzes and results, and leaves other members' results.
    - `normalized_title` treats "Capitals Quiz", "capitals  quiz " and a tab-separated variant as equal, so the second insert for the same creator fails.
    - The `results` check constraints reject an owned row with an expiry and an anonymous row without a token hash.
    - `get_result` returns `ok`, returns `expired` past `expires_at` before any cleanup runs, and returns `not_found` for an unknown ID. It never includes `owner_id`, sets `quiz_updated` correctly, and returns only the winning outcome for personality results with no option mappings.

### Housekeeping

21. `CLAUDE.md` changes:
    - §3: commands updated to the npm scripts above, with `typecheck` shown as the actual command.
    - §2: records the `supabase` CLI as an approved dev dependency.
    - §11: feature 0's status updated when work starts and when it finishes.

    No other `CLAUDE.md` changes.
22. The work happens on a fresh branch, `feature/0-foundation`, cut from `main` after this spec has been merged.

## Packages

Everything below is part of the approved stack (`CLAUDE.md` §2), or is the standard companion package without which that tool can't run. **The project owner approves this list as part of approving this spec.** Install nothing else.

- **Runtime:** `react`, `react-dom`, `@tanstack/react-router`, `@tanstack/react-query`, `@supabase/supabase-js`, `ply-css`
- **Dev:**
  - Build and types: `vite`, `@vitejs/plugin-react`, `typescript`, `@types/react`, `@types/react-dom`, `@tanstack/router-plugin`
  - Lint and format: `eslint`, `@eslint/js`, `typescript-eslint`, `eslint-plugin-react-hooks`, `eslint-plugin-jsx-a11y`, `eslint-config-prettier`, `globals`, `prettier`
  - Tests: `vitest`, `jsdom`, `@testing-library/react`, `@testing-library/jest-dom`, `vitest-axe`
  - Supabase: `supabase` (already installed)

`react-hook-form`, `zod` and `zustand` are installed by the first feature that uses them, not here.

## Files in scope

```
.gitattributes  .gitignore  .prettierrc  .prettierignore  .env.example
eslint.config.js  index.html  package.json  package-lock.json
tsconfig*.json  vite.config.ts  vitest.setup.ts (or similar)  vercel.json
src/main.tsx
src/routes/__root.tsx  src/routes/index.tsx  src/routeTree.gen.ts
src/pages/HomePage.tsx  src/pages/HomePage.test.tsx
src/lib/queryClient.ts  src/lib/supabase.ts
src/types/database.types.ts
supabase/config.toml  supabase/.gitignore  supabase/seed.sql
supabase/migrations/*.sql  supabase/tests/*.sql
CLAUDE.md (§2, §3, and feature 0's status in §11 only)
```

Empty `src/components`, `hooks`, `stores` and `schemas` folders are not created until a feature needs them.

## Out of scope

- Any feature UI, including navigation, a layout shell, the settings menu, a designed 404 page (only the bare not-found heading from criterion 9), and styling beyond importing Ply.
- Authentication, and any auth configuration or email template (feature 4).
- `rate_limits`, `user_settings`, and the enums for them (features 2 and 5).
- `save_quiz`, `get_quiz_for_edit`, `list_my_quizzes`, `search_quizzes` and `claim_result` (features 2, 6 and 3).
- Edge functions, `pg_cron`, and the cleanup job (feature 1).
- Text and count limit constraints (feature 2).
- CI workflows, end-to-end tests, and deploying anywhere.
- Any command against the hosted Supabase project.

## Where to look when reviewing

This feature has no component state, no effects, no custom hooks, and no forms. The sensitive pieces are:
- **`src/lib/supabase.ts`:** only the anon key, read from env, with a clear error if it's missing.
- **`src/lib/queryClient.ts`:** one client, created once at module level and never inside a component.
- **`src/routes/__root.tsx`:** the providers, and nothing else.
- **The privileges and RLS migration, and `get_result`:** this is where data leaks would come from. Check them against the access matrix in `ARCHITECTURE_SPEC.md` §6.2.

## Manual checks

- Run `npm run dev`. Tab through the home page and confirm there are no console warnings.
- Run `npm run build`, then `npm run preview`, and load `/some/unknown/path` directly. The app loads and shows "Page not found".
- In the local Supabase Studio, confirm the seed data looks right. In the SQL editor, run `set role anon; select creator_id from quizzes;` and confirm it is denied.
