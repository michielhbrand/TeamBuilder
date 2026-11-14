# Architecture

## Overview

TeamBuilder is a static Vue 3 single-page application. Authentication and data access are
performed directly against Supabase from the browser using the publishable key. There is no
custom session server. One authenticated Supabase Edge Function, `fit-analysis`, proxies
requests to a free hosted model for CV analysis. Administrators provision users in
Supabase and can invite them by email; invited users choose their own password.

The protected hiring portal is a board-based workspace. A board represents one open role,
boards are grouped by department, and each board has its own ordered columns and applicants.
Boards, columns, applicants, their audit events, notes, and fit analyses are stored in
Supabase Postgres and loaded through Pinia. Every signed-in user shares the same workspace;
Row Level Security allows the `authenticated` role only.

```text
Browser
  |
  |  HTTPS (Supabase Auth API)
  v
Supabase Auth  <---- session JWT issued to the browser
  |
  +--> PostgREST / Postgres (RLS: authenticated only)  <---- boards, columns, applicants, events

Build time:
GitHub Actions secrets -> Vite env -> bundled publishable key + URL -> GitHub Pages
```

## Frontend design system

Direction A / Orbital is the locked visual system. `docs/DESIGN_SYSTEM.md` is the canonical
rule set; the selected reference is `design/ui-directions.html#orbital`.

- `src/styles/orbital.css` defines light and dark tokens, typography, layout primitives,
  panels, fields, buttons, status badges, and the orbital motif.
- `src/plugins/vuetify.ts` registers the matching `orbitalLight` and `orbitalDark` themes
  and Vuetify component defaults. The app starts in the user's saved theme, or `orbitalLight`
  if they have never toggled it.
- `src/lib/theme.ts` owns the theme storage key and reads or persists the selected theme.
- `src/components/ThemeToggle.vue` switches between `orbitalLight` and `orbitalDark` by
  setting `theme.global.name`. It renders in the shared auth shell and the app top bar.
- `src/App.vue` provides the default app shell.
- `src/components/BrandMark.vue` owns the TeamBuilder lockup. `src/components/AuthShell.vue`
  owns the shared login and password-setup layout. `src/components/AppShell.vue` owns the
  top-bar navigation for Overview, Boards, and Account.
- `src/components/BoardList.vue`, `BoardColumn.vue`, `CandidateCard.vue`,
  `ApplicantDrawer.vue`, and `PipelineBar.vue` implement the board UI.
  `ApplicantDrawer.vue` is the right-side editable candidate profile opened from a card.
  `DepartmentLoadChart.vue`, `OutcomeDonut.vue`, `RolePerformanceTable.vue`, and
  `ApplicantWatchList.vue` implement the dashboard visuals and lists.
  `design/hiring-pipeline-step-columns.html` is the structural concept reference; its
  palette and fonts are not used.
- Fonts are self-hosted with `@fontsource-variable/manrope` and `@fontsource/ibm-plex-mono`.
  There are no runtime font requests.
- Views must use the shared tokens and components rather than page-specific colors, radii,
  fonts, or orbital motifs.

## Runtime auth lifecycle

1. `src/main.ts` creates the app, installs Pinia, and resolves the auth store.
2. `auth.initialize()` calls `supabase.auth.getSession()`. The client uses
   `persistSession: false`, so the JWT lives only in the Pinia store and is never written to
   local or session storage; a full reload starts a fresh sign-in.
3. The store subscribes to `onAuthStateChange`; token refreshes and sign-out events update
   `session` in place.
4. Only after initialization does `main.ts` install the router and mount the app. This keeps
   the first navigation from racing the session lookup.
5. `router.beforeEach` checks `to.meta.requiresAuth`. Unauthenticated visitors to a
   protected route are redirected to `/` with a `redirect` query parameter.
6. `LoginView.vue` validates the form and calls `auth.signIn(email, password)`, which calls
   `supabase.auth.signInWithPassword()`.
7. On success the store stores the session, and the view navigates to the requested redirect
   or `/overview`.
8. `OverviewView.vue` is the post-login hiring dashboard. It summarizes open demand, active
   candidates, outcomes, deadlines, role performance, and applicant watch lists, with a
   department filter and drill-downs into boards and applicant profiles. `BoardsView.vue`
   lists boards grouped by department, `BoardView.vue` renders one board's step columns, and
   `AccountView.vue` shows non-sensitive session details, full-name editing, and password
   reset. Sign-out calls `auth.signOut()`, clears the session, and returns to `/`.
9. Signed-in users whose `user_metadata.full_name` is empty see the persistent
   `FullNameDialog` from `AppShell` until they save a name. `auth.updateFullName()` writes the
   value through `supabase.auth.updateUser({ data: { full_name } })`, so it is available on
   every later sign-in. The Account page can change it later and can also reset the password
   through `auth.setPassword()`.
10. Invitation and recovery links arrive with a `type` in the URL hash or query.
    `src/lib/auth-link.ts` reads that type before `supabase-js` consumes and clears the URL.
    The store sets `passwordSetupRequired` for `invite` and `recovery` links.
11. If the user lands on `/` with a pending password setup, the router guard sends them to
    `/set-password`. With the default `{{ .ConfirmationURL }}` template, Supabase Auth has
    already exchanged the link for a session.
12. For invite templates that use `token_hash` instead of `ConfirmationURL`,
    `auth-link.ts` also captures the hash. `/set-password` shows a **Continue** button and
    does not redeem the token until the recipient clicks it; `auth.verifyLink()` then calls
    `supabase.auth.verifyOtp({ token_hash, type })`. This avoids corporate email scanners
    consuming the one-time link before the recipient opens it.
13. `SetPasswordView.vue` validates the new password and calls
    `supabase.auth.updateUser({ password })` through `auth.setPassword()`. On success the
    flag is cleared and the user continues to `/overview`. If the link is expired or
    missing, the page shows the error and points back to sign-in.

## State ownership

`src/stores/auth.ts` is the single source of truth for:

- `session` and derived `user`
- `isAuthenticated`
- `fullName` and `fullNameRequired` from `user_metadata.full_name`
- `initialized` and `loading`
- `error` (user-facing message)
- `initialize`, `signIn`, `verifyLink`, `setPassword`, `updateFullName`, `signOut`
- `passwordSetupRequired`, `linkType`, `linkTokenHash`, and `linkError` for
  invitation/recovery links

Components must not call `supabase.auth` directly. This keeps error handling and session
updates consistent.

The hiring workspace is split by domain, and each store owns its own `error` state:

- `src/stores/boards.ts` owns boards, columns, and the derived groups, summaries, and totals.
- `src/stores/applicants.ts` owns candidate lookup, applicant CRUD, moves, status changes,
  debounced autosave, and edit snapshots.
- `src/stores/applicant-activity.ts` owns applicant events and notes plus their per-applicant
  loading state.
- `src/stores/storage.ts` owns CV and job-spec uploads, removals, signed URLs, and blobs.
- `src/stores/fit.ts` owns persisted CV-analysis state.

Components call the store for the area they are changing instead of calling Supabase
directly. Because the errors are separate, a failed CV upload does not overwrite a board or
applicant error.

## Update strategy

Board and column mutations (`updateBoard`, `addColumn`, `renameColumn`, `reorderColumns`, and
`deleteColumn`) are pessimistic: local state changes only after Supabase accepts the write.
Applicant moves, status changes, and debounced field autosave are optimistic so drag-and-drop
and typing stay responsive:

- `moveCandidate` remembers the previous `stepId`, `status`, and `stepEnteredAt`, and
  `setCandidateStatus` remembers the previous `status`. If the API call fails, the store
  restores the remembered values and sets its `error`, so the board never shows a column or
  outcome the database does not have.
- Autosave tracks the profile fields that changed since the last successful save and writes
  only those fields. Profile saves never include `status` or `column_id`, so editing a name,
  contact detail, role, education, experience, or favourite cannot move an applicant or
  change their outcome. A field that changes while a save is in flight stays dirty and is
  written by the next debounced save.
- A failed autosave keeps the user's text instead of reverting it mid-edit.
  `persistCandidate` marks the applicant as not saved (`hasUnsavedChanges`), the applicant
  drawer shows a non-blocking "Changes not saved" alert with a Retry action, and the next
  successful save clears the flag.

Because every signed-in user shares the workspace, `AppShell` re-fetches boards when the
window regains focus and when the tab becomes visible again. `boards.refresh()` merges the
remote result into the existing board and applicant objects, removes boards and applicants
that no longer exist, and reapplies the applicant store's dirty profile fields so a refresh
never discards text that is still being edited. The router guard still performs the initial
`initialize()` load; refresh does not replace it.

Components render the store `error` values; they do not roll back or retry Supabase writes on
their own.

The Supabase client is a singleton in `src/lib/supabase.ts`. It reads
`VITE_SUPABASE_URL` and `VITE_SUPABASE_PUBLISHABLE_KEY` at module load and refuses to start
without them. It also rejects a `sb_secret_` key defensively. `persistSession` is disabled so
Supabase never writes the JWT to browser storage; `autoRefreshToken` keeps the in-memory
session current while the tab is open.

## Board data

The schema lives in `supabase/migrations/`:

- `public.boards` — free-text department, name unique per department, open positions,
  deadline, job spec path and filename, timestamps.
- `public.board_columns` — board, unique name per board, ordered `position`.
- `public.applicants` — board, assigned column, contact details, current role, free-text
  education and work experience, favourite flag, status, CV path and filename, `applied_at`,
  and `step_entered_at`. Email and phone are optional; when present they are unique per
  board.
- `public.applicant_events` — board and applicant scope, actor id and name, action, rendered
  message, and timestamp. Actions cover creation, profile edits, moves, hire/reject/reopen
  status changes, and CV analyses. The `(board_id, applicant_id)` foreign key targets the
  applicant's composite unique key and cascades on delete, so deleting an applicant or board
  permanently removes its events. Events are immutable: clients have select-only access to
  the table. An `after insert or update` trigger on `public.applicants` writes creation, move,
  and status events in the same transaction as the applicant change, using the JWT full name
  or email as the actor. The narrow `record_applicant_edit_event` RPC records the one
  profile-edit event per drawer session, and the `fit-analysis` Edge Function records
  CV-analysis events. There are no update or delete policies.
- `public.applicant_notes` — board and applicant scope, author id and name, free-text body,
  and timestamp. The composite applicant foreign key cascades from the applicant and board.
  Notes are append-only: clients can select and insert, but there are no update or delete
  policies.
- `public.applicant_fit_analyses` — one row per applicant, scoped by the composite
  `(board_id, applicant_id)` foreign key. It stores CV, job-spec, and profile fingerprints,
  the Kilo model and prompt version, and the validated similarities/gaps JSON. Authenticated
  users can select; only the Edge Function with the service role writes.

The composite applicant foreign key `(board_id, column_id)` guarantees that an applicant is
assigned to a column on the same board. New applicants default to the column named
`Applied`, falling back to the first column when it has been renamed. Email and phone use
partial unique indexes so multiple applicants can leave them blank. A trigger keeps
`updated_at` current. SQL functions
`create_board`, `add_board_column`, `reorder_board_columns`, and `delete_board_column` make
multi-row changes atomic.
`delete_board_column` moves the column's applicants to the first column, and the first column
cannot be deleted. Deleting a board cascades to its columns and applicants, and deleting an
applicant cascades to its events, notes, and fit analysis.

Applicant CVs use the private Supabase Storage bucket `cvs`. One PDF per applicant is stored
at `<applicant-id>/cv.pdf`; the `applicants.cv_path` and `applicants.cv_name` columns hold the
object reference and original filename. Board job specs use the private `job-specs` bucket at
`<board-id>/job-spec.pdf`; the `boards.job_spec_path` and `boards.job_spec_name` columns hold
the reference and original filename. Storage policies allow the `authenticated` role only.
The storage store removes stored objects when a CV, job spec, applicant, or board is deleted.

Every PDF upload passes through the browser compressor in `src/lib/pdf.ts` before it reaches
Supabase. The compressor re-encodes embedded raster images with the browser canvas JPEG
encoder and rewrites the PDF with compact object streams. Text, fonts, and vector drawing are
untouched, tiny files are skipped, and the original file is kept when compression does not
make it smaller. This reduces storage for scanned CVs and job specs without adding a server
or Edge Function.

### Applicant CV import

`src/lib/resume-import.ts` fills the add-applicant form locally; no CV data is sent to a
third party. It extracts each PDF page's text layer with `pdfjs-dist`, then applies
heuristics for name, email, phone, current role, education, and work experience. Names are
title-cased and emails are lowercased. Education and experience are grouped into entries
with a title, date range, and details, separated by blank lines, plus a short summary of the
highest qualification or total industry experience. Section headings such as achievements,
certifications, and skills stop education and experience extraction. Extracted values
populate the form immediately but remain editable and are marked as auto-filled.

Pages with little or no text are treated as scanned. When key fields are still missing, the
importer lazy-loads Tesseract.js (`eng`) and OCRs at most the first three scanned pages,
starting with page one. OCR runs in a Web Worker with one page rendered at a time, reports
progress, and can be cancelled from the dialog. Page text is cached in IndexedDB by file
hash so re-importing the same CV is instant. OCR assets are self-hosted under `public/ocr/`;
`scripts/copy-ocr-assets.mjs` copies the pinned worker, LSTM WASM cores, and English
traineddata from `node_modules` during `predev` and `prebuild`. Generated assets are ignored
by git.

The CV selected during creation is uploaded after the applicant row exists. If the upload
fails, the applicant is still created and the board shows the store error; the CV can be
retried from the applicant drawer. LinkedIn URL scraping is intentionally not supported:
LinkedIn blocks automated access, prohibits scraping, and has no free reliable profile API.

### CV analysis

The applicant drawer has an **Analize** tab. It compares the applicant's education and work
experience with the board's PDF job spec and shows two lists: similarities and gaps. The flow is:

```text
Analize tab, CV upload, or refresh
  -> consent dialog (every analysis, including re-evaluation)
  -> browser extracts job-spec text locally (pdfjs-dist + OCR fallback)
  -> supabase.functions.invoke('fit-analysis')
  -> Edge Function verifies JWT, loads the applicant with the service role
  -> redacts identity/sensitive fields, calls Kilo's free model
  -> validates the similarities/gaps JSON
  -> upserts public.applicant_fit_analyses
  -> Edge Function records an analyzed applicant event
  -> drawer reloads the stored result through the fit Pinia store
```

`src/stores/fit.ts` owns fit state. It downloads the CV and job spec through the storage
store, hashes the CV bytes and cleaned job-spec text, and sends only the applicant id,
job-spec text, and fingerprints; the Edge Function loads the role and department server-side.
The UI requires consent before invoking the function. The Edge Function performs the actual
model call and writes the row; the browser never validates model output or receives the Kilo
key.

The Edge Function sends only the job spec and redacted education/work experience to Kilo. It
removes names, email, phone, URLs, address, date of birth, nationality, gender, age, marital
status, and similar sensitive lines while keeping employers, institutions, and date ranges.
Every analysis requires explicit consent because Kilo may log or train on free-tier requests.
Results are shared with all signed-in users in the workspace. Analysis is English-only, has no
local or paid fallback, and a failed or rate-limited call leaves the previous row intact.

RLS is enabled on all six tables. Table privileges are explicitly granted to
`authenticated` and revoked from `anon`; RLS policies then grant the operations each table
needs. Board tables allow `select`, `insert`, `update`, and `delete`; applicant events allow
`select` only and applicant notes allow `select` and `insert`; fit analyses allow `select`
only. Events are written by database triggers, the narrow edit RPC, or the Edge Function with
the service role. RLS alone is not sufficient
because PostgREST also requires the underlying table grants. RPC execution is revoked from
`public` and `anon` and granted to `authenticated`.

`src/lib/boards-api.ts`, `applicants-api.ts`, `activity-api.ts`, `storage-api.ts`, and
`fit-api.ts` own Supabase queries, Edge Function invocation, and error-throwing boundaries,
sharing row types, select fragments, and domain mappers through `src/lib/api-shared.ts`.
`src/lib/store-errors.ts` holds the shared friendly constraint messages.

`src/stores/boards.ts` is the source of truth for boards and columns:

- `boards`, `loading`, `initialized`, and `error`.
- derived `groups`, `orderedBoards`, `summaries`, `totals`, and `needsAttention` (boards past
  their deadline).
- `initialize`, `refresh`, `createBoard`, `updateBoard`, `deleteBoard`, `addColumn`,
  `renameColumn`, `reorderColumns`, `deleteColumn`, and `reset`.

`src/stores/applicants.ts` owns candidate behavior:

- `candidateById` and its own `error`.
- `createApplicant`, `deleteApplicant`, `updateCandidateField`, and `toggleFavorite`.
- `pendingProfileValues` exposes the dirty profile fields that `boards.refresh()` must keep
  when it merges remote data.
- `advanceCandidate`, `moveCandidate`, `hireCandidate`, `rejectCandidate`,
  `reopenCandidate`, `flushCandidate`, and `reset`.
- `beginCandidateEdit`, `forgetCandidate`, and `forgetCandidates` for autosave timers and
  edit snapshots.

`src/stores/applicant-activity.ts` owns the audit trail and notes:

- its own `error`, `eventsFor`, `eventsLoadingFor`, `notesFor`, and `notesLoadingFor`.
- `loadEvents`, `loadNotes`, `addNote`, `recordEdit`, `forgetCandidate`, and
  `forgetCandidates`.

`src/stores/storage.ts` owns file storage for both buckets:

- its own `error` and CV actions `uploadCv`, `removeCv`, `cvSignedUrl`, and `cvBlob`.
- job-spec actions `uploadJobSpec`, `removeJobSpec`, `jobSpecSignedUrl`, and `jobSpecBlob`.
- quiet cleanup helpers used when an applicant or board is deleted.

`src/stores/fit.ts` holds fit analyses by applicant, loading/analyzing/error/progress state,
and stale flags. Its `load` reads the stored row, `analyze` extracts the job spec, hashes the
CV and profile, invokes `fit-analysis`, and `markStale` / `markBoardStale` flag results after a
CV or job-spec change.

The router guard awaits `boards.initialize()` before entering a protected route. Text-field
edits update Pinia immediately and are debounced before the applicant row is written;
`flushCandidate` writes any pending edit when the drawer closes. The drawer snapshots the
profile when it opens; on close, `flushCandidate` compares the snapshot and records one
`edited` event only when a name, contact, role, education, experience, favourite, or CV value
changed. This avoids one event per keystroke; the narrow `record_applicant_edit_event` RPC
derives the actor and message from the session and applicant. Database triggers record
creation, moves, and hire/reject/reopen events in the same transaction as the applicant
change. `src/types/pipeline.ts` defines the domain types,
`src/lib/applicant-events.ts` provides the fallback actor label and formats timestamps, and
`src/lib/pipeline.ts` contains pure helpers for column lookup, deadlines, elapsed days,
next-step navigation, department grouping, and summaries. Components read from the stores and
call their actions; they do not call Supabase directly.

## Routing and GitHub Pages

- History mode: `createWebHistory(import.meta.env.BASE_URL)`.
- Dev base: `/`; production base: `/TeamBuilder/`.
- Routes: `/` (login), `/set-password` (invite/recovery or password update), `/overview`
  (protected landing), `/boards` (protected), `/boards/:boardId` (protected), `/account`
  (protected), `/dashboard` (redirect to `/account`), catch-all redirect to `/`.
- GitHub Pages does not rewrite unknown paths. `scripts/postbuild.mjs` copies the built
  `index.html` to `404.html` and writes `.nojekyll`. A direct request to
  `/TeamBuilder/boards` receives the 404 document, which boots Vue Router with the original
  URL and renders the boards page.
- The 404 response status is intentional and harmless for this demo. Do not replace the
  fallback with hash routing unless pretty URLs are abandoned.

## Build and deployment pipeline

```text
push to main
  -> deploy.yml
     -> npm ci
     -> lint, typecheck, test
     -> validate:env (fails if secrets are missing or a secret key is used)
     -> npm run build (Vite embeds VITE_SUPABASE_URL + publishable key)
     -> postbuild: dist/404.html + dist/.nojekyll
     -> actions/configure-pages
     -> actions/upload-pages-artifact
     -> actions/deploy-pages
  -> functions job
     -> validate KILO_MODEL is free
     -> supabase secrets set KILO_API_KEY + KILO_MODEL
     -> supabase functions deploy fit-analysis
  -> https://michielhbrand.github.io/TeamBuilder/

push to main (in parallel)
  -> release.yml
     -> npm ci
     -> semantic-release
     -> tag vX.Y.Z + GitHub release with generated notes
```

`ci.yml` runs on pull requests and pushes to `main`. It builds with placeholder values so
forks and untrusted PRs do not need secrets. The deploy workflow, which runs only from the
trusted `main` branch or a manual dispatch, uses the real repository secrets. The function
job never passes `KILO_API_KEY` to Vite; it sets it directly on the Supabase project and
deploys `fit-analysis`.

`release.yml` uses Conventional Commits to decide whether a release is needed. `fix` and
`perf` create patches, `feat` creates minors, and breaking changes create majors. Releases
do not deploy the site; Pages continues to follow every push to `main`, so the deployed site
can be newer than the latest release.

## Environment matrix

| Context                   | URL                      | Key source                        | Sign-ups                  |
| ------------------------- | ------------------------ | --------------------------------- | ------------------------- |
| Local dev, local Supabase | `http://127.0.0.1:54321` | `supabase status` publishable key | Disabled in `config.toml` |
| Local dev, cloud Supabase | Project URL              | Supabase Connect dialog           | Disabled in dashboard     |
| Local production build    | Project URL              | `.env.production.local`           | Not used                  |
| CI build                  | Placeholder              | Workflow placeholders             | Not used                  |
| Production build          | Project URL              | GitHub Actions secret             | Disabled in dashboard     |

`npm run supabase:reset` recreates a local-only user from `LOCAL_USER_EMAIL`,
`LOCAL_USER_PASSWORD`, and `LOCAL_USER_NAME` in `.env.local`; those credentials are never used
for the cloud project. `.env.production.local` is gitignored and lets a local production
build target the cloud project while `.env.local` targets local Supabase.

Function secrets are separate from the Vite build:

| Secret                  | Used by         | Notes                                       |
| ----------------------- | --------------- | ------------------------------------------- |
| `KILO_API_KEY`          | `fit-analysis`  | Server-only; never a `VITE_*` value         |
| `KILO_MODEL`            | `fit-analysis`  | Must be `kilo-auto/free` or end in `:free`  |
| `SUPABASE_ACCESS_TOKEN` | deploy workflow | Used to set secrets and deploy the function |
| `SUPABASE_PROJECT_ID`   | deploy workflow | Supabase project ref                        |

## Failure modes

- Missing env values: `src/lib/supabase.ts` throws a clear startup error; `validate:env`
  fails the deploy before building.
- Wrong Supabase URL or key: the login request fails; the store surfaces a connection error.
- Unconfirmed user: Supabase returns an email-confirmation error; the store explains how to
  fix it.
- Invalid credentials: mapped to "Invalid email or password."
- Invite email opens the wrong host (for example `localhost:3000`): the cloud Supabase Site
  URL is wrong. Set it to the Pages origin and re-send the invitation.
- Expired or already-used invite link: the user arrives without a session; `/set-password`
  shows the link error instead of the form and offers a **Sign in** button so users who
  already set their password can return to login.
- Invite works for one recipient but fails on a corporate domain: an email security scanner
  prefetched the `ConfirmationURL` and consumed the single-use token. Switch the invite
  template to the `token_hash` link documented in `README.md` so the app redeems it only
  after the recipient presses **Continue**.
- No release after a push: the commit message is not a Conventional Commit or contains no
  release-worthy type. The deploy still succeeds; rewrite the commit or create a release
  manually only when recovering.
- Fit analysis missing prerequisites: the tab explains whether the board needs a job spec,
  the applicant needs a CV, or the profile needs education or experience.
- Fit analysis not configured: the Edge Function returns a configuration error when
  `KILO_API_KEY` or `KILO_MODEL` is missing, or when `KILO_MODEL` is not free.
- Kilo rate limit or outage: the function returns an error and the previous stored analysis
  remains visible; there is no fallback engine.
- Pages direct navigation: served through `404.html`; if the fallback is removed, refreshing
  `/TeamBuilder/boards` returns a GitHub 404 page.
- Renamed repository: production base and Supabase redirect URLs must change together. The
  current base `/TeamBuilder/` assumes the repository is `michielhbrand/TeamBuilder`. Deploy
  only after the repository rename, Pages URL, and Supabase Site URL agree.

## Extension guidance

- To change the board schema, add a migration in `supabase/migrations`, update the matching
  module under `src/lib/` (`boards-api.ts`, `applicants-api.ts`, `activity-api.ts`,
  `storage-api.ts`, or `fit-api.ts`) and `api-shared.ts` mapping, and update both the domain
  types and the owning store. Enable RLS and add policies for the intended roles; keep the
  secret key server-side.
- Keep the pure helpers in `src/lib/pipeline.ts` free of Supabase calls so pipeline behavior
  stays unit-testable.
- To change fit analysis, update the prompt/validation/redaction in
  `supabase/functions/fit-analysis`, bump `PROMPT_VERSION`, and keep the Edge Function as the
  only writer of `public.applicant_fit_analyses`.
- Keep the first board column as the fallback bucket. If column reordering is added, update
  the atomic delete function and the `position` ordering together.
- Password recovery links already use the same `/set-password` flow. If magic links are
  added, extend the Supabase redirect allow-list for both local and Pages origins and add
  the corresponding routes.
- If a custom domain is used, update the Vite base (possibly `/`), Supabase Site URL and
  redirect URLs, and the deployment documentation.
