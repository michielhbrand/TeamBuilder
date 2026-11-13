# AGENTS.md

Instructions for agents working in this repository. Read this file,
`docs/ARCHITECTURE.md`, and `docs/DESIGN_SYSTEM.md` before changing auth, routing, build,
deployment, or UI behavior.

## Purpose

TeamBuilder is a Vue 3 + Supabase hiring pipeline workspace. It is hosted on GitHub Pages
and exists to demonstrate a login screen, admin invitations that let users choose a
password, in-memory sessions, a protected hiring portal, and sign-out. The portal has a
dashboard overview, role boards grouped by department, a step-column pipeline for each role,
a consent-gated CV analysis that lists similarities and gaps, an applicant audit trail, and an account page. Boards,
pipeline columns, applicants, events, notes, and fit analyses are stored in Supabase Postgres
and loaded through Pinia. Keep it focused; do not add unrelated product features.

## Commands

Run from the repository root. Use Node 22 via `.nvmrc`.

```bash
nvm use
npm ci
npm run dev
npm run dev:local
npm run lint
npm run format:check
npm run typecheck
npm test
npm run build
npm run validate:env
npm run supabase:reset
npm run supabase:seed:user
npm run supabase:push
npm run supabase:functions
```

`npm run build` runs typechecking, the Vite build, and the `postbuild` script. A local
production build needs `VITE_SUPABASE_URL` and `VITE_SUPABASE_PUBLISHABLE_KEY` in
`.env.local` or the shell.

Before finishing any change, run at least:

```bash
npm run format:check
npm run lint
npm run typecheck
npm test
npm run build
```

## Environment and secret rules

- `VITE_SUPABASE_URL`: Supabase project URL, or `http://127.0.0.1:54321` for local Supabase.
- `VITE_SUPABASE_PUBLISHABLE_KEY`: publishable key (`sb_publishable_...`). It is safe to
  expose in the browser bundle.
- Never place a Supabase secret key (`sb_secret_...`) or legacy `service_role` key in the
  frontend, a `VITE_*` variable, the repository, tests, logs, or chat.
- `KILO_API_KEY` and `KILO_MODEL` are Supabase Edge Function secrets for `fit-analysis`.
  Never name the key `VITE_*` or inject it into the Pages build.
- `SUPABASE_ACCESS_TOKEN` and `SUPABASE_PROJECT_ID` are GitHub Actions secrets used only to
  set function secrets and deploy `fit-analysis`.
- `.env.local` is gitignored. `.env.example` contains placeholders only. Function secret
  placeholders live in `supabase/functions/.env.example`.
- Production values come from GitHub Actions secrets named exactly
  `VITE_SUPABASE_URL`, `VITE_SUPABASE_PUBLISHABLE_KEY`, `KILO_API_KEY`, `KILO_MODEL`,
  `SUPABASE_ACCESS_TOKEN`, and `SUPABASE_PROJECT_ID`.
- Use `npm run validate:env` before a deploy build. It rejects missing values and secret
  keys.

## Architecture map

- `src/lib/supabase.ts` — the only Supabase client instance.
- `src/lib/auth-link.ts` — reads invite/recovery link parameters before Supabase consumes
  the URL.
- `src/stores/auth.ts` — owns session state, initialization, sign-in, full-name capture,
  password setup, and sign-out.
- `src/types/pipeline.ts` — board, step, candidate, applicant event, and summary types.
- `src/types/fit.ts` — applicant CV/job-spec analysis types.
- `src/lib/boards-api.ts` — Supabase reads and writes for boards, columns, applicants,
  applicant events, applicant notes, and fit analyses.
- `src/lib/applicant-events.ts` — event message builders and timestamp formatting.
- `src/lib/pdf-text.ts` — shared PDF text extraction, OCR fallback, IndexedDB cache, and PDF
  fingerprints.
- `src/lib/job-spec.ts` — job-spec PDF text extraction and cleanup.
- `src/lib/fit-hash.ts` — CV, job-spec, and profile fingerprint helpers.
- `src/lib/pipeline.ts` — pure pipeline helpers for steps, deadlines, summaries, department
  grouping, and dashboard candidate watch entries.
- `src/lib/validation.ts` — shared email and phone validation helpers.
- `src/stores/boards.ts` — persisted board, column, and applicant state and actions.
- `src/stores/fit.ts` — persisted applicant CV-analysis state and actions.
- `supabase/migrations/` — Postgres tables, RLS policies, indexes, and board RPC functions.
- `supabase/functions/fit-analysis/` — authenticated Edge Function that redacts CV fields,
  calls the free Kilo model, validates the similarities/gaps JSON, and upserts the shared
  analysis.
- `supabase/functions/.env.example` — placeholders for server-side function secrets.
- `src/router/index.ts` — routes and the auth guard.
- `src/components/AppShell.vue` — top-bar navigation and shared layout for protected pages.
- `src/components/AuthShell.vue` — shared Orbital layout for login and password setup.
- `src/components/FullNameDialog.vue` — blocking full-name capture for signed-in users whose
  profile has no name yet.
- `src/components/BrandMark.vue` — the only application brand lockup.
- `src/components/BoardList.vue` — searchable boards grouped by department.
- `src/components/BoardFormDialog.vue` — create and edit board fields.
- `src/components/ColumnDialog.vue` — add, rename, reorder, and delete pipeline columns.
- `src/components/ApplicantFormDialog.vue` — create an applicant on a board, with optional
  PDF CV autofill and CV attachment.
- `src/components/BoardSwitcher.vue` — compact header menu for switching between role boards.
- `src/components/BoardColumn.vue` — one pipeline step column.
- `src/components/CandidateCard.vue` — candidate summary and pipeline actions.
- `src/components/ApplicantDrawer.vue` — right-side editable applicant profile with Details,
  Analize, and Events tabs, favourite, education, work-experience notes, and free-text applicant
  notes.
- `src/components/FitConsentDialog.vue` — per-analysis consent dialog for sending redacted CV
  data to the hosted model.
- `src/components/JobSpecDialog.vue` — upload, preview, print, open, and remove a board's PDF
  job spec.
- `src/components/ConfirmDialog.vue` — shared destructive-action confirmation dialog.
- `src/lib/pdf.ts` — shared PDF validation, client-side compression, and print helpers.
- `src/lib/resume-import.ts` — local PDF text extraction, applicant heuristics, and lazy
  Tesseract OCR for scanned pages.
- `src/components/PipelineBar.vue` — per-step candidate progress bar.
- `src/components/DepartmentLoadChart.vue` — interactive department workload bars.
- `src/components/OutcomeDonut.vue` — active, hired, and rejected outcome chart.
- `src/components/RolePerformanceTable.vue` — sortable role board table with pipeline bars.
- `src/components/ApplicantWatchList.vue` — compact newest and longest-in-step applicant lists.
- `src/views/LoginView.vue` — login form and validation.
- `src/views/SetPasswordView.vue` — invite and password update form.
- `src/views/OverviewView.vue` — post-login hiring dashboard with KPI cards, department
  workload chart, outcome donut, sortable role table, deadline watch, applicant lists, and
  department filtering.
- `src/views/BoardsView.vue` — all role boards grouped by department.
- `src/views/BoardView.vue` — step-column pipeline for one role.
- `src/views/AccountView.vue` — protected session, identity, full-name editing, and password
  reset.
- `src/styles/orbital.css` — locked design tokens, layout primitives, board styling, and
  Vuetify styling.
- `src/plugins/vuetify.ts` — Orbital light/dark Vuetify themes and component defaults.
- `design/ui-directions.html` — reference exploration; Direction A / Orbital is selected.
- `design/hiring-pipeline-step-columns.html` — board concept reference; adapt it to Orbital.
- `docs/DESIGN_SYSTEM.md` — canonical UI rules and component recipes.
- `vite.config.ts` — production base `/TeamBuilder/`, Vuetify auto-import, aliases.
- `scripts/postbuild.mjs` — copies `index.html` to `404.html` and writes `.nojekyll`.
- `.github/workflows/ci.yml` — checks on pull requests and pushes to `main`.
- `.github/workflows/deploy.yml` — builds with secrets and deploys to GitHub Pages.
- `.github/workflows/release.yml` — creates GitHub releases with `semantic-release`.
- `.releaserc.json` — release branches, tag format, and plugins.

See `docs/ARCHITECTURE.md` for the auth lifecycle and deployment pipeline.

## Conventions

- Use Vue single-file components with `<script setup lang="ts">`.
- Keep auth state in the Pinia store. Components should not call `supabase.auth` directly.
- Keep board state in `src/stores/boards.ts` and fit state in `src/stores/fit.ts`. Components
  read from the stores and call their actions instead of calling Supabase or the Edge
  Function directly.
- Keep Supabase queries and row/domain mapping in `src/lib/boards-api.ts`. Board data is
  persisted in the tables created by `supabase/migrations/`.
- Every signed-in user shares the same workspace. RLS policies allow the `authenticated`
  role only; do not grant board access to `anon`.
- Deleting a board cascades to its columns, applicants, events, notes, and fit analyses.
  Deleting an applicant is permanent and also deletes its events, notes, and fit analysis.
  Deleting a column reassigns its applicants to the first column, which cannot be deleted or
  moved.
- Keep the Supabase client singleton in `src/lib/supabase.ts`.
- Invite and recovery links arrive with a `type` in the URL hash or query. Preserve the
  detection in `src/lib/auth-link.ts`; do not let the login redirect bypass
  `/set-password`.
- Use the locked Direction A / Orbital design system in `docs/DESIGN_SYSTEM.md`. Reuse its
  tokens and shared components; do not introduce colors, fonts, radii, gradients, or motifs
  from the other design directions.
- Use Vuetify 4 components and MDI icon names. Do not upgrade to a non-MIT UI major without
  reviewing its license.
- Keep light and dark mode working. The app starts in the user's saved theme, or light mode
  if they have never toggled it, and switches with the top-bar theme toggle; new UI must use
  Orbital tokens and be checked in both modes.
- Use Conventional Commits for commit messages and PR titles. `semantic-release` uses them
  to choose patch/minor/major versions; non-conventional commits do not create releases.
- Use the `@/` alias for imports from `src/`.
- No comments unless they explain non-obvious behavior.
- Match existing formatting. Prettier and ESLint are authoritative.
- Add tests for auth store behavior when changing sign-in, sign-out, or error handling.
- Keep documentation in sync with behavior changes.

## Deployment constraints

- The site is a GitHub Pages project site at `https://michielhbrand.github.io/TeamBuilder/`.
- Production `base` must remain `/TeamBuilder/` unless the repository is renamed again. If
  it changes, update `vite.config.ts`, Supabase redirect URLs, the README, and the docs.
- The cloud Supabase **Site URL** must be `https://michielhbrand.github.io/TeamBuilder/`.
  Invitation emails build their link from it. If it points at `localhost:3000`, recipients
  cannot accept invites.
- Do not remove the `404.html` fallback; it is what makes `/TeamBuilder/boards` work on a
  hard refresh.
- `.github/workflows/deploy.yml` is the only production deploy path. Keep Pages permissions
  (`pages: write`, `id-token: write`) and the `github-pages` environment. The same workflow
  sets `KILO_API_KEY` and `KILO_MODEL` as Supabase secrets and deploys `fit-analysis` using
  `SUPABASE_ACCESS_TOKEN` and `SUPABASE_PROJECT_ID`; never inject those values into the Vite
  build.
- Deployments occur on pushes to `main`. Releases are created automatically by
  `semantic-release` from Conventional Commits; do not create tags or releases manually
  unless recovering from a failed release.

## Supabase constraints

- Public sign-ups are disabled in cloud and local settings. Administrators create users or
  send invitations from the dashboard or local Studio. Invited users choose their password
  through `/set-password`.
- Keep the cloud Site URL aligned with the Pages origin so invite links return to the app.
  Local invitations use `supabase/config.toml` and Mailpit at `http://localhost:54324`.
- `npm run supabase:reset` recreates a local-only auth user from `LOCAL_USER_EMAIL`,
  `LOCAL_USER_PASSWORD`, and `LOCAL_USER_NAME` in `.env.local`. Those values are never used
  for the cloud project. Keep cloud values for local production builds in the gitignored
  `.env.production.local`.
- Applicant CVs use the private Supabase Storage bucket `cvs` (one PDF per applicant,
  `<applicant-id>/cv.pdf`). Board job specs use the private `job-specs` bucket at
  `<board-id>/job-spec.pdf`. Keep storage policies limited to `authenticated`, validate PDF
  uploads client-side, and remove the object when its applicant, board, or job spec is
  deleted.
- PDF uploads pass through the browser compressor in `src/lib/pdf.ts` before reaching
  Supabase. The compressor re-encodes embedded images only, so text stays selectable and
  files never grow. Keep the same helper for new PDF upload paths.
- Applicant CV autofill is entirely local. `src/lib/resume-import.ts` extracts the PDF text
  layer first, then lazy-loads Tesseract OCR for scanned pages. OCR runs in a Web Worker,
  processes at most three pages, is cancellable, and caches page text in IndexedDB. Parsed
  names are title-cased, emails are lowercased, and education/experience entries are
  formatted as title, date range, and details with blank lines and a summary. Stop those
  sections at achievements, certifications, skills, and other headings. OCR assets are
  generated into `public/ocr/` by `scripts/copy-ocr-assets.mjs` from `predev`/`prebuild`; do
  not commit them.
- CV analysis runs through the authenticated `fit-analysis` Edge Function. It sends only
  the job spec, role/department, and redacted education/work experience to a free Kilo model.
  Never send name, email, phone, URLs, address, date of birth, nationality, gender, age, or
  other sensitive personal fields. Consent is required for every analysis, including
  re-evaluation, and the UI must state that Kilo may log or train on free-tier requests.
- Fit results are stored in `public.applicant_fit_analyses`, one row per applicant, scoped by
  the composite `(board_id, applicant_id)` foreign key. Authenticated users may select;
  only the Edge Function with the service role may insert or update. Validate the model JSON
  on the server and store only the returned similarities and gaps.
- Fit analysis is English-only, has no local or paid fallback, and must keep the previous
  result when Kilo is unavailable or rate-limited. Refuse any `KILO_MODEL` that is not a free
  model. Do not expose the Kilo key to the browser.
- Do not add LinkedIn or other third-party profile scraping. LinkedIn blocks automated
  requests and prohibits scraping, and no free API is reliable. Profile data may only enter
  through user-provided text or files.
- Board data uses `public.boards`, `public.board_columns`, `public.applicants`, and
  `public.applicant_fit_analyses`. Board
  names are unique within a department; applicant email and phone are optional and unique
  per board only when filled. New applicants default to the `Applied` column. If you
  add a table, add a migration under `supabase/migrations`, enable Row Level Security, write
  policies for the intended roles, explicitly grant table privileges to `authenticated`, and
  revoke them from `anon`. RLS does not replace table grants. Do not expose board data to
  `anon`.
- Audit events use `public.applicant_events`, scoped by `(board_id, applicant_id)`. The
  composite foreign key cascades from the applicant and board, so deleting either removes its
  events permanently. Events are immutable: clients may select and insert, but there are no
  update or delete policies. Insert `actor_name` from the signed-in user's full name and let
  the `actor_id` default to `auth.uid()`. Record applicant creation, moves,
  hire/reject/reopen status changes, CV analyses, and one edit event per profile drawer
  session when any profile field changed.
- Applicant notes use `public.applicant_notes`, also scoped by `(board_id, applicant_id)` with
  a cascading composite foreign key. Notes are append-only free text: clients may select and
  insert, but there are no update or delete policies. Insert `author_name` from the signed-in
  user's full name and let `author_id` default to `auth.uid()`.
- Use the publishable key for client access. Never introduce a service-role client into the
  browser bundle.
- Keep `supabase/config.toml` redirect URLs aligned with local and Pages origins.

## Do not

- Do not commit `.env` files, keys, tokens, or generated secrets.
- Do not add a sign-up UI without an explicit product decision.
- Do not add a local or paid fallback for CV analysis, and do not send CV data to Kilo
  without the consent dialog.
- Do not let the browser validate model output or write `public.applicant_fit_analyses`.
- Do not add analytics, error reporting, or third-party scripts that handle auth data
  without documenting the privacy/security impact.
- Do not change the deployment target, repo name assumptions, or base path without updating
  all related configuration and docs.
- Do not force-push or rewrite shared history unless explicitly requested.

## Documentation rule

Any change to auth flow, environment variables, deployment, routing, the UI library, or the
Orbital design system must update the relevant files in `docs/` and this file when
conventions change. Keep `docs/DESIGN_SYSTEM.md` aligned with the tokens and components.
