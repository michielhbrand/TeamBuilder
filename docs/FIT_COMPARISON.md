# CV fit comparison

Status: first iteration. This document records the shipped behavior and the known gaps so the
feature can be hardened without rediscovering them.

## What it does

The board page shows a collapsible **CV fit comparison** band between the page header and the
stage columns. It compares every active applicant on the board using the analyses the fit store
already loaded.

- Three bars per applicant: **Minimum**, **Recommended**, **Skills**.
- A bar is a met-share: `(full + 0.5 × partial) / total`, on a shared 0–100% axis.
- Group chips hide a group and remove it from the total and ordering.
- **Weighted** uses the board's saved percentages; **Unweighted** uses an equal mean across the
  selected groups that have requirements.
- Ordering is two-tier: no missed minimum first, then total descending, then the existing
  lexicographic fit key, then name.
- Clicking a candidate opens the applicant drawer. Hovering a bar shows counts and the share.
- The chart scrolls horizontally with a visible scrollbar and has an `sr-only` data table.

## Formula

For each group with at least one requirement:

```text
metShare = (full + 0.5 * partial) / total
```

For the selected groups that have requirements:

```text
weightedTotal   = sum(storedWeight / sum(storedWeights) * metShare) * 100
unweightedTotal = mean(metShare) * 100
tier            = minimum.none > 0 ? 1 : 0
```

Groups with no requirements are dropped and the remaining weights are renormalized. If every
selected group has a zero weight, the total falls back to equal weights. If no selected group has
requirements, the applicant has no comparison value.

## Persistence

- `public.boards.fit_weights` is a jsonb object `{ minimum, recommended, skills }` of percentages
  that must total 100. The default is `50 / 30 / 20`.
- It is shared by the whole workspace, saved pessimistically through the boards store, and
  updated under the existing authenticated board update policy.
- `parseFitWeights` falls back to the defaults when a row is missing or invalid.

## Known gaps, inconsistencies, and shortcomings

### Ranking semantics

- **The chart order can differ from the stage order.** Stage columns and cards stay
  lexicographic and minimum-first; the comparison uses a weighted total. There is no side-by-side
  rank indicator, so a user may see a different order in two places. This is intentional for the
  first iteration but is the main product tension.
- **Only a full minimum miss trips the gate.** A partial minimum does not. Within tier 0, a
  candidate with several partial minimums can rank below one with fewer if recommended or skills
  compensate. This follows the current `none`-based gate but may surprise users who read
  "minimum" as strictly binary.
- **Met-share normalizes by group size.** A group with one requirement is worth 0% or 100%, so a
  single requirement can dominate a weighted total if its weight is high. There is no minimum
  group size, confidence, or sample-size guard.
- **Partial is fixed at half.** The 0.5 factor is not configurable per board or per requirement.
- **Unweighted is an equal mean of groups, not raw counts or equal-per-requirement.** A group
  with many requirements does not get more influence than a group with one.
- **Deselecting the Minimum bar does not disable the minimum gate.** The gate still uses
  `summary.minimum.none`, even though the bar is hidden. This is deliberate but can look
  inconsistent.
- **Displayed percentages are rounded.** Ordering uses the exact values, so two candidates can
  show the same percentage but not be tied.

### Data freshness and scope

- **Stale analyses are included without warning.** If the CV, job spec, or profile changed after
  an analysis, the comparison still uses the stored result. The drawer shows a stale warning, but
  the comparison band does not.
- **Incomplete and unanalyzed applicants are excluded.** The band only reports a count; it does
  not list who is missing or why.
- **All active applicants are compared across stages.** Requirements are board-wide, but the
  stage context may differ. Closed applicants are excluded, so the comparison is not a full
  history.
- **Requirement wording changes are not surfaced.** Weights and analyses are tied to the board,
  not to a requirement-set version; a job-spec change can leave old analyses in the chart.

### Weights and persistence

- **Weights are shared per board, not per user.** One recruiter's change affects everyone.
- **There is no audit trail for weight changes.** The board `updated_at` changes, but no
  `applicant_events` entry is written.
- **Last write wins.** A focus/visibility refresh during a save can overwrite local weights with
  the remote value; there is no version check or conflict message.
- **Malformed stored weights silently fall back to defaults.** A bad row is not surfaced as an
  error.
- **The migration must land before the new select runs.** `BOARD_SELECT` now requests
  `fit_weights`; a local or manual deploy that runs the new bundle against an unmigrated database
  will fail board reads. The GitHub workflows push migrations first, but local development needs
  a reset.
- **No presets, templates, or copy-from-board.** Reset only restores 50 / 30 / 20, and only takes
  effect after Save.
- **The dialog previews a valid draft, not an invalid one.** While the inputs do not total 100,
  the chart keeps the last saved weights; this avoids nonsense values but means the preview is
  not literal.

### UI and interaction

- **The band is collapsed by default.** It is discoverable but easy to miss; expanded state,
  mode, and group selection are not persisted across navigation or board changes.
- **Many candidates require horizontal scrolling.** Names are truncated, and there is no search,
  stage grouping, zoom, or virtualization.
- **Per-bar labels show `full/total`, not partial counts.** Partial detail is only in the
  tooltip and the hidden table.
- **Colors are group-coded, not status-coded.** Minimum uses ink, Recommended accent, and Skills
  `line-input`. The legend and counts carry the meaning, but there is no pattern or shape cue for
  colorblind users, and both themes need visual review.
- **Zero-requirement selected groups draw a 2px placeholder.** It can read like a zero score
  rather than "this group has no requirements".
- **Tooltips are pointer-only.** Keyboard users rely on the cluster label and the hidden table;
  there is no focus-triggered tooltip.
- **The phone `aria-controls` target may not exist while the sheet is closed.** The dialog content
  is lazy-mounted.
- **No export or sharing.** The comparison is not part of the Excel export and cannot be copied
  as an image or link.

### Testing and operations

- **Only the pure logic is unit-tested.** There are no component tests for the panel, chart,
  weight dialog, or phone sheet, and no end-to-end or visual regression tests.
- **No migration test or seed coverage.** Staging seeds do not exercise weights, and the
  `fit_weights` check constraint is only covered by the migration itself.
- **No realtime updates.** Other users see weight changes on the next focus/visibility refresh.
- **`Board.fitWeights` is optional in the type.** API mapping always sets it, but the optional
  shape allows fixtures and old callers to omit it; components fall back to defaults silently.

## Suggested hardening order

1. Surface stale and excluded analyses in the comparison band, with names and a reason.
2. Add a compact rank comparison (stage rank vs comparison rank) so the two orders are explicit.
3. Decide whether partial minimums should gate, and document the decision.
4. Add weight-change auditing and conflict handling, or move weights to a per-user preference.
5. Add component tests for the panel, chart, weight validation, and phone sheet.
6. Add an explicit migration/rollout note for local development and staging.
7. Revisit the color/pattern encoding and both themes with an accessibility pass.
