# Architecture decision records

Decisions are recorded here so future agents do not need to rediscover the reasoning.
Dates use ISO 8601. Status values are proposed, accepted, superseded, or deprecated.

## ADR-001: Vue 3 + Vite + TypeScript

- **Date:** 2026-11-03
- **Status:** Accepted
- **Context:** The project is a small login demo that should be easy to deploy as static
  files and easy for future agents to extend.
- **Decision:** Use Vue 3 single-file components, Vite, and TypeScript. Use Vue Router and
  Pinia from the start so auth state and protected routes have clear homes.
- **Consequences:** Fast local feedback and static hosting. TypeScript adds a typecheck step
  and requires generated Vuetify component types to work with `vue-tsc`.

## ADR-002: Supabase Auth with the publishable key only

- **Date:** 2026-11-03
- **Status:** Accepted
- **Context:** Supabase now issues publishable keys (`sb_publishable_...`) for browser use
  and secret keys (`sb_secret_...`) for trusted servers. Legacy anon/service_role keys are
  being deprecated by the end of 2026.
- **Decision:** Use `@supabase/supabase-js` in the browser with `VITE_SUPABASE_URL` and
  `VITE_SUPABASE_PUBLISHABLE_KEY`. Never ship a secret key to the client.
- **Consequences:** No backend is required. Authorization for future data access must be
  enforced with Row Level Security, not with key secrecy. The environment validator rejects
  `sb_secret_` values defensively.

## ADR-003: Hosted Supabase plus local Supabase CLI

- **Date:** 2026-11-03
- **Status:** Accepted
- **Context:** The demo must run locally without touching production data, and also deploy
  against a real hosted project.
- **Decision:** Commit `supabase/config.toml` and support `supabase start` for local
  development. Use a hosted cloud project for the Pages deployment. Local and cloud Auth URL
  settings are documented together.
- **Consequences:** Local development requires Docker. The local stack is disposable and can
  be reset independently of the cloud project.

## ADR-004: Manual demo users, sign-ups disabled

- **Date:** 2026-11-03
- **Status:** Accepted
- **Context:** The goal is a login screen demonstration, not a registration product. Open
  sign-up would add email confirmation and abuse concerns.
- **Decision:** Disable public sign-ups in cloud and local settings. Create demo users
  manually in the Supabase dashboard or local Studio with auto-confirm enabled.
- **Consequences:** Visitors cannot create accounts. Provisioning is an explicit operator
  step. If registration is added later, Supabase email confirmation and redirect URLs must
  be configured for both local and Pages origins.

## ADR-005: Vuetify 4 instead of PrimeVue 5

- **Date:** 2026-11-03
- **Status:** Accepted
- **Context:** A component library was requested. PrimeVue 5 is distributed under terms
  other than MIT and includes a license manager; this repository is Apache-2.0. Vuetify 4
  is MIT-licensed.
- **Decision:** Use Vuetify 4 with `vite-plugin-vuetify` auto-import and MDI icons.
- **Consequences:** The bundle is larger than a minimal CSS approach. Do not upgrade the UI
  library to a non-MIT major without a license review and an ADR update.

## ADR-006: GitHub Pages project site with history routing

- **Date:** 2026-11-03
- **Status:** Superseded by ADR-015
- **Context:** The repository is `AuthApp`, so the free project site lives under
  `/AuthApp/`. GitHub Pages has no server-side SPA rewrite.
- **Decision:** Set the production Vite base to `/AuthApp/`, use `createWebHistory`, and
  copy the built `index.html` to `404.html` in a postbuild script. Write `.nojekyll` as
  well.
- **Consequences:** URLs remain pretty and direct navigation works, at the cost of returning
  HTTP 404 for deep links. Renaming the repository requires changing the base and Supabase
  redirect URLs together.

## ADR-007: Official Pages Actions artifact and build-time secrets

- **Date:** 2026-11-03
- **Status:** Accepted
- **Context:** The deployment must use GitHub Actions and repository secrets, and should not
  push generated files to a long-lived branch.
- **Decision:** Build in GitHub Actions with `npm ci`, upload `dist/` using
  `actions/upload-pages-artifact`, and deploy with `actions/deploy-pages`. Inject
  `VITE_SUPABASE_URL` and `VITE_SUPABASE_PUBLISHABLE_KEY` from repository secrets. CI builds
  with placeholders so untrusted pull requests do not need secrets.
- **Consequences:** Pages must use the GitHub Actions source. The publishable key is still
  public in the bundle by design; GitHub secrets are used for consistent injection and to
  avoid hardcoding values.

## ADR-008: Deploy on main, release with manual tags

- **Date:** 2026-11-03
- **Status:** Superseded by ADR-012
- **Context:** The project needs a simple, transparent release process without an automated
  changelog or semantic-release toolchain.
- **Decision:** Every push to `main` deploys. Versioned releases are explicit semver tags
  (for example `v0.1.0`) followed by `gh release create`.
- **Consequences:** The deployed site may be newer than the latest release. Operators must
  tag intentionally. The initial `v0.1.0` release is created after the first successful
  deployment.

## ADR-009: Node 22 LTS and npm

- **Date:** 2026-11-03
- **Status:** Accepted
- **Context:** The toolchain requires a modern Node version; the current create-vue and
  Vitest releases require Node 22.18 or newer.
- **Decision:** Pin Node 22 in `.nvmrc`, declare the engine range in `package.json`, use npm,
  and commit `package-lock.json`.
- **Consequences:** CI uses `npm ci`. Contributors using newer Node versions should still be
  compatible with the declared range.

## ADR-010: Apache-2.0 license

- **Date:** 2026-11-03
- **Status:** Accepted
- **Context:** The project is a public demonstration that should be permissively licensed
  and include an explicit patent grant.
- **Decision:** License the repository under Apache-2.0 with
  `Copyright 2026 Michiel Brand`.
- **Consequences:** Dependencies must remain license-compatible. The Vuetify choice was
  partly driven by this constraint.

## ADR-011: Admin invitations with an in-app password setup route

- **Date:** 2026-11-04
- **Status:** Accepted
- **Context:** Administrators should be able to invite users from the Supabase dashboard and
  let each recipient choose a password. Supabase invitation emails redirect to the project's
  configured Site URL, and the invite token must be exchanged before the password update.
- **Decision:** Detect the `invite` and `recovery` link types in `src/lib/auth-link.ts`
  before Supabase consumes the URL. Track `passwordSetupRequired` in the auth store, route
  those users to `/set-password`, and call `supabase.auth.updateUser({ password })` from the
  store. Keep public sign-ups disabled; invitations are an administrator action.
- **Consequences:** The cloud Supabase Site URL must be the Pages origin. If it points at
  `localhost:3000`, invite links fail regardless of application code. The same route also
  supports future password recovery links.

## ADR-012: Automated semantic releases from Conventional Commits

- **Date:** 2026-11-04
- **Status:** Accepted
- **Context:** Manual tagging and `gh release create` are easy to forget and leave the
  deployed site ahead of the latest release. Releases should be created consistently from
  commit history.
- **Decision:** Run `semantic-release` on every push to `main` from
  `.github/workflows/release.yml`. Use the commit analyzer, release notes generator, and
  GitHub plugins configured in `.releaserc.json`. Require Conventional Commits: `fix` and
  `perf` produce patches, `feat` produces minors, and breaking changes produce majors.
  Deployment remains independent and continues on every push to `main`.
- **Consequences:** Only release-worthy commits create tags and GitHub releases. Commits
  without a conventional type are ignored by semantic-release. Release versions come from
  Git tags rather than `package.json`. The release workflow needs `contents: write` (and
  issue/PR write for the GitHub plugin) but does not deploy the site.

## ADR-013: Orbital Direction A as the locked design system

- **Date:** 2026-11-04
- **Status:** Accepted
- **Context:** Five UI directions were prototyped in both light and dark modes in
  `design/ui-directions.html`. The product needs one coherent, calm, professional visual
  language that future agents can apply consistently to auth and protected pages.
- **Decision:** Select Direction A / Orbital. Implement its tokens in
  `src/styles/orbital.css`, its Vuetify themes in `src/plugins/vuetify.ts`, and its shared
  brand and auth layout in `src/components`. Document the exact palette, typography,
  geometry, component recipes, dual-mode behavior, accessibility rules, and extension
  checklist in `docs/DESIGN_SYSTEM.md`. Follow the operating system color scheme by default.
- **Consequences:** Orbital is the only canonical direction. The other four explorations are
  historical and must not be mixed into product UI. New pages and components must use the
  shared tokens and helpers rather than one-off styles. UI changes must be reviewed in both
  light and dark mode, and the design document must stay aligned with the implementation.

## ADR-014: Manual light/dark toggle instead of following the operating system

- **Date:** 2026-11-04
- **Status:** Accepted
- **Context:** ADR-013 followed the operating system color scheme for the Orbital design
  system. The product owner asked for a simple manual light/dark control that does not depend
  on the visitor's system setting.
- **Decision:** Default to the `orbitalLight` theme. Add `src/components/ThemeToggle.vue`, an
  outlined primary button that calls `theme.change` to switch between `orbitalLight` and
  `orbitalDark`, and render it in the shared `AuthShell` and the dashboard top bar. Remove the
  `prefers-color-scheme` listener from `src/App.vue` and the dark pre-hydration background
  from `src/styles/orbital.css`.
- **Consequences:** The theme no longer tracks the operating system; it is fixed to the toggle.
  ADR-013's dual-mode requirement still holds: every UI change is reviewed in both modes. The
  design system and architecture docs describe the toggle as the single theme source.

## ADR-015: Rename AuthApp to TeamBuilder with the /TeamBuilder/ base path

- **Date:** 2026-11-05
- **Status:** Accepted
- **Context:** The product moved from an authentication demo to a hiring pipeline workspace.
  The old name and Pages path no longer described the app. The repository, package metadata,
  production base, deployment URLs, and Supabase redirect allow-list all need to agree.
- **Decision:** Rename the visible brand and package to TeamBuilder. Set the production Vite
  base to `/TeamBuilder/`, target `https://michielhbrand.github.io/TeamBuilder/`, and update
  package repository/homepage/bugs URLs, the local Supabase project id, the Supabase redirect
  allow-list, and all documentation. The external GitHub repository rename and the cloud
  Supabase Site URL change are operator steps that must happen with the deployment.
- **Consequences:** The site will not resolve correctly if code is deployed before the GitHub
  repository and Supabase URLs use TeamBuilder. Outstanding invitation emails still point at
  the old Site URL and must be re-sent. Supersedes the `/AuthApp/` path in ADR-006.

## ADR-016: Board-based hiring portal with deterministic in-memory data

- **Date:** 2026-11-05
- **Status:** Superseded by ADR-019
- **Context:** The protected area should demonstrate a realistic hiring pipeline without
  introducing database schema, RLS policies, or a data-loading phase. The design reference in
  `design/hiring-pipeline-step-columns.html` models roles, ordered steps, candidates, target
  days, and closed outcomes.
- **Decision:** Create one board per hiring role, grouped by department. Port the concept to
  Vue components and the Orbital design system. Generate deterministic dummy boards with a
  seeded random generator in `src/data/boards.ts`, expose them through
  `src/stores/boards.ts`, and keep pure pipeline logic in `src/lib/pipeline.ts`. Candidate
  actions (advance, move, reject, hire, reopen) mutate Pinia memory only.
- **Consequences:** The portal is immediately demonstrable with no backend work, and all
  action state resets on reload. Making boards persistent later requires migrations, RLS
  policies, and replacing the seeded data source. The prototype's palette and fonts are not
  part of the design system.

## ADR-017: App navigation and protected route structure

- **Date:** 2026-11-05
- **Status:** Accepted
- **Context:** The old protected area was a single session dashboard. The portal needs a
  landing overview, a boards index, individual role boards, and an account page.
- **Decision:** Use a top-bar `AppShell` with Overview, Boards, and Account links. Protect
  `/overview`, `/boards`, `/boards/:boardId`, and `/account`; send authenticated users from
  `/` to `/overview`; redirect `/dashboard` to `/account` for old links; and keep the auth
  guard and `/set-password` flow unchanged.
- **Consequences:** The role switcher and pipeline stay inside the Boards section rather than
  becoming app-level navigation. The top bar wraps on narrow screens instead of collapsing
  into a hidden menu. Account retains the session-detail content that used to live at
  `/dashboard`.

## ADR-018: Redeem invite tokens with an explicit token-hash confirmation step

- **Date:** 2026-11-06
- **Status:** Accepted
- **Context:** Supabase's default invite template uses `{{ .ConfirmationURL }}`, which
  redeems the single-use token on any GET. Corporate email security tools such as Microsoft
  Defender Safe Links prefetch links, so the token is often spent before the recipient
  clicks it and they see "Email link is invalid or has expired". A personal address may work
  while a corporate address fails.
- **Decision:** Support invite and recovery emails that link to
  `/set-password?token_hash={{ .TokenHash }}&type=invite` (or `recovery`). Capture the hash
  in `src/lib/auth-link.ts`, show a **Continue to set password** action, and call
  `supabase.auth.verifyOtp({ token_hash, type })` from `auth.verifyLink()` only after the
  recipient clicks. Keep the existing `ConfirmationURL` flow working for operators who do
  not change their template.
- **Consequences:** Email prefetchers can fetch the app link but cannot redeem the token;
  the recipient must press one extra button. The cloud and local invite templates must be
  updated separately from the code. Expired or already-used token hashes still show the
  friendly invalid-link message.

## ADR-019: Persist hiring data in Supabase Postgres

- **Date:** 2026-11-06
- **Status:** Accepted
- **Context:** The hiring portal originally used deterministic in-memory dummy data, so all
  edits reset on reload. The product now needs persistent boards, ordered pipeline columns,
  and applicants while keeping the static GitHub Pages deployment and browser-only Supabase
  client.
- **Decision:** Add `boards`, `board_columns`, and `applicants` tables in
  `supabase/migrations/`, with RLS limited to `authenticated`. Store free-text career and
  work-experience notes as Postgres `text` so indentation, bullets, and newlines are
  preserved. Use a composite `(board_id, column_id)` foreign key to keep applicants on their
  board's columns, and atomic SQL functions for board creation, column reordering, and column
  deletion. Access
  data through `src/lib/boards-api.ts` and keep Pinia as the UI source of truth.
- **Consequences:** Every signed-in user shares one workspace. Applicant email and phone are
  unique per board; board names and column names are case-insensitively unique within their
  scope. Deleting an applicant is permanent, deleting a column moves its applicants to the
  first column, and the first column cannot be deleted. Local and cloud projects must apply
  the migration before the portal can load data. The dummy data source is removed.

## ADR-020: Compare CVs with a free hosted model through an Edge Function

- **Date:** 2026-11-10
- **Status:** Accepted
- **Context:** The static Pages build cannot safely hold a model API key, and the browser must
  not validate or write trusted AI results. Applicants' CVs contain personal data,
  while the free Kilo tier may log or train on requests. A deterministic rules-only matcher
  would be brittle and a paid or local model would add cost and deployment weight.
- **Decision:** Add an authenticated Supabase Edge Function, `fit-analysis`, that loads the
  applicant with the service role, redacts identity and sensitive fields, sends only the job
  spec, role/department, and redacted education/work experience to a free Kilo model, validates
  the JSON similarities/gaps result, and upserts `public.applicant_fit_analyses`. The browser asks for explicit consent before every
  analysis and reads results with the authenticated select-only RLS policy. There is no
  fallback engine. The Kilo key lives only in Supabase Edge Function secrets; CI deploys the
  function with `SUPABASE_ACCESS_TOKEN` and `SUPABASE_PROJECT_ID`.
- **Consequences:** Fit analysis is English-only and depends on Kilo availability and free-tier
  rate limits. A failed call leaves the previous result intact. Every signed-in user sees the
  same result for an applicant. The app must keep the consent copy accurate, never expose
  `KILO_API_KEY`, and refuse any `KILO_MODEL` that is not free.
