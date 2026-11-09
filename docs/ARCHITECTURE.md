# Architecture

## Overview

TeamBuilder is a static Vue 3 single-page application. Authentication and data access are
performed directly against Supabase from the browser using the publishable key. There is no
custom backend and no server-side session. Administrators provision users in Supabase and can
invite them by email; invited users choose their own password.

The protected hiring portal is a board-based workspace. A board represents one open role,
boards are grouped by department, and each board has its own ordered columns and applicants.
Boards, columns, applicants, and their audit events are stored in Supabase Postgres and
loaded through Pinia. Every signed-in user shares the same workspace; Row Level Security
allows the `authenticated` role only.

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
8. `OverviewView.vue` is the post-login landing page. `BoardsView.vue` lists boards grouped
   by department, `BoardView.vue` renders one board's step columns, and `AccountView.vue`
   shows non-sensitive session details, full-name editing, and password reset. Sign-out calls
   `auth.signOut()`, clears the session, and returns to `/`.
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
  message, and timestamp. The `(board_id, applicant_id)` foreign key targets the applicant's
  composite unique key and cascades on delete, so deleting an applicant or board permanently
  removes its events. Events are append-only: clients can select and insert, but there are no
  update or delete policies.

The composite applicant foreign key `(board_id, column_id)` guarantees that an applicant is
assigned to a column on the same board. New applicants default to the column named
`Applied`, falling back to the first column when it has been renamed. Email and phone use
partial unique indexes so multiple applicants can leave them blank. A trigger keeps
`updated_at` current. SQL functions
`create_board`, `add_board_column`, `reorder_board_columns`, and `delete_board_column` make
multi-row changes atomic.
`delete_board_column` moves the column's applicants to the first column, and the first column
cannot be deleted. Deleting a board cascades to its columns and applicants; deleting an
applicant is permanent.

Applicant CVs use the private Supabase Storage bucket `cvs`. One PDF per applicant is stored
at `<applicant-id>/cv.pdf`; the `applicants.cv_path` and `applicants.cv_name` columns hold the
object reference and original filename. Board job specs use the private `job-specs` bucket at
`<board-id>/job-spec.pdf`; the `boards.job_spec_path` and `boards.job_spec_name` columns hold
the reference and original filename. Storage policies allow the `authenticated` role only.
The store removes stored objects when a CV, job spec, applicant, or board is deleted.

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

RLS is enabled on all four tables. Table privileges are explicitly granted to
`authenticated` and revoked from `anon`; RLS policies then grant the operations each table
needs. Board tables allow `select`, `insert`, `update`, and `delete`; applicant events are
append-only and allow `select` and `insert` only. RLS alone is not sufficient because
PostgREST also requires the underlying table grants. RPC execution is revoked from `public`
and `anon` and granted to `authenticated`.

`src/lib/boards-api.ts` owns Supabase queries, row/domain mapping, and error-throwing
boundaries. `src/stores/boards.ts` is the single source of truth for the hiring portal:

- `boards`, `loading`, `initialized`, and `error`.
- derived `groups`, `orderedBoards`, `summaries`, `totals`, and `needsAttention` (boards past
  their deadline).
- `initialize`, `createBoard`, `updateBoard`, `deleteBoard`, `addColumn`, `renameColumn`,
  `reorderColumns`, `deleteColumn`.
- `createApplicant`, `deleteApplicant`, `updateCandidateField`, and `toggleFavorite`.
- `advanceCandidate`, `moveCandidate`, `hireCandidate`, `rejectCandidate`,
  `reopenCandidate`, `flushCandidate`, and `reset`.
- `beginCandidateEdit`, `loadApplicantEvents`, `eventsFor`, and `eventsLoadingFor` for the
  applicant audit trail.

The router guard awaits `boards.initialize()` before entering a protected route. Text-field
edits update Pinia immediately and are debounced before the applicant row is written;
`flushCandidate` writes any pending edit when the drawer closes. The drawer snapshots the
profile when it opens; on close, `flushCandidate` compares the snapshot and records one
`edited` event only when a name, contact, role, education, experience, favourite, or CV value
changed. This avoids one event per keystroke. Drag-and-drop moves, status changes, deletes,
and creations call the API directly. Applicant creation, moves, and hire/reject/reopen
changes record one event after the applicant update succeeds. `src/types/pipeline.ts` defines
the domain types,
`src/lib/applicant-events.ts` builds event messages and formats timestamps, and
`src/lib/pipeline.ts` contains pure helpers for column lookup, deadlines, elapsed days,
next-step navigation, department grouping, and summaries. Components read from the store and
call its actions; they do not call Supabase directly.

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
  -> https://michielhbrand.github.io/TeamBuilder/

push to main (in parallel)
  -> release.yml
     -> npm ci
     -> semantic-release
     -> tag vX.Y.Z + GitHub release with generated notes
```

`ci.yml` runs on pull requests and pushes to `main`. It builds with placeholder values so
forks and untrusted PRs do not need secrets. The deploy workflow, which runs only from the
trusted `main` branch or a manual dispatch, uses the real repository secrets.

`release.yml` uses Conventional Commits to decide whether a release is needed. `fix` and
`perf` create patches, `feat` creates minors, and breaking changes create majors. Releases
do not deploy the site; Pages continues to follow every push to `main`, so the deployed site
can be newer than the latest release.

## Environment matrix

| Context                   | URL                      | Key source                        | Sign-ups                  |
| ------------------------- | ------------------------ | --------------------------------- | ------------------------- |
| Local dev, local Supabase | `http://127.0.0.1:54321` | `supabase status` publishable key | Disabled in `config.toml` |
| Local dev, cloud Supabase | Project URL              | Supabase Connect dialog           | Disabled in dashboard     |
| CI build                  | Placeholder              | Workflow placeholders             | Not used                  |
| Production build          | Project URL              | GitHub Actions secret             | Disabled in dashboard     |

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
- Pages direct navigation: served through `404.html`; if the fallback is removed, refreshing
  `/TeamBuilder/boards` returns a GitHub 404 page.
- Renamed repository: production base and Supabase redirect URLs must change together. The
  current base `/TeamBuilder/` assumes the repository is `michielhbrand/TeamBuilder`. Deploy
  only after the repository rename, Pages URL, and Supabase Site URL agree.

## Extension guidance

- To change the board schema, add a migration in `supabase/migrations`, update
  `src/lib/boards-api.ts` mapping, and update both the domain types and the store. Enable RLS
  and add policies for the intended roles; keep the secret key server-side.
- Keep the pure helpers in `src/lib/pipeline.ts` free of Supabase calls so pipeline behavior
  stays unit-testable.
- Keep the first board column as the fallback bucket. If column reordering is added, update
  the atomic delete function and the `position` ordering together.
- Password recovery links already use the same `/set-password` flow. If magic links are
  added, extend the Supabase redirect allow-list for both local and Pages origins and add
  the corresponding routes.
- If a custom domain is used, update the Vite base (possibly `/`), Supabase Site URL and
  redirect URLs, and the deployment documentation.
