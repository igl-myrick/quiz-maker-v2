# Quiz Maker

**Live site: [quiz-maker-v2-xi.vercel.app](https://quiz-maker-v2-xi.vercel.app/)**

A casual quiz site. Anyone can take personality and trivia quizzes for fun, and members can save their results and make their own quizzes.

- **No account needed to play.** Anonymous results get a private link that expires after 1 day.
- **Members** log in with Google or GitHub (no passwords). Their results are kept, they can create, edit and delete quizzes, and they get a dashboard.
- **Grading happens on the server.** Answer keys are never sent to the browser before a quiz is submitted.
- **Results are snapshots.** Editing or deleting a quiz never changes results people already have.
- **Built for WCAG 2.2 AA**, with theme, text size, high contrast and a dyslexia-friendly font in the settings menu.
- **No analytics, tracking or third-party scripts.**

## Tech stack

React, TypeScript and Vite, with TanStack Router and Query, React Hook Form, Zod, Zustand and [Ply CSS](https://plycss.com/). The backend is [Supabase](https://supabase.com/) (Postgres, Auth, Edge Functions, `pg_cron`), and the static front end is hosted on [Vercel](https://vercel.com/). Tests use Vitest, React Testing Library and pgTAP.

## Build and run locally

### Prerequisites

- [Node.js](https://nodejs.org/) 22 or newer, with npm
- [Docker](https://docs.docker.com/get-docker/) (Docker Desktop on Windows and macOS), running. The local Supabase stack runs in containers.
- Git

The Supabase CLI is a dev dependency, so you don't need to install it globally. Run it as `npx supabase …`.

### 1. Clone and install

```sh
git clone https://github.com/igl-myrick/quiz-maker-v2.git
cd quiz-maker-v2
npm install
```

### 2. Create local OAuth apps

Logging in needs a Google and a GitHub OAuth app that point at your local Supabase stack. You can skip this step if you only want to take quizzes anonymously, but you won't be able to log in, create quizzes or use the dashboard.

The callback URL for both is:

```
http://127.0.0.1:54321/auth/v1/callback
```

- **GitHub:** go to *Settings → Developer settings → OAuth Apps → New OAuth App*. Use `http://localhost:5173` as the homepage URL and the callback URL above. Generate a client secret.
- **Google:** in the [Google Cloud console](https://console.cloud.google.com/), go to *APIs & Services → Credentials → Create credentials → OAuth client ID*, choose *Web application*, and add the callback URL above as an authorized redirect URI. You may need to set up the OAuth consent screen first. While it is in testing mode, add your own Google account as a test user.

### 3. Create the env files

There are three env files. All of them are gitignored, so never commit them.

| File | Copy from | Holds |
| --- | --- | --- |
| `supabase/.env` | `supabase/.env.example` | Google and GitHub client IDs and secrets for the local stack |
| `supabase/functions/.env` | `supabase/functions/.env.example` | Edge function secrets |
| `.env.local` | `.env.example` | The front end's Supabase URL and public key |

```sh
cp supabase/.env.example supabase/.env
cp supabase/functions/.env.example supabase/functions/.env
cp .env.example .env.local
```

Then fill them in:

- **`supabase/.env`:** paste the four OAuth values from step 2. Use plain `KEY=value` lines, with no quotes and no `export`. A missing value doesn't cause an error at startup, but login will fail.
- **`supabase/functions/.env`:** set `IP_HASH_SECRET` to any long random string, for example the output of `openssl rand -hex 32`. Keep `RATE_LIMIT_TRUST_XFF=true`. It is for local development only.
- **`.env.local`:** fill this in after the next step.

### 4. Start Supabase

```sh
npm run db:start
```

The first run downloads the Docker images, which takes a few minutes. Starting the stack applies every migration in `supabase/migrations/` and loads the sample quizzes from `supabase/seed.sql`.

When it finishes, it prints the local URLs and keys. Run `npx supabase status` to see them again. Copy the **API URL** (`http://127.0.0.1:54321`) and the **anon** or **publishable** key into `.env.local`:

```sh
VITE_SUPABASE_URL=http://127.0.0.1:54321
VITE_SUPABASE_ANON_KEY=<anon or publishable key>
```

Only the public key goes in `.env.local`. Never put the service role (secret) key in a front-end env file.

Supabase Studio, a local database dashboard, is at http://127.0.0.1:54323.

### 5. Serve the edge functions

Submitting a quiz and deleting an account run in edge functions. In a second terminal, run:

```sh
npx supabase functions serve
```

This reads `supabase/functions/.env` and reloads when you edit a function. Leave it running.

### 6. Start the app

```sh
npm run dev
```

Open http://localhost:5173. Use `localhost`, not `127.0.0.1`, so that login redirects back to the right address.

### Stopping and resetting

```sh
npm run db:stop    # stop the local stack (your data is kept)
npm run db:reset   # rebuild the local database from the migrations and seed
```

Restart the stack (`npm run db:stop`, then `npm run db:start`) after editing `supabase/.env` or `supabase/config.toml`.

## Scripts

| Command | What it does |
| --- | --- |
| `npm run dev` | Vite dev server |
| `npm run build` | Type-check and build for production into `dist/` |
| `npm run preview` | Serve the production build locally |
| `npm run lint` | ESLint, including `jsx-a11y` |
| `npm run typecheck` | TypeScript check of every `tsconfig` |
| `npm run format` / `format:check` | Prettier, writing or checking only |
| `npm test` | Vitest unit and component tests, single run |
| `npm run db:start` / `db:stop` | Start or stop the local Supabase stack |
| `npm run db:reset` | Rebuild the local database from migrations and seed |
| `npm run db:test` | pgTAP database tests in `supabase/tests/` (the stack must be running) |
| `npm run db:types` | Regenerate `src/types/database.types.ts` from the local database |
| `npm run db:new -- <name>` | Create a new migration file |

## Deploying your own copy

A deployment has two parts: a hosted **Supabase** project for the database, auth and edge functions, and a **Vercel** project for the static front end. Set up Supabase first, because Vercel needs its URL and key.

### Supabase

1. **Create a project** at [supabase.com](https://supabase.com/dashboard). Note its **project ref** (the `xxxx` in `https://xxxx.supabase.co`).

2. **Link the repo and push the schema.** This applies every migration, including the `pg_cron` cleanup job. The seed data is for local development only and is not pushed.

   ```sh
   npx supabase login
   npx supabase link --project-ref <your-project-ref>
   npx supabase db push
   ```

3. **Set the edge function secret.** Use a new random value, not the one from your local `.env`. Don't set `RATE_LIMIT_TRUST_XFF` on a hosted project.

   ```sh
   npx supabase secrets set IP_HASH_SECRET=<long random string>
   ```

4. **Deploy the edge functions.** `supabase/config.toml` turns off the platform's JWT check for both functions (`verify_jwt = false`), because they check the caller themselves.

   ```sh
   npx supabase functions deploy submit-quiz
   npx supabase functions deploy delete-account
   ```

5. **Set up auth** in the dashboard under *Authentication*:
   - **Providers:** turn off **Email**. Turn on **Google** and **GitHub**, and paste in the client ID and secret of a separate production OAuth app for each. The callback URL for both apps is `https://<your-project-ref>.supabase.co/auth/v1/callback`. For Google, publish the OAuth consent screen so that anyone can log in, not only test users.
   - **URL configuration:** set the **Site URL** to your production domain, for example `https://your-app.vercel.app`. Under **Redirect URLs**, add `https://your-app.vercel.app/auth/callback`. If you want login to work on Vercel preview deployments too, add a wildcard such as `https://*-<your-vercel-team>.vercel.app/auth/callback`.

6. **Check the cleanup job.** Under *Integrations → Cron*, confirm that the `cleanup-expired` job exists and runs every 15 minutes. It deletes expired anonymous results, old rate-limiter rows, and retired quiz versions.

7. **Check the client IP header.** Rate limiting for anonymous visitors uses the `cf-connecting-ip` header. Send a test submission with a forged `X-Forwarded-For` header and confirm the limit still applies to your real address. See `specs/01-quiz-taking.md` for details.

8. **Get the public key.** Under *Project Settings → API Keys*, copy the **publishable** key (or the legacy **anon** key). You'll need it for Vercel.

### Vercel

1. **Point the Content-Security-Policy at your Supabase project.** `vercel.json` only allows the browser to connect to the original project. In the `Content-Security-Policy` header, change the `connect-src` host to your own:

   ```
   connect-src 'self' https://<your-project-ref>.supabase.co;
   ```

   Commit this change to your fork. The `script-src` hash matches the inline settings script in `index.html`. If you edit that script, update the hash too. `npm test` checks that they match.

2. **Import the repository** at [vercel.com/new](https://vercel.com/new). Vercel detects Vite, so the defaults work: build command `npm run build`, output directory `dist`.

3. **Add environment variables** for Production and Preview:

   | Name | Value |
   | --- | --- |
   | `VITE_SUPABASE_URL` | `https://<your-project-ref>.supabase.co` |
   | `VITE_SUPABASE_ANON_KEY` | The publishable or anon key from Supabase step 8 |

   These are the only variables the front end needs. If you connect Supabase's Vercel integration, turn off its environment variable sync. It copies database passwords and the service role key into Vercel, which never needs them.

4. **Deploy.** `vercel.json` rewrites every path to `index.html`, so direct links to results and quizzes work. It also sets the security headers.

5. **Update the redirect URLs** in Supabase (step 5 above) if your final domain is different from the one you entered.

Don't turn on Vercel Analytics or Speed Insights. The site doesn't collect usage data, and its privacy page says so.

## Project layout

```
src/
  components/   React components (shared UI pieces in components/ui/)
  pages/        Page components rendered by routes
  routes/       File-based TanStack Router routes (routeTree.gen.ts is generated)
  hooks/        React hooks
  stores/       Zustand stores
  schemas/      Zod schemas
  lib/          Supabase client, query client, utilities
  styles/       Design tokens and custom CSS on top of Ply
  types/        database.types.ts (generated) and app types
supabase/
  migrations/   SQL migrations, the source of truth for the schema and RLS
  functions/    Edge functions: submit-quiz (grading) and delete-account
  tests/        pgTAP database tests
  seed.sql      Sample quizzes for local development
specs/          Specs for each feature
docs/adr/       Architecture decision records
```

`src/routeTree.gen.ts` and `src/types/database.types.ts` are generated. Don't edit them by hand. Run `npm run db:types` after changing the schema.

## Stretch goals

Ideas for later. None of them are built yet.

- **Images in questions:** attach images from a short allowlist of trusted image hosts, with required alt text.
- **PWA / offline mode:** an installable app that caches the app shell and queues submissions while offline.
- **AI quiz generation and tagging:** draft a quiz from a topic and tag quizzes automatically, all server-side.
- **Search suggestions:** popular-this-week and all-time lists from anonymous daily play counts, and maybe autocomplete.
- **Personality quiz upgrades:** multi-select questions and showing up to 5 ranked outcomes.
- **Moderation and reporting:** a way to report inappropriate quizzes and review or remove them.

## License

See [LICENSE.md](LICENSE.md).
