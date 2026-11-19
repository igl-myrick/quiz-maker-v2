# Members log in with Google or GitHub instead of an email code

Members log in through Supabase Auth's built-in OAuth with Google or GitHub. This replaces the original one-time code sent by email (feature 4). Sending login email needs an SMTP provider, and before deploying the project owner found that Brevo and other SMTP providers don't work for this project. Supabase's own email service is only for testing.

Staying on Supabase Auth keeps members as ordinary `auth.users` rows, so `auth.uid()` in RLS and functions, the foreign keys that cascade on account deletion, claiming, the settings sync and the pgTAP tests all stay as they are. The change is limited to the login popup, a new `/auth/callback` route, and local config.

## Considered Options

- **Keep email codes with an SMTP provider** (the original design). Rejected by the project owner: no SMTP provider works for this project.
- **Firebase Authentication with email links.** Rejected. Firebase users aren't in `auth.users` and their IDs aren't UUIDs, so every foreign key, cascade, RLS policy and pgTAP test that uses `auth.uid()` would need reworking, and account deletion would be split across two services. It also adds the Firebase SDK and a second backend, and it still depends on sending email. Links opened in a new tab or on another device would also lose the take in session storage or the claim token.
- **More providers** (Discord, Microsoft and others). Not now: each one is another OAuth app to register and keep working. Google covers most people, and GitHub suits a developer audience.
- **Opening the provider in a popup window** so the page never reloads. Rejected for now: it needs cross-window session handoff and handling for popup blockers, for little gain. Take progress, claim tokens and settings already survive a same-tab redirect, and the app puts focus back and announces the login on return.

## Consequences

- Logging in leaves the page and comes back. Before redirecting, the app saves the path and the element to refocus in session storage (never in the URL), and puts the person back there afterward.
- Google and GitHub send a profile (name, avatar URL and similar), and Supabase Auth stores it on the auth user. The project owner approved this as an exception to the minimal-data rule, on the condition that the app never reads, shows, copies or logs it.
- A member who uses both providers with the same verified email gets one account, because Supabase links identities by email.
- Local development needs real Google and GitHub OAuth apps pointed at the local Supabase stack. The seeded test members can no longer log in, but still exist as quiz creators.
- The project owner sets up the hosted providers and adds the production domain and Vercel preview URLs to the hosted redirect allowlist.
