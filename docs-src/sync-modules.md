# Sync Modules

`src/services/graphqlGradingService.js` · `src/masteryOutlook/plOutlookSyncStatus.js` · `src/masteryOutlook/studentSyncTable.js`

---

## Overview

Three modules implement the sync-facing surface of the Mastery Outlook:

- **`graphqlGradingService`** — pushes rubric assessments to Canvas via GraphQL. Used by every score-write path in the extension.
- **`plOutlookSyncStatus`** — derives the per-student-per-outcome sync badge and aggregates counts. The single source of truth for what "synced" means.
- **`studentSyncTable`** — renders and wires the "All Students" tab inside an expanded outcome row. Owns all the pill-click, Will Post, lock/unlock, note, and save interactions.

---

## `graphqlGradingService.js`

### `submitRubricAssessment(params, apiClient)` → `Promise<{ customGradeStatusId }>`

Sends a single GraphQL mutation to Canvas that can include up to 5 sub-mutations in one request, determined by which parameters are provided.

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `submissionId` | `string` | Yes | Canvas submission ID |
| `rubricAssociationId` | `string` | Yes | Rubric association ID |
| `rubricCriterionId` | `string` | Yes | Rubric criterion ID |
| `points` | `number` | Yes | Score to set on the criterion |
| `clearPoints` | `boolean` | No | If `true`, omits points entirely (Canvas rejects `null` with 422) |
| `enrollmentId` | `string` | No | When provided, triggers `setOverrideScore` + `setOverrideStatus` mutations |
| `overrideScore` | `number \| null` | No | Enrollment-level grade override; `null` clears it |
| `overrideStatusId` | `string \| null` | No | Enrollment-level custom status; `undefined` = leave unchanged |
| `customStatusId` | `string \| null` | No | Submission-level custom status; `undefined` = leave unchanged |
| `comment` | `string` | No | Submission comment text; omit or pass `""` to skip |
| `apiClient` | `CanvasApiClient` | Yes | |

The five sub-mutations (included conditionally):

| Mutation | Condition |
|----------|-----------|
| `saveRubricAssessment` | Always |
| `setOverrideScore` | `enrollmentId` is provided |
| `setOverrideStatus` | `enrollmentId` AND `overrideStatusId` are provided |
| `updateSubmissionGradeStatus` | `customStatusId` is provided |
| `createSubmissionComment` | `comment` is provided and non-empty |

**Returns** `{ customGradeStatusId }` — the submission's new custom grade status ID, or `null` if no status mutation was included.

**Throws** if the GraphQL request fails or Canvas returns rubric-level errors in `data.rubric.errors`.

> **Gotcha — `clearPoints: true`** — Passing `points: null` in the rubric criterion data causes a 422. When you want to clear a score, set `clearPoints: true` instead, which omits `points` from the criterion object entirely.

---

### `submitRubricAssessmentBatch(students, apiClient, options)` → `Promise<BatchResult>`

Batches `submitRubricAssessment` calls with concurrency control, per-attempt retry, and a sequential second pass for persistent failures.

```js
const { successCount, errors, retryCounts } = await submitRubricAssessmentBatch(
  studentsArray,
  apiClient,
  { concurrency: 5, maxAttempts: 3, retryDelayMs: 500, onProgress: (done, total) => {} }
);
```

| Option | Default | Description |
|--------|---------|-------------|
| `concurrency` | `5` | Max simultaneous requests per chunk |
| `maxAttempts` | `3` | Max retry attempts per student per pass |
| `retryDelayMs` | `500` | ms between retry attempts |
| `onProgress` | `null` | `(successCount, total) => void` |

**Two-pass strategy:**

1. **First pass** — students processed in chunks of `concurrency`. Each student gets up to `maxAttempts` tries with `retryDelayMs` between attempts. Students that exhaust all attempts are deferred.
2. **Second pass** — all first-pass failures are retried **sequentially**, again up to `maxAttempts`. Students still failing become permanent errors.

| Return field | Type | Description |
|-------------|------|-------------|
| `successCount` | `number` | Total successful pushes across both passes |
| `errors` | `Array<{index, submissionId, userId, average, error}>` | Permanent failures |
| `retryCounts` | `Array<{userId, attempts}>` | Students that required >1 attempt |

> **Gotcha** — `students` must include a `userId` field for error reporting (not required by Canvas GraphQL but used in the return value). The `score` or `points` field is used as `average` in the error object.

---

## `plOutlookSyncStatus.js`

### `scoresMatch(a, b)` → `boolean`

Compares two scores as equal when they round to the same two-decimal value. Prevents false "needs sync" alerts from floating-point drift.

```js
scoresMatch(2.50000001, 2.5)  // → true
scoresMatch(null, 2.5)        // → false
```

Uses `Math.round(x * 100) === Math.round(y * 100)`.

---

### `getSyncStatus(studentId, outcomeId, plPrediction, canvasScore, plConfig)` → `StatusObject`

The **single source of truth** for the sync status badge. Returns one of six statuses in priority order (first match wins):

| Priority | Status | Label | CSS class | Condition |
|----------|--------|-------|-----------|-----------|
| 1 | `ne` | `NE` | `sb-ne` | `plPrediction` is null/undefined |
| 2 | `not_setup` | `Setup needed` | `sb-ne` | No `pl_assignments` entry for this outcome |
| 3 | `manual_override` | `⚑ Override` | `sb-override` | `sync_state[outcomeId][studentId].manual_override === true` |
| 4 | `possible_override` | `⚑ Override?` | `sb-override-q` | Canvas score changed after last PL push (`canvasScore ≠ lastSyncedScore`) |
| 5 | `needs_sync` | `↑ Needs sync` | `sb-needs` | Score mismatch or never synced |
| 6 | `synced` | `✓ Synced` | `sb-synced` | All checks passed |

`plConfig` shape: `{ pl_assignments: { [outcomeId]: { assignment_id, … } }, sync_state: { [outcomeId]: { [studentId]: { … } } } }`

Status objects may include extra fields: `canvasScore`, `plPrediction`, `lastSyncedScore`, `overrideNote`.

**`needs_sync` target score** — uses `will_post` if set, otherwise `roundToHalf(plPrediction)`. A teacher typing in a custom value changes what "synced" means for that student.

---

### `aggregateSyncStatus(students, outcomeId, plConfig)` → `Counts`

Runs `getSyncStatus` for every student in `cache.students` and returns a counts object.

```js
{
  total: 24,
  synced: 18,
  needsSync: 4,
  possibleOverride: 1,
  manualOverride: 1,
  ne: 0,
  notSetup: 0,
}
```

Used by `checkSyncNeeded()` in `plOutlookSync.js` and the sync summary chip in `masteryOutlookView.js`.

---

## `studentSyncTable.js`

### Purpose

Renders and wires the per-outcome student table shown in the expanded "All Students" tab. Carved out of `masteryOutlookView.js` to let the table evolve independently.

### `renderOutcomeStudentTable(outcome, cache)` → `string`

Returns the full HTML string for the student table, including the toolbar banner and the `<table>` body. Pure render — no DOM writes, no side effects.

Columns rendered:

| Column | Data source |
|--------|------------|
| Student | `student.name` or `student.sortableName` |
| Alignments | Per-attempt score dots (colour-coded by `scoreTone`) |
| Canvas | `outcomeData.canvasScore` |
| Marzano | `roundToHalf(outcomeData.plPrediction)` |
| Override | `syncEntry.will_post` or rounded Marzano |
| Note | `syncEntry.will_post_note` |
| Save | Per-row sync/refresh button |

Rows are sorted alphabetically by `sortableName`.

The toolbar banner shows one of three states:
- **OK** (`✓ Canvas gradebook is up to date`) — zero students with `needs` status
- **Warn** (`⬆ N students need updating`) — non-zero needs count, not actively syncing
- **Syncing** (spinner + disabled save button) — `syncingOutcomeIds` contains this outcome

---

### `wireOutcomeStudentTable(options)` → `teardown: Function`

Attaches all event listeners to `contentEl` (the `.od-detail-content` element). Returns a no-op teardown function (reserved for future cleanup of the document-level dot-popover listener).

| Option | Type | Required | Description |
|--------|------|----------|-------------|
| `contentEl` | `HTMLElement` | Yes | The `.od-detail-content` node |
| `outcome` | `Object` | Yes | Outcome object from cache |
| `cache` | `Object` | Yes | In-memory mastery outlook cache |
| `courseId` | `string` | Yes | |
| `apiClient` | `CanvasApiClient` | Yes | |
| `renderTable` | `Function` | Yes | Re-render callback — wired as `onRerender` on every action |
| `onRefreshOutcome` | `Function` | No | Re-pulls live rollups for this outcome |
| `onChipUpdate` | `Function` | No | Refreshes the outcome-level chip/strip after sync |

**Actions handled** (via `data-action` on elements):

| `data-action` | Handler called | Description |
|---------------|---------------|-------------|
| `dot-ignore-toggle` | `handleIgnoreAlignment` / `handleUnignoreAlignment` | Toggle an alignment's ignored state |
| `os-use-canvas` | `handleCanvasPillClick` | Set Will Post = Canvas score |
| `os-use-marzano` | `handleMarzanoPillClick` | Revert Will Post to auto-track Marzano |
| `os-wp-click` | Inline input replacement | Show editable `<input>` over the Override box |
| `os-lock` | `handleLockWillPost` | Lock the Will Post value |
| `os-unlock` | `handleUnlockWillPost` | Unlock the Will Post value |
| `os-save` | `handleSyncStudents` (single student) | Push one student's score to Canvas |
| `os-post-all` | `handleSyncStudents` (all students) | Push all students in this outcome |
| `os-refresh-student` | `refreshStudentOutcomeData` | Re-fetch attempts + canvas score for one student |
| `os-refresh-outcome` | `onRefreshOutcome` callback | Re-fetch live rollups for the outcome |
| `os-note` | `handleNoteChanged` (on `input` event) | Live-update `will_post_note` |
| `os-note-clear` | `handleNoteChanged` (empty string) | Clear the note |

### `buildOutcomeStudentRow` (internal) — row status logic

| Row status | Condition |
|------------|-----------|
| `ne` | `plPrediction === null` |
| `synced` | `scoresMatch(willPost ?? marzano, canvas)` AND no pending note |
| `verify_failed` | `syncEntry.verify_mismatch === true` |
| `needs` | Catch-all |

A pending note (`will_post_note !== will_post_note_last_submitted`) prevents `synced` even when scores match — the row stays highlighted until the note is submitted to Canvas.

### `buildPlAssignmentIds` (internal)

Builds a `Set<string>` of `"assignment_<id>"` strings from `cache.pl_assignments`. Used to filter PL override assignments out of the attempts dots so they don't appear as alignment data points.

---

## Gotchas

- **`clearPoints: true` vs `points: null`** — Canvas returns 422 if you pass `null` in the criterion data. Use the `clearPoints` flag in `submitRubricAssessment` when you need to clear a score.
- **`getSyncStatus` is stateless** — it reads from `plConfig` (cache fields) only. Callers must pass an up-to-date `plConfig` after any mutation or the badge will be stale.
- **`possible_override` requires both `lastSyncedScore` and `canvasScore` to be non-null** — if either is missing (e.g. student never synced, or no Canvas rollup), the status falls through to `needs_sync`.
- **Inline edit in `wireOutcomeStudentTable`** — the Override box click replaces the `<div class="os-wp-box">` node with an `<input>` directly in the DOM. If `renderTable()` fires before `blur`, the input disappears without committing. The `Escape` key deliberately triggers this to cancel edits.
- **`fetchingStudentIds` guard** — the `os-refresh-student` handler checks `fetchingStudentIds.has(key)` before starting a fetch. This global `Set` (from `masteryOutlookState.js`) prevents double-fetches if the refresh button is clicked quickly.
