# Orbital design system

## Status

Direction A / **Orbital** is the locked visual system for TeamBuilder. The product owner selected
it on 2026-11-04 from the five options in `design/ui-directions.html`. Orbital is the only
canonical direction; the other four remain historical exploration and must not be mixed into
new work.

On 2026-11-14 the UX overhaul amended Orbital: a warning token pair (`--orbital-warn`,
`--orbital-warn-soft`), input-line and signal-text tokens, a compact protected-page header with
the display scale kept for auth pages, label-above fields, and the terminology below.

Read this file before adding or changing any UI. For auth, routing, build, or deployment
changes, also read `AGENTS.md` and `docs/ARCHITECTURE.md`.

## Identity

- Mood: calm, optimistic, precise.
- Audience: broad; trust and effortlessness matter more than technical density.
- Visual signature: a bright or deep navy field, one cobalt or electric-blue signal, soft
  8-12 px geometry, disciplined Manrope typography, and a single restrained orbital ring.
- Density: low. Prefer one clear hierarchy and generous space over packed dashboards.
- Copy: direct, quiet, confident. Sentence case. Page titles may end with a period.

The watch-out from the exploration still applies: without the orbital motif and the type
scale, Orbital can read as a generic SaaS theme. Use the motif and the tokens deliberately.

## Source of truth

| Concern             | File                                                                                         |
| ------------------- | -------------------------------------------------------------------------------------------- |
| CSS tokens          | `src/styles/orbital.css`                                                                     |
| Vuetify themes      | `src/plugins/vuetify.ts`                                                                     |
| Fonts               | `src/main.ts` and `package.json`                                                             |
| Brand lockup        | `src/components/BrandMark.vue`                                                               |
| Auth page shell     | `src/components/AuthShell.vue`                                                               |
| App page shell      | `src/components/AppShell.vue`                                                                |
| Board list          | `src/components/BoardList.vue`                                                               |
| Board switcher      | `src/components/BoardSwitcher.vue`                                                           |
| Board column        | `src/components/BoardColumn.vue`                                                             |
| Candidate card      | `src/components/CandidateCard.vue`                                                           |
| Stage tabs          | `src/components/StageTabs.vue`                                                               |
| Applicant drawer    | `src/components/ApplicantDrawer.vue`                                                         |
| Drawer stage bar    | `src/components/ApplicantStageBar.vue`                                                       |
| Job spec dialog     | `src/components/JobSpecDialog.vue`                                                           |
| Confirmation dialog | `src/components/ConfirmDialog.vue`                                                           |
| Progress bar        | `src/components/PipelineBar.vue`                                                             |
| Overview shells     | `src/components/Overview{Panel,Kpi,SourceTag}.vue`                                           |
| Overview charts     | `QuarterChart.vue`, `HireTimeChart.vue`, `PipelineLine.vue`, `StageBars.vue`, `FlowRows.vue` |
| Overview lists      | `AttentionList.vue`, `ActivityFeed.vue`, `RoleDeadlineTable.vue`                             |
| Chart tooltip       | `src/components/ChartTooltip.vue`                                                            |
| Theme toggle        | `src/components/ThemeToggle.vue`                                                             |
| Visual exploration  | `design/ui-directions.html`                                                                  |
| Board concept       | `design/hiring-pipeline-step-columns.html`                                                   |

The prototype is a reference, not an application dependency. Production styling lives in the
files above. Change the tokens there first; do not copy one-off hex values into views.

## Terminology

Use one noun per concept in all user-facing copy, aria-labels, and docs. User-facing spelling is
en-US.

| Use                                 | Not                             |
| ----------------------------------- | ------------------------------- |
| Stage                               | step, column                    |
| Applicant                           | candidate                       |
| Role (prose), Boards (nav and page) | position, pipeline (as a title) |
| CV fit                              | Analize, analysis tab           |
| Not shown in CV (a requirement)     | None, Not met, Zero compliance  |
| Activity                            | Events                          |
| N days in stage                     | N days in step                  |
| N days overdue, Due in N days       | other deadline phrasings        |
| favorite, organization              | favourite, organisation         |

Identifiers are not renamed: `PipelineStep`, `stepId`, `steps`, `candidates`, `summariseBoard`,
and the `fit` and `events` tab values keep their names. `src/__tests__/copy-guard.spec.ts` fails
on banned user-facing phrases in `src/**/*.vue`.

## Color tokens

Role names are stable. Use the CSS variable rather than the hex value in components.

| Role        | CSS variable            | Light     | Dark                     | Use                                                                 |
| ----------- | ----------------------- | --------- | ------------------------ | ------------------------------------------------------------------- |
| Canvas      | `--orbital-canvas`      | `#F5F7FA` | `#07111F`                | Page background                                                     |
| Surface     | `--orbital-surface`     | `#FFFFFF` | `#0B1728`                | Cards, panels, fields                                               |
| Surface 2   | `--orbital-surface-2`   | `#EEF2F7` | `#101F34`                | Notes, readouts, inset bands                                        |
| Ink         | `--orbital-ink`         | `#0A1B2E` | `#EAF1FA`                | Primary text and strong values                                      |
| Muted       | `--orbital-muted`       | `#58687A` | `#91A3B7`                | Secondary text, labels, metadata                                    |
| Line        | `--orbital-line`        | `#D9E1EA` | `#1E3148`                | Hairline borders and dividers                                       |
| Accent      | `--orbital-accent`      | `#1D4ED8` | `#60A5FA`                | Primary action, focus, orbital ring                                 |
| Accent text | `--orbital-accent-text` | `#1D4ED8` | `#93C5FD`                | Accent text and links on surfaces                                   |
| Accent ink  | `--orbital-accent-ink`  | `#FFFFFF` | `#06111F`                | Text and icons on accent                                            |
| Accent soft | `--orbital-accent-soft` | `#E6ECFF` | `rgba(96,165,250,0.16)`  | Focus rings, selected and badge fills                               |
| Signal      | `--orbital-signal`      | `#0E8F7E` | `#2DD4BF`                | Success, active session, healthy status                             |
| Signal soft | `--orbital-signal-soft` | `#E0F5F1` | `rgba(45,212,191,0.13)`  | Signal badge fills and status halo                                  |
| Signal text | `--orbital-signal-text` | `#0A7565` | `#2DD4BF`                | Signal-colored text, icons, badge text                              |
| Input line  | `--orbital-line-input`  | `#7B8BA0` | `#5B7390`                | Input borders (at least 3:1 on surface)                             |
| Warn        | `--orbital-warn`        | `#9A4A06` | `#FBBF24`                | Warning alerts only                                                 |
| Warn soft   | `--orbital-warn-soft`   | `#FEF3E2` | `rgba(251,191,36,0.12)`  | Warning alert fills                                                 |
| Danger      | `--orbital-danger`      | `#B42318` | `#FDA4AF`                | Errors and destructive text                                         |
| Danger soft | `--orbital-danger-soft` | `#FEECE9` | `rgba(253,164,175,0.12)` | Error fills                                                         |
| Shadow      | `--orbital-shadow`      | soft navy | deep black               | Auth and app panels                                                 |
| Shadow soft | `--orbital-shadow-soft` | 2 px navy | 2 px black               | Stat cards, data panels, board cards, candidate tray, Overview KPIs |

Exact shadows:

```css
/* light */
--orbital-shadow: 0 1px 2px rgba(10, 27, 46, 0.04), 0 18px 50px rgba(10, 27, 46, 0.08);
--orbital-shadow-soft: 0 1px 2px rgba(10, 27, 46, 0.04);

/* dark */
--orbital-shadow: 0 1px 2px rgba(0, 0, 0, 0.18), 0 24px 60px rgba(0, 0, 0, 0.4);
--orbital-shadow-soft: 0 1px 2px rgba(0, 0, 0, 0.18);
```

Do not introduce purple, teal-mint, orange (except `--orbital-warn`, for warning alerts only), serif display type, grid-paper backgrounds,
planets, glows, or gradients. Those belong to the other directions.

## Typography

- Display and body: `Manrope` via `@fontsource-variable/manrope` as `Manrope Variable`.
- Metadata, labels, indices, and code-like values: `IBM Plex Mono` at 400/500.
- Fallbacks are system sans and monospace. Do not load Google Fonts at runtime.

| Role        | Family        | Size                  | Weight  | Tracking     | Line height |
| ----------- | ------------- | --------------------- | ------- | ------------ | ----------- |
| Page title  | Manrope       | `2rem` (`PageHeader`) | 700     | `-0.045em`   | 1.15        |
| Panel title | Manrope       | `1.15rem`             | 700     | `-0.035em`   | 1.2         |
| Stat value  | Manrope       | `1.55rem`             | 700     | `-0.045em`   | 1.05        |
| Body        | Manrope       | `1rem`                | 400     | normal       | 1.7         |
| Small body  | Manrope       | `0.75-0.88rem`        | 400-600 | normal       | 1.5-1.6     |
| Eyebrow     | IBM Plex Mono | `0.6875rem` (11px)    | 500     | `0.12em`     | 1.5         |
| Data label  | IBM Plex Mono | `0.6875-0.75rem`      | 500     | `0.08-0.1em` | 1.4-1.5     |
| Meta        | Manrope       | `0.75rem` (12px)      | 400-500 | normal       | 1.5         |
| Field label | Manrope       | `0.8125rem`           | 600     | normal       | 1.4         |
| Field value | Manrope       | `0.94rem`             | 400     | normal       | 1.45        |

Rules:

- Type floor: no text is smaller than `0.75rem` (12px); uppercase IBM Plex Mono is at least
  `0.6875rem` (11px). `tokens.spec.ts` enforces this for `orbital.css`.
- Mono is for data: dates, counts, IDs, badges, and eyebrows are uppercase mono. Descriptive
  labels, card footers, and tab metadata use the sentence-case `.meta` utility instead of
  `.mono-label`.
- Body copy and button labels are sentence case; buttons are never uppercase.
- Keep headings tight. Do not add letter-spacing to body copy.
- Use at most one display-scale title per page.

## Geometry and spacing

- Radii: panel and auth card `12px`; input and button `8px`; small inset `5px`; badges and
  avatars `999px`.
- Borders: always a hairline `1px solid var(--orbital-line)` unless the surface is intentionally
  borderless (badge fills and the accent button).
- Spacing scale: 4, 8, 12, 16, 24, 32, 40, 48, 64, 80 px. Use the closest step; do not invent
  intermediate values for layout gaps.
- Main content width: `min(1180px, calc(100% - 64px))`; at `920px` or below use
  `calc(100% - 40px)`; at `520px` or below use `calc(100% - 32px)`.
- Auth card: maximum `460px`, panel padding `36px` desktop / `24px` tablet / `18-22px` phone.
- Top bar: `72px` desktop and tablet, `60px` at `720px` and below.
- Page padding: `64px 0 72px` for auth pages; `clamp(40px, 6vw, 72px) 0 80px` for protected
  app pages.

## Orbital motif

The motif is one thin off-canvas circle, not a decorative illustration system.

- Orbit rings appear on auth pages only; protected pages have none.
- Use `1px` accent stroke at `10-12%` opacity.
- Desktop ring: large, roughly `460-840px`, anchored off the top-right of the page.
- Optional second ring: signal color at about `6%`, anchored off the bottom-left.
- Auth panels may repeat a smaller accent arc in the top-right corner at `10%` opacity.
- Never place a ring behind form text, never animate it continuously, and never use more than
  two page rings plus one panel arc.
- The `mdi-google-analytics` icon in the brand mark is the only filled glyph in the
  application identity.

The implementation classes are `.orbital-orbit`, `.orbital-orbit--a`,
`.orbital-orbit--b`, and the `.auth-panel::after` arc.

## Layout patterns

### Auth pages

Use `AuthShell` for `/`, `/forgot-password`, and `/set-password`.

```vue
<AuthShell eyebrow="Secure access" title="Welcome back." subtitle="...">
  <div class="panel-head">...</div>
  <v-form class="auth-form">...</v-form>
  <div class="auth-note">...</div>
</AuthShell>
```

- Desktop: two columns, editorial intro on the left and a `460px` auth panel on the right.
- The intro contains an eyebrow, a display title (`.display-title`, used by `AuthShell` only), one short paragraph, and three plain-language cells (icon, title, sentence) supplied by the default `intro-cells` slot of `AuthShell`. There is no footer. Keep the cells free of technical terms.
- At `720px` and below the readout is hidden so the form stays close to the top; the
  eyebrow, title, and paragraph remain. The layout becomes one column with the intro first.
- Every auth page uses `BrandMark context="Recruitment platform"`, and the `ThemeToggle`
  from the shell.
- Auth forms use a panel title with a one-line `.panel-sub`, the fields (16px apart, labels above), one primary full-width submit button, and one
  titled `.auth-note` help line. A link on the label row (for example Forgot password?) uses `.auth-field` / `.auth-field__aside`. Do not add social login, tabs, or extra actions without a product decision.

### Protected pages

Use `AppShell` for `/overview`, `/boards`, `/boards/:boardId`, and `/account`.

- `app-topbar` with `BrandMark` (no context line), the Overview / Boards navigation,
  `ThemeToggle`, and the avatar account menu (Account and Sign out live there). No orbit rings
  and no footer.
- `PageHeader` (`title` prop; slots `breadcrumb`, `title-adornment`, `meta`, `actions`) renders
  the `2rem` page title with chips on the left and actions on the right, wrapping under `1024px`.
  Pages not yet migrated keep `.page-heading` with the same `.page-title`.
- The Overview page is a hiring dashboard under a `PageHeader` (see Overview dashboard below).
  It has a department chip row, six KPI cards, a needs-attention list beside the latest
  activity, a roles-by-deadline table, a "Hiring over time" band with two quarterly charts and
  "How long hires take", and a "One board in focus" band with a board picker.
- The Account page is one 640px column (`.account-column`) of four `.data-panel`s under a
  `PageHeader`: Profile (full name plus a read-only email with a lock icon), Password (new and
  confirm in two columns, one column at `720px`), Appearance (a Light / Dark segmented control
  that mirrors the top-bar toggle), and Signed in as (avatar, name, Sign out). Forms use
  `.account-form` with 16px between fields; Save changes and Update password are right-aligned
  and disabled until the form is dirty or valid. It shows no stat cards, user id, provider, or
  session expiry.
- At `920px` the top bar wraps: brand and actions on the first row, navigation on its own
  row. Do not collapse the navigation into a hidden menu without a product decision.
- At `720px` stat grids stack.

### Boards

Adapt the structure of `design/hiring-pipeline-step-columns.html` to Orbital. Do not copy
that prototype's palette, gradients, or Bricolage/Hanken fonts.

- `/boards` has a `PageHeader` whose meta reads "N roles across M departments" plus "K past
  deadline" in danger text. The toolbar holds a search field with a `/` hint, `All N` and
  `Past deadline N` chips, a sort select (Deadline soonest, Name, Most active), and the
  primary New board button. Department headings are lighter than card titles and show a
  count. Each card shows the role, a deadline chip (neutral with a calendar icon, or danger
  with an alert icon when overdue), Open and Active figures, a pipeline bar, and a one-line
  stage breakdown ("Applied 2 · Interview 3 · +2 more").
- `/boards/:boardId` uses `PageHeader`: a "Boards > department" breadcrumb, the 2rem role
  title with a **Switch role** button (it shows a `/` kbd hint and opens the searchable,
  department-grouped `BoardSwitcher` menu), meta chips for open positions, active applicants,
  and the deadline (`deadlineLabel`; danger with an alert icon only when overdue), and a
  **Job spec** text button that opens `JobSpecDialog`. Actions are a labelled **Add applicant**
  primary and a **Board** menu (Edit board, Manage stages); both are 48px. The secondary board
  controls (Job spec, Show/Hide, Reopen) share one height: 36px, and 40px at `1024px` and below
  or on touch devices. The header wraps at `1024px`.
- Stage columns are a grid of `repeat(var(--columns), minmax(208px, 1fr))` panels with a 12px
  gap, so five stages fit in the 1180px content width. Wider boards scroll horizontally with a
  visible, token-colored scrollbar; never use an edge fade or gradient. Each column is a
  surface-2 panel with the stage name and a count pill. There are no numbered stage circles
  and no per-stage target days.
- Applicant cards are quiet: initials avatar, the name as a button labelled "Open profile for
  <name>" (wrapping to two lines at most), the current role, a star toggle (visible when the
  applicant is a favorite, or on hover or focus), and "N days in stage" in muted text with a
  clock icon. Time in stage is never colored by age. Clicking the card body also opens the
  profile, but the card root is an `<article>`, not a button, and no interactive element is
  nested inside another.
- A tools tray holds move back, move forward, and an overflow menu. It appears on hover and
  `:focus-within`, stays open while its menu is open, and is always visible at `1024px` and
  below and on touch devices. Tray buttons are 32px with 8px spacing (40px at `1024px`). First-
  stage cards have no move back and last-stage cards no move forward. The overflow menu lists
  Open profile, Move to... (a list of the other stages), Hire (signal icon, ink text), and
  Reject (danger). Hire and Reject never confirm; they show the 8 second Undo toast.
- Clicking an applicant card opens a right-side applicant drawer at roughly half the viewport
  width (see Applicant drawer). The drawer becomes full width at `720px`.
- Applicant cards can be dragged one stage left or right. While a card is held, only the
  adjacent columns highlight with the accent token and accept the drop. The card in flight
  keeps full opacity and uses an accent border ring. Moves are optimistic and roll back when
  the write fails.
- Boards past their deadline use the danger token on the deadline chip and in overview
  attention rows. Never rely on color alone; the chip has an alert icon and says "N days overdue".
- At `720px` and below the board shows `StageTabs` (a scrollable `role="tablist"` of pills with
  counts, arrow/Home/End keys) and only the selected stage. The default tab is the first stage
  with applicants, and the selection resets when the board changes.
- Closed applicants collapse into a one-line summary row ("Closed · N hired, M rejected") with
  a Show/Hide button. Expanded, it lists hired and rejected applicants in two columns (stacked
  at `720px`), each row showing "Last stage: <name>" and a visible outlined **Reopen** button.
- Keyboard support: `/` opens the role switcher with its search focused (and focuses the board
  search on `/boards`). Tab order on a card is name, star, move back, move forward, overflow;
  Enter or Space opens the overflow menu, arrows move through it, and Escape returns focus to
  the overflow button. The applicant drawer CV tab and the job spec preview support open
  in a new tab, print, and remove controls.

## Components

### Data visualization

- Build dashboard charts with small, local SVG/CSS components. Do not add a chart library
  without a product decision.
- Use the Orbital tokens for chart fills. Accent is active work, signal is a positive outcome,
  `line-input` or muted is rejected, closed, or inactive, and danger is reserved for overdue
  deadlines and errors. The Overview recipe below has the full rules.
- Show visible labels and values; color must never be the only cue. Give charts an
  `aria-label`, text summaries, and readable legends.
- Keep charts static. No gradients, looping animation, dense grids, or decorative telemetry.

### Overview dashboard

- Layout: department chips (`.ov-chips`, single-select `aria-pressed` buttons) filter every
  widget. Six KPI cards (`OverviewKpi`, `.ov-kpis`) follow: Open positions, Active applicants,
  At final stage (live boards) and Hired last 4 quarters, Time to a hire, Hire rate (history
  table). Hire rate adds a hired/rejected split bar. Then two-up panels (Needs your attention,
  Latest activity), the full-width Roles by deadline panel, a "Hiring over time" band, and a
  "One board in focus" band. Bands (`.ov-band`) pair a title and one line of copy with chip or
  select controls.
- Source tags: every KPI and panel shows a small neutral tag, "Live boards" or "History table"
  (`OverviewSourceTag`). They never use an accent, signal, or danger color.
- Panels use `OverviewPanel` (a `.data-panel` with a Manrope title, optional `.meta` subtitle,
  source tag, and an optional actions slot). Chips are pill buttons; the pressed chip fills with the ink
  token. Do not hand-roll panel borders or chip styles.
- No cross-board logic depends on stage names. Stage-level charts (`StageBars`) appear only in
  "One board in focus", for one board's own stages. `PipelineLine` shows each board's own stages
  inside its role row, and attention copy may name a board's last stage as display text.
- Chart rules: charts are small local SVG components (`QuarterChart`, `HireTimeChart`,
  `PipelineLine`) or token-colored CSS bars (`StageBars`, `FlowRows`). `QuarterChart` and `HireTimeChart`
  measure their container with `useElementWidth` and draw in a viewBox of that real pixel width,
  so SVG text is never scaled below 12px; `PipelineLine` is a fixed 150 x 34 sparkline. Chart
  text and strokes use tokens. Every mark has a hover tooltip through the shared `ChartTooltip`.
  The SVG charts have `role="img"` and a summary `aria-label`, plus a visually hidden data table
  (`.sr-only`) where they plot data; `StageBars` and `FlowRows` are accessible lists and buttons
  with `sr-only` text. Meaning is also in visible labels, never color alone.
- Color roles: accent is work in progress (applicants in, active), signal is hired or filled
  positions, `--orbital-line-input` is rejected, and danger is only for a deadline that has
  passed. Never color by time in stage. The current quarter is marked partial with an asterisk.
- With no live boards the page keeps its history KPIs and charts (when history exists) under the
  "No role boards yet." empty state.
- Empty states are explicit: no boards, "History fills in as applicants are hired and
  rejected.", no hires in the range, and nothing needs attention.
- Mobile: the KPI grid is 6 columns wide, 3 columns at `1000px`, and 2 at `640px`. Two-up
  panels collapse to one column at `1000px`. `FlowRows` rows put the label and count on one line with the bars below at
  `640px`. `RoleDeadlineTable` becomes stacked rows at `720px`, with its header visually
  hidden.

### Excel export

- The "Export to Excel" button is an outlined `v-btn` with `mdi-microsoft-excel` in the Overview
  `PageHeader` actions slot, shown when there are live boards or history. It uses the Vuetify
  `loading` prop and is disabled while the file is created and until history has loaded without
  an error. It never replaces its label.
- A failure shows an `orbital-alert` error: "The export could not be created. Try again."
- Workbook presentation (set in `src/lib/export-xlsx.ts`):
  - Header row: bold white text on `#0a1b2e`, frozen on every table sheet.
  - Column width: `clamp(max(header, longest value) + 2, 8, 48)` characters; the Summary label
    column is fixed.
  - Formats: dates `dd/mm/yyyy`, rand `"R" #,##0`, counts and days `#,##0`, fractional notice periods in General, rates `0%`; text
    cells are written as text (`@`).
  - Active roles and Applicants print landscape; the Summary hides gridlines.
  - Only a negative "Days to deadline" is colored, in danger `#b42318`. There is no other
    color coding, and nothing is colored by time in stage.
  - No Excel filter dropdowns.

### Buttons

- Primary: accent fill, accent-ink text, `48px` height, `8px` radius, 700 weight, sentence
  case. Use one primary action per panel.
- Secondary: transparent fill, line border, ink text. It may become accent on hover.
- Text/ghost: accent text, no fill, no border. Use for navigation and cancellation.
- Add MDI icons at `18-20px`; place trailing icons with `<v-icon end>`.
- Loading state uses the Vuetify `loading` prop. Do not replace the label with a spinner.

### Theme toggle

- Use `ThemeToggle.vue`.
- Render an outlined primary circular `v-btn` with `mdi-weather-sunny` or
  `mdi-weather-night`.
- Toggle by setting `theme.global.name` between `orbitalLight` and `orbitalDark`.
- The control matches the `38px` avatar circle and uses a dynamic accessible label.
- The selected theme persists in `localStorage` under `orbital-theme`; only a user who has
  never toggled the control starts in light mode.

### Fields

Vuetify defaults set `variant="outlined"`, comfortable density, and the `orbital-field`
class. Keep the rules attached to the field.

- The label is static text above the control (Manrope `0.8125rem`, 600, ink, sentence case),
  never inside the border and never floating. The CSS positions the Vuetify label; templates
  keep passing `label`.
- Control height `44px`; surface background; `1px` outline in `--orbital-line-input`; `8px`
  radius; `16px` visual gap between fields. No message space is reserved: a message appears
  below the control only when there is one.
- Focus: accent outline plus a `3px` accent-soft ring. Values are Manrope at `0.94rem`.
- Placeholders are always visible in the muted token at full opacity, because the label sits
  above the control. Pass `persistent-placeholder` with any `placeholder` on a labelled field.
- Mark optional fields with "(optional)" in the label (applicant Email and Phone number).
- Icons are muted; the focused icon becomes accent text.
- Errors use the danger token. Never rely on color alone; keep the validation message.

### Alerts, badges, and notes

- Alerts are tonal, `8px` radius, and use the `orbital-alert` class. Use `error` for failures
  and `success` for completed actions.
- The undo toast (`.undo-toast`) sits bottom-left in a `role="status"` `aria-live="polite"`
  region. It uses the neutral surface-2 fill, line border, ink text, an Undo text button, and a
  close icon; it carries no color accent and auto-dismisses after 8 seconds.
- Badges are pill-shaped mono uppercase labels (`status-badge`) in the neutral style, for
  classification only. The class remains an available primitive; no screen currently uses it.
- Notes use `.auth-note`: surface-2 fill, line border, 2 px accent left border, shield or
  lock icon, and small muted copy.

### Panels and data rows

- Use `.auth-panel` and `.data-panel` (and `.stat-card` if a stat tile is ever needed; no screen
  currently uses it; the Overview uses `OverviewKpi`); do not reimplement their borders,
  radius, or shadow.
- Panel header (`.data-panel-head`): a Manrope panel title with an optional muted hint line
  beneath it; there is no mono label or badge. The Account page uses this for Profile and
  Password, and shows the session as a single row with the avatar, "Signed in as" name, and
  Sign out.
- Data rows separate with hairlines; no zebra striping.
- Values wrap with `overflow-wrap: anywhere`.

### Dialogs

- Board create/edit, stage management, and applicant creation use `v-dialog` with
  `.orbital-dialog`: surface fill, line border, standard radius and shadow.
- Structure each dialog with `.orbital-dialog__head`, `.orbital-dialog__body`, and
  `.orbital-dialog__actions`. Headers pair an eyebrow with a panel title and a close button;
  actions align right with cancel/primary buttons.
- Use `.orbital-dialog__grid` for two-column field pairs; it collapses to one column at
  `720px`.
- Edit-board dialogs place a destructive text button on the left of the actions. Deleting a
  board opens `ConfirmDialog` because it also deletes its stages and applicants.
- The board form uses a department combobox seeded from departments that already have
  boards, while still allowing a new department name. Deadlines are entered and displayed as
  `dd/mm/yyyy`, with a live readout of calendar and working days remaining.
- `ColumnDialog` ("Manage stages", subtitle "Changes save as you type." with a brief "Saved" tick
  that fades in without shifting layout) lists `.column-manage__row` rows: drag handle, name
  field, "N applicants", and a delete button that shows on row hover or focus (always visible at
  max-width 1024px). The first row shows a lock and a "Default" chip with a tooltip instead of a
  handle and delete. Rows reorder by HTML5 drag on the handle or by keyboard (focus the handle,
  Space to pick up, Up/Down to move, Space to drop) with an `aria-live` announcement; nothing
  moves above row 2. Delete opens `ConfirmDialog` ("N applicants will move to <first stage>.").
  "Add stage" uses a dashed field.
- `JobSpecDialog` is a single adaptive dialog. Without a PDF it shows the `.job-spec-empty`
  upload state. With a PDF it expands to a document preview with open-in-new-tab, print, and
  remove actions; remove opens `ConfirmDialog`. The preview reuses the CV toolbar and iframe
  classes.
- `FullNameDialog` is a persistent one-field dialog shown from `AppShell` when a signed-in
  user has no `full_name`. It has no close action; the user must save a name before using the
  protected pages.
- `FitConsentDialog` is a persistent dialog shown before every CV analysis. It uses the
  shared dialog shell, lists what is sent and removed, and requires an explicit **Analyze now**
  or **Cancel** choice. Do not add a "remember this choice" option.

### Add applicant and CV import

- `ApplicantFormDialog` uses the shared `.orbital-dialog` shell and `.orbital-field`
  treatment. The header is "Add applicant" with the board name and department as the
  `.orbital-dialog__sub` subtitle. A dashed `.applicant-import` drop zone ("Start with a CV")
  leads: it accepts a dropped PDF or the **Choose PDF** primary button, both through the same
  validation, and shows the selected filename, progress line, and cancel action. Fields sit in
  two columns (Full name (required), Current role, Email, Phone, Stage) with example
  placeholders.
- Work experience and Education live in one collapsed **Career history** disclosure
  (`.applicant-disclosure`, a real button with `aria-expanded` and `aria-controls`) that shows
  "Optional · Work N · Education M". It opens automatically when CV import fills at least one
  entry and then shows the two `CareerTimeline`s. With it collapsed, the dialog fits a 900px
  viewport without scrolling.
- Auto-filled fields receive `.orbital-field--autofilled`. The treatment uses the accent and
  accent-soft tokens. A manual edit removes the marker; do not use an icon, separate color,
  or badge.
- OCR progress must never block manual entry. Keep the form editable while recognition runs
  and allow submit; submitting cancels OCR and uses the current values.
- Keep copy direct: the CV fills what it can, and every field remains editable.

### Applicant drawer

- Use `ApplicantDrawer.vue` from `BoardView`; it is a temporary `v-navigation-drawer` on the
  right at `50vw` desktop, `min(640px, 100vw)` at `1024px`, and full width at `720px`.
- The header is the decision surface. Row one: the initials avatar, the applicant name, a
  muted "<current role> · applied N days ago" line (`daysSinceApplied`; "applied today" on
  day 0), a star favorite button (`mdi-star` / `mdi-star-outline` with `aria-pressed`), an
  overflow menu (`mdi-dots-horizontal`) whose only item is **Delete applicant** (danger,
  opens `ConfirmDialog`), and close. The header is sticky above `720px` and scrolls with the
  body below it.
- `ApplicantStageBar.vue` sits under row one. It shows every stage as a pill button joined by
  chevrons: done stages use `surface-2`, the current stage is accent-filled with
  `aria-current="step"`, later stages are outlined. Clicking a stage moves the applicant
  there. The pills wrap on desktop and scroll horizontally in one row at `720px` and below,
  with the current stage scrolled into view. Below the stepper: a primary **Move to <next
  stage>** (hidden in the last stage), **Hire** (outlined, signal icon), and **Reject**
  (outlined, danger text and icon). Hire and Reject never confirm; they push the same 8
  second Undo toast as the board. On phones Move to takes the full row and Hire and Reject
  share the next one.
- Closed applicants show an outcome chip ("Hired" with a signal icon or "Rejected" with a
  danger icon) and an outlined **Reopen** instead of the decision buttons, and the stepper is
  disabled. Time in stage never changes a color.
- The save indicator sits at the end of the action row and never moves the layout. It reads
  `saveStatusFor`: "Saving..." (`mdi-sync`, muted) for `pending` and `saving`, "Saved" (signal
  check) for `saved`, and "Couldn't save · Retry" in danger for `failed`; Retry flushes the
  pending edit. It is a polite live region and is empty while `idle`.
- Five tabs follow, in this order: **Overview**, **CV**, **Career**, **CV fit**, **Activity**.
  Tabs use the display font, sentence case, an accent underline, and a hairline divider. The tab
  list is labelled "Applicant sections" and all five fit at 390px without scrolling.
- **Overview** holds the profile fields two by two (Full name, Current role, Email (optional),
  Phone (optional); one column at `720px`) with a 16px gap, a compact CV card (file name and
  an **Open** button that opens the CV tab, or **Upload CV** when there is none), and
  **Notes**. Email must be valid when present and phone accepts digits only; invalid values
  show a field error and are not persisted.
- The note composer is a bordered box (`line-input`, accent focus ring) with a borderless
  textarea, the helper "Visible to everyone in the workspace", and an **Add note** primary
  that is disabled until there is text. Notes render below it, newest first, with the author
  and a relative time ("2 days ago"); the absolute time is in the `title`.
- **CV** hosts the inline viewer: a toolbar with the file name, open in a new tab, print, and an
  overflow menu with **Remove CV**, then the PDF iframe. Without a CV it shows a quiet empty
  state with **Upload CV**.
- **Activity** renders events as a vertical timeline with an accent dot, the message, and the
  actor name with a relative time (absolute time in the `title`).
- The drawer is backed by Postgres and saves automatically; there is no footer sentence or
  in-body delete button.
- Each applicant can have one PDF CV stored in the private `cvs` Supabase Storage bucket.
  Upload is limited to PDF files up to `10 MB`. Uploading a CV marks the analysis stale, opens
  the **CV fit** tab, and asks for consent when the prerequisites are met. Deleting the
  applicant or its board removes the stored CV.
- Every PDF upload passes through the browser compressor in `src/lib/pdf.ts` before it
  reaches Supabase. It re-encodes embedded images, preserves selectable text, and never
  returns a larger file.

### Career timeline and strip

- Entries have four visible parts: title (job title or qualification), organization (company
  or institution), time span, and description. Time spans use "Start date" and "End date"
  fields with a `YYYY-MM` placeholder (for example, `2024-06`), inline validation while the
  user types or leaves a field, and a "Currently working here" / "Still studying" checkbox
  that disables the end date. Start and end dates are optional; a typed month must be a
  valid `YYYY-MM` and an end must not be before the start. Only the title is required.
- `CareerTimeline` renders entries newest first as a vertical rail. A mono date column on the
  left shows the end month (or **Present**), start month, and duration; the rail carries a dot
  per entry, and the current entry uses the signal token with a soft halo. Cards use the
  standard 12 px radius and hairline border. The pencil swaps a card for the inline editor
  with **Save**, **Cancel**, and **Delete** (through `ConfirmDialog`); the add button is a
  dashed outline. Adding an entry opens the editor at the add button, not above the list, and
  saving sorts the entry into its dated position. Below `540px` of container width the date
  column narrows to `76px`.
- `CareerStrip` is a horizontal strip on a shared time axis with a Work lane (filled accent
  bars, signal for the current role) and an Education lane (outlined bars). Overlapping
  entries stack on extra rows, employment gaps longer than three months are dashed boxes, and
  one mono readout line shows the hovered entry or the gap summary. Hovering a bar or an entry
  highlights the other; clicking a bar scrolls to and flashes its entry. Entries without a full
  span are left off the strip and a muted note counts them; when no entry has a span the strip
  is replaced by a note saying so.
- The strip is pinned under the drawer header on the Career tab. The create dialog shows the
  timelines only, without the strip.
- Use only Orbital tokens for bars, dots, and highlights, and keep both themes working.

### CV analysis

- The **CV fit** tab uses the same drawer surface, spacing, and hairline rhythm. Keep the
  empty state quiet: one muted icon, a short title, the missing prerequisites, and a single
  primary **Analyze CV** action.
- The result reads top to bottom: a header (`Analyzed <relative time>` and an outlined
  **Re-run analysis** button), a verdict panel, a **Gaps only** switch, the requirement groups,
  then **Similarities and gaps**. When the profile, CV, job spec, or skills changed since the
  last analysis, a warning alert says so and carries an inline outlined **Re-run** button,
  which replaces the header button.
- The verdict panel (`FitRequirements.vue`, a `surface-2` inset band with a hairline border)
  leads with a plain count such as "4 of 6 minimum requirements met", the stage rank ("Ranked #3
  of 12 analyzed in Screening · minimum first, then recommended, then skills") when the
  applicant is ranked, one 8px segmented bar per group, and a legend. Bar segments are signal
  (met), accent (partly met), and `--orbital-line-input` (not shown); never danger, because
  charts reserve danger for overdue deadlines and errors. Each bar has an `aria-label` and a
  visible count beside it.
- Statuses are shapes before colors (`FitStatusGlyph.vue`): a filled check circle (signal) for
  met, a half-filled circle (accent) for partly met, and an outlined dash circle for not shown
  in the CV. A not-shown **minimum** requirement alone uses the danger token, on the glyph and
  on "Not found in the CV"; every other not-shown item stays neutral (`line-input` glyph, muted
  text), because a missing nice-to-have is not an error. Each row also carries `sr-only` status
  text. Never print "None" for a requirement: absence of evidence in a CV is not a failed
  requirement. A requirement the model skipped reads "Not assessed" and is never danger.
- Requirement groups appear in order: **Minimum requirements**, **Recommended requirements**,
  then **Skills and tools**. Each group header is a button (`aria-expanded`) that collapses the
  group, with a mono "N / M met" count. Rows are a 20px glyph gutter, a 600-weight label, and
  evidence in a 1px `line-input` quote rule at full ink contrast; partly met evidence starts
  with an accent "Partly met ·". Skills are compact pill chips with the glyph, and the
  evidence in the `title`. **Gaps only** hides fully met items.
- An incomplete analysis shows a warning alert: "This analysis did not check every
  requirement. Re-run it for a complete ranking." When the job spec has no requirement sections
  (or the analysis uses the earlier format, schema version below 3), a hairline `fit-note`
  explains it and **Similarities and gaps** becomes the main content under "How the CV compares
  with the job spec". Do not add a composite score, percentage, verdict pill, or confidence
  label; the counts and bars are facts, not a rating.
- Similarities use the signal marker and gaps use the danger marker. Color is never the only
  cue because the section labels carry the meaning.
- On the board, each stage is always sorted by the shared CV-fit ranking; there is no toggle.
  Ranked cards show a compact mono badge such as
  `#2 · Min 4/5 · Rec 2/3`; a danger icon appears when a minimum requirement is not met.
  Never hide the applicant's stage or move candidates between stages for ranking.
- Re-analysis always opens `FitConsentDialog` first. The dialog must explain what is sent
  (including education, work experience, and skills), what is removed, that Kilo may log or
  train on free-tier requests, and that results are shared with the workspace. Use a
  warning-tonal alert for the privacy notice.
- While analysis runs, show an indeterminate progress line or spinner with the current progress
  text. A failure stays in the tab and never hides the previous result.

### Brand, avatar, and status

- `BrandMark` is the only application identity lockup. It combines the accent square, the
  `mdi-google-analytics` icon, `TeamBuilder`, a small neutral `Beta` badge, and an optional
  uppercase mono context line (`context` prop, used on auth pages only). The browser
  favicon uses the same icon on an accent square.
- Use `Recruitment platform` as the context on auth pages; protected pages omit it.
- The avatar is a `38px` accent-soft circle with two initials. It is decorative; never make
  it the only way to identify the account.
- Session status belongs in the top bar and in the session panel. The labels are
  `Session active` and `Secure access`.

## Dark mode

Orbital is dual-mode by design.

- `src/plugins/vuetify.ts` registers `orbitalLight` and `orbitalDark`; the startup theme is
  the saved selection, or `orbitalLight` when none exists.
- `src/lib/theme.ts` owns the theme storage key and read/persist helpers.
- `src/App.vue` provides the default app shell.
- `src/components/ThemeToggle.vue` toggles between `orbitalLight` and `orbitalDark` by
  setting `theme.global.name` and saves the choice.
- `src/styles/orbital.css` defines token overrides on `.v-theme--orbitalLight` and
  `.v-theme--orbitalDark`.
- The UI starts in the user's saved theme, or light mode if they have never toggled it. The
  manual toggle switches between dark and light and persists the selection.
- Do not hardcode light-only colors in new components. Add or use a token.
- Do not add another theme source unless the product owner asks for one.

Check both modes for every UI change.

## Accessibility and motion

- Keep the visible focus treatment: the accent outline and 3 px accent-soft ring.
- Preserve native labels, `autocomplete`, validation messages, and keyboard order.
- Interactive controls are at least `44px` high; primary and auth buttons are `48px`.
- Do not use color as the only error, success, or status cue.
- Decorative orbital rings are `aria-hidden` and non-interactive.
- Entrance motion is a 420 ms fade and 12 px rise. No looping animation. Always respect
  `prefers-reduced-motion`, which the global stylesheet handles.
- Check key text against its surface using the token pairs. Accent text is for accents and
  links, not long paragraphs.

## Adding or changing UI

1. Reuse `AppShell`, `AuthShell`, `BrandMark`, the board components, and the tokenized
   classes before building anything new.
2. If a new component is genuinely reusable, add it under `src/components` and style it with
   the existing tokens. Avoid page-specific copies of the same pattern.
3. Use Vuetify 4 components and MDI icon names. Keep the global defaults in
   `src/plugins/vuetify.ts`; override only the component internals that need Orbital
   treatment in `src/styles/orbital.css`.
4. Run `npm run format:check`, `npm run lint`, `npm run typecheck`, `npm test`, and
   `npm run build`.
5. Inspect the page in light and dark mode at desktop and phone widths.
6. If the behavior or design rules change, update this file and `AGENTS.md`.

## Do not

- Do not introduce another direction's palette, typography, radius, or motif.
- Do not use arbitrary hex values, box shadows, gradients, or fonts in a view.
- Do not add heavy illustration, glassmorphism, neon glow, or dense telemetry.
- Do not restyle Vuetify into a different system; extend the Orbital tokens.
- Do not add UI that is not part of the TeamBuilder hiring workspace without a product
  decision.
