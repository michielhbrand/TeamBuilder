# Orbital design system

## Status

Direction A / **Orbital** is the locked visual system for TeamBuilder. The product owner selected
it on 2026-11-04 from the five options in `design/ui-directions.html`. Orbital is the only
canonical direction; the other four remain historical exploration and must not be mixed into
new work.

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

| Concern             | File                                       |
| ------------------- | ------------------------------------------ |
| CSS tokens          | `src/styles/orbital.css`                   |
| Vuetify themes      | `src/plugins/vuetify.ts`                   |
| Fonts               | `src/main.ts` and `package.json`           |
| Brand lockup        | `src/components/BrandMark.vue`             |
| Auth page shell     | `src/components/AuthShell.vue`             |
| App page shell      | `src/components/AppShell.vue`              |
| Board list          | `src/components/BoardList.vue`             |
| Board switcher      | `src/components/BoardSwitcher.vue`         |
| Board column        | `src/components/BoardColumn.vue`           |
| Candidate card      | `src/components/CandidateCard.vue`         |
| Applicant drawer    | `src/components/ApplicantDrawer.vue`       |
| Job spec dialog     | `src/components/JobSpecDialog.vue`         |
| Confirmation dialog | `src/components/ConfirmDialog.vue`         |
| Progress bar        | `src/components/PipelineBar.vue`           |
| Workload chart      | `src/components/DepartmentLoadChart.vue`   |
| Outcome chart       | `src/components/OutcomeDonut.vue`          |
| Role table          | `src/components/RolePerformanceTable.vue`  |
| Applicant lists     | `src/components/ApplicantWatchList.vue`    |
| Theme toggle        | `src/components/ThemeToggle.vue`           |
| Visual exploration  | `design/ui-directions.html`                |
| Board concept       | `design/hiring-pipeline-step-columns.html` |

The prototype is a reference, not an application dependency. Production styling lives in the
files above. Change the tokens there first; do not copy one-off hex values into views.

## Color tokens

Role names are stable. Use the CSS variable rather than the hex value in components.

| Role        | CSS variable            | Light     | Dark                     | Use                                     |
| ----------- | ----------------------- | --------- | ------------------------ | --------------------------------------- |
| Canvas      | `--orbital-canvas`      | `#F5F7FA` | `#07111F`                | Page background                         |
| Surface     | `--orbital-surface`     | `#FFFFFF` | `#0B1728`                | Cards, panels, fields                   |
| Surface 2   | `--orbital-surface-2`   | `#EEF2F7` | `#101F34`                | Notes, readouts, inset bands            |
| Ink         | `--orbital-ink`         | `#0A1B2E` | `#EAF1FA`                | Primary text and strong values          |
| Muted       | `--orbital-muted`       | `#58687A` | `#91A3B7`                | Secondary text, labels, metadata        |
| Line        | `--orbital-line`        | `#D9E1EA` | `#1E3148`                | Hairline borders and dividers           |
| Accent      | `--orbital-accent`      | `#1D4ED8` | `#60A5FA`                | Primary action, focus, orbital ring     |
| Accent text | `--orbital-accent-text` | `#1D4ED8` | `#93C5FD`                | Accent text and links on surfaces       |
| Accent ink  | `--orbital-accent-ink`  | `#FFFFFF` | `#06111F`                | Text and icons on accent                |
| Accent soft | `--orbital-accent-soft` | `#E6ECFF` | `rgba(96,165,250,0.16)`  | Focus rings, selected and badge fills   |
| Signal      | `--orbital-signal`      | `#0E8F7E` | `#2DD4BF`                | Success, active session, healthy status |
| Signal soft | `--orbital-signal-soft` | `#E0F5F1` | `rgba(45,212,191,0.13)`  | Signal badge fills and status halo      |
| Danger      | `--orbital-danger`      | `#B42318` | `#FDA4AF`                | Errors and destructive text             |
| Danger soft | `--orbital-danger-soft` | `#FEECE9` | `rgba(253,164,175,0.12)` | Error fills                             |
| Shadow      | `--orbital-shadow`      | soft navy | deep black               | Auth and app panels                     |
| Shadow soft | `--orbital-shadow-soft` | 2 px navy | 2 px black               | Stat cards and quiet surfaces           |

Exact shadows:

```css
/* light */
--orbital-shadow: 0 1px 2px rgba(10, 27, 46, 0.04), 0 18px 50px rgba(10, 27, 46, 0.08);
--orbital-shadow-soft: 0 1px 2px rgba(10, 27, 46, 0.04);

/* dark */
--orbital-shadow: 0 1px 2px rgba(0, 0, 0, 0.18), 0 24px 60px rgba(0, 0, 0, 0.4);
--orbital-shadow-soft: 0 1px 2px rgba(0, 0, 0, 0.18);
```

Do not introduce purple, teal-mint, orange, serif display type, grid-paper backgrounds,
planets, glows, or gradients. Those belong to the other directions.

## Typography

- Display and body: `Manrope` via `@fontsource-variable/manrope` as `Manrope Variable`.
- Metadata, labels, indices, and code-like values: `IBM Plex Mono` at 400/500.
- Fallbacks are system sans and monospace. Do not load Google Fonts at runtime.

| Role        | Family        | Size                            | Weight  | Tracking     | Line height |
| ----------- | ------------- | ------------------------------- | ------- | ------------ | ----------- |
| Page title  | Manrope       | `clamp(2.6rem, 5-6vw, 4.75rem)` | 700     | `-0.055em`   | 0.98-1.05   |
| Panel title | Manrope       | `1.15rem`                       | 700     | `-0.035em`   | 1.2         |
| Stat value  | Manrope       | `1.55rem`                       | 700     | `-0.045em`   | 1.05        |
| Body        | Manrope       | `1rem`                          | 400     | normal       | 1.7         |
| Small body  | Manrope       | `0.75-0.88rem`                  | 400-600 | normal       | 1.5-1.6     |
| Eyebrow     | IBM Plex Mono | `0.66rem`                       | 500     | `0.12em`     | 1.5         |
| Meta label  | IBM Plex Mono | `0.62-0.68rem`                  | 500     | `0.08-0.1em` | 1.4-1.5     |
| Field label | IBM Plex Mono | `0.68rem`                       | 500     | `0.09em`     | 1.4         |
| Field value | Manrope       | `0.94rem`                       | 400     | normal       | 1.45        |

Rules:

- Eyebrows, labels, badges, and table-like metadata are uppercase.
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
- Top bar: `88px` desktop, `76px` tablet.
- Page padding: `64px 0 72px` for auth pages; `clamp(40px, 6vw, 72px) 0 80px` for protected
  app pages.

## Orbital motif

The motif is one thin off-canvas circle, not a decorative illustration system.

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

Use `AuthShell` for `/` and `/set-password`.

```vue
<AuthShell eyebrow="Secure access" title="Welcome back." subtitle="...">
  <div class="panel-head">...</div>
  <v-form class="auth-form">...</v-form>
  <div class="auth-note">...</div>
</AuthShell>
```

- Desktop: two columns, editorial intro on the left and a `460px` auth panel on the right.
- The intro contains an eyebrow, page title, one short paragraph, and a three-cell readout.
- At `720px` and below the readout is hidden so the form stays close to the top; the
  eyebrow, title, and paragraph remain. The layout becomes one column with the intro first.
- Every auth page uses `BrandMark`, the `Secure access` status badge, and the `ThemeToggle`
  from the shell.
- Auth forms use a panel heading, the fields, one primary full-width submit button, and one
  quiet note. Do not add social login, tabs, or extra actions without a product decision.

### Protected pages

Use `AppShell` for `/overview`, `/boards`, `/boards/:boardId`, and `/account`.

- `app-topbar` with `BrandMark context="Recruitment platform"`, the Overview / Boards /
  Account navigation, `ThemeToggle`, and the avatar account menu.
- Eyebrow plus display title, one paragraph, and the page-level action.
- The Overview page is a hiring dashboard. It has a department filter row, a four-card stat
  row, a department workload chart, an outcome donut, a sortable role performance table, a
  deadline watch list, and newest / longest-in-step applicant lists. Chart bars and table
  rows drill into a department, board, or applicant. Dashboard grids become one column at
  `1024px`; filter chips and applicant lists stack at `720px`; tables scroll horizontally on
  small screens.
- The Account page keeps the existing three-card stat row and two-column identity/status
  body. A second grid adds full-name editing and password reset panels using the same
  `.data-panel` shell and `.account-form` spacing.
- At `920px` the top bar wraps: brand and actions on the first row, navigation on its own
  row. Do not collapse the navigation into a hidden menu without a product decision.
- At `720px` stat grids stack and the account aside stacks.

### Boards

Adapt the structure of `design/hiring-pipeline-step-columns.html` to Orbital. Do not copy
that prototype's palette, gradients, or Bricolage/Hanken fonts.

- `/boards` uses a search field, All roles / Past deadline filter chips, department
  headings, and a responsive grid of board cards. Each card shows the role, open positions,
  active candidates, deadline, and a pipeline bar.
- `/boards/:boardId` gives the step-column pipeline the full content width. A compact
  board-switcher button in the page header opens a searchable, department-grouped menu for
  changing roles. At `1024px` the header stacks and the switcher spans the available width.
  Edit, Columns, Job spec, and Add applicant are equal-sized icon-only buttons. The Job spec
  button opens the upload state when the board has no PDF and the preview state when it does.
- Step columns are a horizontal grid with a numbered step header, candidate count, and
  candidate cards. Columns use the surface-2 fill and hairline dividers. There are no
  per-step target days.
- Candidate cards use a 12 px radius, a token-only initials avatar, current role, time in
  step, a favourite star in the top-right corner, and persistent Hire and Reject actions.
  Chevron-left and chevron-right buttons beside the Hire and Reject actions move the
  candidate one column without opening the profile.
- Clicking a candidate card opens a right-side applicant drawer at roughly half the viewport
  width. It uses the surface, hairline, and field tokens, with an editable basic-information
  form, a star favourite toggle, separate auto-growing textareas for career and work
  experience, and a single PDF CV document. The drawer becomes full width at `720px`.
- Candidate cards can be dragged one step left or right. While a card is held, only the
  adjacent columns highlight with the accent token and accept the drop. The card in flight
  keeps full opacity and uses an accent border ring. Cards in the first and final steps can
  still move in the available direction.
- Boards past their deadline use the danger token on the card label and in overview
  attention rows. Never rely on color alone; the copy says "Past deadline".
- The closed-candidates disclosure uses two columns for hired and rejected, with a reopen
  action. It stacks at `720px`. Hiring or rejecting a candidate removes the card from the
  step columns and adds the name to the matching closed column.
- Keyboard support mirrors the concept: `/` focuses board search. The applicant drawer CV
  preview and the job spec preview support open in a new tab, print, and remove controls.

## Components

### Data visualization

- Build dashboard charts with small, local SVG/CSS components. Do not add a chart library
  without a product decision.
- Use the Orbital tokens for chart fills. Accent is active work, signal is a positive outcome,
  muted is closed or inactive, and danger is reserved for overdue deadlines and errors.
- Show visible labels and values; color must never be the only cue. Give charts an
  `aria-label`, text summaries, and readable legends.
- Keep charts static. No gradients, looping animation, dense grids, or decorative telemetry.

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

- Height about `50px`; surface background; line outline; `8px` radius.
- Focus: accent outline plus a `3px` accent-soft ring.
- Labels are uppercase mono at `0.68rem`; values are Manrope at `0.94rem`.
- Icons are muted; the focused icon becomes accent text.
- Errors use the danger token. Never rely on color alone; keep the validation message.

### Alerts, badges, and notes

- Alerts are tonal, `8px` radius, and use the `orbital-alert` class. Use `error` for failures
  and `success` for completed actions.
- Badges are pill-shaped mono uppercase labels. Use `status-badge--signal` for active or
  healthy state, and the neutral badge for classification.
- A status dot is `6px`, current-color, with a soft halo.
- Notes use `.auth-note`: surface-2 fill, line border, 2 px accent left border, shield or
  lock icon, and small muted copy.

### Panels and data rows

- Use `.auth-panel`, `.data-panel`, and `.stat-card`; do not reimplement their borders,
  radius, or shadow.
- Panel header: mono label above a Manrope panel title; optional classification badge on the
  right.
- Identity/data rows are a three-column grid: mono index, label/value stack, optional MDI
  icon. Separate rows with hairlines; no zebra striping.
- Values wrap with `overflow-wrap: anywhere`; IDs and session timestamps use mono at
  `0.78rem`.

### Dialogs

- Board create/edit, column management, and applicant creation use `v-dialog` with
  `.orbital-dialog`: surface fill, line border, standard radius and shadow.
- Structure each dialog with `.orbital-dialog__head`, `.orbital-dialog__body`, and
  `.orbital-dialog__actions`. Headers pair an eyebrow with a panel title and a close button;
  actions align right with cancel/primary buttons.
- Use `.orbital-dialog__grid` for two-column field pairs; it collapses to one column at
  `720px`.
- Edit-board dialogs place a destructive text button on the left of the actions. Deleting a
  board opens `ConfirmDialog` because it also deletes its columns and applicants.
- The board form uses a department combobox seeded from departments that already have
  boards, while still allowing a new department name. Deadlines are entered and displayed as
  `dd/mm/yyyy`, with a live readout of calendar and working days remaining.
- `ColumnDialog` uses `.column-manage__row` for ordered name fields with move up, move down,
  and delete actions. Column names save automatically, and the first column cannot be moved
  or deleted.
- `JobSpecDialog` is a single adaptive dialog. Without a PDF it shows the `.job-spec-empty`
  upload state. With a PDF it expands to a document preview with open-in-new-tab, print, and
  remove actions; remove opens `ConfirmDialog`. The preview reuses the CV toolbar and iframe
  classes.
- `FullNameDialog` is a persistent one-field dialog shown from `AppShell` when a signed-in
  user has no `full_name`. It has no close action; the user must save a name before using the
  protected pages.

### Add applicant and CV import

- `ApplicantFormDialog` uses the shared `.orbital-dialog` shell and `.orbital-field`
  treatment. Above the fields, keep the `.applicant-import` quick-fill panel with an upload
  action, selected filename, progress line, and cancel action.
- Auto-filled fields receive `.orbital-field--autofilled`. The treatment uses the accent and
  accent-soft tokens. A manual edit removes the marker; do not use an icon, separate color,
  or badge.
- OCR progress must never block manual entry. Keep the form editable while recognition runs
  and allow submit; submitting cancels OCR and uses the current values.
- Keep copy direct: the CV fills what it can, and every field remains editable.

### Applicant drawer

- Use `ApplicantDrawer.vue` from `BoardView`; it is a temporary `v-navigation-drawer` on the
  right at `50vw` desktop.
- The header keeps the initials avatar, applicant name, current role metadata, a star
  favourite button (`mdi-star` / `mdi-star-outline` with `aria-pressed`), and a close button.
- Editable basic fields use the standard `orbital-field` treatment. Education and work
  experience each use one auto-growing `v-textarea` with the same field treatment rather
  than structured timeline items.
- Email is optional and must be valid when present. Phone is optional and accepts digits
  only. Invalid values show a field error and are not persisted.
- The drawer has two tabs below the header: **Details** for the editable profile and
  **Events** for the applicant audit trail. Tabs use the display font, sentence case, an
  accent underline, and the standard hairline divider. Events render newest first as a
  vertical timeline with an accent dot, the event message, and an uppercase mono timestamp.
  Show a quiet loading line or empty state when there are no events.
- The Details tab ends with a **Notes** section. A free-text field and **Add note** button
  append a note for the current user; notes render newest first with the author name and a
  mono timestamp. Keep notes inside the standard drawer section rhythm and show a quiet
  loading line or empty state when none exist.
- The drawer is backed by Postgres. The note at the end tells the user that changes save
  automatically, and a destructive text button opens `ConfirmDialog` before deleting the
  applicant.
- Each applicant can have one PDF CV stored in the private `cvs` Supabase Storage bucket.
  Upload is limited to PDF files up to `10 MB`; remove is available from the profile. The
  inline preview replaces the profile body with a back button, an open-in-new-tab button,
  and a print button. Deleting the applicant or its board removes the stored CV.
- Every PDF upload passes through the browser compressor in `src/lib/pdf.ts` before it
  reaches Supabase. It re-encodes embedded images, preserves selectable text, and never
  returns a larger file.

### Brand, avatar, and status

- `BrandMark` is the only application identity lockup. It combines the accent square, the
  `mdi-google-analytics` icon, `TeamBuilder`, and an uppercase mono context line. The browser
  favicon uses the same icon on an accent square.
- Use `Identity console` on auth pages and `Recruitment platform` on protected pages.
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
