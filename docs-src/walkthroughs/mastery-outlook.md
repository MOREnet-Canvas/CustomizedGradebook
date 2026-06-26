# Mastery Outlook

**URL:** `/courses/:id/pages/mastery-outlook`
**Audience:** Teachers, TAs, admins
**Entry point:** `src/masteryOutlook/masteryOutlookInit.js`

---

## Purpose

Mastery Outlook is a teacher-facing analytics and grade sync tool. It replaces Canvas's built-in outcome scoring methods (decaying average, highest, latest) with Marzano's Power Law regression, then lets teachers push those predictions back to Canvas as assignment grades.

---

## First-time setup

1. Navigate to **Course Settings** (`/courses/:id/settings`)
2. A **"Create Mastery Outlook"** button appears in the right sidebar (injected by `sidebarLinkInjection.js`)
3. Click it — the module creates the wiki page with `<div id="mastery-outlook-root">` and sets it up for the extension
4. A link to the Mastery Outlook page is injected into the sidebar for future access

---

## Teacher workflow

### Step 1 — Refresh Data

Click **Refresh Data** to pull current scores from Canvas and recompute predictions.

The refresh flow (`masteryOutlookDataService.js`):

1. Fetch all outcome rollups for the course
2. Fetch all rubric criteria scores per student per outcome
3. Sort attempts chronologically (oldest first)
4. Run `computeStudentOutcome(scores)` for each student × outcome combination
5. Run `computeClassStats(studentResults, threshold)` for each outcome
6. Write the full cache JSON to Canvas Files (`masteryOutlookCacheService.js`)

Progress is shown in the dashboard header during refresh.

### Step 2 — Review the outcome dashboard

Each outcome row shows:

| Column | Source |
|--------|--------|
| Class average prediction | `classStats.plAvg` |
| Distribution (1–2–3–4) | `classStats.distribution` |
| Students below threshold | `classStats.belowThresholdCount` |
| Learning direction | `classStats.avgSlope` (positive = class improving) |
| NE count | `classStats.neCount` |

Click an outcome row to expand it and see the **All Students** tab.

### Step 3 — Adjust the re-teach threshold (optional)

The threshold slider controls the "below threshold" count. Stored in `localStorage` per teacher per course (`cg_threshold_{courseId}_{userId}`). Default: `2.2`.

### Step 4 — Review individual student rows

Each student row in the expanded table shows:

| Column | Description |
|--------|-------------|
| Student | Name (resolved from roster at render time) |
| Alignments | Score dots for each rubric attempt (color-coded) |
| Canvas | Current Canvas rollup score |
| Marzano | `roundToHalf(plPrediction)` — the regression output |
| Override | Teacher-set value (`will_post`), or auto-tracks Marzano |
| Note | `will_post_note` — shown as submission comment on push |
| Save | Sync status button |

**Sync status values:**

| Badge | Meaning |
|-------|---------|
| NE | Fewer than 3 scored attempts |
| ⬆ Needs sync | Score mismatch or never synced |
| ✓ Synced | Canvas score matches Override AND no pending note |
| ⚑ Override | Teacher has manually locked an override |
| ⚑ Override? | Canvas score changed after last push (possible manual edit) |
| ✗ Verify failed | Score was pushed but Canvas rollup didn't confirm |

### Step 5 — Push scores to Canvas

- **Per-row save button** — pushes one student's Override score to Canvas
- **"Save grades to Canvas" banner button** — pushes all students in this outcome who need syncing

The push runs through `PLOutlookStateMachine` (see [State Machine](../state-machine.md)):

```
IDLE → CHECKING → CALCULATING_CHANGES → PUSHING → VERIFYING → COMPLETE
```

After a successful push, `updateAvgAssignmentForStudents()` updates the "Current Score" assignment for affected students.

---

## Score override controls

| Control | Action |
|---------|--------|
| Canvas pill | Copy Canvas score to Override |
| Marzano pill | Revert Override to auto-track Marzano |
| Override box click | Open inline text input for a custom value |
| 🔒 Lock | Lock Override to prevent it from changing when the prediction updates |
| 🔓 Unlock | Restore auto-tracking |
| Note input | Type a teacher note; shown as submission comment on next push |
| × button | Clear the note |
| ↻ per-student | Refresh this student's scores from Canvas |
| ↻ per-outcome | Re-pull live rollups for this outcome |

---

## Heatmap view

An alternate view that shows all students × outcomes as a color-coded grid. Toggle between the dashboard view and the heatmap using the view switcher in the toolbar.

Entry point: `masteryOutlookHeatmap.js` / `heatmapView.js`

---

## Sync state persistence

Changes to `will_post`, `will_post_lock`, and `will_post_note` are written back to Canvas Files (the shared cache) via a debounced write scheduler (`plOutlookActions.js`). This means override values survive page reloads and are visible to other teachers viewing the same course.

---

## Developer notes

- **Cache schema**: See [Data Layer](../data-layer.md) for the full `sync_state` and `pl_assignments` field documentation
- **Sync state machine**: See [State Machine](../state-machine.md) for state transition details
- **Grade push primitives**: See [Sync Modules](../sync-modules.md) for `submitRubricAssessment` and `submitRubricAssessmentBatch`
- **Power Law math**: See [Power Law](../power-law.md)
