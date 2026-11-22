# AGENTS.md

Instructions for agents working in this repository. Read this file,
`docs/ARCHITECTURE.md`, and `docs/DESIGN_SYSTEM.md` before changing auth, routing, build,
deployment, or UI behavior.

## Purpose

TeamBuilder is a Vue 3 + Supabase recruitment platform workspace. It is hosted on GitHub Pages
and exists to demonstrate a login screen, admin invitations that let users choose a
password, in-memory sessions, a protected hiring portal, and sign-out. The portal has a
hiring dashboard overview (live board numbers plus quarterly hiring trends kept in a small
history) with an Excel export, role boards grouped by department, a stage-column pipeline for
each role, a consent-gated CV analysis that lists similarities and gaps, an applicant audit trail, and an account page. Boards,
pipeline stages, applicants, events, notes, fit analyses, and the monthly hiring history are
stored in Supabase Postgres and loaded through Pinia. Keep it focused; do not add unrelated product features.

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
  actor-name derivation, password setup, sign-out, and dependent-store resets when the
  session becomes `null`.
- `src/types/pipeline.ts` — board, stage, applicant, applicant event, and summary types.
- `src/types/fit.ts` — applicant CV/job-spec analysis types.
- `src/types/history.ts` — `HiringMonth` and `HireRecord`, the camel-cased rows of the history
  tables.
- `src/lib/career.ts` — structured education/work entries: normalising, serialising, month and
  duration formatting, total experience, employment gaps, the career-strip layout, and the
  plain-text formatter used for fit analysis fingerprints.
- `src/lib/compensation.ts` — notice-period months and rand salary expectations stored as
  cents: parsing, validation, and formatting for the applicant drawer.
- `src/lib/api-shared.ts` — shared row types, select fragments, and board/applicant/event/note
  mappers, including applicant `skills` and fit-result normalisation.
- `src/lib/boards-api.ts` — Supabase reads and writes for boards and stages.
- `src/lib/applicants-api.ts` — Supabase create, update, and delete for applicants, including
  structured `skills` on create.
- `src/lib/activity-api.ts` — Supabase reads and writes for applicant events and notes, plus
  `fetchRecentEvents(limit)` for the newest events across all boards.
- `src/lib/storage-api.ts` — Supabase Storage uploads, downloads, signed URLs, and object
  removal for applicant CVs and board job specs.
- `src/lib/fit-api.ts` — Supabase reads for stored fit analyses, including the bulk
  `fetchBoardFitAnalyses` used for ranking, and Edge Function invocation.
- `src/lib/fit-errors.ts` — `friendlyError`, the only client-side rewriting of fit-analysis errors; it
  replaces a message only for rate limits, a missing `KILO_API_KEY`, and a missing function.
- `src/lib/fit-rank.ts` — pure fit summaries and the lexicographic ranking: minimum penalty,
  minimum misses, recommended penalty, recommended misses, skills penalty, skills misses, then
  name. A penalty is one per miss plus half per partial match; only complete analyses with at
  least one requirement rank.
- `src/lib/history-api.ts` — select-only reads of `public.hiring_monthly` and
  `public.hire_history` with their row mappers. Both fetchers page through `fetchAllPages` in
  1000-row `.range()` pages (the API caps a response at 1000 rows), and `fetchHireHistory` only
  reads hires from `historyWindowStart()` (the first day of the quarter 11 quarters back, the
  most the Overview can show), newest first, then returns them oldest first. There are no history
  writes.
- `src/lib/store-errors.ts` — shared friendly constraint messages and store error formatting.
- `src/lib/applicant-events.ts` — fallback actor label, absolute timestamp formatting, and
  `formatRelativeTime` for the audit trail.
- `src/lib/pdf-text.ts` — shared PDF text extraction, OCR fallback, IndexedDB cache, and PDF
  fingerprints.
- `src/lib/job-spec.ts` — job-spec PDF text extraction and cleanup.
- `src/lib/fit-hash.ts` — CV, job-spec, and profile fingerprint helpers; the profile
  fingerprint includes education, experience, and skills.
- `src/lib/pipeline.ts` — pure pipeline helpers for steps, deadlines and `deadlineLabel`,
  summaries, `stageBreakdown`, `sortBoards`, `applicantsInStage`, `reorderIds` (first stage
  locked), `applicantActions`, and department grouping.
- `src/lib/overview.ts` — pure Overview helpers: percentiles and median, calendar-quarter keys
  and labels, `quarterSeries`, `hireRate`, `hiresInQuarters`, `rangeByDepartment`, `speedCurve`,
  `medianByQuarter`, `finalStageCount`, `attentionItems`, `roleFlow`, `filledShare`,
  `openedDaysAgo`, per-board `stageStats` / `slowestStage`, `historyWindowStart`, and
  `formatCount` (groups thousands, en-US). All "now" arithmetic is UTC.
- `src/lib/export-sheets.ts` — pure Excel export models: `buildWorkbookModel` turns boards,
  history months, hire records, and the department filter into the six `SheetModel`s;
  `columnWidth` applies the column width rule and `exportFileName` builds the download name.
  No Supabase, DOM, or writer imports.
- `src/lib/export-xlsx.ts` — the writer: `buildXlsxBlob` lazy-imports
  `write-excel-file/universal` and styles the sheet models, `downloadBlob` triggers the browser
  download, and `exportWorkbook` combines the two. The library stays out of the main bundle.
- `src/lib/chart-scale.ts` — pure chart geometry: `niceTicks`, `axisMaxDays`, `dayTickStep`,
  `thinStep`, `truncateLabel`, `rowLabelWidth`, and `barPath`.
- `src/lib/chart-tooltip.ts` — `provideChartTooltip()` / `useChartTooltip()` / `useChartHover()`
  shared hover tooltip state and viewport clamping.
- `src/lib/use-element-width.ts` — `useElementWidth(target, fallback)` measures an element with
  `ResizeObserver` so `QuarterChart` and `HireTimeChart` draw at real pixel widths. `PipelineLine`
  is a fixed 150 x 34 sparkline and does not measure.
- `src/lib/validation.ts` — shared email and phone validation helpers.
- `src/lib/use-media-query.ts` — `useMediaQuery(query)` composable returning a reactive
  `matchMedia` result that removes its listener when the scope stops.
- `src/stores/boards.ts` — persisted board and stage state, derived `groups` / `orderedBoards`,
  board actions, and the focus/visibility refresh used to keep the shared workspace current.
- `src/stores/applicants.ts` — applicant lookup, applicant CRUD, moves, status changes,
  dirty-field debounced autosave, and edit snapshots.
- `src/stores/applicant-activity.ts` — applicant events and notes with per-applicant loading
  state; derives the note author from the auth store's `actorName`. `recent`, `recentError`,
  `recentLoaded`, and `loadRecent(limit = 30)` hold the newest events across all boards for
  the Overview; `AppShell` reloads them on focus only once they have been loaded.
- `src/stores/storage.ts` — CV and job-spec uploads, removals, signed URLs, and blobs.
- `src/stores/fit.ts` — persisted applicant CV-analysis state and actions, plus `loadBoard`,
  `rankForStage`, `summaryFor`, `isRankableFor`, and schema-version staleness.
- `src/stores/history.ts` — read-only `months` (`hiring_monthly`) and `hires` (`hire_history`)
  with `initialize`, `refresh`, and `reset`; its own `error`. The Overview initializes it on
  mount (refreshing instead when already initialized) and `AppShell` refreshes it on focus and
  visibility. Reset on sign-out.
- `src/stores/undo.ts` — the single pending undo entry with an 8 second timer; the undo action
  reports failures through `applicants.error`. Reset on sign-out.
- `src/components/UndoToast.vue` — bottom-left status toast with an Undo action, mounted once
  in `AppShell.vue`.
- `supabase/migrations/` — Postgres tables, RLS policies, indexes, and board RPC functions.
- `supabase/migrations/20261115000000_hiring_history.sql` — `public.hiring_monthly`,
  `public.hire_history`, the `applicants_record_history` trigger and its security-definer
  functions, and the backfill from live data.
- `supabase/migrations/20261121000000_board_requirements_and_skills.sql` —
  `public.applicants.skills`, `public.board_requirement_sets`, its RLS policy, and grants.
- `supabase/functions/fit-analysis/` — authenticated Edge Function that extracts and caches
  job-spec requirements (`requirements.ts`), assesses every requirement (`assess.ts`), redacts
  CV fields, calls the free Kilo model, validates the result, and upserts the shared analysis.
  `kilo.ts` holds the free-model check and the single Kilo call (reasoning disabled, 8192 output
  tokens, no fallback model, no text-based filtering of the answer). An empty extraction is never
  cached, and the server reads up to 20,000 characters of job spec and 6,000 of CV text, matching
  what the browser extracts.
- `supabase/functions/.env.example` — placeholders for server-side function secrets.
- `src/router/index.ts` — routes and the auth guard.
- `src/components/AppShell.vue` — top-bar navigation and shared layout for protected pages.
- `src/components/AuthShell.vue` — shared Orbital layout for login and password setup.
- `src/components/FullNameDialog.vue` — blocking full-name capture for signed-in users whose
  profile has no name yet.
- `src/components/PageHeader.vue` — page title, breadcrumb, meta, and actions header.
- `src/components/BrandMark.vue` — the only application brand lockup.
- `src/components/BoardList.vue` — searchable boards grouped by department.
- `src/components/BoardFormDialog.vue` — create and edit board fields.
- `src/components/ColumnDialog.vue` — "Manage stages": add, rename (debounced autosave with a
  "Saved" tick), reorder by drag handle or keyboard, and delete (via `ConfirmDialog`, showing
  applicant counts) pipeline stages.
- `src/components/ApplicantFormDialog.vue` — create an applicant on a board, with optional
  PDF CV autofill and CV attachment.
- `src/components/BoardSwitcher.vue` — "Switch role" button (with a `/` hint) beside the board
  title that opens a searchable menu for switching between role boards.
- `src/components/BoardColumn.vue` — one pipeline stage column with a name and count pill,
  passing any stage fit ranks to its cards.
- `src/components/CandidateCard.vue` — quiet applicant card (avatar, name button, role, star,
  "N days in stage", optional fit badge) with a hover/focus tools tray: move back, move
  forward, and an overflow menu (Open profile, Move to..., Hire, Reject).
- `src/components/StageTabs.vue` — `role="tablist"` stage pills with counts; the phone (up to
  720px) board shows one stage at a time.
- `src/components/ApplicantDrawer.vue` — right-side applicant profile: header (avatar, name,
  "role · applied N days ago", favorite, overflow menu with Delete applicant, close) over
  Overview (profile fields, read-only skills chips, CV card, notes), CV (inline viewer),
  Career, CV fit (requirement groups plus similarities and gaps), and Activity tabs.
- `src/components/ApplicantStageBar.vue` — the drawer's stage stepper, Move to <next>, Hire,
  Reject, save indicator (Saving..., Saved, Couldn't save · Retry), and the outcome chip with
  Reopen for closed applicants.
- `src/components/CareerTimeline.vue` — editable vertical timeline of education or work
  entries with inline add, edit, and delete; used in the drawer Career tab and the create dialog.
- `src/components/CareerEntryEditor.vue` — the title, organization, start/end month, current,
  and description fields for one career entry.
- `src/components/CareerStrip.vue` — the pinned horizontal career strip with work and education
  lanes, employment-gap boxes, and a hover readout; linked to the timelines.
- `src/components/FitConsentDialog.vue` — per-analysis consent dialog for sending redacted CV
  and skills data to the hosted model.
- `src/components/ResyncCvDialog.vue` — after a CV replacement, asks whether to re-sync
  education, experience, and skills or keep the current profile details.
- `src/components/JobSpecDialog.vue` — upload, preview, print, open, and remove a board's PDF
  job spec.
- `src/components/ConfirmDialog.vue` — shared destructive-action confirmation dialog.
- `src/lib/pdf.ts` — shared PDF validation, client-side compression, and print helpers.
- `src/lib/resume-import.ts` — local PDF text extraction, applicant heuristics, and lazy
  Tesseract OCR for scanned pages.
- `src/components/OverviewPanel.vue`, `OverviewKpi.vue`, `OverviewSourceTag.vue` — Overview panel
  and KPI shells with the neutral "Live boards" / "History table" source tag (`.ov-*` styles).
- `src/components/ChartTooltip.vue` — the single hover tooltip element, mounted once in
  `OverviewView.vue`.
- `src/components/QuarterChart.vue` — quarterly SVG bars: hired stacked with rejected
  (`decisions`) or applicants in (`applicants`).
- `src/components/HireTimeChart.vue` — SVG "How long hires take" in four views: every hire,
  typical range, speed curve, and trend.
- `src/components/PipelineLine.vue` — 150px sparkline of one board's active applicants per stage
  with a hover tooltip and a hidden table.
- `src/components/StageBars.vue` — horizontal bar rows per stage (counts or median days) for the
  focused board.
- `src/components/FlowRows.vue` — per-role rows of applicants in, hired, rejected, and active;
  selecting a row focuses that board.
- `src/components/AttentionList.vue` — the "Needs your attention" rows with a total.
- `src/components/ActivityFeed.vue` — the "Latest activity" rows from audit events.
- `src/components/RoleDeadlineTable.vue` — roles sorted by deadline with deadline chip, positions
  filled, active count, and `PipelineLine`; stacks into rows at 720px.
- `src/components/PipelineBar.vue` — per-stage applicant progress bar.
- `src/views/LoginView.vue` — login form and validation, with a Forgot password link.
- `src/views/ForgotPasswordView.vue` — password reset request at `/forgot-password`; shows the
  same confirmation whether or not the account exists and throttles resend for 30 seconds.
- `src/views/SetPasswordView.vue` — invite and password update form.
- `src/views/OverviewView.vue` — post-login hiring dashboard: department chips (filter every
  widget), six KPIs, needs attention and latest activity, roles by deadline, "Hiring over time"
  and "How long hires take" (history, with a last-4-quarters / all-on-record range), and a "One
  board in focus" section with a board picker for stage-level charts.
- `src/views/BoardsView.vue` — all role boards grouped by department.
- `src/views/BoardView.vue` — stage-column pipeline for one role: `PageHeader` with
  breadcrumb, switch-role button, meta chips, Job spec, Add applicant, and a Board menu; stage
  tabs at 720px and below; and a collapsible closed-applicants summary row. Includes optional
  **Rank by CV fit** toggle to sort each stage by fit ranking.
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
- Keep board, applicant, activity, storage, and fit state in their dedicated Pinia stores
  (`src/stores/boards.ts`, `applicants.ts`, `applicant-activity.ts`, `storage.ts`, and
  `fit.ts`). Components read from the stores and call their actions instead of calling
  Supabase or the Edge Function directly. Each store owns its own `error` state so a failure
  in one area does not overwrite another.
- Board and stage mutations are pessimistic. Applicant moves, status changes, and the
  debounced field autosave are optimistic: roll back the previous `stepId`/`status`/
  `stepEnteredAt` when a move or status write fails, and keep the not-saved flag set when an
  autosave fails. Autosave writes only profile fields that changed since the last successful
  save; it must never include `status` or `column_id`. Components read the autosave state
  from `saveStatusFor(candidateId)` (`idle | pending | saving | saved | failed`) instead of
  tracking it themselves.
- Hire and Reject never ask for confirmation; they rely on the undo toast pushed by
  `hireCandidate` / `rejectCandidate`. On the board they live in the card overflow menu, not
  on the resting card. Interactive elements are never nested: the card root is an `<article>`
  and only its name button, star, and tray buttons are focusable. The tools tray must stay
  keyboard reachable (`:focus-within`) and always visible at `1024px` and below. Time in stage
  is plain muted text; never color it by age.
- The shared workspace refreshes on window focus and when the tab becomes visible. A refresh
  merges remote boards and applicants in place and preserves dirty local profile fields, so
  another user's move or edit appears without a full page reload.
- Keep Supabase queries and row/domain mapping in the split API modules under `src/lib/`
  (`boards-api.ts`, `applicants-api.ts`, `activity-api.ts`, `storage-api.ts`, and
  `fit-api.ts`), sharing row mappers through `api-shared.ts`. Board data is persisted in the
  tables created by `supabase/migrations/`.
- Every signed-in user shares the same workspace. RLS policies allow the `authenticated`
  role only; do not grant board access to `anon`.
- Deleting a board cascades to its stages, applicants, events, notes, and fit analyses.
  Deleting an applicant is permanent and also deletes its events, notes, and fit analysis.
  Deleting a stage reassigns its applicants to the first stage, which cannot be deleted or
  moved. The UI confirms a stage delete with `ConfirmDialog` and shows how many applicants will
  move; stage reorder is pessimistic and never uses `window.confirm`.
- Reversible decisions (hire, reject) apply immediately and offer Undo through
  `useUndoStore().push`; use `ConfirmDialog` only for permanent actions such as deletes.
  `hireCandidate`, `rejectCandidate`, and `reopenCandidate` return `Promise<boolean>`.
- Keep the Supabase client singleton in `src/lib/supabase.ts`.
- Password reset requests go through `auth.requestPasswordReset`; never reveal whether an
  account exists. The reset email returns to the app root as a recovery link.
- Invite and recovery links arrive with a `type` in the URL hash or query. Preserve the
  detection in `src/lib/auth-link.ts`; do not let the login redirect bypass
  `/set-password`.
- Education and work experience are structured `CareerEntry` arrays (`title`, `organization`,
  `start`/`end` as `YYYY-MM`, `current`, `description`) stored as jsonb in
  `applicants.education` and `applicants.experience`. Always replace the array immutably through
  `useApplicantsStore().updateCandidateEntries`; the autosave dirty-field logic compares by
  reference. Never store or send free-text education or experience.
- No cross-board Overview logic depends on stage names, because every board has its own stages.
  Company-wide numbers use open positions, applicant counts, hired and rejected, board creation
  date, deadline, and "at final stage" (active applicants in each board's last stage). The Roles
  table draws each board's own stages as a line, and attention copy names a board's last stage as
  display text only. Stage-level numbers live in the single-board "One board in focus" section.
- "Needs your attention" lists, in order: boards past their deadline (most overdue first), boards
  with applicants at the final stage (most applicants first, then board name), boards where every
  active applicant is still in the first stage and the board is at least 7 days old, and boards
  due within 14 days (soonest first). It shows the first 6 and the full count. "Latest activity"
  filters the 30 most recent events to the selected department's boards and shows the first 6.
- With no live boards the Overview shows "No role boards yet." in place of the live KPIs,
  attention, activity, roles table, and board focus, and still renders the history KPIs and
  charts whenever history exists. Department chips also include departments known only from
  history.
- Overview charts are local SVG (no chart library) drawn in a viewBox equal to the container's
  measured pixel width (`useElementWidth`, used by `QuarterChart` and `HireTimeChart`; `PipelineLine`
  is a fixed sparkline), so SVG text stays at least 12px. Every mark has a hover tooltip through
  the shared `chart-tooltip`. The SVG charts (`QuarterChart`, `HireTimeChart`, `PipelineLine`)
  have `role="img"` and a summary `aria-label`, plus a visually hidden data table where they plot
  data; `StageBars` and `FlowRows` are accessible lists and buttons with `sr-only` text. Accent is work in progress, signal is
  hired/filled, `line-input` is rejected, and danger is only for past-deadline.
- "Export to Excel" in the Overview `PageHeader` actions builds the workbook entirely in the
  browser from data the stores already loaded (live boards, history months, hire records); no
  data is sent to a server (the lazy export chunk is fetched on the first click). The button
  stays disabled until history has loaded without an error. It honors the department chip. Sheets, in
  order: Summary, Active roles, Applicants, Pipeline, Hiring by quarter, Time to hire. Cell text
  is written as typed strings (`format: '@'`) with no changes apart from XML-invalid control characters (stripped by the library) and one
  trailing space on values that equal a JavaScript built-in property name (a library bug
  workaround, `guardSharedString`), so phone numbers, leading zeros, and values that look like
  formulas or dates stay as typed. Failures show "The export
  could not be created. Try again." and never change store state.
- Hiring history is maintained by the `applicants_record_history` trigger, never by clients. Do
  not write `public.hiring_monthly` or `public.hire_history` from the app; the history store
  and `history-api.ts` only read.
- Use the locked Direction A / Orbital design system in `docs/DESIGN_SYSTEM.md`. Reuse its
  tokens and shared components; do not introduce colors, fonts, radii, gradients, or motifs
  from the other design directions.
- Text is at least `0.75rem`; uppercase IBM Plex Mono is at least `0.6875rem` and is reserved for
  data (dates, counts, IDs, badges, eyebrows). Use `.meta` for descriptive labels.
  `tokens.spec.ts` enforces the floor.
- User-facing copy is en-US and follows the Terminology table in `docs/DESIGN_SYSTEM.md`
  (Stage, Applicant, Boards/role, CV fit, Activity). Code identifiers such as `PipelineStep`,
  `stepId`, and `candidates` keep their names. `copy-guard.spec.ts` rejects banned phrases.
- The warning token is for warning alerts only. Never derive a color or label from time in
  stage; cards show a neutral "N days in stage".
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
  names are title-cased, emails are lowercased, and basics, education, and experience are
  returned as structured data (education: qualification, institution, start/end month, current
  flag, details; experience: role, company, start/end month, current flag, details). Start and
  end months are validated as `YYYY-MM`; invalid months are dropped and reversed ranges are
  cleared. Stop those sections at achievements, certifications, skills, and other headings.
  OCR assets are generated into `public/ocr/` by `scripts/copy-ocr-assets.mjs` from
  `predev`/`prebuild`; do not commit them. Skills are extracted separately from skills sections
  and stored as a structured string array on the applicant.
- CV analysis runs through the authenticated `fit-analysis` Edge Function. It sends only
  the job spec, role/department, and redacted education/work experience and skills to a free
  Kilo model. Never send name, email, phone, URLs, address, date of birth, nationality,
  gender, age, or other sensitive personal fields. Consent is required for every analysis,
  including re-evaluation, and the UI must state that Kilo may log or train on free-tier
  requests.
- Fit results are stored in `public.applicant_fit_analyses`, one row per applicant, scoped by
  the composite `(board_id, applicant_id)` foreign key. Authenticated users may select;
  only the Edge Function with the service role may insert or update. Validate the model JSON
  on the server and store only the returned requirements assessments, similarities, and gaps.
  `service_role` bypasses RLS but still needs table grants: select on `applicants` and
  `boards`, select/insert/update on `applicant_fit_analyses`, and select/insert on
  `applicant_events`. Keep those grants in a migration; do not rely on Supabase auto-granting
  new public tables.
- Fit analysis is English-only, has no local or paid fallback, and must keep the previous
  result when Kilo is unavailable or rate-limited. Refuse any `KILO_MODEL` that is not a free
  model or contains "reasoning" or "deep". The API explicitly disables reasoning with
  `reasoning: { enabled: false, type: 'none' }` and will reject any model that uses reasoning
  tokens. Do not expose the Kilo key to the browser.
- Keep `src/lib/career.ts` `formatEntriesText` and
  `supabase/functions/fit-analysis/career.ts` `formatCareerEntries` identical: the browser and
  the Edge Function both fingerprint the formatted text, and `career.spec.ts` asserts parity.
- Requirements extracted from job specs are cached per board and job-spec fingerprint in
  `public.board_requirement_sets`. This ensures every candidate is assessed against identical
  requirement wording. Generic headings like "Requirements" or "Qualifications" count as
  minimum requirements only when no explicit minimum section exists.
- Only complete fit analyses with at least one requirement are ranked. Ranking is lexicographic
  ascending by minimum penalty (one per miss, half per partial), minimum misses, recommended
  penalty, recommended misses, skills penalty, skills misses, then name. This means any
  candidate with zero minimum misses ranks above all candidates with a minimum miss.
- Replacing an applicant's CV opens a `ResyncCvDialog` asking whether to re-sync education,
  experience, and skills from the new CV or keep the existing profile details.
- Do not add LinkedIn or other third-party profile scraping. LinkedIn blocks automated
  requests and prohibits scraping, and no free API is reliable. Profile data may only enter
  through user-provided text or files.
- Board data uses `public.boards`, `public.board_columns`, `public.applicants`, and
  `public.applicant_fit_analyses`. Board names are unique within a department; applicant email
  and phone are optional and unique per board only when filled; skills are stored as a
  structured string array and are not editable. New applicants default to the `Applied` stage.
  If you add a table, add a migration under `supabase/migrations`, enable Row Level Security,
  write policies for the intended roles, explicitly grant table privileges to `authenticated`,
  and revoke them from `anon`. RLS does not replace table grants. Do not expose board data to
  `anon`.
- Hiring history uses `public.hiring_monthly` (`month` as the first day of the month,
  `department`, `applicants_in`, `hired`, `rejected`; primary key `(month, department)`) and
  `public.hire_history` (`applicant_id` as an opaque primary key, `department`, `hired_on`,
  `days_to_hire`). Neither table has foreign keys or personal data, so deleting boards or
  applicants never touches them. RLS gives `authenticated` select only; `anon` has nothing and
  clients cannot insert, update, or delete. The `applicants_record_history` trigger
  (`after insert or update` on `public.applicants`) maintains them through security-definer
  functions with execute revoked from everyone, in the same transaction as the applicant
  change; the migration backfills them from live data. Accepted limits: history starts when the
  migration shipped, a board's later department change leaves earlier counts under the old
  department, there is no per-stage history, and applicants deleted without a decision still
  count in `applicants_in`.
- Audit events use `public.applicant_events`, scoped by `(board_id, applicant_id)`. The
  composite foreign key cascades from the applicant and board, so deleting either removes its
  events permanently. Events are immutable: clients may select them but cannot insert,
  update, or delete. An `after insert or update` trigger on `public.applicants` records
  creation, moves, and hire/reject/reopen status changes in the same transaction as the
  applicant change and derives `actor_name` from `auth.jwt()` (`user_metadata.full_name`,
  falling back to email). The `record_applicant_edit_event` RPC records one profile-edit event
  per drawer session, and the `fit-analysis` Edge Function records CV analyses. Do not add
  client-side event inserts.
- Applicant notes use `public.applicant_notes`, also scoped by `(board_id, applicant_id)` with
  a cascading composite foreign key. Notes are append-only free text: clients may select and
  insert, but there are no update or delete policies. Insert `author_name` from the signed-in
  user's full name and let `author_id` default to `auth.uid()`.
- The Excel export contains personal data: applicant name, email, phone, current role, notice
  period, and salary expectation (a product owner decision). It is created on the user's device
  and saved wherever they choose, so treat the file as personal data. The export adds no new
  access, because every signed-in user can already see this data. It excludes notes, activity
  events, CVs, career entries, fit analyses, and internal ids.
- Use the publishable key for client access. Never introduce a service-role client into the
  browser bundle.
- Keep `supabase/config.toml` redirect URLs aligned with local and Pages origins.

## Do not

- Do not commit `.env` files, keys, tokens, or generated secrets.
- Do not add a sign-up UI without an explicit product decision.
- Do not add a local or paid fallback for CV analysis, and do not send CV data to Kilo
  without the consent dialog.
- Do not let the browser validate model output or write `public.applicant_fit_analyses`.
- Do not add client writes to `public.hiring_monthly` or `public.hire_history`, and do not add
  per-stage history or personal data to them.
- Do not add a third-party or server-side export service, and do not send export data
  anywhere. Do not add notes, CVs, activity events, career entries, or fit analyses to the
  export without a product decision.
- Do not add analytics, error reporting, or third-party scripts that handle auth data
  without documenting the privacy/security impact.
- Do not change the deployment target, repo name assumptions, or base path without updating
  all related configuration and docs.
- Do not force-push or rewrite shared history unless explicitly requested.
- Do not use an edge fade or gradient to signal horizontal scroll; show a visible,
  token-colored scrollbar instead.

## Documentation rule

Any change to auth flow, environment variables, deployment, routing, the UI library, or the
Orbital design system must update the relevant files in `docs/` and this file when
conventions change. Keep `docs/DESIGN_SYSTEM.md` aligned with the tokens and components.
