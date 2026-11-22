# Architecture

## Overview

TeamBuilder is a static Vue 3 single-page application. Authentication and data access are
performed directly against Supabase from the browser using the publishable key. There is no
custom session server. One authenticated Supabase Edge Function, `fit-analysis`, proxies
requests to a free hosted model for CV analysis. Administrators provision users in
Supabase and can invite them by email; invited users choose their own password.

The protected hiring portal is a board-based workspace. A board represents one open role,
boards are grouped by department, and each board has its own ordered stages and applicants.
Boards, stages, applicants, their audit events, notes, fit analyses, and a small hiring
history are stored in Supabase Postgres and loaded through Pinia. Every signed-in user shares the same workspace;
Row Level Security allows the `authenticated` role only.

```text
Browser
  |
  |  HTTPS (Supabase Auth API)
  v
Supabase Auth  <---- session JWT issued to the browser
  |
  +--> PostgREST / Postgres (RLS: authenticated only)  <---- boards, stages, applicants, events, history

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
- `src/components/BoardList.vue`, `BoardColumn.vue`, `CandidateCard.vue`, `StageTabs.vue`,
  `BoardSwitcher.vue`, `ApplicantDrawer.vue`, and `PipelineBar.vue` implement the board UI.
  The Overview is built from `OverviewPanel.vue`, `OverviewKpi.vue`, `OverviewSourceTag.vue`,
  `QuarterChart.vue`, `HireTimeChart.vue`, `PipelineLine.vue`, `StageBars.vue`, `FlowRows.vue`,
  `AttentionList.vue`, `ActivityFeed.vue`, `RoleDeadlineTable.vue`, and one `ChartTooltip.vue`;
  the earlier workload chart, outcome donut, role performance table, and applicant watch lists
  (`DepartmentLoadChart.vue`, `OutcomeDonut.vue`, `RolePerformanceTable.vue`,
  `ApplicantWatchList.vue`) were removed, not kept alongside.
  `BoardView.vue` renders its header through `PageHeader` and uses
  `useMediaQuery('(max-width: 720px)')` from `src/lib/use-media-query.ts` to swap the stage
  grid for `StageTabs` and a single selected stage on phones. `CandidateCard.vue` moves an
  applicant through `moveCandidate` (tray chevrons, Move to..., or drag to an adjacent stage)
  and decides through `hireCandidate` / `rejectCandidate`, whose undo entry the shared
  `UndoToast` shows. `ApplicantDrawer.vue` is the right-side editable applicant profile opened
  from a card. Its header holds `ApplicantStageBar.vue`, which reads the applicants and boards
  stores itself: a stage stepper (click a stage to call `moveCandidate`), **Move to <next>**
  (`advanceCandidate`), Hire and Reject (with the same undo toast), the `saveStatusFor`
  indicator, and for closed applicants an outcome chip with Reopen. The drawer tabs are
  Overview, CV, Career, CV fit, and Activity.
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
   `session` in place. When the next session is `null`, the auth store resets the boards,
   applicants, applicant-activity, storage, fit, history, and undo stores so no workspace data or
   pending saves survive a sign-out.
4. Only after initialization does `main.ts` install the router and mount the app. This keeps
   the first navigation from racing the session lookup.
5. `router.beforeEach` checks `to.meta.requiresAuth`. Unauthenticated visitors to a
   protected route are redirected to `/` with a `redirect` query parameter.
6. `LoginView.vue` validates the form and calls `auth.signIn(email, password)`, which calls
   `supabase.auth.signInWithPassword()`.
7. On success the store stores the session, and the view navigates to the requested redirect
   or `/overview`.
8. `OverviewView.vue` is the post-login hiring dashboard. It shows six KPIs, what needs
   attention, the latest activity, roles by deadline, quarterly hiring trends and time to hire
   from the history tables, and a per-board stage view, with a department filter and
   drill-downs into boards. `BoardsView.vue`
   lists boards grouped by department, `BoardView.vue` renders one board's stage columns, and
   `AccountView.vue` is a single column with full-name editing, a read-only email, password
   reset, a light/dark appearance control, and sign-out. Sign-out calls `auth.signOut()`, which clears the session and resets the dependent
   workspace stores; `App.vue` watches `auth.isAuthenticated` and redirects a protected route
   to `/` with a `redirect` query when the session ends.
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
13. `ForgotPasswordView.vue` (`/forgot-password`, linked from the sign-in password label)
    calls `auth.requestPasswordReset(email)`, which validates the email and calls
    `supabase.auth.resetPasswordForEmail(email, { redirectTo: <origin><BASE_URL> })`. The view
    shows the same "If an account exists for that address..." message whether or not the
    account exists, and disables resend for 60 seconds, and treats Supabase's per-user "for security purposes" throttle as success too. The emailed link returns to the app
    root as a `recovery` link, which the steps above route to `/set-password`. The router
    guard treats `/forgot-password` like `/` (redirect to `/overview` when signed in, to
    `/set-password` when password setup is pending).
14. `SetPasswordView.vue` validates the new password and calls
    `supabase.auth.updateUser({ password })` through `auth.setPassword()`. On success the
    flag is cleared and the user continues to `/overview`. If the link is expired or
    missing, the page shows the error and points back to sign-in.

## State ownership

`src/stores/auth.ts` is the single source of truth for:

- `session` and derived `user`
- `isAuthenticated`
- `fullName` and `fullNameRequired` from `user_metadata.full_name`
- `actorName` for activity authors, falling back to the signed-in email and then
  `DEFAULT_ACTOR_NAME`
- `initialized` and `loading`
- `error` (user-facing message)
- `initialize`, `signIn`, `requestPasswordReset`, `clearError`, `verifyLink`, `setPassword`,
  `updateFullName`, `signOut`
- `passwordSetupRequired`, `linkType`, `linkTokenHash`, and `linkError` for
  invitation/recovery links

Components must not call `supabase.auth` directly. This keeps error handling and session
updates consistent.

The hiring workspace is split by domain, and each store owns its own `error` state:

- `src/stores/boards.ts` owns boards, stages (`board_columns`), and the derived groups and ordered boards.
- `src/stores/applicants.ts` owns applicant lookup, applicant CRUD, moves, status changes,
  debounced autosave (`retryCandidateSave` retries a failed save without touching the edit
  snapshot; `flushCandidate` saves and records the profile-edit event on close), and edit
  snapshots.
- `src/stores/applicant-activity.ts` owns applicant events and notes plus their per-applicant
  loading state.
- `src/stores/storage.ts` owns CV and job-spec uploads, removals, signed URLs, and blobs.
- `src/stores/fit.ts` owns persisted CV-analysis state.
- `src/stores/history.ts` owns the read-only hiring history (`months` from
  `public.hiring_monthly`, `hires` from `public.hire_history`) with `initialize`, `refresh`,
  and `reset`.
- `src/stores/undo.ts` owns the single pending undo entry (message, action, and an 8 second
  timer). A new entry replaces the current one; sign-out resets it. The undo action handles its own
  failures: a failed undo write rolls back and surfaces through `applicants.error`.

Components call the store for the area they are changing instead of calling Supabase
directly. Because the errors are separate, a failed CV upload does not overwrite a board or
applicant error.

## Update strategy

Board and stage mutations (`updateBoard`, `addColumn`, `renameColumn`, `reorderColumns`, and
`deleteColumn`) are pessimistic: local state changes only after Supabase accepts the write.
Applicant moves, status changes, and debounced field autosave are optimistic so drag-and-drop
and typing stay responsive:

- `moveCandidate` remembers the previous `stepId`, `status`, and `stepEnteredAt`, and
  `setCandidateStatus` remembers the previous `status`. If the API call fails, the store
  restores the remembered values and sets its `error`, so the board never shows a stage or
  outcome the database does not have.
- `hireCandidate`, `rejectCandidate`, and `reopenCandidate` resolve `true` when the write
  succeeds. Hire and reject also push an undo entry (`"<name> hired"` / `"<name> rejected"`)
  that `UndoToast` shows; running it reopens the applicant only if the status still matches
  the one just set, both locally and on the server (`reopenApplicantIfStatus` updates only a
  row that still has that status, so a decision changed elsewhere is left alone). Reopen pushes nothing.
- Autosave tracks the profile fields that changed since the last successful save and writes
  only those fields. Profile saves never include `status` or `column_id`, so editing a name,
  contact detail, role, notice period, salary expectation, education, experience, or favorite
  cannot move an applicant or change their outcome. A field that changes while a save is in flight stays dirty and is
  written by the next debounced save.
- A failed autosave keeps the user's text instead of reverting it mid-edit.
  `persistCandidate` marks the applicant as not saved (`hasUnsavedChanges`), the applicant
  drawer's save indicator reads "Couldn't save" with a Retry action (which calls
  `flushCandidate`), and the next successful save clears the flag.
- `saveStatusFor(candidateId)` exposes the autosave lifecycle as `SaveStatus`
  (`idle`, `pending`, `saving`, `saved`, `failed`): an edit sets `pending`, the write sets
  `saving`, success sets `saved` (or `pending` again if a field changed mid-write), failure
  sets `failed`, and `forgetCandidate`/`reset` return to `idle`.

Because every signed-in user shares the workspace, `AppShell` re-fetches boards when the
window regains focus and when the tab becomes visible again. `boards.refresh()` merges the
remote result into the existing board and applicant objects, removes boards and applicants
that no longer exist, and reapplies the applicant store's dirty profile fields so a refresh
never discards text that is still being edited. The router guard still performs the initial
`initialize()` load; refresh does not replace it.

The history store follows the same pattern. `OverviewView.vue` calls `history.initialize()` on
mount, or `history.refresh()` when it is already initialized, so returning to the Overview
shows hires and decisions made meanwhile. `AppShell` also calls `history.refresh()` on window
focus and visibility, next to `boards.refresh()`. A failed refresh sets `history.error` and
keeps the previous rows. The Overview's "Latest activity" reads
`useApplicantActivityStore().recent`: `loadRecent()` fetches the newest 30 audit events across
all boards (one `applicant_events` query ordered by `created_at`), the view keeps those on the
filtered boards and shows 6, and `AppShell` reloads them on focus only after they have been
loaded once.

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
- `public.applicants` — board, assigned stage, contact details, current role, notice period
  in months (one decimal), salary expectation in cents defaulting to `0`, structured
  education and work experience (jsonb arrays of entries with `id`, `title`, `organization`,
  `start` and `end` as `YYYY-MM`, `current`, and `description`; a check constraint requires
  arrays), a `skills` jsonb string array, favorite flag, status, CV path and filename,
  `applied_at`, and `step_entered_at`.
  Entries are validated as valid month/year values and kept sorted newest first before they
  are written. Email and phone are optional; when present they are unique per board.
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
  the Kilo model and prompt version, the analysis schema version, completeness, and the
  validated requirements, similarities, and gaps JSON. Authenticated users can select; only
  the Edge Function with the service role writes.
- `public.board_requirement_sets` — one cached requirement list per board and job-spec
  fingerprint, scoped by `board_id` with a cascading foreign key. It stores the extracted
  minimum, recommended, and skills requirements so every applicant on that job spec is
  assessed against the same list. Authenticated users can select; only the Edge Function
  with the service role inserts or updates.

- `public.hiring_monthly` and `public.hire_history` — the hiring history, described under
  [Hiring history](#hiring-history).

The composite applicant foreign key `(board_id, column_id)` guarantees that an applicant is
assigned to a stage on the same board. New boards start with `Applied`, `Interview`, and
`Offer` stages. New applicants default to the stage named `Applied`, falling back to the
first stage when it has been renamed. Email and phone use
partial unique indexes so multiple applicants can leave them blank. A trigger keeps
`updated_at` current. SQL functions
`create_board`, `add_board_column`, `reorder_board_columns`, and `delete_board_column` make
multi-row changes atomic.
`delete_board_column` moves the stage's applicants to the first stage, and the first stage
cannot be deleted. The Manage stages dialog confirms deletes with `ConfirmDialog` and persists reorders pessimistically through `reorder_board_columns`. Deleting a board cascades to its columns and applicants, and deleting an
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

### Overview data sources

`OverviewView.vue` mixes two sources and tags each KPI and panel with a neutral source label.

- **Live boards** (`useBoardsStore`, filtered by the department chip): open positions, active
  applicants, "At final stage" (active applicants in each board's last stage), needs your
  attention, roles by deadline, and everything inside "One board in focus". Boards deleted by
  a manager vanish from these.
- **History table** (`useHistoryStore`): "Hired last 4 quarters", "Time to a hire" (median
  `days_to_hire` of hires in the last 4 quarters), "Hire rate" (hired over hired plus rejected
  across every recorded month), the two quarterly charts, and "How long hires take". These
  keep counting after boards and applicants are deleted. The range control chooses the last 4
  quarters or all quarters on record up to the latest 12, and drives both the quarterly charts
  and "How long hires take". The current quarter is marked partial.

No cross-board logic depends on stage names: company-wide numbers use counts, outcomes, dates,
and each board's last stage. The Roles table draws each board's own stages as a line, and
attention copy names a board's last stage as display text only. "Needs your attention" lists
boards past their deadline (most overdue first), boards with applicants at the final stage (most
applicants first), boards where every active applicant is still in the first stage and that are
at least 7 days old, and boards due within 14 days (soonest first); it shows 6 and the total.
"Latest activity" filters the 30 most recent events to the selected department's boards and
shows 6. With no live boards, the Overview replaces the live sections with "No role boards yet."
and still renders the history KPIs and charts when history exists; department chips include
departments known only from history. Stage-level charts ("Where active applicants are", "Time in the current stage") read
one board's own stages and are limited to the "One board in focus" picker. Charts are local SVG
sized from the container's measured width; `OverviewView` provides one shared tooltip.

### Excel export

The Overview's "Export to Excel" button downloads a workbook generated entirely in the browser.
Nothing is sent to a server; no Edge Function is involved.

Data flow: the boards and history stores (already loaded, read under RLS) feed
`buildWorkbookModel` in `src/lib/export-sheets.ts`, which returns pure `SheetModel`s. `exportWorkbook`
in `src/lib/export-xlsx.ts` styles them with `write-excel-file` (MIT), turns the result into a
`Blob`, and `downloadBlob` saves it through a temporary object URL. The library is loaded with
`import('write-excel-file/universal')` on click, so it sits in its own lazy chunk and never
loads with the page. `fflate` is a runtime dependency of `write-excel-file` (bundled in the lazy
chunk) and is also listed in `devDependencies` for tests that unzip the workbook.

Scope rules:

- The department chip applies to every sheet; with a department selected the file name carries
  it (`TeamBuilder-overview-<department>-<yyyy-mm-dd>.xlsx`), otherwise `all-departments`.
- Live sheets include every live board in scope. Hiring by quarter uses every history month in
  full. Time to hire uses the hire records the history store reads, which are limited to the
  last 12 quarters (see Hiring history). "All departments" total rows appear only when no
  department is selected.
- Date arithmetic uses UTC, with one `now` shared by all sheets in a workbook build.

Sheets, in order:

- **Summary** — title, as-at date, scope, six headline figures, a by-department table, and a
  note when history starts.
- **Active roles** — one row per live role: deadline, days to deadline, opened date, stage
  count, and active, hired, rejected, and final-stage counts.
- **Applicants** — one row per applicant: role, department, stage, status, name, email, phone,
  current role, applied date, days in stage (active only), notice period, salary expectation,
  and favorite.
- **Pipeline** — active applicants per stage for each role.
- **Hiring by quarter** — applicants in, hired, rejected, and hire rate per quarter and
  department. Quarters are sortable text such as `2026 Q3`; departments follow the known
  department order.
- **Time to hire** — hires (last 12 quarters) and median, fastest, slowest, quartile 1 and 3 days per department,
  plus the median for the last 4 quarters.

Excluded: notes, activity events, CVs, career entries, fit analyses, and internal ids.

Presentation rules are in `docs/DESIGN_SYSTEM.md`. Cell text is written as typed strings with
no changes apart from XML-invalid control characters (stripped by the library) and one trailing
space on values that equal a JavaScript built-in property name such as `constructor` or
`toString` (a workaround for a shared-string bug in the library). Excel filter dropdowns are not offered because the library cannot write
them. The button is disabled until the history store has loaded without an error, so the file never
silently omits history. A failed export shows an inline alert and leaves all state unchanged.

### Hiring history

Two tables hold privacy-safe history so trends survive deleted boards and applicants. Both have
no foreign keys and no personal data.

- `public.hiring_monthly` — one row per `(month, department)`, `month` being the first day of
  the month, with `applicants_in`, `hired`, and `rejected` counters.
- `public.hire_history` — one row per currently hired applicant: an opaque `applicant_id` (used
  only to undo a hire on reopen), `department`, `hired_on`, and `days_to_hire`.

Both are readable by `authenticated` only; clients cannot insert, update, or delete. The
`applicants_record_history` trigger on `public.applicants` (`after insert or update`) maintains
them through security-definer functions, in the same transaction as the applicant change:

- Insert adds 1 to `applicants_in` in the month of `applied_at`.
- A change to `hired` adds 1 to `hired` in the current month and upserts the `hire_history` row
  (`days_to_hire` is whole days from the board's `created_at` to today, floored at 0 and capped
  at 32767). A change to `rejected` adds 1 to `rejected` in the current month.
- Leaving `hired` removes the `hire_history` row and subtracts 1 from `hired` in the month of
  its stored `hired_on`. Leaving `rejected` subtracts 1 in the month of the applicant's latest
  `rejected` event, falling back to the current month. Counters never go below zero, and a
  direct hired to rejected change is an undo followed by the new decision.

Months and dates use UTC. The migration backfills both tables from live applicants and their
events. Deleting applicants or boards never touches them.

The API returns at most 1000 rows per request (`max_rows`), so `history-api.ts` pages through
every read with `.range()`. `fetchHireHistory` also limits the read to hires on or after
`historyWindowStart()` (the first day of the quarter 11 quarters back, the widest range the
Overview shows) and reads newest first, so the window itself can never drop the latest hires.

Accepted limits: history starts when the migration shipped (earlier deleted boards are not
recovered); a board's later department change leaves earlier counts under the old department;
there is no per-stage history; and an applicant deleted without a decision still counts in
`applicants_in`.

### Applicant CV import

`src/lib/resume-import.ts` fills the add-applicant form locally; no CV data is sent to a
third party. It extracts each PDF page's text layer with `pdfjs-dist`, then applies
heuristics for three groups: basics (name, email, phone, current role), education, and work
experience. Names are title-cased and emails are lowercased. Education and experience are
returned as structured entries: the title line becomes the qualification or job title, an
`at`/comma split or an institution-looking line becomes the institution or company, date
ranges become start and end months, and the remaining lines become the description. Start and
end months are validated as `YYYY-MM` before they reach an entry: month names, `MM/YYYY`,
`YYYY-MM`, and `YYYY/MM` are normalized, year-only dates use January and December,
`Present`/`Ongoing` and `Since <date>` set the current flag, invalid months are dropped, and an
end month before the start month is cleared. Section headings such as achievements,
certifications, and skills stop education and experience extraction. The current role comes
from an explicit label or the latest/current experience entry, and duplicate entries are
collapsed. Extracted entries populate the create dialog's timelines immediately but remain
editable and are marked as filled from the CV.

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
retried from the applicant drawer's CV tab or Overview CV card. LinkedIn URL scraping is intentionally not supported:
LinkedIn blocks automated access, prohibits scraping, and has no free reliable profile API.

### CV analysis

The applicant drawer has a **CV fit** tab. It compares the applicant's education, work
experience, and skills with the board's PDF job spec, assesses every requirement as full,
partial, or not met, and keeps the similarities and gaps lists. The flow is:

```text
CV fit tab, CV upload, refresh, or the stale banner's Re-run
  -> consent dialog (every analysis, including re-evaluation)
  -> browser extracts job-spec text locally (pdfjs-dist + OCR fallback)
  -> supabase.functions.invoke('fit-analysis')
  -> Edge Function verifies JWT, loads the applicant with the service role
  -> extracts requirements from the job spec, or reuses the cached
     board_requirement_sets row for the same board and job-spec fingerprint
  -> redacts identity/sensitive fields, calls Kilo's free model to assess each requirement
  -> validates the requirements and assessment JSON
  -> upserts public.applicant_fit_analyses
  -> Edge Function records an analyzed applicant event
  -> drawer reloads the stored result through the fit Pinia store
```

`src/stores/fit.ts` owns fit state. It downloads the CV and job spec through the storage
store, hashes the CV bytes and cleaned job-spec text, fingerprints the profile (including
skills), and sends only the applicant id, job-spec text, and fingerprints; the Edge Function
loads the role and department server-side. The UI requires consent before invoking the
function. The Edge Function performs the actual model calls and writes the rows; the browser
never validates model output or receives the Kilo key.

The Edge Function reads the structured entries, formats them with `formatCareerEntries`
(`supabase/functions/fit-analysis/career.ts`, mirrored by `formatEntriesText` in
`src/lib/career.ts`) into a heading, period, and description per entry, and fingerprints that
text. Legacy free text migrated into a single description-only entry formats to the same text,
so existing analyses stay current. It sends only the job spec and redacted education, work
experience, and skills to Kilo. It
removes names, email, phone, URLs, address, date of birth, nationality, gender, age, marital
status, and similar sensitive lines while keeping employers, institutions, and date ranges.
Every analysis requires explicit consent because Kilo may log or train on free-tier requests.
Results are shared with all signed-in users in the workspace. Analysis is English-only, has no
local or paid fallback, and a failed or rate-limited call leaves the previous row intact.

Requirement lists are cached in `public.board_requirement_sets` by board and job-spec
fingerprint. A new or changed job spec extracts a fresh list; every other analysis for that
spec reuses it, so candidates are compared against identical wording. Only complete analyses
with at least one requirement are ranked. Ranking is lexicographic ascending by minimum
penalty, minimum misses, recommended penalty, recommended misses, skills penalty, skills
misses, then name, where a penalty is one per missed requirement plus half per partial match.
This guarantees that any candidate with zero minimum misses ranks above every candidate with
a minimum miss. The board sorts within each stage only, and the **Rank by CV fit** toggle is
off by default.

RLS is enabled on all seven tables. Table privileges are explicitly granted to
`authenticated` and revoked from `anon`; RLS policies then grant the operations each table
needs. Board tables allow `select`, `insert`, `update`, and `delete`; applicant events allow
`select` only and applicant notes allow `select` and `insert`; fit analyses and board
requirement sets allow `select` only. Events are written by database triggers, the narrow edit
RPC, or the Edge Function with the service role. RLS alone is not sufficient
because PostgREST also requires the underlying table grants. RPC execution is revoked from
`public` and `anon` and granted to `authenticated`.

`src/lib/boards-api.ts`, `applicants-api.ts`, `activity-api.ts`, `storage-api.ts`, and
`fit-api.ts` own Supabase queries, Edge Function invocation, and error-throwing boundaries,
sharing row types, select fragments, and domain mappers through `src/lib/api-shared.ts`.
`src/lib/store-errors.ts` holds the shared friendly constraint messages.

`src/stores/boards.ts` is the source of truth for boards and stages:

- `boards`, `loading`, `initialized`, and `error`.
- derived `groups` (department groups, boards sorted by name) and `orderedBoards` (the flattened
  list).
- `initialize`, `refresh`, `createBoard`, `updateBoard`, `deleteBoard`, `addColumn`,
  `renameColumn`, `reorderColumns`, `deleteColumn`, and `reset`.

`src/stores/applicants.ts` owns applicant behavior:

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
  `forgetCandidates`. `addNote` reads the author from `auth.actorName`; components do not
  compute it.

`src/stores/storage.ts` owns file storage for both buckets:

- its own `error` and CV actions `uploadCv`, `removeCv`, `cvSignedUrl`, and `cvBlob`.
- job-spec actions `uploadJobSpec`, `removeJobSpec`, `jobSpecSignedUrl`, and `jobSpecBlob`.
- quiet cleanup helpers used when an applicant or board is deleted.

`src/stores/fit.ts` holds fit analyses by applicant, loading/analyzing/error/progress state,
and stale flags. Its `load` reads the stored row, `loadBoard` fetches every analysis for a
board so the stage ranking is complete, and `analyze` extracts the job spec, hashes the CV and
profile, invokes `fit-analysis`, and `markStale` / `markBoardStale` flag results after a CV or
job-spec change. `isStaleFor` also treats schema versions below 3 as stale. `rankForStage`,
`summaryFor`, and `isRankableFor` expose the pure ranking helpers to the board and drawer.

The router guard awaits `boards.initialize()` before entering a protected route. Text-field
edits update Pinia immediately and are debounced before the applicant row is written;
`flushCandidate` writes any pending edit when the drawer closes. The drawer snapshots the
profile when it opens; on close, `flushCandidate` compares the snapshot and records one
`edited` event only when a name, contact, role, education, experience, skills, favorite, or CV
value changed. This avoids one event per keystroke; the narrow `record_applicant_edit_event` RPC
derives the actor and message from the session and applicant. Database triggers record
creation, moves, and hire/reject/reopen events in the same transaction as the applicant
change. `src/types/pipeline.ts` defines the domain types,
`src/lib/applicant-events.ts` provides the fallback actor label and formats absolute and
relative timestamps (`formatRelativeTime`), and `src/lib/pipeline.ts` contains pure helpers
for column lookup, deadlines and deadline labels (`deadlineLabel`), elapsed days, next-step
navigation, per-stage breakdowns (`stageBreakdown`, `applicantsInStage`), board sorting
(`sortBoards`), locked-first reordering (`reorderIds`), per-applicant action availability
(`applicantActions`), department grouping, and summaries. Components read from the stores and
call their actions; they do not call Supabase directly.

## Routing and GitHub Pages

- History mode: `createWebHistory(import.meta.env.BASE_URL)`.
- Dev base: `/`; production base: `/TeamBuilder/`.
- Routes: `/` (login), `/forgot-password`, `/set-password` (invite/recovery or password update), `/overview`
  (protected landing), `/boards` (protected), `/boards/:boardId` (protected), `/account`
  (protected), `/dashboard` (redirect to `/account`), catch-all redirect to `/`.
- GitHub Pages does not rewrite unknown paths. `scripts/postbuild.mjs` copies the built
  `index.html` to `404.html` and writes `.nojekyll`. A direct request to
  `/TeamBuilder/boards` receives the 404 document, which boots Vue Router with the original
  URL and renders the boards page.
- The 404 response status is intentional and harmless for this demo. Do not replace the
  fallback with hash routing unless pretty URLs are abandoned.

## Build and deployment pipeline

Both deploy workflows publish to the `gh-pages` branch using
`JamesIves/github-pages-deploy-action`. GitHub Pages must be configured to serve from the
`gh-pages` branch, root `/` (Settings → Pages → Source: Deploy from a branch).

```text
push to main
  -> deploy.yml
     build job:
       -> npm ci
       -> lint, typecheck, test
       -> validate:env (fails if secrets are missing or a secret key is used)
       -> npm run build (Vite embeds VITE_SUPABASE_URL + publishable key; BASE_PATH defaults to /TeamBuilder/)
       -> postbuild: dist/404.html + dist/.nojekyll
       -> upload dist as artifact
     migrations job (needs: build):
       -> supabase db push --remote=$SUPABASE_DB_URL (session pooler URL; pushes pending migrations to production DB)
     functions job (needs: migrations):
       -> validate KILO_MODEL is free
       -> supabase secrets set KILO_API_KEY + KILO_MODEL
       -> supabase functions deploy fit-analysis
     deploy job (needs: migrations):
       -> JamesIves/github-pages-deploy-action → gh-pages branch root
       -> clean-exclude: staging (preserves the staging subfolder)
  -> https://michielhbrand.github.io/TeamBuilder/

push to staging
  -> deploy-staging.yml
     build job:
       -> npm ci
       -> lint, typecheck, test
       -> validate:env (uses STAGING_VITE_SUPABASE_URL + STAGING_VITE_SUPABASE_PUBLISHABLE_KEY)
       -> npm run build with BASE_PATH=/TeamBuilder/staging/
       -> postbuild: dist/404.html + dist/.nojekyll
       -> upload dist as artifact
     migrations job (needs: build):
       -> supabase db push --remote=$STAGING_SUPABASE_DB_URL (session pooler URL; pushes pending migrations to staging DB)
     functions job (needs: migrations):
       -> validate KILO_MODEL is free (same secret as production)
       -> supabase secrets set KILO_API_KEY + KILO_MODEL on the staging project
       -> supabase functions deploy fit-analysis on staging project
     deploy job (needs: migrations):
       -> JamesIves/github-pages-deploy-action → gh-pages branch staging/ subfolder
  -> https://michielhbrand.github.io/TeamBuilder/staging/

push to main (in parallel)
  -> release.yml
     -> npm ci
     -> semantic-release
     -> tag vX.Y.Z + GitHub release with generated notes
```

`ci.yml` runs on pull requests and pushes to `main` and `staging`. It builds with placeholder
values so forks and untrusted PRs do not need secrets. The deploy workflows, which run only
from their respective trusted branches or a manual dispatch, use the real repository secrets.
The functions jobs never pass `KILO_API_KEY` to Vite; they set it directly on the Supabase
project and deploy `fit-analysis`.

Migrations run automatically before the Pages deploy on every push to `main` or `staging`.
`supabase db push` applies only the migrations not yet recorded in the target project's
`supabase_migrations.schema_migrations` table, so it is a no-op when nothing is pending.

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
| Staging build             | Staging project URL      | `STAGING_*` GitHub Actions secret | Disabled in dashboard     |
| Production build          | Project URL              | GitHub Actions secret             | Disabled in dashboard     |

`npm run supabase:reset` recreates a local-only user from `LOCAL_USER_EMAIL`,
`LOCAL_USER_PASSWORD`, and `LOCAL_USER_NAME` in `.env.local`; those credentials are never used
for the cloud project. `.env.production.local` is gitignored and lets a local production
build target the cloud project while `.env.local` targets local Supabase.

Function secrets are separate from the Vite build:

| Secret                  | Used by          | Notes                                                                                                  |
| ----------------------- | ---------------- | ------------------------------------------------------------------------------------------------------ |
| `KILO_API_KEY`          | `fit-analysis`   | Server-only; never a `VITE_*` value                                                                    |
| `KILO_MODEL`            | `fit-analysis`   | Must be `kilo-auto/free` or end in `:free`                                                             |
| `SUPABASE_ACCESS_TOKEN` | deploy workflow  | Scoped project token: Edge Functions and Edge Function Secrets read-write, Project Settings read       |
| `SUPABASE_PROJECT_ID`   | deploy workflow  | Supabase project ref                                                                                   |
| `SUPABASE_DB_URL`       | deploy workflow  | Session pooler connection string with the DB password; migrations only (runners lack IPv6)             |
| `STAGING_SUPABASE_*`    | staging workflow | `ACCESS_TOKEN` (scoped like the production token, but for the staging project), `PROJECT_ID`, `DB_URL` |

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
- History read fails: the Overview shows `history.error` in an alert, keeps the previous
  history rows, and the live widgets keep working. A failed recent-activity read replaces only
  the "Latest activity" list with its message. With no history yet the history panels show
  "History fills in as applicants are hired and rejected."
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
- Keep the pure helpers in `src/lib/pipeline.ts`, `src/lib/overview.ts`, and
  `src/lib/chart-scale.ts` free of Supabase calls so behavior stays unit-testable.
- Keep the export generated in the browser. Sheet content and widths belong in
  `export-sheets.ts`, styling and the writer in `export-xlsx.ts`; keep the library behind the
  lazy import.
- Never write `public.hiring_monthly` or `public.hire_history` from the app; change the
  trigger in a new migration instead. Do not add per-stage history, because stage names differ
  per board.
- To change fit analysis, update the requirement extraction, assessment, prompt, validation,
  and redaction in `supabase/functions/fit-analysis`, bump `PROMPT_VERSION`, and keep the Edge
  Function as the only writer of `public.applicant_fit_analyses` and
  `public.board_requirement_sets`. Keep the ranking rules in `src/lib/fit-rank.ts` aligned with
  the documented lexicographic order. Prompt version is currently `2026-11-22.3`.
- Keep the first board stage as the fallback bucket. If stage reordering is added, update
  the atomic delete function and the `position` ordering together.
- Password recovery links (requested from `/forgot-password`) use the same `/set-password` flow. If magic links are
  added, extend the Supabase redirect allow-list for both local and Pages origins and add
  the corresponding routes.
- If a custom domain is used, update the Vite base (possibly `/`), Supabase Site URL and
  redirect URLs, and the deployment documentation.
