# TeamBuilder

A Vue 3 + Supabase hiring pipeline workspace: email/password sign-in, invited users who
choose their own password, in-memory sessions, a protected hiring portal, and sign-out. The
portal has a pipeline overview, role boards grouped by department, a step-column board for
each role, and an account page. The frontend is deployed to GitHub Pages with GitHub
Actions. Boards, pipeline columns, and applicants are stored in Supabase Postgres and loaded
through Pinia.

- **Live demo:** https://michielhbrand.github.io/TeamBuilder/
- **Repository:** https://github.com/michielhbrand/TeamBuilder
- **License:** [Apache-2.0](LICENSE)

## Stack

- Vue 3 + TypeScript + Vite
- Vue Router and Pinia
- Vuetify 4 (MIT) with MDI icons
- Manrope + IBM Plex Mono, self-hosted with Fontsource
- Supabase Auth (`@supabase/supabase-js`)
- Vitest, ESLint, Oxlint, Prettier
- GitHub Actions and GitHub Pages

## What it demonstrates

- A login screen backed by Supabase Auth
- Admin invitations that let users choose their own password
- In-memory session handling in Pinia with automatic token refresh
- A router guard that protects the hiring portal
- A pipeline overview at `/overview` with workload and attention summaries
- Role boards grouped by department at `/boards`
- A step-column pipeline for each role with candidate cards and deadline indicators
- Board creation and editing, including ordered pipeline columns
- Applicant creation per board with a right-side editable profile, favourite toggle, and
  career / work-experience notes
- An applicant Events tab with a timestamped audit trail for creation, profile edits, moves,
  and hire/reject/reopen actions
- Persisted candidate actions: advance, move, reject, hire, reopen, and delete
- An account page with non-sensitive session details, full-name editing, and password reset
- A blocking full-name prompt after sign-in when the profile has no name yet
- Sign-out and redirect back to the login screen
- Build-time environment injection from GitHub Actions secrets
- A GitHub Pages SPA fallback so `/TeamBuilder/boards` survives a hard refresh

Public sign-ups are disabled. Administrators can add users directly or invite them from the
Supabase dashboard; invited users finish at `/set-password`.

## Design system

The locked visual system is Direction A / **Orbital**: a calm, precise interface with a cobalt
signal, soft geometry, Manrope typography, and a restrained orbital motif. The app starts in
the user's saved theme, or light mode if they have never toggled it, and offers a top-bar
toggle for dark mode.

- Canonical rules: [docs/DESIGN_SYSTEM.md](docs/DESIGN_SYSTEM.md)
- Token and layout implementation: `src/styles/orbital.css`
- Vuetify themes: `src/plugins/vuetify.ts`
- Design exploration: `design/ui-directions.html`
- Board concept reference: `design/hiring-pipeline-step-columns.html`

Use the shared `BrandMark`, `AuthShell`, and `AppShell` components and the Orbital tokens
for any new UI. The board reference uses a different palette and type system; adapt its
structure, not its styling. Do not add colors, fonts, radii, or motifs from the other design
directions.

## Prerequisites

- Node.js 22 LTS. The repo includes `.nvmrc`; `nvm use` selects the right version.
- npm 11 or newer. The project was generated with npm 12.
- Docker, only if you want to run Supabase locally.
- A Supabase account and a project for the cloud deployment.

## Quick start with Supabase Cloud

1. Create a project at https://supabase.com/dashboard. Save the database password somewhere
   safe.
2. Open the project's **Connect** dialog and copy:
   - **Project URL**
   - **Publishable key** (`sb_publishable_...`)
3. In **Authentication → URL Configuration**:
   - Site URL: `https://michielhbrand.github.io/TeamBuilder/`
   - Redirect URLs: `http://localhost:5173/` and
     `https://michielhbrand.github.io/TeamBuilder/`
4. In **Authentication → Sign In / Providers → Email**, disable new user sign-ups.
5. Apply the database migration from this repository:

   ```bash
   npx supabase link --project-ref <project-ref>
   npm run supabase:push
   ```

   The migrations create the `boards`, `board_columns`, `applicants`, and
   `applicant_events` tables, enable Row Level Security, add authenticated-user policies,
   and explicitly grant table privileges to `authenticated` while revoking them from `anon`.

6. In **Authentication → Users**, either add a demo user with auto-confirm enabled or use
   **Invite user** so the recipient chooses their own password.
7. Create a local environment file:

   ```bash
   cp .env.example .env.local
   ```

   Set `VITE_SUPABASE_URL` and `VITE_SUPABASE_PUBLISHABLE_KEY` to the cloud values.

8. Install and run:

   ```bash
   nvm use
   npm ci
   npm run dev
   ```

9. Sign in with the demo user. The login route is `/`; the protected landing page is
   `/overview`. Create the first board from **Boards → New board**.

> The publishable key is designed to be public. Never put a Supabase secret key
> (`sb_secret_...`) or a legacy `service_role` key in a `VITE_*` variable.

## Inviting users

Invite users from **Authentication → Users → Invite user**. Supabase sends an email whose
link returns the user to the project's **Site URL** with an invite token. The app detects
the invite, opens `/set-password`, and calls `supabase.auth.updateUser({ password })` to save
the password they choose. After saving, they land on `/overview`.

The invitation link is built from the cloud project's **Site URL**, not from this
repository. If an invite opens `http://localhost:3000` or another wrong host, fix it in
**Authentication → URL Configuration**:

- Site URL: `https://michielhbrand.github.io/TeamBuilder/`
- Redirect URLs: `http://localhost:5173/` and
  `https://michielhbrand.github.io/TeamBuilder/`

Then send a new invitation; previously sent links keep the old destination. Local Studio
invitations use the local Site URL from `supabase/config.toml` and appear in Mailpit at
http://localhost:54324.

### Invites blocked by corporate email scanners

Some corporate email systems (for example Microsoft Defender Safe Links) open every link
once to scan it. The default `{{ .ConfirmationURL }}` is a single-use token, so the scanner
consumes it and the recipient sees "Email link is invalid or has expired" even though the
email is new. If one recipient works and another on a corporate domain fails, this is the
likely cause.

The app supports a safer link that is only redeemed when the recipient presses **Continue**
on `/set-password`. Change the cloud **Authentication → Email Templates → Invite user**
template link to:

```html
<a
  href="https://michielhbrand.github.io/TeamBuilder/set-password?token_hash={{ .TokenHash }}&type=invite"
>
  Set your password
</a>
```

Local invitations can use `http://localhost:5173/set-password?token_hash={{ .TokenHash }}&type=invite`.
The app calls `supabase.auth.verifyOtp({ token_hash, type })` from
`src/stores/auth.ts` only after the recipient clicks, so scanning the email cannot spend the
token.

## Local Supabase

Local Supabase gives you a database, Auth, and Studio without touching the cloud project.
Docker must be running.

```bash
npm run supabase:start
npm run supabase:status
npm run supabase:reset
```

`supabase db reset` applies everything in `supabase/migrations/` to the local database. Run
it after pulling new migrations.

`supabase status` prints the local API URL and publishable key. Put them in `.env.local`:

```dotenv
VITE_SUPABASE_URL=http://127.0.0.1:54321
VITE_SUPABASE_PUBLISHABLE_KEY=sb_publishable_...
```

Open Supabase Studio at http://localhost:54323, go to **Authentication → Users**, and add a
demo user with auto-confirm enabled or invite one. Local invitation emails are captured by
Mailpit at http://localhost:54324. The local project has sign-ups disabled in
`supabase/config.toml`.

Stop the stack when you are done:

```bash
npm run supabase:stop
```

If the agent shell or your terminal cannot access Docker after installation, restart the
session or run commands through `sg docker -c '...'`.

## Environment variables

| Variable                        | Where it is used                          | Notes                                                    |
| ------------------------------- | ----------------------------------------- | -------------------------------------------------------- |
| `VITE_SUPABASE_URL`             | Local `.env.local`, GitHub Actions secret | Project URL, or local API URL                            |
| `VITE_SUPABASE_PUBLISHABLE_KEY` | Local `.env.local`, GitHub Actions secret | Publishable key (`sb_publishable_...`), not a secret key |

Vite embeds `VITE_*` values into the browser bundle at build time. That is expected for the
Supabase URL and publishable key.

## Scripts

| Command                   | Purpose                                 |
| ------------------------- | --------------------------------------- |
| `npm run dev`             | Start the Vite dev server               |
| `npm run build`           | Typecheck and build to `dist/`          |
| `npm run preview`         | Preview the production build            |
| `npm run typecheck`       | Run `vue-tsc`                           |
| `npm run lint`            | Run Oxlint and ESLint in check mode     |
| `npm run lint:fix`        | Apply safe lint fixes                   |
| `npm run format`          | Format the repository with Prettier     |
| `npm run format:check`    | Verify formatting without writing       |
| `npm test`                | Run unit tests once                     |
| `npm run test:unit`       | Run Vitest in watch mode                |
| `npm run validate:env`    | Validate the Supabase build environment |
| `npm run supabase:start`  | Start the local Supabase stack          |
| `npm run supabase:status` | Show local URL and keys                 |
| `npm run supabase:stop`   | Stop the local Supabase stack           |
| `npm run supabase:reset`  | Reset local DB and apply migrations     |
| `npm run supabase:push`   | Push migrations to the linked project   |

## GitHub Actions secrets

The deploy workflow reads two repository secrets:

```bash
gh secret set VITE_SUPABASE_URL --repo michielhbrand/TeamBuilder
gh secret set VITE_SUPABASE_PUBLISHABLE_KEY --repo michielhbrand/TeamBuilder
```

Paste the values at the prompts; avoid putting them in shell history. Verify with:

```bash
gh secret list --repo michielhbrand/TeamBuilder
```

## Deployment

- `ci.yml` runs lint, formatting, typecheck, tests, and a placeholder build on pull requests
  and pushes to `main`.
- `deploy.yml` builds with the real secrets and deploys the `dist/` artifact to GitHub Pages
  on every push to `main` or manual dispatch.
- The build `base` is `/TeamBuilder/` in production. If the repository is renamed again,
  update the base in `vite.config.ts`, the Pages URL in the Supabase redirect settings, and
  this README.
- `scripts/postbuild.mjs` copies `index.html` to `404.html` and writes `.nojekyll`. GitHub
  Pages serves the copy for unknown paths, which lets Vue Router handle `/boards`.

Enable Pages with **Settings → Pages → Source: GitHub Actions** if it is not already enabled.

## Releases

Deployment follows `main`; releases are version markers created automatically by
`.github/workflows/release.yml` using `semantic-release`. No manual tagging or
`gh release create` is needed.

Every push to `main` inspects commits since the last release tag and creates a GitHub
release with generated notes when a release-worthy change is found. Commit messages and
PR titles must follow [Conventional Commits](https://www.conventionalcommits.org/):

| Commit                                  | Release |
| --------------------------------------- | ------- |
| `fix: ...` or `perf: ...`               | patch   |
| `feat: ...`                             | minor   |
| `feat!: ...` or `BREAKING CHANGE: ...`  | major   |
| `chore:`, `docs:`, `test:`, `refactor:` | none    |

Examples:

```text
fix(auth): handle expired invite links
feat(boards): show candidate time in step
feat(auth)!: require email confirmation
```

Release versions come from Git tags (`vX.Y.Z`); the workflow does not bump
`package.json`. Non-conventional commits are ignored by the release calculation. If a
push does not warrant a release, the deployed site can be newer than the latest release.

## Project structure

```text
src/
  lib/supabase.ts           Supabase client and environment validation
  lib/auth-link.ts          Detects invite/recovery links before Supabase consumes them
  lib/pipeline.ts           Pure pipeline helpers and summaries
  lib/applicant-events.ts   Event message builders and timestamp formatting
  lib/validation.ts         Email and phone validation helpers
  lib/boards-api.ts         Supabase reads/writes for boards, columns, applicants, and events
  stores/auth.ts            Session state, sign-in, sign-out, full name, password setup
  stores/boards.ts          Persisted boards, columns, applicants, and actions
  types/pipeline.ts         Board, step, candidate, and summary types
  router/index.ts           Routes and authentication guard
  components/AppShell.vue   Top-bar navigation for protected pages
  components/AuthShell.vue  Shared Orbital auth layout
  components/BrandMark.vue  TeamBuilder brand lockup
  components/BoardList.vue  Searchable boards grouped by department
  components/BoardFormDialog.vue Create/edit board fields
  components/ColumnDialog.vue Add, rename, reorder, and delete pipeline columns
  components/ApplicantFormDialog.vue Create an applicant on a board
  components/BoardColumn.vue One pipeline step column
  components/CandidateCard.vue Candidate summary and actions
  components/ApplicantDrawer.vue Editable applicant profile, events, and notes
  components/FullNameDialog.vue Blocking full-name capture for signed-in users
  components/ConfirmDialog.vue Shared destructive-action confirmation
  components/PipelineBar.vue Per-step progress bar
  components/ThemeToggle.vue Light/dark mode toggle
  views/LoginView.vue       Login form
  views/SetPasswordView.vue Invite and password update form
  views/OverviewView.vue    Post-login hiring overview
  views/BoardsView.vue      All boards grouped by department
  views/BoardView.vue       Step-column pipeline for one role
  views/AccountView.vue     Session details, full name, and password reset
  styles/orbital.css        Orbital tokens and shared page styles
  plugins/vuetify.ts        Vuetify themes and component defaults
scripts/
  postbuild.mjs             GitHub Pages 404 fallback and .nojekyll
  validate-env.mjs          Deploy-time environment validation
supabase/config.toml        Local Supabase configuration
supabase/migrations/        Postgres schema, RLS policies, and board RPC functions
design/ui-directions.html   UI direction exploration
design/hiring-pipeline-step-columns.html  Board concept reference
docs/                       Architecture, design system, and decision records
```

## Security notes

- Only the Supabase publishable key is shipped to the browser. The secret key is never used
  by this project.
- Sessions are stored in browser storage by `@supabase/supabase-js`. Treat the app as
  vulnerable to XSS and keep dependencies and content secure.
- Board data lives in `public.boards`, `public.board_columns`, `public.applicants`, and
  `public.applicant_events`. Row Level Security restricts all access to authenticated users;
  every signed-in user shares the same workspace. The anonymous role has no access.
- Applicant events are append-only audit records scoped to a board and applicant. Clients can
  read and insert them, but cannot update or delete them directly.
- Delete operations are permanent. Deleting a board cascades to its columns, applicants, and
  their events; deleting an applicant removes the row and its events; deleting a column
  reassigns its applicants to the first column. The first column cannot be deleted or moved.
- Sign-ups are disabled. Administrators create accounts or send invitations from the
  Supabase dashboard or local Studio.

## Documentation for agents

- [AGENTS.md](AGENTS.md) — commands, conventions, and constraints
- [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) — runtime and deployment architecture
- [docs/DESIGN_SYSTEM.md](docs/DESIGN_SYSTEM.md) — locked Orbital UI rules
- [docs/DECISIONS.md](docs/DECISIONS.md) — architecture decision records

## License

Copyright 2026 Michiel Brand. Licensed under the [Apache License, Version 2.0](LICENSE).
